/**
 * Lambda cron ハンドラー — 定点把握データ収集 + AI コメント生成
 *
 * トリガー: EventBridge 毎週月曜 5:00 JST (cron(0 20 ? * SUN *))
 * データ:
 *   - IDWR CSV → 全47都道府県の疾患別定点当り患者数
 *   - TMIPH → 東京都保健所別データ (district level)
 *   - Amazon Nova Lite → AIサマリー生成 (level変化時のみ、DynamoDBキャッシュ)
 * 保存先 (gakkyu-alert-snapshots-dev):
 *   - pk=DISEASE_STATUS,     sk=<YYYY-W{WW}>
 *   - pk=DISTRICT_STATUS,    sk=<YYYY-W{WW}>   (東京都地区レベル)
 *   - pk=PREFECTURE_STATUS,  sk=<YYYY-W{WW}>   (全47都道府県)
 *   - pk=PREF_SUMMARY_CACHE, sk=<prefId>#level<N>  (AIサマリーキャッシュ)
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { fetchLatestIdwrData, PREF_ID_MAP, type IdwrRecord } from "../lib/idwr.js";
import {
  fetchLatestTmiphData,
  type HcRecord,
} from "../lib/tmiph.js";
import {
  putSnapshot,
  getSnapshotByKey,
  querySnapshots,
} from "../lib/dynamodb.js";
import { logger } from "../lib/logger.js";

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

// Amazon Nova Lite — Haiku より安価、日本語品質十分
const NOVA_MODEL = "amazon.nova-lite-v1:0";
const WEEKLY_HISTORY_WEEKS = 8;

// 都道府県の日本語名
const PREF_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(PREF_ID_MAP).map(([ja, id]) => [id, ja])
);

// 東京都 地区レベル算出対象
const DISTRICT_NAMES: Record<string, string> = {
  nerima:    "練馬区",
  suginami:  "杉並区",
  musashino: "武蔵野市",
  itabashi:  "板橋区",
  toshima:   "豊島区",
  nakano:    "中野区",
  setagaya:  "世田谷区",
  mitaka:    "三鷹市",
};

// 流行レベル閾値（定点あたり患者数 / 週）
// インフルエンザ: 東京都公式基準準拠
// COVID-19: 同スケールで仮設定（公式基準なし）
const FLU_THRESHOLDS = [
  { level: 3, min: 30 },
  { level: 2, min: 10 },
  { level: 1, min: 1  },
  { level: 0, min: 0  },
] as const;

const COVID_THRESHOLDS = [
  { level: 3, min: 20 },
  { level: 2, min: 10 },
  { level: 1, min: 2  },
  { level: 0, min: 0  },
] as const;

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

interface DiseaseStatus {
  id: string;
  currentLevel: 0 | 1 | 2 | 3;
  currentCount: number;
  lastWeekCount: number;
  twoWeeksAgoCount: number;
  weeklyHistory: number[];
  aiComment: string;
}

interface DiseaseStatusSnapshot {
  sk: string;
  diseases: DiseaseStatus[];
}

interface NovaResponseBody {
  output: {
    message: {
      role: string;
      content: Array<{ text: string }>;
    };
  };
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function calcLevel(
  value: number,
  thresholds: typeof FLU_THRESHOLDS | typeof COVID_THRESHOLDS
): 0 | 1 | 2 | 3 {
  for (const { level, min } of thresholds) {
    if (value >= min) return level;
  }
  return 0;
}

function prefLevel(fluPerSentinel: number, covidPerSentinel: number): 0 | 1 | 2 | 3 {
  return Math.max(
    calcLevel(fluPerSentinel, FLU_THRESHOLDS),
    calcLevel(covidPerSentinel, COVID_THRESHOLDS)
  ) as 0 | 1 | 2 | 3;
}

function isoWeekKey(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Amazon Nova Lite 呼び出し
// ---------------------------------------------------------------------------

async function invokeNova(
  client: BedrockRuntimeClient,
  prompt: string,
  maxTokens = 200
): Promise<string> {
  const res = await client.send(
    new InvokeModelCommand({
      modelId: NOVA_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { max_new_tokens: maxTokens },
      }),
    })
  );
  const body = JSON.parse(new TextDecoder().decode(res.body)) as NovaResponseBody;
  return body.output?.message?.content?.[0]?.text?.trim() ?? "";
}

// ---------------------------------------------------------------------------
// AIサマリー生成 + DynamoDB キャッシュ
// キャッシュキー: pk=PREF_SUMMARY_CACHE, sk="{prefId}#level{N}"
// level が変わると sk が変わり自動的にキャッシュミスになる
// ---------------------------------------------------------------------------

async function getCachedOrGenerateSummary(
  client: BedrockRuntimeClient,
  prefId: string,
  level: number,
  generatePrompt: () => string
): Promise<string> {
  const cacheKey = `${prefId}#level${level}`;

  // キャッシュ確認
  const cached = await getSnapshotByKey<{ summary: string }>(
    "PREF_SUMMARY_CACHE",
    cacheKey
  );
  if (cached?.summary) {
    return cached.summary;
  }

  // 生成
  const summary = await invokeNova(client, generatePrompt(), 150);
  if (summary) {
    await putSnapshot("PREF_SUMMARY_CACHE", cacheKey, { summary });
  }
  return summary;
}

async function generatePrefSummary(
  client: BedrockRuntimeClient,
  prefId: string,
  level: number,
  fluPerSentinel: number,
  covidPerSentinel: number
): Promise<string> {
  const name = PREF_NAMES[prefId] ?? prefId;
  const levelLabel = ["平穏", "注意", "警戒", "流行"][level] ?? "不明";
  return getCachedOrGenerateSummary(client, prefId, level, () =>
    `${name}の感染症状況を保護者向けに1〜2文で要約してください。
流行レベル: ${level} (${levelLabel})
インフルエンザ定点当り: ${fluPerSentinel.toFixed(2)}
COVID-19定点当り: ${covidPerSentinel.toFixed(2)}
出力は日本語の1〜2文のみ。余分な説明不要。`
  );
}

async function generateDiseaseComment(
  client: BedrockRuntimeClient,
  diseaseId: string,
  perSentinel: number,
  level: number
): Promise<string> {
  const trend =
    level === 3 ? "急増" : level === 2 ? "増加中" : level === 1 ? "散発" : "落ち着き";
  return invokeNova(
    client,
    `東京都の感染症データを保護者向けに1〜2文で簡潔にコメントしてください。
疾患ID: ${diseaseId}
定点あたり患者数: ${perSentinel.toFixed(2)}
流行レベル: ${level} (0=なし, 1=注意, 2=警戒, 3=流行)
傾向: ${trend}
出力は日本語の1〜2文のみ。余分な説明不要。`,
    120
  );
}

async function generateDistrictSummary(
  client: BedrockRuntimeClient,
  districtId: string,
  level: number,
  diseases: DiseaseStatus[]
): Promise<string> {
  const name = DISTRICT_NAMES[districtId] ?? districtId;
  const active = diseases
    .filter((d) => d.currentLevel >= 1)
    .map((d) => `${d.id}(レベル${d.currentLevel}、定点当り${d.currentCount})`)
    .join("、");
  const levelLabel = ["なし", "注意", "警戒", "流行"][level] ?? "不明";
  return invokeNova(
    client,
    `東京都${name}の感染症状況を保護者向けに1〜2文で要約してください。
地域全体レベル: ${level} (${levelLabel})
流行中の疾患: ${active || "なし"}
出力は日本語の1〜2文のみ。余分な説明不要。`,
    120
  );
}

// ---------------------------------------------------------------------------
// 週次履歴の構築
// ---------------------------------------------------------------------------

async function buildWeeklyHistory(
  currentWeekKey: string,
  diseases: DiseaseStatus[]
): Promise<void> {
  const prevSnaps = await querySnapshots<DiseaseStatusSnapshot>({
    KeyConditionExpression: "pk = :pk AND sk < :sk",
    ExpressionAttributeValues: { ":pk": "DISEASE_STATUS", ":sk": currentWeekKey },
    ScanIndexForward: false,
    Limit: WEEKLY_HISTORY_WEEKS - 1,
  });

  const history = prevSnaps.reverse();

  for (const disease of diseases) {
    const counts = history.map((snap) => {
      const d = snap.diseases?.find((x) => x.id === disease.id);
      return d?.currentCount ?? 0;
    });

    while (counts.length < WEEKLY_HISTORY_WEEKS - 1) counts.unshift(0);

    disease.weeklyHistory    = [...counts, disease.currentCount];
    disease.lastWeekCount    = counts[counts.length - 1] ?? 0;
    disease.twoWeeksAgoCount = counts[counts.length - 2] ?? 0;
  }
}

// ---------------------------------------------------------------------------
// Lambda ハンドラー
// ---------------------------------------------------------------------------

export const handler = async (): Promise<void> => {
  logger.info("定点把握データ収集 開始");

  const { records: idwrRecords, year, week } = await fetchLatestIdwrData();
  logger.info({ year, week, count: idwrRecords.length }, "IDWR データ取得完了");

  const bedrock = new BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? "ap-northeast-1",
  });

  const weekKey = isoWeekKey(year, week);

  // ── 1. DISEASE_STATUS (東京都・疾患別) ──────────────────────────────────────

  const tokyoByDisease = new Map<string, IdwrRecord>();
  for (const rec of idwrRecords) {
    if (rec.prefectureId === "tokyo") {
      // 同じ疾患が複数行ある場合は最初のものを採用
      if (!tokyoByDisease.has(rec.diseaseId)) {
        tokyoByDisease.set(rec.diseaseId, rec);
      }
    }
  }

  const diseases: DiseaseStatus[] = [];
  for (const [diseaseId, rec] of tokyoByDisease) {
    const level = calcLevel(rec.perSentinel, FLU_THRESHOLDS);
    let aiComment = "";
    try {
      aiComment = await generateDiseaseComment(bedrock, diseaseId, rec.perSentinel, level);
    } catch (err) {
      logger.warn({ diseaseId, err }, "疾患 AI コメント生成失敗 — スキップ");
    }
    diseases.push({
      id: diseaseId,
      currentLevel: level,
      currentCount: rec.perSentinel,
      lastWeekCount: 0,
      twoWeeksAgoCount: 0,
      weeklyHistory: [],
      aiComment,
    });
  }

  try {
    await buildWeeklyHistory(weekKey, diseases);
    logger.info({ weekKey }, "週次履歴 構築完了");
  } catch (err) {
    logger.warn({ err }, "週次履歴 構築失敗 — スキップ");
  }

  await putSnapshot("DISEASE_STATUS", weekKey, {
    diseases,
    generatedAt: new Date().toISOString(),
  });
  logger.info({ sk: weekKey, diseaseCount: diseases.length }, "DISEASE_STATUS 保存完了");

  // 東京都最大レベル (TMIPH 失敗時のフォールバック用)
  const tokyoMaxLevel = diseases.reduce(
    (max, d) => Math.max(max, d.currentLevel), 0
  ) as 0 | 1 | 2 | 3;

  // ── 2. DISTRICT_STATUS (東京都・保健所別地区レベル) ─────────────────────────

  let hcRecords: HcRecord[] = [];
  try {
    const { records, year: hcYear, week: hcWeek } = await fetchLatestTmiphData();
    hcRecords = records;
    logger.info({ hcYear, hcWeek, count: records.length }, "TMIPH 保健所別データ取得完了");
  } catch (err) {
    logger.warn({ err }, "TMIPH データ取得失敗 — 東京都全体レベルで代替");
  }

  const districtToHc = new Map<string, HcRecord>();
  for (const rec of hcRecords) {
    for (const distId of rec.districtIds) districtToHc.set(distId, rec);
  }

  const districts: Array<{ id: string; level: number; aiSummary: string }> = [];
  for (const districtId of Object.keys(DISTRICT_NAMES)) {
    const hcRec = districtToHc.get(districtId);
    const districtLevel: 0 | 1 | 2 | 3 = hcRec
      ? calcLevel(hcRec.fluPerSentinel, FLU_THRESHOLDS)
      : tokyoMaxLevel;

    let aiSummary = "";
    try {
      aiSummary = await generateDistrictSummary(bedrock, districtId, districtLevel, diseases);
    } catch (err) {
      logger.warn({ districtId, err }, "地区 AI サマリー生成失敗 — スキップ");
    }
    districts.push({ id: districtId, level: districtLevel, aiSummary });
  }

  await putSnapshot("DISTRICT_STATUS", weekKey, {
    districts,
    generatedAt: new Date().toISOString(),
  });
  logger.info({ sk: weekKey, districtCount: districts.length }, "DISTRICT_STATUS 保存完了");

  // ── 3. PREFECTURE_STATUS (全47都道府県) ─────────────────────────────────────

  // 都道府県 × 疾患 の perSentinel を集計
  type PrefDisease = { flu: number; covid: number };
  const prefMap = new Map<string, PrefDisease>();

  for (const rec of idwrRecords) {
    if (!rec.prefectureId) continue;
    const entry = prefMap.get(rec.prefectureId) ?? { flu: 0, covid: 0 };
    if (rec.diseaseId === "flu")   entry.flu   = rec.perSentinel;
    if (rec.diseaseId === "covid") entry.covid = rec.perSentinel;
    prefMap.set(rec.prefectureId, entry);
  }

  const prefectures: Array<{ id: string; level: number; aiSummary: string }> = [];

  for (const [prefId, { flu, covid }] of prefMap) {
    const level = prefLevel(flu, covid);

    let aiSummary = "";
    try {
      aiSummary = await generatePrefSummary(bedrock, prefId, level, flu, covid);
    } catch (err) {
      logger.warn({ prefId, err }, "都道府県 AI サマリー生成失敗 — スキップ");
    }
    prefectures.push({ id: prefId, level, aiSummary });
  }

  await putSnapshot("PREFECTURE_STATUS", weekKey, {
    prefectures,
    generatedAt: new Date().toISOString(),
  });
  logger.info(
    { sk: weekKey, prefectureCount: prefectures.length },
    "PREFECTURE_STATUS 保存完了"
  );
};
