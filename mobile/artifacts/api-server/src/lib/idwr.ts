/**
 * IDWR (感染症発生動向調査週報) CSV スクレイパー
 *
 * データソース: JIHS (国立健康危機管理研究機構)
 * URL: https://id-info.jihs.go.jp/surveillance/idwr/provisional/{year}/{week}/{year}-{week}-teiten.csv
 * エンコーディング: Shift-JIS
 *
 * CSV構造:
 *   row0: タイトル行
 *   row1: 週情報
 *   row2: 疾患名ヘッダー (col0=空, col1=疾患名, col2=空, col3=疾患名, ...)
 *   row3: 報告/定当サブヘッダー (col1=報告, col2=定当, col3=報告, col4=定当, ...)
 *   row4: 総数行 (skip)
 *   row5+: 都道府県データ行
 *
 * 各疾患の列: header_idx → caseCount=data[header_idx], perSentinel=data[header_idx+1]
 */

import iconv from "iconv-lite";
import { logger } from "./logger.js";

const IDWR_BASE_URL =
  "https://id-info.jihs.go.jp/surveillance/idwr/provisional";

// CSV の日本語疾患名 → アプリの diseaseId マッピング
const DISEASE_ID_MAP: Record<string, string> = {
  インフルエンザ: "flu-a", // CSV ではA/B合算のため flu-a に寄せる
  ＲＳウイルス感染症: "rsv",
  手足口病: "hand-foot",
  ヘルパンギーナ: "herpangina",
  感染性胃腸炎: "gastro",
  "COVID-19": "covid",
  麻疹: "measles",
  風疹: "rubella",
  水痘: "chickenpox",
  "咽頭結膜熱（プール熱）": "adeno",
  咽頭結膜熱: "adeno",
  マイコプラズマ肺炎: "mycoplasma",
  百日咳: "pertussis",
  溶連菌感染症: "strep",
  流行性耳下腺炎: "mumps",
};

// CSV の都道府県名 → 内部 ID マッピング
// 将来的に市区町村レベルへの分解を見越して "jp-{都道府県コード}" 形式
export const PREF_ID_MAP: Record<string, string> = {
  北海道: "hokkaido",
  青森県: "aomori",
  岩手県: "iwate",
  宮城県: "miyagi",
  秋田県: "akita",
  山形県: "yamagata",
  福島県: "fukushima",
  茨城県: "ibaraki",
  栃木県: "tochigi",
  群馬県: "gunma",
  埼玉県: "saitama",
  千葉県: "chiba",
  東京都: "tokyo",
  神奈川県: "kanagawa",
  新潟県: "niigata",
  富山県: "toyama",
  石川県: "ishikawa",
  福井県: "fukui",
  山梨県: "yamanashi",
  長野県: "nagano",
  岐阜県: "gifu",
  静岡県: "shizuoka",
  愛知県: "aichi",
  三重県: "mie",
  滋賀県: "shiga",
  京都府: "kyoto",
  大阪府: "osaka",
  兵庫県: "hyogo",
  奈良県: "nara",
  和歌山県: "wakayama",
  鳥取県: "tottori",
  島根県: "shimane",
  岡山県: "okayama",
  広島県: "hiroshima",
  山口県: "yamaguchi",
  徳島県: "tokushima",
  香川県: "kagawa",
  愛媛県: "ehime",
  高知県: "kochi",
  福岡県: "fukuoka",
  佐賀県: "saga",
  長崎県: "nagasaki",
  熊本県: "kumamoto",
  大分県: "oita",
  宮崎県: "miyazaki",
  鹿児島県: "kagoshima",
  沖縄県: "okinawa",
};

export interface IdwrRecord {
  diseaseId: string;
  diseaseNameJa: string;
  prefecture: string;       // 都道府県名 (日本語)
  prefectureId: string;     // 都道府県ID (例: "tokyo")
  caseCount: number;        // 報告数 (整数)
  perSentinel: number;      // 定点当たり報告数 (小数)
  reportYear: number;
  reportWeek: number;
}

/**
 * IDWR CSV を取得して UTF-8 文字列で返す（リダイレクト追従・Shift-JIS デコード）
 */
async function fetchCsv(year: number, week: number): Promise<string> {
  const weekStr = String(week).padStart(2, "0");
  const url = `${IDWR_BASE_URL}/${year}/${weekStr}/${year}-${weekStr}-teiten.csv`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${url}`);
  }

  const buffer = await res.arrayBuffer();
  const decoded = iconv.decode(Buffer.from(buffer), "shift-jis");

  if (!decoded.trim()) {
    throw new Error("空のCSVレスポンス");
  }

  return decoded;
}

/**
 * CSV の1行をパース（クォート内カンマ対応）
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

/**
 * CSV テキストをパースして全都道府県の疾患別患者数を抽出
 *
 * 列構造: 疾患名ヘッダーが col_n にあるとき
 *   data[col_n]   = 報告数 (caseCount)
 *   data[col_n+1] = 定点当り (perSentinel)
 */
function parseCsv(
  csvText: string,
  year: number,
  week: number
): IdwrRecord[] {
  const lines = csvText.split("\n");
  if (lines.length < 6) return [];

  // row2: 疾患名ヘッダー行
  const headers = parseCsvLine(lines[2]);

  // 疾患列インデックスを収集
  const diseaseColumns: Array<{
    diseaseId: string;
    diseaseNameJa: string;
    caseIndex: number;      // 報告数列
    sentinelIndex: number;  // 定当列
  }> = [];

  headers.forEach((header, idx) => {
    const name = header.trim().replace(/\s+/g, "");
    const diseaseId = DISEASE_ID_MAP[name];
    if (diseaseId) {
      diseaseColumns.push({
        diseaseId,
        diseaseNameJa: name,
        caseIndex: idx,       // 疾患名と同じ列が報告数
        sentinelIndex: idx + 1, // 次の列が定当
      });
    }
  });

  if (diseaseColumns.length === 0) return [];

  const records: IdwrRecord[] = [];

  // row5以降: 都道府県データ (row4=総数はスキップ)
  for (let i = 5; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    if (values.length < 2) continue;

    const prefName = values[0].replace(/"/g, "").trim();
    if (!prefName) continue;

    const prefectureId = PREF_ID_MAP[prefName];
    if (!prefectureId) continue; // 総数行など未知の行はスキップ

    for (const col of diseaseColumns) {
      const rawCase = (values[col.caseIndex] ?? "").replace(/[",\s]/g, "");
      const rawSentinel = (values[col.sentinelIndex] ?? "").replace(/[",\s]/g, "");

      const caseCount = rawCase && rawCase !== "-" ? parseInt(rawCase, 10) : 0;
      const perSentinel = rawSentinel && rawSentinel !== "-" ? parseFloat(rawSentinel) : 0;

      records.push({
        diseaseId: col.diseaseId,
        diseaseNameJa: col.diseaseNameJa,
        prefecture: prefName,
        prefectureId,
        caseCount: isNaN(caseCount) ? 0 : caseCount,
        perSentinel: isNaN(perSentinel) ? 0 : perSentinel,
        reportYear: year,
        reportWeek: week,
      });
    }
  }

  return records;
}

/**
 * 直近の利用可能な週のデータを取得（最大 4 週前まで遡る）
 */
export async function fetchLatestIdwrData(
  maxFallbackWeeks = 4
): Promise<{ records: IdwrRecord[]; year: number; week: number }> {
  const now = new Date();
  let year = now.getFullYear();

  // ISO 週番号を計算
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear =
    Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000) + 1;
  let week = Math.ceil(dayOfYear / 7);

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxFallbackWeeks; attempt++) {
    try {
      const csvText = await fetchCsv(year, week);
      const records = parseCsv(csvText, year, week);

      if (records.length > 0) {
        return { records, year, week };
      }

      logger.warn({ year, week }, "IDWR: データなし、前週を試みます");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ year, week, err: lastError.message }, "IDWR: 取得失敗");
    }

    week--;
    if (week < 1) {
      week = 52;
      year--;
    }
  }

  throw lastError ?? new Error("IDWR データ取得失敗");
}
