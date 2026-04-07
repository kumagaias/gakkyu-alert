/**
 * Lambda cron ハンドラー — 定点把握データ収集 + AI コメント生成
 *
 * トリガー: EventBridge 毎週月曜 5:00 JST (cron(0 20 ? * SUN *))
 * データ:
 *   - IDWR CSV → 疾患別患者数
 *   - 過去 7 週分スナップショット → weeklyHistory / lastWeekCount / twoWeeksAgoCount
 *   - Bedrock (Claude 3 Haiku) → 疾患別 aiComment + 地区別 aiSummary
 *   - gakkyu-snapshots (pk=DISEASE_STATUS, sk=<YYYY-W{WW}>)
 *   - gakkyu-snapshots (pk=DISTRICT_STATUS, sk=<YYYY-W{WW}>)
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { fetchLatestIdwrData, type IdwrRecord } from "../lib/idwr.js";
import {
  fetchLatestTmiphData,
  type HcRecord,
} from "../lib/tmiph.js";
import { putSnapshot, querySnapshots } from "../lib/dynamodb.js";
import { logger } from "../lib/logger.js";

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const BEDROCK_MODEL = "anthropic.claude-3-haiku-20240307-v1:0";
const WEEKLY_HISTORY_WEEKS = 8; // 保持する週数

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

// 流行レベル閾値（定点あたり患者数 / 週）— 東京都公式基準
//   level 3 = 警報  : ≥ 30  (都または保健所単位で警報発令)
//   level 2 = 注意報: ≥ 10  (注意報発令)
//   level 1 = 注意  : ≥  1  (流行開始の目安)
//   level 0 = なし  :  < 1
// 参照: 東京都感染症情報センター https://idsc.tmiph.metro.tokyo.lg.jp/diseases/flu/flu/
const LEVEL_THRESHOLDS = [
  { level: 3, min: 30 },
  { level: 2, min: 10 },
  { level: 1, min: 1  },
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

interface BedrockResponseBody {
  content: Array<{ type: string; text: string }>;
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function calcLevel(count: number): 0 | 1 | 2 | 3 {
  for (const { level, min } of LEVEL_THRESHOLDS) {
    if (count >= min) return level;
  }
  return 0;
}

function isoWeekKey(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Bedrock 呼び出し
// ---------------------------------------------------------------------------

async function invokeHaiku(
  client: BedrockRuntimeClient,
  prompt: string,
  maxTokens = 150
): Promise<string> {
  const res = await client.send(
    new InvokeModelCommand({
      modelId: BEDROCK_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    })
  );
  const body = JSON.parse(new TextDecoder().decode(res.body)) as BedrockResponseBody;
  const block = body.content[0];
  return block?.type === "text" ? block.text.trim() : "";
}

async function generateDiseaseComment(
  client: BedrockRuntimeClient,
  diseaseId: string,
  count: number,
  level: number
): Promise<string> {
  const trend =
    level === 3 ? "急増" : level === 2 ? "増加中" : level === 1 ? "散発" : "落ち着き";
  return invokeHaiku(
    client,
    `東京都の感染症データを保護者向けに1〜2文で簡潔にコメントしてください。
疾患ID: ${diseaseId}
定点あたり患者数: ${count}
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
    .map((d) => `${d.id}(レベル${d.currentLevel}、患者数${d.currentCount})`)
    .join("、");
  const levelLabel = ["なし", "注意", "警戒", "流行"][level] ?? "不明";

  return invokeHaiku(
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
  // 現在週より前のスナップショットを最大 (WEEKLY_HISTORY_WEEKS - 1) 件取得
  const prevSnaps = await querySnapshots<DiseaseStatusSnapshot>({
    KeyConditionExpression: "pk = :pk AND sk < :sk",
    ExpressionAttributeValues: { ":pk": "DISEASE_STATUS", ":sk": currentWeekKey },
    ScanIndexForward: false,
    Limit: WEEKLY_HISTORY_WEEKS - 1,
  });

  // newest-first → oldest-first に並べ替え
  const history = prevSnaps.reverse();

  for (const disease of diseases) {
    const counts = history.map((snap) => {
      const d = snap.diseases?.find((x) => x.id === disease.id);
      return d?.currentCount ?? 0;
    });

    // 8 週分に満たない場合は先頭を 0 で埋める
    while (counts.length < WEEKLY_HISTORY_WEEKS - 1) {
      counts.unshift(0);
    }

    disease.weeklyHistory     = [...counts, disease.currentCount]; // oldest → newest
    disease.lastWeekCount     = counts[counts.length - 1] ?? 0;
    disease.twoWeeksAgoCount  = counts[counts.length - 2] ?? 0;
  }
}

// ---------------------------------------------------------------------------
// Lambda ハンドラー
// ---------------------------------------------------------------------------

export const handler = async (): Promise<void> => {
  logger.info("定点把握データ収集 開始");

  const { records, year, week } = await fetchLatestIdwrData();
  logger.info({ year, week, count: records.length }, "IDWR データ取得完了");

  const bedrock = new BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? "ap-northeast-1",
  });

  // 疾患別に集計（東京都のデータのみ）
  const byDisease = new Map<string, IdwrRecord>();
  for (const rec of records) {
    if (rec.prefecture === "東京都") {
      byDisease.set(rec.diseaseId, rec);
    }
  }

  const weekKey = isoWeekKey(year, week);

  // 疾患ステータス + AI コメント生成
  const diseases: DiseaseStatus[] = [];

  for (const [diseaseId, rec] of byDisease) {
    const level = calcLevel(rec.caseCount);
    let aiComment = "";
    try {
      aiComment = await generateDiseaseComment(bedrock, diseaseId, rec.caseCount, level);
    } catch (err) {
      logger.warn({ diseaseId, err }, "疾患 AI コメント生成失敗 — スキップ");
    }

    diseases.push({
      id: diseaseId,
      currentLevel: level,
      currentCount: rec.caseCount,
      lastWeekCount: 0,
      twoWeeksAgoCount: 0,
      weeklyHistory: [],
      aiComment,
    });
  }

  // 週次履歴を DynamoDB 過去スナップショットから構築
  try {
    await buildWeeklyHistory(weekKey, diseases);
    logger.info({ weekKey }, "週次履歴 構築完了");
  } catch (err) {
    logger.warn({ err }, "週次履歴 構築失敗 — スキップ");
  }

  // DISEASE_STATUS スナップショット保存
  await putSnapshot("DISEASE_STATUS", weekKey, {
    diseases,
    generatedAt: new Date().toISOString(),
  });
  logger.info({ sk: weekKey, diseaseCount: diseases.length }, "DISEASE_STATUS 保存完了");

  // DISTRICT_STATUS: 保健所別データで地区ごとにレベルを算出
  // 東京都全体レベル（TMIPH 取得失敗時のフォールバック用）
  const tokyoMaxLevel = diseases.reduce(
    (max, d) => Math.max(max, d.currentLevel), 0
  ) as 0 | 1 | 2 | 3;

  // TMIPH 保健所別データ取得
  let hcRecords: HcRecord[] = [];
  try {
    const { records, year: hcYear, week: hcWeek } = await fetchLatestTmiphData();
    hcRecords = records;
    logger.info(
      { hcYear, hcWeek, count: records.length },
      "TMIPH 保健所別データ取得完了"
    );
  } catch (err) {
    logger.warn(
      { err },
      "TMIPH データ取得失敗 — 東京都全体レベルで代替"
    );
  }

  // district ID → 保健所レコード のマップを構築
  const districtToHc = new Map<string, HcRecord>();
  for (const rec of hcRecords) {
    for (const distId of rec.districtIds) {
      districtToHc.set(distId, rec);
    }
  }

  const districts: Array<{ id: string; level: number; aiSummary: string }> = [];

  for (const districtId of Object.keys(DISTRICT_NAMES)) {
    const hcRec = districtToHc.get(districtId);

    // 保健所別インフルエンザ定点あたり患者数 → レベル計算
    // 保健所データなし → 東京都全体レベルにフォールバック
    const districtLevel: 0 | 1 | 2 | 3 = hcRec
      ? calcLevel(hcRec.fluPerSentinel)
      : tokyoMaxLevel;

    let aiSummary = "";
    try {
      aiSummary = await generateDistrictSummary(
        bedrock,
        districtId,
        districtLevel,
        diseases
      );
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
};
