/**
 * TMIPH (東京都保健医療局) 保健所別感染症データ取得
 *
 * データソース: 東京都保健医療局 WEB感染症発生動向調査
 * URL: https://survey.tmiph.metro.tokyo.lg.jp/epidinfo/dlwhc.do
 * Method: POST application/x-www-form-urlencoded
 * Encoding: Shift-JIS
 *
 * CSV構造:
 *   男性ブロック → 女性ブロック → 男女合計ブロック (各ブロック30保健所+合計行)
 *   列: 保健所名, インフルエンザ, COVID-19, ARI, RSV, 咽頭結膜熱, 溶連菌, 感染性胃腸炎 ... (24疾患)
 *         + 定点数列 (col25: インフルエンザ/COVID-19定点, col27: 小児科定点, ...)
 */

import iconv from "iconv-lite";

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const TMIPH_URL =
  "https://survey.tmiph.metro.tokyo.lg.jp/epidinfo/dlwhc.do";

// CSV 疾患列インデックス (0-indexed, col0 = 保健所名)
const DISEASE_COLS: Record<number, string> = {
  1:  "flu",         // インフルエンザ
  2:  "covid",       // 新型コロナウイルス感染症（COVID-19）
  4:  "rsv",         // RSウイルス感染症
  5:  "adeno",       // 咽頭結膜熱
  6:  "strep",       // Ａ群溶血性レンサ球菌咽頭炎
  7:  "gastro",      // 感染性胃腸炎
  8:  "chickenpox",  // 水痘
  9:  "hand-foot",   // 手足口病
  12: "herpangina",  // ヘルパンギーナ
  13: "mumps",       // 流行性耳下腺炎
  20: "mycoplasma",  // マイコプラズマ肺炎
};

// 定点数列インデックス
const COL_FLU_SENTINEL = 25;   // インフルエンザ/COVID-19定点
const COL_PEDI_SENTINEL = 27;  // 小児科定点 (RSV, 手足口病, 水痘 など)

// 保健所名 (CSV) → district ID リスト
// 23特別区はほぼ1対1。多摩地区の保健所は複数市区をカバー。
const HC_TO_DISTRICTS: Record<string, string[]> = {
  // ── 23特別区 ──────────────────────────────────────────────────────────────
  "千代田":  ["chiyoda"],
  "中央区":  ["chuo"],
  "みなと":  ["minato"],
  "新宿区":  ["shinjuku"],
  "文京":    ["bunkyo"],
  "台東":    ["taito"],
  "墨田区":  ["sumida"],
  "江東区":  ["koto"],
  "品川区":  ["shinagawa"],
  "目黒区":  ["meguro"],
  "大田区":  ["ota"],
  "世田谷":  ["setagaya"],
  "渋谷区":  ["shibuya"],
  "中野区":  ["nakano"],
  "杉並":    ["suginami"],
  "池袋":    ["toshima"],   // 豊島区の保健所は池袋保健所
  "北区":    ["kita"],
  "荒川区":  ["arakawa"],
  "板橋区":  ["itabashi"],
  "練馬区":  ["nerima"],
  "足立":    ["adachi"],
  "葛飾区":  ["katsushika"],
  "江戸川":  ["edogawa"],
  // ── 多摩地区（市保健所） ───────────────────────────────────────────────────
  "八王子市": ["hachioji"],
  "町田市":   ["machida"],
  // ── 多摩地区（都保健所） ───────────────────────────────────────────────────
  // 西多摩保健所: 青梅市, 福生市, 羽村市, あきる野市, 瑞穂町 等
  "西多摩":   ["ome", "fussa"],
  // 南多摩保健所: 日野市, 多摩市, 稲城市
  "南多摩":   ["hino"],
  // 多摩立川保健所: 立川市, 武蔵野市, 三鷹市, 昭島市, 国分寺市, 国立市, 東大和市
  "多摩立川": ["tachikawa", "musashino", "mitaka", "akishima", "kokubunji", "kunitachi", "higashiyamato"],
  // 多摩府中保健所: 府中市, 調布市, 小金井市, 狛江市
  "多摩府中": ["fuchu", "chofu", "koganei", "komae"],
  // 多摩小平保健所: 小平市, 東村山市, 清瀬市, 東久留米市, 武蔵村山市
  "多摩小平": ["kodaira", "higashimurayama", "kiyose", "higashikurume", "musashimurayama"],
};

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

export interface HcRecord {
  hcName: string;
  districtIds: string[];
  fluCount: number;
  fluSentinels: number;
  fluPerSentinel: number;
  diseaseCounts: Map<string, number>; // diseaseId → 報告数 (男女合計)
}

// ---------------------------------------------------------------------------
// ISO 週番号計算 (ISO 8601 準拠)
// ---------------------------------------------------------------------------

export function getIsoWeek(date: Date): { year: number; week: number } {
  // Thursday of the current ISO week を求める
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7; // Sun=0 → 7, Mon=1, ..., Sat=6
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return { year: d.getUTCFullYear(), week };
}

// ---------------------------------------------------------------------------
// CSV パーサー
// ---------------------------------------------------------------------------

function parseLine(line: string): string[] {
  const values: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') {
      inQ = !inQ;
    } else if (ch === "," && !inQ) {
      values.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  values.push(cur.trim());
  return values;
}

function parseCsv(csv: string): HcRecord[] {
  const lines = csv
    .split("\n")
    .map((l) => l.replace(/\r$/, ""));

  // 男女合計ブロックの開始位置を特定
  let genderLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("男女合計")) {
      genderLineIdx = i;
      break;
    }
  }
  if (genderLineIdx < 0) {
    throw new Error("男女合計ブロックが見つかりません");
  }

  // genderLine の次が空行、その次が疾患ヘッダー行、その次からデータ行
  const dataStart = genderLineIdx + 3;
  const records: HcRecord[] = [];

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i];
    if (!line) break; // 空行でブロック終端

    const vals = parseLine(line);
    if (vals.length < COL_FLU_SENTINEL + 1) continue;

    const hcName = vals[0];
    if (!hcName || hcName === "合計") continue;

    const districtIds = HC_TO_DISTRICTS[hcName];
    if (!districtIds) continue; // 未マッピング保健所はスキップ

    const fluCount = parseInt(vals[1], 10) || 0;
    const fluSentinels = parseInt(vals[COL_FLU_SENTINEL], 10) || 0;
    const fluPerSentinel = fluSentinels > 0 ? fluCount / fluSentinels : 0;

    const diseaseCounts = new Map<string, number>();
    for (const [colStr, diseaseId] of Object.entries(DISEASE_COLS)) {
      const col = Number(colStr);
      if (col < vals.length) {
        diseaseCounts.set(diseaseId, parseInt(vals[col], 10) || 0);
      }
    }

    records.push({
      hcName,
      districtIds,
      fluCount,
      fluSentinels,
      fluPerSentinel,
      diseaseCounts,
    });
  }

  return records;
}

// ---------------------------------------------------------------------------
// フェッチ
// ---------------------------------------------------------------------------

async function fetchCsv(year: number, week: number): Promise<string> {
  const body = new URLSearchParams({
    "val(reportType)":     "2",
    "val(prefCode)":       "13",
    "val(hcCode)":         "",
    "val(epidCode)":       "",
    "val(startYear)":      String(year),
    "val(startSubPeriod)": String(week),
    "val(endYear)":        String(year),
    "val(endSubPeriod)":   String(week),
    "val(totalMode)":      "0",
  });

  const res = await fetch(TMIPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const buffer = await res.arrayBuffer();
  return iconv.decode(Buffer.from(buffer), "shift-jis");
}

/**
 * 最新保健所別データを取得（最大3週前まで遡る）
 *
 * TMIPHは火曜前後更新のため、Lambda実行時（月曜）には直前週が未公開の場合がある。
 * そのため開始週を current - 1 として試みる。
 */
export async function fetchLatestTmiphData(maxFallback = 3): Promise<{
  records: HcRecord[];
  year: number;
  week: number;
}> {
  const { year: curYear, week: curWeek } = getIsoWeek(new Date());

  // 1週遅延想定: 当週-1 から開始
  let year = curYear;
  let week = curWeek - 1;
  if (week < 1) {
    week = 52;
    year -= 1;
  }

  let lastErr: Error | undefined;

  for (let attempt = 0; attempt <= maxFallback; attempt++) {
    try {
      const csv = await fetchCsv(year, week);
      const records = parseCsv(csv);
      if (records.length > 0) {
        return { records, year, week };
      }
      console.warn(`TMIPH ${year}-W${week}: データなし`);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.warn(`TMIPH ${year}-W${week}: ${lastErr.message}`);
    }
    week--;
    if (week < 1) {
      week = 52;
      year--;
    }
  }

  throw lastErr ?? new Error("TMIPH データ取得失敗");
}
