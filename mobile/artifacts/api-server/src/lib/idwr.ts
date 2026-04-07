/**
 * IDWR (感染症発生動向調査週報) CSV スクレイパー
 *
 * データソース: JIHS (国立健康危機管理研究機構)
 * URL: https://id-info.jihs.go.jp/surveillance/idwr/provisional/{year}/{week}/{year}-{week}-teiten.csv
 * エンコーディング: Shift-JIS
 */

import iconv from "iconv-lite";

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

// 東京都の CSV 上の表記（全角・半角混在に対応）
const TOKYO_PREF_LABELS = ["東京都", "東　京"];

export interface IdwrRecord {
  diseaseId: string;
  diseaseNameJa: string;
  prefecture: string;
  caseCount: number;
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
 * CSV テキストをパースして東京都の疾患別患者数を抽出
 */
function parseCsv(
  csvText: string,
  year: number,
  week: number
): IdwrRecord[] {
  const lines = csvText.split("\n");
  if (lines.length < 6) return [];

  // 3行目（index 2）が疾患名ヘッダー行
  const headers = parseCsvLine(lines[2]);

  // 疾患列インデックスを収集（疾患名の次の列が報告数）
  const diseaseColumns: Array<{
    diseaseId: string;
    diseaseNameJa: string;
    countIndex: number;
  }> = [];

  headers.forEach((header, idx) => {
    const name = header.trim().replace(/\s+/g, "");
    const diseaseId = DISEASE_ID_MAP[name];
    if (diseaseId) {
      diseaseColumns.push({ diseaseId, diseaseNameJa: name, countIndex: idx + 1 });
    }
  });

  if (diseaseColumns.length === 0) return [];

  const records: IdwrRecord[] = [];

  // 5行目（index 4）以降がデータ行
  for (let i = 4; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    if (values.length < 2) continue;

    const pref = values[0].replace(/"/g, "").trim();

    // 東京都の行だけ抽出
    if (!TOKYO_PREF_LABELS.some((label) => pref.includes(label))) continue;

    for (const col of diseaseColumns) {
      if (col.countIndex >= values.length) continue;
      const raw = values[col.countIndex].replace(/[",\s]/g, "");
      if (!raw || raw === "-") continue;
      const count = parseInt(raw, 10);
      if (isNaN(count)) continue;

      records.push({
        diseaseId: col.diseaseId,
        diseaseNameJa: col.diseaseNameJa,
        prefecture: "東京都",
        caseCount: count,
        reportYear: year,
        reportWeek: week,
      });
    }

    break; // 東京都の行を見つけたら終了
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

      console.warn(`IDWR ${year}-W${week}: データなし、前週を試みます`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`IDWR ${year}-W${week}: ${lastError.message}`);
    }

    week--;
    if (week < 1) {
      week = 52;
      year--;
    }
  }

  throw lastError ?? new Error("IDWR データ取得失敗");
}
