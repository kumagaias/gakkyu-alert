import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useGetStatus, type DistrictStatus } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type AlertLevel = "red" | "yellow" | "green" | "none";

const LEVEL_COLOR: Record<AlertLevel, string> = {
  red: "#dc2626",
  yellow: "#d97706",
  green: "#16a34a",
  none: "#d1d5db",
};

const LEVEL_BG: Record<AlertLevel, string> = {
  red: "#fef2f2",
  yellow: "#fffbeb",
  green: "#f0fdf4",
  none: "#f9fafb",
};

const LEVEL_LABEL: Record<AlertLevel, string> = {
  red: "警戒",
  yellow: "注意",
  green: "正常",
  none: "データなし",
};

// Tokyo 23 special wards + monitored municipalities
// Arranged in approximate geographic rows (N→S, W→E)
const WARD_GRID: Array<Array<string | null>> = [
  [null, null, "北区", "荒川区", "足立区", null],
  ["板橋区", "豊島区", "文京区", "台東区", null, "葛飾区"],
  ["練馬区", "中野区", "新宿区", "千代田区", "墨田区", "江東区"],
  [null, "杉並区", "渋谷区", "港区", "中央区", "江戸川区"],
  [null, "世田谷区", "目黒区", "品川区", "大田区", null],
];

// Monitored municipalities outside 23 wards
const MUNICIPALITIES = ["武蔵野市", "三鷹市"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toLevel(n: number): AlertLevel {
  if (n >= 3) return "red";
  if (n >= 2) return "yellow";
  if (n >= 1) return "green";
  return "green";
}

function getDistrictLevel(
  name: string,
  districts: DistrictStatus[]
): AlertLevel {
  const found = districts.find((d) => d.id === name);
  if (!found) return "none";
  return toLevel(found.level);
}

// ---------------------------------------------------------------------------
// Ward cell
// ---------------------------------------------------------------------------

function WardCell({
  name,
  level,
  monitored,
}: {
  name: string;
  level: AlertLevel;
  monitored: boolean;
}) {
  const color = LEVEL_COLOR[level];
  const bg = LEVEL_BG[level];
  return (
    <View
      style={[
        styles.wardCell,
        {
          backgroundColor: bg,
          borderColor: monitored ? color : "#e5e7eb",
          borderWidth: monitored ? 2 : 1,
        },
      ]}
    >
      <Text
        style={[styles.wardName, { color: monitored ? "#111827" : "#9ca3af" }]}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {name.replace("区", "\n区").replace("市", "\n市")}
      </Text>
      {monitored && (
        <View style={[styles.wardDot, { backgroundColor: color }]} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function Legend() {
  const items: Array<{ level: AlertLevel; label: string }> = [
    { level: "red", label: "警戒" },
    { level: "yellow", label: "注意" },
    { level: "green", label: "正常" },
    { level: "none", label: "データなし" },
  ];
  return (
    <View style={styles.legendRow}>
      {items.map(({ level, label }) => (
        <View key={level} style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: LEVEL_COLOR[level] }]}
          />
          <Text style={styles.legendLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// District detail card
// ---------------------------------------------------------------------------

function DistrictCard({ district }: { district: DistrictStatus }) {
  const level = toLevel(district.level);
  const color = LEVEL_COLOR[level];
  const bg = LEVEL_BG[level];
  return (
    <View style={[styles.distCard, { borderTopColor: color }]}>
      <View style={styles.distHeader}>
        <Text style={styles.distName}>{district.id}</Text>
        <View style={[styles.distBadge, { backgroundColor: bg, borderColor: color }]}>
          <Text style={[styles.distBadgeText, { color }]}>
            {LEVEL_LABEL[level]}
          </Text>
        </View>
      </View>
      {district.aiSummary ? (
        <Text style={styles.distSummary}>{district.aiSummary}</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Loading / Error
// ---------------------------------------------------------------------------

function LoadingScreen() {
  return (
    <SafeAreaView style={[styles.safe, styles.center]}>
      <ActivityIndicator size="large" color="#1a56db" />
      <Text style={styles.loadingText}>データを取得中…</Text>
    </SafeAreaView>
  );
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <SafeAreaView style={[styles.safe, styles.center]}>
      <Text style={styles.errorText}>データの取得に失敗しました</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
        <Text style={styles.retryText}>再試行</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MapScreen() {
  const { data, isLoading, isError, refetch } = useGetStatus();

  if (isLoading) return <LoadingScreen />;
  if (isError || !data) return <ErrorScreen onRetry={() => void refetch()} />;

  const { districts, schoolClosures } = data;
  const monitoredIds = new Set(districts.map((d) => d.id));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🗺️ 地域マップ</Text>
          <Text style={styles.headerSub}>東京23区・監視エリア</Text>
        </View>

        <Legend />

        {/* Ward grid */}
        <View style={styles.gridWrap}>
          {WARD_GRID.map((row, ri) => (
            <View key={ri} style={styles.gridRow}>
              {row.map((name, ci) =>
                name ? (
                  <WardCell
                    key={ci}
                    name={name}
                    level={getDistrictLevel(name, districts)}
                    monitored={monitoredIds.has(name)}
                  />
                ) : (
                  <View key={ci} style={styles.wardEmpty} />
                )
              )}
            </View>
          ))}
        </View>

        {/* Municipalities outside 23 wards */}
        <Text style={styles.sectionTitle}>市部 (監視エリア)</Text>
        <View style={styles.muniRow}>
          {MUNICIPALITIES.map((name) => (
            <WardCell
              key={name}
              name={name}
              level={getDistrictLevel(name, districts)}
              monitored={monitoredIds.has(name)}
            />
          ))}
        </View>

        {/* District detail cards */}
        {districts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>監視エリア 詳細</Text>
            {districts.map((d) => (
              <DistrictCard key={d.id} district={d} />
            ))}
          </>
        )}

        <Text style={styles.footer}>
          最終更新: {schoolClosures.lastUpdated}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f3f4f6" },
  center: { justifyContent: "center", alignItems: "center" },
  content: { padding: 16, paddingBottom: 40 },

  header: {
    backgroundColor: "#1a56db",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 12, color: "#bfdbfe", marginTop: 2 },

  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { fontSize: 12, color: "#374151" },

  gridWrap: { marginBottom: 16 },
  gridRow: { flexDirection: "row", gap: 4, marginBottom: 4 },
  wardCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  wardEmpty: { flex: 1, aspectRatio: 1 },
  wardName: {
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 12,
  },
  wardDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  muniRow: { flexDirection: "row", gap: 8, marginBottom: 16 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 10,
  },

  distCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderTopWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  distHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  distName: { fontSize: 17, fontWeight: "700", color: "#111827" },
  distBadge: {
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  distBadgeText: { fontSize: 13, fontWeight: "700" },
  distSummary: {
    fontSize: 13,
    color: "#4b5563",
    lineHeight: 20,
  },

  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 8,
  },

  loadingText: { marginTop: 12, fontSize: 14, color: "#6b7280" },
  errorText: { fontSize: 15, color: "#dc2626", marginBottom: 16, fontWeight: "600" },
  retryBtn: {
    backgroundColor: "#1a56db",
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
