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
  TOKYO_DISTRICTS,
  type District,
  type EpidemicLevel,
  LEVEL_NAMES,
} from "@/constants/data";
import { useStatusData } from "@/hooks/useStatusData";
import { DistrictModal } from "@/components/DistrictModal";
// Bundled ward boundary data — no network fetch needed
import tokyoGeoJSON from "@/assets/data/tokyo.json";

// ---- HTML builder ----

function buildLevelMap(districts: District[]) {
  const map: Record<string, number> = {};
  for (const d of districts) {
    map[d.name] = d.level;
  }
  return map;
}

function buildMapHTML(
  levelMap: Record<string, number>,
  homeDistrictId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geoData: any
): string {
  const levelColors = { 0: "#94a3b8", 1: "#eab308", 2: "#f97316", 3: "#ef4444" };
  const homeDistrict = homeDistrictId
    ? (TOKYO_DISTRICTS.find((d) => d.id === homeDistrictId)?.name ?? null)
    : null;

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
    var LEVELS = ${JSON.stringify(levelMap)};
    var HOME = ${JSON.stringify(homeDistrict)};
    var COLORS = ${JSON.stringify(levelColors)};
    var LNAMES = { 0: '平穏', 1: '注意', 2: '警戒', 3: '流行' };
    // Bundled ward boundary data — no network fetch required
    var GEO_DATA = ${JSON.stringify(geoData)};

    // Works in both react-native-webview and plain iframe
    function send(data) {
      var msg = JSON.stringify(data);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(msg);
      } else {
        window.parent.postMessage(msg, '*');
      }
    }

    function getLevel(name) {
      if (LEVELS[name] !== undefined) return LEVELS[name];
      for (var k in LEVELS) {
        if (name && k && (name.indexOf(k) !== -1 || k.indexOf(name) !== -1)) return LEVELS[k];
      }
      return -1;
    }

    function wardName(props) {
      return props['ward_ja'] || props['city'] || props['N03_004'] || props['name'] || props['name_1'] || '';
    }

    var map = L.map('map', {
      center: [35.685, 139.692],
      zoom: 11,
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19
    }).addTo(map);

    L.control.attribution({ position: 'bottomleft', prefix: '' })
      .addAttribution('© <a href="https://openstreetmap.org">OSM</a> © <a href="https://carto.com">CARTO</a>')
      .addTo(map);

    function processGeoJSON(data) {
        document.getElementById('loading').style.display = 'none';

        // Support both GeoJSON FeatureCollection and plain arrays
        var allFeatures = data.features || (Array.isArray(data) ? data : []);

        // Show wards (区) and cities (市) — includes 多摩地区 municipalities
        var wards = allFeatures.filter(function(f) {
          var p = f.properties || {};
          var name = p['ward_ja'] || p['city'] || p['N03_004'] || p['name'] || p['name_1'] || '';
          var last = name.slice(-1);
          return last === '\u533a' || last === '\u5e02'; // 区 or 市
        });
        if (wards.length === 0) wards = allFeatures;

        var layer = L.geoJSON({ type: 'FeatureCollection', features: wards }, {
          style: function(f) {
            var n = wardName(f.properties);
            var lv = getLevel(n);
            var isHome = n === HOME;
            return {
              fillColor: lv >= 0 ? COLORS[lv] : '#cbd5e1',
              fillOpacity: 0.55,
              color: isHome ? '#1d4ed8' : '#ffffff',
              weight: isHome ? 2.5 : 1.2
            };
          },
          onEachFeature: function(f, lyr) {
            var n = wardName(f.properties);
            var lv = getLevel(n);
            var isHome = n === HOME;

            lyr.on('click', function(e) {
              L.DomEvent.stopPropagation(e);
              send({ type: 'wardClick', name: n });
            });

            var homeLine = isHome ? '<div class="ward-home">★ 居住区</div>' : '';
            var lvLine = lv >= 0
              ? '<div class="ward-level" style="color:' + COLORS[lv] + ';font-weight:600">' + LNAMES[lv] + ' (Lv.' + lv + ')</div>'
              : '';

            lyr.bindPopup(
              '<div class="ward-name">' + n + '</div>' + lvLine + homeLine,
              { closeButton: false, autoPan: false, offset: [0, -4] }
            );

            lyr.on('mouseover', function() {
              lyr.setStyle({ fillOpacity: 0.82, weight: lyr.options.color === '#1d4ed8' ? 2.5 : 2, color: lyr.options.color === '#1d4ed8' ? '#1d4ed8' : '#94a3b8' });
              lyr.openPopup();
            });
            lyr.on('mouseout', function() {
              layer.resetStyle(lyr);
              lyr.closePopup();
            });
          }
        }).addTo(map);

        try {
          var bounds = layer.getBounds();
          var sw = bounds.getSouthWest();
          var ne = bounds.getNorthEast();
          // Sanity check: Tokyo 23 wards span ~0.28°lat × 0.35°lng
          if (ne.lat - sw.lat < 1.0 && ne.lng - sw.lng < 1.0) {
            map.fitBounds(bounds, { padding: [20, 20] });
          } else {
            // Data is too large; center on Tokyo wards
            map.setView([35.685, 139.74], 11);
          }
        } catch(e) {
          map.setView([35.685, 139.74], 11);
        }
        send({ type: 'ready', count: wards.length });
    }

    // Use bundled data immediately — no network fetch required
    processGeoJSON(GEO_DATA);
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
  const { districts } = useStatusData();
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [mapError, setMapError] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  const levelMap = buildLevelMap(districts);
  // Memoize HTML so it's stable across renders
  const mapHTML = React.useMemo(
    () => buildMapHTML(levelMap, homeDistrictId ?? null, tokyoGeoJSON),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [homeDistrictId, districts]
  );

  const handleMessage = useCallback((raw: string) => {
    try {
      const data = JSON.parse(raw);
      if (data.type === "wardClick") {
        const district = TOKYO_DISTRICTS.find((d) => d.name === data.name);
        if (district) setSelectedDistrict(district);
      }
    } catch {}
  }, []);

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
          東京都 感染症マップ
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          流行レベルで色分け・タップで詳細表示
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
