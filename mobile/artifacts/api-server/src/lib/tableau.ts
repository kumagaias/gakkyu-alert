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

// ---------------------------------------------------------------------------
// 都道府県コードマップ（全47都道府県）
// ---------------------------------------------------------------------------

export const PREF_CODE_MAP: Record<string, string> = {
  "01": "hokkaido",  "02": "aomori",    "03": "iwate",     "04": "miyagi",
  "05": "akita",     "06": "yamagata",  "07": "fukushima", "08": "ibaraki",
  "09": "tochigi",   "10": "gunma",     "11": "saitama",   "12": "chiba",
  "13": "tokyo",     "14": "kanagawa",  "15": "niigata",   "16": "toyama",
  "17": "ishikawa",  "18": "fukui",     "19": "yamanashi", "20": "nagano",
  "21": "gifu",      "22": "shizuoka",  "23": "aichi",     "24": "mie",
  "25": "shiga",     "26": "kyoto",     "27": "osaka",     "28": "hyogo",
  "29": "nara",      "30": "wakayama",  "31": "tottori",   "32": "shimane",
  "33": "okayama",   "34": "hiroshima", "35": "yamaguchi", "36": "tokushima",
  "37": "kagawa",    "38": "ehime",     "39": "kochi",     "40": "fukuoka",
  "41": "saga",      "42": "nagasaki",  "43": "kumamoto",  "44": "oita",
  "45": "miyazaki",  "46": "kagoshima", "47": "okinawa",
};

// 学校等欠席者・感染症情報システム 非参加都道府県
const NON_PARTICIPATING_PREFS = new Set([
  "hokkaido", "kanagawa", "okayama", "tokushima", "yamagata",
]);

export interface PrefClosureEntry {
  id: string;       // prefId
  hasData: boolean;
  diseases: Array<{ id: string; closedClasses: number }>;
}

/**
 * 全都道府県 × CLOSURE_DISEASES の学級閉鎖データを取得して週次集計
 * 直近2週分を返す（今週 + 先週）
 */
export async function fetchAllPrefClosures(): Promise<{
  weekKey: string;
  prefectures: PrefClosureEntry[];
}> {
  // 今週の月曜日をISO週キーに変換
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);

  function isoWeekKey(date: Date): string {
    const tmp = new Date(date.getTime());
    tmp.setHours(0, 0, 0, 0);
    tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
    const week1 = new Date(tmp.getFullYear(), 0, 4);
    const week = 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${tmp.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  const weekKey = isoWeekKey(monday);

  // 都道府県×疾患の組み合わせを並列取得（p-limit で同時実行数を制限）
  const prefCodes = Object.keys(PREF_CODE_MAP);
  const CONCURRENCY = 5;

  // 都道府県ごとに全疾患を取得
  const prefResults = new Map<string, Map<string, number>>();

  for (let i = 0; i < prefCodes.length; i += CONCURRENCY) {
    const batch = prefCodes.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (code) => {
      const prefId = PREF_CODE_MAP[code];
      if (NON_PARTICIPATING_PREFS.has(prefId)) return;

      const diseaseMap = new Map<string, number>();

      await Promise.all(CLOSURE_DISEASES.map(async (disease) => {
        try {
          const params = new URLSearchParams({
            ":showVizHome": "no",
            都道府県: `${code}:${Object.entries(PREF_CODE_MAP).find(([, v]) => v === prefId)?.[0] ?? code}`,
            疾患名等: `${disease.code}:${disease.name}`,
          });
          // 都道府県名を日本語で渡す必要があるため別途マップ
          const prefNameMap: Record<string, string> = {
            "01": "北海道", "02": "青森県", "03": "岩手県", "04": "宮城県",
            "05": "秋田県", "06": "山形県", "07": "福島県", "08": "茨城県",
            "09": "栃木県", "10": "群馬県", "11": "埼玉県", "12": "千葉県",
            "13": "東京都", "14": "神奈川県", "15": "新潟県", "16": "富山県",
            "17": "石川県", "18": "福井県", "19": "山梨県", "20": "長野県",
            "21": "岐阜県", "22": "静岡県", "23": "愛知県", "24": "三重県",
            "25": "滋賀県", "26": "京都府", "27": "大阪府", "28": "兵庫県",
            "29": "奈良県", "30": "和歌山県", "31": "鳥取県", "32": "島根県",
            "33": "岡山県", "34": "広島県", "35": "山口県", "36": "徳島県",
            "37": "香川県", "38": "愛媛県", "39": "高知県", "40": "福岡県",
            "41": "佐賀県", "42": "長崎県", "43": "熊本県", "44": "大分県",
            "45": "宮崎県", "46": "鹿児島県", "47": "沖縄県",
          };
          const p = new URLSearchParams({
            ":showVizHome": "no",
            都道府県: `${code}:${prefNameMap[code]}`,
            疾患名等: `${disease.code}:${disease.name}`,
          });
          const url = `${TABLEAU_BASE}?${p}`;
          const res = await fetch(url, {
            headers: { "User-Agent": UA },
            signal: AbortSignal.timeout(20_000),
          });
          if (!res.ok) return;
          const text = await res.text();
          if (!text.includes(",")) return;

          const rows = parseCsvText(text);
          // 今週分（直近14日以内）の閉鎖クラス数を合計
          const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
          let total = 0;
          for (const row of rows) {
            if (row["Measure Names"] !== "閉鎖クラス数") continue;
            const d = new Date(row["Day of 表示年月日"]);
            if (isNaN(d.getTime()) || d.getTime() < cutoff) continue;
            total += parseInt(row["Measure Values"] ?? "0", 10) || 0;
          }
          if (total > 0) diseaseMap.set(disease.diseaseId, total);
        } catch {
          // 取得失敗は無視
        }
      }));

      prefResults.set(prefId, diseaseMap);
    }));
  }

  const prefectures: PrefClosureEntry[] = Object.values(PREF_CODE_MAP).map((prefId) => {
    if (NON_PARTICIPATING_PREFS.has(prefId)) {
      return { id: prefId, hasData: false, diseases: [] };
    }
    const diseaseMap = prefResults.get(prefId);
    if (!diseaseMap) {
      return { id: prefId, hasData: true, diseases: [] };
    }
    return {
      id: prefId,
      hasData: true,
      diseases: Array.from(diseaseMap.entries()).map(([id, closedClasses]) => ({ id, closedClasses })),
    };
  });

  return { weekKey, prefectures };
}

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
