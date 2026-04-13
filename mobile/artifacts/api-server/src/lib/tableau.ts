/**
 * Tableau CSV スクレイパー（学級閉鎖データ）
 *
 * データソース1: 東京都感染症情報センター × JSSH Tableau
 *   URL: https://public.tableau.com/views/____17095533629730/1.csv
 *        ?:showVizHome=no&都道府県=13:東京都&疾患名等=<code>:<name>
 *
 * データソース2: 学校欠席者・感染症情報システム（東京都版）
 *   URL: https://public.tableau.com/views/TEST_17756976950650/sheet5.csv
 *        ?:showVizHome=no&prefecture=13:東京都&disease=<code>:<name>
 *   特徴: 日次データ → 週単位に集計して利用
 */

const TABLEAU_BASE =
  "https://public.tableau.com/views/____17095533629730/1.csv";

const TABLEAU_EXTRA_BASE =
  "https://public.tableau.com/views/TEST_17756976950650/sheet5.csv";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";

/** 対象疾患（JSSH Tableau / データソース1） */
export const CLOSURE_DISEASES = [
  { code: "1110", name: "インフルエンザA型",        diseaseId: "flu-a",  alertThreshold: 3 },
  { code: "1120", name: "インフルエンザB型",        diseaseId: "flu-b",  alertThreshold: 3 },
  { code: "1130", name: "インフルエンザ(その他)",   diseaseId: "flu-other", alertThreshold: 2 },
  { code: "0200", name: "新型コロナウイルス感染症", diseaseId: "covid",  alertThreshold: 5 },
] as const;

/** 追加疾患（TEST_17756976950650 / データソース2） */
export const EXTRA_CLOSURE_DISEASES = [
  { code: "1001", name: "水痘(みずぼうそう)",   diseaseId: "varicella",      alertThreshold: 3 },
  { code: "1150", name: "感染性胃腸炎",         diseaseId: "gastroenteritis", alertThreshold: 5 },
  { code: "1160", name: "溶連菌感染症",         diseaseId: "strep",          alertThreshold: 3 },
  { code: "1170", name: "マイコプラズマ感染症", diseaseId: "mycoplasma",     alertThreshold: 2 },
] as const;

/** アラート閾値判定に使う全疾患リスト */
export const ALL_CLOSURE_DISEASES = [
  ...CLOSURE_DISEASES,
  ...EXTRA_CLOSURE_DISEASES,
] as const;

export interface ClosureEntry {
  diseaseId: string;
  diseaseName: string;
  closedClasses: number;          // 最新値（今週）
  weekAgoClasses: number;         // 先週値（直近7日前）
  weeklyHistory: number[];        // 8週分 oldest→newest
  sourceUpdatedAt: string | null; // Tableau の更新日時
}

// ---------------------------------------------------------------------------
// 共通ユーティリティ
// ---------------------------------------------------------------------------

/** "2026年3月10日" → Date */
function parseJapaneseDate(s: string): Date {
  const m = s.match(/(\d+)年(\d+)月(\d+)日/);
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** 日付が属するISO週の月曜日を YYYY-MM-DD で返す（週集計キーとして使用） */
function mondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** CSV 1行のパース */
function splitCsv(line: string): string[] {
  const values: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') {
      inQ = !inQ;
    } else if (ch === "," && !inQ) {
      values.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  values.push(cur);
  return values;
}

function parseCsvText(csv: string): Record<string, string>[] {
  const lines = csv.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsv(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = splitCsv(line);
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? "").trim()]));
  });
}

/** 1疾患の学級閉鎖データを Tableau CSV から取得 */
async function fetchDiseaseClosures(
  code: string,
  name: string
): Promise<Record<string, string>[]> {
  const params = new URLSearchParams({
    ":showVizHome": "no",
    都道府県: `13:東京都`,
    疾患名等: `${code}:${name}`,
  });
  const url = `${TABLEAU_BASE}?${params}`;

  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) return [];

  const text = await res.text();
  if (!text.includes(",")) return [];

  return parseCsvText(text);
}

/** 最新値と前週値、8週推移を算出 */
function buildEntry(
  disease: (typeof CLOSURE_DISEASES)[number],
  rows: Record<string, string>[]
): ClosureEntry {
  // 「閉鎖クラス数」行のみ
  const closureRows = rows.filter((r) => r["Measure Names"] === "閉鎖クラス数");

  // 日付でソート（降順）して最新 8 件
  const sorted = [...closureRows].sort(
    (a, b) =>
      new Date(b["Day of 表示年月日"]).getTime() -
      new Date(a["Day of 表示年月日"]).getTime()
  );

  const latest = sorted[0] ?? null;

  // 最新レコードが 14 日以上前の場合は現在の閉鎖なしとして扱う
  // （Tableau は閉鎖が 0 の週のレコードを返さないため古いデータが「最新」になる問題を回避）
  const latestDate = latest ? new Date(latest["Day of 表示年月日"]) : null;
  const isStale = latestDate ? (Date.now() - latestDate.getTime()) > 14 * 24 * 60 * 60 * 1000 : true;

  const closedClasses = isStale ? 0 : (parseInt(latest?.["Measure Values"] ?? "0", 10) || 0);

  // 先週値（インデックス 1）
  const weekAgoClasses = parseInt(sorted[1]?.["Measure Values"] ?? "0", 10) || 0;

  // 8週分の履歴（昇順）
  const recentEight = sorted.slice(0, 8).reverse();
  const weeklyHistory = recentEight.map(
    (r) => parseInt(r["Measure Values"] ?? "0", 10) || 0
  );

  // 8件未満の場合は先頭に 0 を補完
  while (weeklyHistory.length < 8) weeklyHistory.unshift(0);

  const sourceUpdatedAt = latest?.["Update Date Time"] ?? null;

  return {
    diseaseId: disease.diseaseId,
    diseaseName: disease.name,
    closedClasses,
    weekAgoClasses,
    weeklyHistory,
    sourceUpdatedAt,
  };
}

// ---------------------------------------------------------------------------
// データソース2: TEST_17756976950650（追加疾患・日次→週次集計）
// ---------------------------------------------------------------------------

async function fetchExtraDiseaseCsv(
  code: string,
  name: string
): Promise<Record<string, string>[]> {
  const params = new URLSearchParams({
    ":showVizHome": "no",
    prefecture: "13:東京都",
    disease: `${code}:${name}`,
  });
  const url = `${TABLEAU_EXTRA_BASE}?${params}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return [];
  const text = await res.text();
  if (!text.includes(",")) return [];
  return parseCsvText(text);
}

function buildExtraEntry(
  disease: (typeof EXTRA_CLOSURE_DISEASES)[number],
  rows: Record<string, string>[]
): ClosureEntry {
  // 日次データを週（月曜日起点）でグループ化して合計
  const weekMap = new Map<string, number>();
  for (const row of rows) {
    const date = parseJapaneseDate(row["Day of date"] ?? "");
    if (isNaN(date.getTime())) continue;
    const key = mondayOfWeek(date);
    weekMap.set(key, (weekMap.get(key) ?? 0) + (parseInt(row["閉鎖クラス数"] ?? "0", 10) || 0));
  }

  // 週を降順ソート
  const sorted = [...weekMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const latest = sorted[0] ?? null;
  const latestDate = latest ? new Date(latest[0]) : null;
  const isStale = latestDate
    ? Date.now() - latestDate.getTime() > 14 * 24 * 60 * 60 * 1000
    : true;

  const closedClasses = isStale ? 0 : (latest?.[1] ?? 0);
  const weekAgoClasses = sorted[1]?.[1] ?? 0;

  const recentEight = sorted.slice(0, 8).reverse();
  const weeklyHistory = recentEight.map(([, v]) => v);
  while (weeklyHistory.length < 8) weeklyHistory.unshift(0);

  return {
    diseaseId: disease.diseaseId,
    diseaseName: disease.name,
    closedClasses,
    weekAgoClasses,
    weeklyHistory,
    sourceUpdatedAt: null,
  };
}

/** 追加疾患（データソース2）の学級閉鎖データを並列取得 */
export async function fetchExtraClosures(): Promise<{
  entries: ClosureEntry[];
  fetchedAt: string;
}> {
  const results = await Promise.allSettled(
    EXTRA_CLOSURE_DISEASES.map(async (disease) => {
      const rows = await fetchExtraDiseaseCsv(disease.code, disease.name);
      return buildExtraEntry(disease, rows);
    })
  );

  const entries: ClosureEntry[] = results
    .filter(
      (r): r is PromiseFulfilledResult<ClosureEntry> => r.status === "fulfilled"
    )
    .map((r) => r.value);

  for (const [i, r] of results.entries()) {
    if (r.status === "rejected") {
      const disease = EXTRA_CLOSURE_DISEASES[i];
      console.error(
        `Extra Tableau ${disease.name} 取得失敗:`,
        (r as PromiseRejectedResult).reason
      );
      entries.push({
        diseaseId: disease.diseaseId,
        diseaseName: disease.name,
        closedClasses: 0,
        weekAgoClasses: 0,
        weeklyHistory: new Array(8).fill(0),
        sourceUpdatedAt: null,
      });
    }
  }

  return { entries, fetchedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// データソース1: ____17095533629730（既存疾患）
// ---------------------------------------------------------------------------

/**
 * 全対象疾患の学級閉鎖データを並列取得
 */
export async function fetchAllClosures(): Promise<{
  entries: ClosureEntry[];
  fetchedAt: string;
}> {
  const results = await Promise.allSettled(
    CLOSURE_DISEASES.map(async (disease) => {
      const rows = await fetchDiseaseClosures(disease.code, disease.name);
      return buildEntry(disease, rows);
    })
  );

  const entries: ClosureEntry[] = results
    .filter(
      (r): r is PromiseFulfilledResult<ClosureEntry> => r.status === "fulfilled"
    )
    .map((r) => r.value);

  // 失敗した疾患はゼロ値で補完
  for (const [i, r] of results.entries()) {
    if (r.status === "rejected") {
      const disease = CLOSURE_DISEASES[i];
      console.error(
        `Tableau ${disease.name} 取得失敗:`,
        (r as PromiseRejectedResult).reason
      );
      entries.push({
        diseaseId: disease.diseaseId,
        diseaseName: disease.name,
        closedClasses: 0,
        weekAgoClasses: 0,
        weeklyHistory: new Array(8).fill(0),
        sourceUpdatedAt: null,
      });
    }
  }

  return { entries, fetchedAt: new Date().toISOString() };
}
