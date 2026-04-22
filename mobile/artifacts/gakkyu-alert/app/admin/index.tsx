import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

if (Platform.OS !== "web") {
  throw new Error("Admin page is web-only");
}

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://rrxho9axj1.execute-api.ap-northeast-1.amazonaws.com/dev";

const TOKEN_KEY = "gakkyu_admin_token";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function adminFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JobStatus {
  name: string;
  schedule: string;
  lastRunSk: string | null;
  lastUpdatedAt: string | null;
  status: "ok" | "no-data";
}

interface ClosureEntry {
  diseaseId?: string;
  diseaseName?: string;
  closedClasses?: number;
}

interface ClosureRecord {
  date: unknown;
  updatedAt: string | null;
  entries: ClosureEntry[];
}

interface DiseaseRecord {
  id: string;
  currentLevel: number;
  currentCount: number;
  weeklyHistory: number[];
}

interface WeekRecord {
  weekKey: unknown;
  generatedAt: string | null;
  diseases: DiseaseRecord[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: "ok" | "no-data" }) {
  return (
    <Text style={[s.badge, status === "ok" ? s.badgeOk : s.badgeWarn]}>
      {status === "ok" ? "✓ 正常" : "⚠ データなし"}
    </Text>
  );
}

function JobsTab({ token }: { token: string }) {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ jobs: JobStatus[] }>("/api/v1/admin/status", token)
      .then((d) => setJobs(d.jobs))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "エラー"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <ActivityIndicator style={s.center} />;
  if (error) return <Text style={s.errorText}>{error}</Text>;

  return (
    <View>
      {jobs.map((job) => (
        <View key={job.name} style={s.card}>
          <View style={s.cardRow}>
            <Text style={s.cardTitle}>{job.name}</Text>
            <StatusBadge status={job.status} />
          </View>
          <Text style={s.cardMeta}>スケジュール: {job.schedule}</Text>
          <Text style={s.cardMeta}>最終実行: {job.lastRunSk ?? "—"}</Text>
          <Text style={s.cardMeta}>
            更新日時: {job.lastUpdatedAt ? new Date(job.lastUpdatedAt).toLocaleString("ja-JP") : "—"}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ClosuresTab({ token }: { token: string }) {
  const [closures, setClosures] = useState<ClosureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ closures: ClosureRecord[] }>("/api/v1/admin/closures", token)
      .then((d) => setClosures(d.closures))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "エラー"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <ActivityIndicator style={s.center} />;
  if (error) return <Text style={s.errorText}>{error}</Text>;

  return (
    <View>
      {closures.map((c) => (
        <View key={String(c.date)} style={s.card}>
          <View style={s.cardRow}>
            <Text style={s.cardTitle}>{String(c.date)}</Text>
            <Text style={s.cardMeta}>{c.entries.length} 件</Text>
          </View>
          <Text style={s.cardMeta}>
            更新: {c.updatedAt ? new Date(c.updatedAt).toLocaleString("ja-JP") : "—"}
          </Text>
          {c.entries.slice(0, 5).map((e, i) => (
            <Text key={i} style={s.entry}>
              • {e.diseaseName ?? e.diseaseId ?? "不明"}: {e.closedClasses ?? 0} クラス
            </Text>
          ))}
          {c.entries.length > 5 && (
            <Text style={s.cardMeta}>他 {c.entries.length - 5} 件…</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function DiseasesTab({ token }: { token: string }) {
  const [weeks, setWeeks] = useState<WeekRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ weeks: WeekRecord[] }>("/api/v1/admin/diseases", token)
      .then((d) => setWeeks(d.weeks))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "エラー"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <ActivityIndicator style={s.center} />;
  if (error) return <Text style={s.errorText}>{error}</Text>;

  return (
    <View>
      {weeks.map((w) => (
        <View key={String(w.weekKey)} style={s.card}>
          <Text style={s.cardTitle}>{String(w.weekKey)}</Text>
          <Text style={s.cardMeta}>
            生成: {w.generatedAt ? new Date(w.generatedAt).toLocaleString("ja-JP") : "—"}
          </Text>
          {(w.diseases as DiseaseRecord[]).map((d) => (
            <Text key={d.id} style={s.entry}>
              • {d.id}: Lv{d.currentLevel} / {d.currentCount.toFixed(2)}/定点
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await adminFetch("/api/v1/admin/status", input.trim());
      localStorage.setItem(TOKEN_KEY, input.trim());
      onLogin(input.trim());
    } catch {
      setError("トークンが無効です");
    } finally {
      setLoading(false);
    }
  }, [input, onLogin]);

  return (
    <View style={s.loginOuter}>
      <View style={s.loginBox}>
        <Text style={s.loginTitle}>管理画面</Text>
        <TextInput
          style={s.input}
          placeholder="Admin Token"
          secureTextEntry
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSubmit}
          autoFocus
        />
        {error && <Text style={s.errorText}>{error}</Text>}
        <Pressable style={s.btn} onPress={handleSubmit} disabled={loading}>
          <Text style={s.btnText}>{loading ? "確認中…" : "ログイン"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

type Tab = "jobs" | "closures" | "diseases";

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("jobs");

  return (
    <View style={s.dashOuter}>
      <View style={s.dashHeader}>
        <Text style={s.dashTitle}>管理画面</Text>
        <Pressable onPress={onLogout}>
          <Text style={s.logoutText}>ログアウト</Text>
        </Pressable>
      </View>

      <View style={s.tabBar}>
        {(["jobs", "closures", "diseases"] as Tab[]).map((t) => (
          <Pressable key={t} style={[s.tabItem, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === "jobs" ? "バッチ状況" : t === "closures" ? "閉鎖一覧" : "病気トレンド"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.contentInner}>
        {tab === "jobs" && <JobsTab token={token} />}
        {tab === "closures" && <ClosuresTab token={token} />}
        {tab === "diseases" && <DiseasesTab token={token} />}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  if (!token) return <LoginScreen onLogin={setToken} />;
  return <Dashboard token={token} onLogout={handleLogout} />;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  center: { marginTop: 40 },
  errorText: { color: "#e53e3e", marginVertical: 8, fontSize: 13 },

  // Login
  loginOuter: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f0f4f8" },
  loginBox: { width: 340, backgroundColor: "#fff", borderRadius: 12, padding: 32, gap: 16,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  loginTitle: { fontSize: 22, fontWeight: "700", color: "#1a4bab", textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, fontSize: 14 },
  btn: { backgroundColor: "#1a4bab", borderRadius: 8, padding: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },

  // Dashboard
  dashOuter: { flex: 1, backgroundColor: "#f0f4f8" },
  dashHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#1a4bab", paddingHorizontal: 24, paddingVertical: 16 },
  dashTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  logoutText: { color: "#bfdbfe", fontSize: 14 },

  // Tabs
  tabBar: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#1a4bab" },
  tabText: { fontSize: 13, color: "#6b7280" },
  tabTextActive: { color: "#1a4bab", fontWeight: "600" },

  // Content
  content: { flex: 1 },
  contentInner: { padding: 16, gap: 12 },

  // Cards
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 16, gap: 6,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  cardMeta: { fontSize: 12, color: "#6b7280" },
  entry: { fontSize: 13, color: "#374151", marginTop: 2 },

  // Badge
  badge: { fontSize: 12, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeOk: { backgroundColor: "#d1fae5", color: "#065f46" },
  badgeWarn: { backgroundColor: "#fef3c7", color: "#92400e" },
});
