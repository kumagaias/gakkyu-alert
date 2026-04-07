import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import {
  useGetStatus,
  type ClosureEntry,
  type DiseaseStatus,
} from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type AlertLevel = "red" | "yellow" | "green";

const ALERT_COLOR: Record<AlertLevel, string> = {
  red: "#dc2626",
  yellow: "#d97706",
  green: "#16a34a",
};

const ALERT_BG: Record<AlertLevel, string> = {
  red: "#fef2f2",
  yellow: "#fffbeb",
  green: "#f0fdf4",
};

const ALERT_LABEL: Record<AlertLevel, string> = {
  red: "警戒",
  yellow: "注意",
  green: "正常",
};

const DISEASE_LABEL: Record<string, string> = {
  "flu-a": "インフルエンザ A型",
  "flu-b": "インフルエンザ B型",
  "flu-other": "インフルエンザ その他",
  covid: "COVID-19",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toLevel(n: number): AlertLevel {
  if (n >= 3) return "red";
  if (n >= 2) return "yellow";
  return "green";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Trend bar chart
// ---------------------------------------------------------------------------

function TrendBars({
  counts,
  levels,
}: {
  counts: number[];
  levels: number[];
}) {
  const max = Math.max(...counts, 1);
  return (
    <View style={styles.trendWrap}>
      {counts.map((v, i) => {
        const pct = v / max;
        const level = toLevel(levels[i] ?? 0);
        const color = v === 0 ? "#e5e7eb" : ALERT_COLOR[level];
        return (
          <View key={i} style={styles.trendCol}>
            <View style={styles.trendBarBg}>
              <View
                style={[
                  styles.trendBarFill,
                  { height: `${Math.max(pct * 100, v > 0 ? 8 : 0)}%`, backgroundColor: color },
                ]}
              />
            </View>
            <Text style={styles.trendWeek}>{counts.length - i}w</Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Disease card
// ---------------------------------------------------------------------------

function DiseaseCard({
  entry,
  disease,
}: {
  entry: ClosureEntry;
  disease: DiseaseStatus | undefined;
}) {
  const level = toLevel(disease?.currentLevel ?? 0);
  const color = ALERT_COLOR[level];
  const bg = ALERT_BG[level];
  const name = DISEASE_LABEL[entry.diseaseId] ?? entry.diseaseName;
  const change = entry.closedClasses - entry.weekAgoClasses;
  const changeSign = change > 0 ? "▲" : change < 0 ? "▼" : "─";
  const changeColor = change > 0 ? "#dc2626" : change < 0 ? "#16a34a" : "#9ca3af";

  return (
    <View style={[styles.card, { borderTopColor: color }]}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{name}</Text>
          {entry.sourceUpdatedAt ? (
            <Text style={styles.cardMeta}>更新: {entry.sourceUpdatedAt}</Text>
          ) : null}
        </View>
        <View style={[styles.levelBadge, { backgroundColor: bg, borderColor: color }]}>
          <Text style={[styles.levelBadgeText, { color }]}>{ALERT_LABEL[level]}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={[styles.statNum, { color }]}>{entry.closedClasses}</Text>
          <Text style={styles.statLabel}>クラス閉鎖</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={[styles.statChange, { color: changeColor }]}>
            {changeSign} {Math.abs(change)}
          </Text>
          <Text style={styles.statLabel}>先週比</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statNum2}>{entry.weekAgoClasses}</Text>
          <Text style={styles.statLabel}>先週</Text>
        </View>
      </View>

      {entry.weeklyHistory.length > 0 && (
        <TrendBars counts={entry.weeklyHistory} levels={disease?.weeklyHistory ?? []} />
      )}

      {disease?.aiComment ? (
        <View style={styles.aiBox}>
          <Text style={styles.aiText}>{disease.aiComment}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Alert banner
// ---------------------------------------------------------------------------

function AlertBanner({ level, diseases }: { level: AlertLevel; diseases: string[] }) {
  const color = ALERT_COLOR[level];
  const bg = ALERT_BG[level];
  const label = ALERT_LABEL[level];
  const icon = level === "red" ? "⚠️" : level === "yellow" ? "⚡" : "✅";

  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: color }]}>
      <View style={[styles.bannerLevelBox, { backgroundColor: color }]}>
        <Text style={styles.bannerLevelText}>{label}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        {level === "green" ? (
          <Text style={[styles.bannerMsg, { color }]}>{icon} 現在、閾値超えの学級閉鎖はありません</Text>
        ) : (
          <>
            <Text style={[styles.bannerMsg, { color }]}>
              {icon} 学級閉鎖アラート
            </Text>
            <Text style={styles.bannerSub}>{diseases.join("・")} が閾値超え</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Loading / Error
// ---------------------------------------------------------------------------

function LoadingScreen() {
  return (
    <SafeAreaView style={[styles.safe, styles.center]}>
      <Text style={styles.shieldIcon}>🛡️</Text>
      <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 16 }} />
      <Text style={styles.loadingText}>データを取得中…</Text>
    </SafeAreaView>
  );
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <SafeAreaView style={[styles.safe, styles.center]}>
      <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠️</Text>
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

export default function HomeScreen() {
  const { data, isLoading, isError, refetch } = useGetStatus();

  if (isLoading) return <LoadingScreen />;
  if (isError || !data) return <ErrorScreen onRetry={() => void refetch()} />;

  const { schoolClosures, diseases } = data;

  const overallLevel: AlertLevel = (() => {
    const levels = diseases.map((d) => d.currentLevel);
    const max = Math.max(...levels, 0);
    return toLevel(max);
  })();

  const alertDiseases = diseases
    .filter((d) => d.currentLevel >= 2)
    .map((d) => DISEASE_LABEL[d.id] ?? d.id);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.shieldIcon}>🛡️</Text>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.headerTitle}>がっきゅうアラート</Text>
              <Text style={styles.headerSub}>学級閉鎖 感染症モニタリング</Text>
            </View>
          </View>
          <View>
            <Text style={styles.headerDate}>
              更新: {formatDate(schoolClosures.lastUpdated)}
            </Text>
          </View>
        </View>

        {/* Alert banner */}
        <AlertBanner level={overallLevel} diseases={alertDiseases} />

        {/* Disease section */}
        <Text style={styles.sectionTitle}>疾患別 学級閉鎖状況</Text>
        {schoolClosures.entries.map((entry) => (
          <DiseaseCard
            key={entry.diseaseId}
            entry={entry}
            disease={diseases.find((d) => d.id === entry.diseaseId)}
          />
        ))}
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
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a56db",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  shieldIcon: { fontSize: 36 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 11, color: "#bfdbfe", marginTop: 2 },
  headerDate: { fontSize: 11, color: "#bfdbfe", textAlign: "right" },

  // Banner
  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 18,
  },
  bannerLevelBox: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 56,
    alignItems: "center",
  },
  bannerLevelText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  bannerMsg: { fontSize: 14, fontWeight: "700" },
  bannerSub: { fontSize: 12, color: "#6b7280", marginTop: 3 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 10,
  },

  // Card
  card: {
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
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  cardMeta: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  levelBadge: {
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  levelBadgeText: { fontSize: 13, fontWeight: "700" },

  // Stats row
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  statBlock: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 32, fontWeight: "800", lineHeight: 38 },
  statNum2: { fontSize: 24, fontWeight: "700", color: "#6b7280", lineHeight: 30 },
  statChange: { fontSize: 22, fontWeight: "700", lineHeight: 28 },
  statLabel: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: "#e5e7eb" },

  // Trend bars
  trendWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 56,
    marginBottom: 8,
  },
  trendCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
  },
  trendBarBg: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
  },
  trendBarFill: {
    width: "100%",
    borderRadius: 3,
  },
  trendWeek: {
    fontSize: 9,
    color: "#d1d5db",
    marginTop: 2,
  },

  // AI comment
  aiBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#93c5fd",
  },
  aiText: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 18,
    fontStyle: "italic",
  },

  // Loading / Error
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
