import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
import {
  PREFECTURES,
  type EpidemicLevel,
  type Prefecture,
  LEVEL_NAMES,
} from "@/constants/data";
import { useStatusData } from "@/hooks/useStatusData";
import { DistrictModal } from "@/components/DistrictModal";
import type { District } from "@/constants/data";

// 都道府県の日本語名 → ID マッピング (GeoJSON nam_ja → prefId)
const PREF_NAME_TO_ID: Record<string, string> = {
  北海道: "hokkaido", 青森県: "aomori", 岩手県: "iwate", 宮城県: "miyagi",
  秋田県: "akita", 山形県: "yamagata", 福島県: "fukushima", 茨城県: "ibaraki",
  栃木県: "tochigi", 群馬県: "gunma", 埼玉県: "saitama", 千葉県: "chiba",
  東京都: "tokyo", 神奈川県: "kanagawa", 新潟県: "niigata", 富山県: "toyama",
  石川県: "ishikawa", 福井県: "fukui", 山梨県: "yamanashi", 長野県: "nagano",
  岐阜県: "gifu", 静岡県: "shizuoka", 愛知県: "aichi", 三重県: "mie",
  滋賀県: "shiga", 京都府: "kyoto", 大阪府: "osaka", 兵庫県: "hyogo",
  奈良県: "nara", 和歌山県: "wakayama", 鳥取県: "tottori", 島根県: "shimane",
  岡山県: "okayama", 広島県: "hiroshima", 山口県: "yamaguchi", 徳島県: "tokushima",
  香川県: "kagawa", 愛媛県: "ehime", 高知県: "kochi", 福岡県: "fukuoka",
  佐賀県: "saga", 長崎県: "nagasaki", 熊本県: "kumamoto", 大分県: "oita",
  宮崎県: "miyazaki", 鹿児島県: "kagoshima", 沖縄県: "okinawa",
};

// ---- HTML builder ----

function buildLevelMap(prefectures: Prefecture[]) {
  const map: Record<string, number> = {};
  for (const p of prefectures) {
    map[p.id] = p.level;
  }
  return map;
}

function buildMapHTML(
  levelMap: Record<string, number>,
  homePrefId: string | null,
): string {
  const levelColors = { 0: "#94a3b8", 1: "#eab308", 2: "#f97316", 3: "#ef4444" };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css"/>
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #f8fafc; }
    #map { width: 100%; height: 100%; }
    .leaflet-popup-content-wrapper {
      border-radius: 10px;
      font-family: -apple-system, "Hiragino Sans", sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,.15);
    }
    .leaflet-popup-content { margin: 10px 14px; }
    .ward-name { font-size: 14px; font-weight: 700; color: #0f172a; }
    .ward-level { font-size: 12px; color: #64748b; margin-top: 3px; }
    .ward-home { font-size: 11px; color: #2563eb; margin-top: 2px; font-weight: 600; }
    #loading {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      font-size: 13px; color: #64748b; z-index: 9999;
      font-family: -apple-system, "Hiragino Sans", sans-serif;
      text-align: center; line-height: 1.6;
    }
    .spinner {
      width: 32px; height: 32px; border: 3px solid #e2e8f0;
      border-top-color: #3b82f6; border-radius: 50%;
      animation: spin 0.8s linear infinite; margin: 0 auto 10px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #error-box {
      display: none; position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      text-align: center; color: #ef4444; z-index: 9999;
      font-family: -apple-system, "Hiragino Sans", sans-serif;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div id="loading"><div class="spinner"></div>地図を表示中...</div>
  <div id="error-box"></div>
  <div id="map"></div>
  <script>
    // 都道府県ID → level マップ (例: { tokyo: 0, osaka: 1, ... })
    var LEVELS = ${JSON.stringify(levelMap)};
    // 都道府県の日本語名 → ID マッピング (GeoJSON nam_ja → prefId)
    var NAME_TO_ID = ${JSON.stringify(PREF_NAME_TO_ID)};
    var HOME_PREF = ${JSON.stringify(homePrefId)};
    var COLORS = ${JSON.stringify(levelColors)};
    var LNAMES = { 0: '平穏', 1: '注意', 2: '警戒', 3: '流行' };

    function send(data) {
      var msg = JSON.stringify(data);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(msg);
      } else {
        window.parent.postMessage(msg, '*');
      }
    }

    function getPrefId(props) {
      // dataofjapan/land GeoJSON uses nam_ja
      return NAME_TO_ID[props['nam_ja']] || NAME_TO_ID[props['name']] || null;
    }
    function getPrefName(props) {
      return props['nam_ja'] || props['name'] || '';
    }
    function getLevel(prefId) {
      return prefId !== null && LEVELS[prefId] !== undefined ? LEVELS[prefId] : -1;
    }

    var map = L.map('map', {
      center: [36.5, 136.0],
      zoom: 5,
      zoomControl: true,
      attributionControl: false,
      minZoom: 4,
      maxZoom: 10,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19
    }).addTo(map);

    L.control.attribution({ position: 'bottomleft', prefix: '' })
      .addAttribution('© <a href="https://openstreetmap.org">OSM</a> © <a href="https://carto.com">CARTO</a>')
      .addTo(map);

    function processGeoJSON(data) {
      document.getElementById('loading').style.display = 'none';
      var features = data.features || [];
      if (features.length === 0) {
        send({ type: 'error', msg: 'no features' });
        return;
      }

      var layer = L.geoJSON({ type: 'FeatureCollection', features: features }, {
        style: function(f) {
          var prefId = getPrefId(f.properties);
          var lv = getLevel(prefId);
          var isHome = prefId !== null && prefId === HOME_PREF;
          return {
            fillColor: lv >= 0 ? COLORS[lv] : '#cbd5e1',
            fillOpacity: 0.6,
            color: isHome ? '#1d4ed8' : '#ffffff',
            weight: isHome ? 2.5 : 0.8,
          };
        },
        onEachFeature: function(f, lyr) {
          var prefId = getPrefId(f.properties);
          var name = getPrefName(f.properties);
          var lv = getLevel(prefId);
          var isHome = prefId !== null && prefId === HOME_PREF;

          lyr.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            send({ type: 'prefClick', id: prefId, name: name });
          });

          var homeLine = isHome ? '<div class="ward-home">★ 居住地</div>' : '';
          var lvLine = lv >= 0
            ? '<div class="ward-level" style="color:' + COLORS[lv] + ';font-weight:600">' + LNAMES[lv] + ' (Lv.' + lv + ')</div>'
            : '<div class="ward-level">データなし</div>';

          lyr.bindPopup(
            '<div class="ward-name">' + name + '</div>' + lvLine + homeLine,
            { closeButton: false, autoPan: false, offset: [0, -4] }
          );
          lyr.on('mouseover', function() {
            lyr.setStyle({ fillOpacity: 0.85 });
            lyr.openPopup();
          });
          lyr.on('mouseout', function() {
            layer.resetStyle(lyr);
            lyr.closePopup();
          });
        }
      }).addTo(map);

      map.fitBounds(layer.getBounds(), { padding: [10, 10] });
      send({ type: 'ready', count: features.length });
    }

    // Japan prefecture GeoJSON — fetched from CDN at runtime
    fetch('https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson')
      .then(function(r) { return r.json(); })
      .then(processGeoJSON)
      .catch(function(e) {
        document.getElementById('error-box').style.display = 'block';
        document.getElementById('error-box').textContent = '地図データ取得失敗: ' + e.message;
        send({ type: 'error', msg: String(e) });
      });
  </script>
</body>
</html>`;
}

// ---- Web-specific iframe component ----
// react-native-webview on web has message-passing issues; use a real iframe + blob URL instead.

type MessageHandler = (data: string) => void;

function LeafletMapWeb({
  html,
  onMessage,
  style,
}: {
  html: string;
  onMessage: MessageHandler;
  style?: object;
}) {
  const containerRef = useRef<View>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Get the underlying DOM element from the React Native Web View ref
    const el = containerRef.current as unknown as HTMLDivElement | null;
    if (!el) return;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.display = "block";

    const handleMsg = (e: MessageEvent) => {
      if (e.source === iframe.contentWindow) {
        onMessage(e.data as string);
      }
    };
    window.addEventListener("message", handleMsg);
    el.appendChild(iframe);

    cleanupRef.current = () => {
      window.removeEventListener("message", handleMsg);
      URL.revokeObjectURL(url);
      if (el.contains(iframe)) el.removeChild(iframe);
    };
    return () => cleanupRef.current?.();
  }, []); // only mount once; html is stable

  return <View ref={containerRef} style={[{ flex: 1 }, style]} />;
}

// ---- Shared Leaflet map (native + web) ----

function LeafletMap({
  html,
  onMessage,
  onError,
}: {
  html: string;
  onMessage: MessageHandler;
  onError?: () => void;
}) {
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  const handleMsg = useCallback(
    (raw: string) => {
      try {
        const data = JSON.parse(raw);
        if (data.type === "ready") setLoading(false);
        if (data.type === "error") { setLoading(false); onError?.(); }
        onMessage(raw);
      } catch {}
    },
    [onMessage, onError]
  );

  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1 }}>
        <LeafletMapWeb html={html} onMessage={handleMsg} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={{ flex: 1, backgroundColor: "transparent" }}
        onMessage={(e) => handleMsg(e.nativeEvent.data)}
        onError={() => { setLoading(false); onError?.(); }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        allowsInlineMediaPlayback
        mixedContentMode="always"
        originWhitelist={["*"]}
      />
      {loading && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.center,
            { backgroundColor: colors.background, gap: 12 },
          ]}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            地図を読み込み中...
          </Text>
        </View>
      )}
    </View>
  );
}

// ---- Main map screen ----

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { homeDistrictId } = useApp();
  const { prefectures } = useStatusData();
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [mapError, setMapError] = useState(false);

  // 居住地の地区ID (例: "nerima") から都道府県ID を推定
  // シンプルに東京都地区 → "tokyo" にフォールバック
  const homePrefId = homeDistrictId ? "tokyo" : null;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  const levelMap = buildLevelMap(prefectures);
  const mapHTML = React.useMemo(
    () => buildMapHTML(levelMap, homePrefId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [homePrefId, prefectures]
  );

  const handleMessage = useCallback((raw: string) => {
    try {
      const data = JSON.parse(raw);
      if (data.type === "prefClick") {
        // 都道府県クリック: 将来的に都道府県詳細モーダルを表示
        // 現在は東京都の場合のみ地区詳細へ (既存DistrictModal流用)
        if (data.id === "tokyo" && homeDistrictId) {
          const pref = prefectures.find((p) => p.id === "tokyo");
          if (pref) {
            // Prefecture を District 互換として扱う
            setSelectedDistrict({
              id: pref.id,
              name: pref.name,
              level: pref.level,
              aiSummary: pref.aiSummary,
            });
          }
        }
      }
    } catch {}
  }, [prefectures, homeDistrictId]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          全国 感染症マップ
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          都道府県別・流行レベルで色分け
        </Text>
      </View>

      {/* Legend */}
      <View
        style={[styles.legend, { borderBottomColor: colors.border }]}
      >
        {([0, 1, 2, 3] as EpidemicLevel[]).map((lv) => {
          const c = [colors.level0, colors.level1, colors.level2, colors.level3][lv];
          return (
            <View key={lv} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: c }]} />
              <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
                {LEVEL_NAMES[lv]}
              </Text>
            </View>
          );
        })}
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { borderWidth: 2, borderColor: colors.primary, backgroundColor: "transparent" }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>居住区</Text>
        </View>
      </View>

      {/* Map */}
      <View style={{ flex: 1, marginBottom: botPad }}>
        {mapError ? (
          <View style={[styles.center, { flex: 1, gap: 10, padding: 24 }]}>
            <Text style={[styles.errorTitle, { color: colors.foreground }]}>
              地図を読み込めませんでした
            </Text>
            <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>
              通信状況を確認してください
            </Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              onPress={() => setMapError(false)}
            >
              <Text style={styles.retryText}>再試行</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <LeafletMap
            html={mapHTML}
            onMessage={handleMessage}
            onError={() => setMapError(true)}
          />
        )}
      </View>

      <DistrictModal district={selectedDistrict} onClose={() => setSelectedDistrict(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  headerSub: { fontSize: 12 },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 11, height: 11, borderRadius: 5.5 },
  legendText: { fontSize: 11, fontWeight: "500" },
  center: { alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 14 },
  errorTitle: { fontSize: 16, fontWeight: "700" },
  errorSub: { fontSize: 13, textAlign: "center" },
  retryBtn: { marginTop: 6, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
