/**
 * 学校等欠席者・感染症情報システム CSV → DynamoDB ロードスクリプト
 *
 * 使い方:
 *   pnpm --filter @workspace/api-server exec ts-node --esm src/scripts/load-pref-closures.ts <csvファイルパス>
 *
 * CSVフォーマット (UTF-16 TSV):
 *   prefecture  disease  date の日  閉鎖クラス数
 *   02:青森県   1099:インフルエンザ  2026年3月10日  5
 *
 * 保存先: pk=CLOSURE_BY_PREF, sk=<YYYY-Www>
 */

import { readFileSync } from "fs";
import { putSnapshot } from "../lib/dynamodb.js";

// ---------------------------------------------------------------------------
// マッピング
// ---------------------------------------------------------------------------

const PREF_CODE_TO_ID: Record<string, string> = {
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

const DISEASE_CODE_TO_ID: Record<string, string> = {
  "1099": "flu",         // インフルエンザ (A+B 合算)
  "1110": "flu-a",       // インフルエンザA型
  "1120": "flu-b",       // インフルエンザB型
  "1125": "flu-a",       // インフルエンザA(H1N1)2009 → flu-a に統合
  "1140": "flu",         // インフルエンザ(感染の疑い) → flu に統合
  "1150": "gastro",      // 感染性胃腸炎
  "1160": "strep",       // 溶連菌感染症
  "1170": "mycoplasma",  // マイコプラズマ感染症
  "1200": "rsv",         // RS
  "1230": "strep",       // A群溶血性レンサ球菌咽頭炎 → strep に統合
  "1510": "covid",       // 新型コロナウイルス感染症
  "1001": "chickenpox",  // 水痘
  "1011": "other",       // その他感染症
};

// ---------------------------------------------------------------------------
// 日付 → ISO 週キー
// ---------------------------------------------------------------------------

function parseJpDate(s: string): Date | null {
  // "2026年3月10日"
  const m = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
}

function isoWeekKey(date: Date): string {
  // ISO 8601 週番号
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  const week = 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${tmp.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// CSV パース & 集計
// ---------------------------------------------------------------------------

type WeekData = Map<string, Map<string, Map<string, number>>>;
// weekKey → prefId → diseaseId → closedClasses (累計)

function parseCsv(csvPath: string): WeekData {
  const raw = readFileSync(csvPath);
  const text = raw.slice(0, 2).toString("hex") === "fffe" || raw.slice(0, 2).toString("hex") === "feff"
    ? raw.toString("utf16le").replace(/^\uFEFF/, "")
    : raw.toString("utf-8");

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV が空です");

  // ヘッダー行スキップ
  const weekData: WeekData = new Map();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols.length < 4) continue;

    const prefRaw    = cols[0].trim();
    const diseaseRaw = cols[1].trim();
    const dateRaw    = cols[2].trim();
    const countRaw   = cols[3].trim();

    // 都道府県コード
    const prefCode = prefRaw.split(":")[0].trim();
    const prefId   = PREF_CODE_TO_ID[prefCode];
    if (!prefId) continue;

    // 疾患コード
    const diseaseCode = diseaseRaw.split(":")[0].trim();
    const diseaseId   = DISEASE_CODE_TO_ID[diseaseCode];
    if (!diseaseId) continue;

    // 日付 → ISO週
    const date = parseJpDate(dateRaw);
    if (!date) continue;
    const weekKey = isoWeekKey(date);

    // 閉鎖クラス数
    const count = parseInt(countRaw.replace(/,/g, ""), 10);
    if (isNaN(count)) continue;

    // 集計
    if (!weekData.has(weekKey)) weekData.set(weekKey, new Map());
    const prefMap = weekData.get(weekKey)!;
    if (!prefMap.has(prefId)) prefMap.set(prefId, new Map());
    const diseaseMap = prefMap.get(prefId)!;
    diseaseMap.set(diseaseId, (diseaseMap.get(diseaseId) ?? 0) + count);
  }

  return weekData;
}

// ---------------------------------------------------------------------------
// DynamoDB 保存
// ---------------------------------------------------------------------------

const ALL_PREF_IDS = Object.values(PREF_CODE_TO_ID);

async function saveWeek(weekKey: string, prefMap: Map<string, Map<string, number>>): Promise<void> {
  const participatingIds = new Set(prefMap.keys());

  const prefectures = ALL_PREF_IDS.map((prefId) => {
    if (!participatingIds.has(prefId)) {
      return { id: prefId, hasData: false };
    }
    const diseaseMap = prefMap.get(prefId)!;
    const diseases = Array.from(diseaseMap.entries()).map(([id, closedClasses]) => ({
      id,
      closedClasses,
    }));
    return { id: prefId, hasData: true, diseases };
  });

  await putSnapshot("CLOSURE_BY_PREF", weekKey, {
    prefectures,
    loadedAt: new Date().toISOString(),
  });
  console.log(`✓ ${weekKey}: ${participatingIds.size} 都道府県`);
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("使い方: load-pref-closures.ts <csvファイルパス>");
    process.exit(1);
  }

  console.log(`CSV 読み込み: ${csvPath}`);
  const weekData = parseCsv(csvPath);
  console.log(`週数: ${weekData.size}`);

  for (const [weekKey, prefMap] of [...weekData.entries()].sort()) {
    await saveWeek(weekKey, prefMap);
  }

  console.log("完了");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
