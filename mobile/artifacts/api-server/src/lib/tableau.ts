/**
 * Tableau CSV スクレイパー（学級閉鎖データ）
 *
 * データソース: 東京都感染症情報センター × JSSH Tableau
 * URL: https://public.tableau.com/views/____17095533629730/1.csv
 *      ?:showVizHome=no&都道府県=13:東京都&疾患名等=<code>:<name>
 */

const TABLEAU_BASE =
  "https://public.tableau.com/views/____17095533629730/1.csv";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";

/** 対象疾患（Tableau で取得可能なもの） */
export const CLOSURE_DISEASES = [
  { code: "1110", name: "インフルエンザA型",        diseaseId: "flu-a",  alertThreshold: 3 },
  { code: "1120", name: "インフルエンザB型",        diseaseId: "flu-b",  alertThreshold: 3 },
  { code: "1130", name: "インフルエンザ(その他)",   diseaseId: "flu-other", alertThreshold: 2 },
  { code: "0200", name: "新型コロナウイルス感染症", diseaseId: "covid",  alertThreshold: 5 },
] as const;

export interface ClosureEntry {
  diseaseId: string;
  diseaseName: string;
  closedClasses: number;          // 最新値（今週）
  weekAgoClasses: number;         // 先週値（直近7日前）
  weeklyHistory: number[];        // 8週分 oldest→newest
  sourceUpdatedAt: string | null; // Tableau の更新日時
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
  const closedClasses = parseInt(latest?.["Measure Values"] ?? "0", 10) || 0;

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
