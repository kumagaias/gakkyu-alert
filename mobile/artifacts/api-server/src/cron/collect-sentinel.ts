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
import pLimit from "p-limit";
import { fetchLatestIdwrData, PREF_ID_MAP, type IdwrRecord } from "../lib/idwr.js";
import {
  fetchLatestTmiphData,
  type HcRecord,
} from "../lib/tmiph.js";
import {
  putSnapshot,
  getSnapshotByKey,
  querySnapshots,
  getLatestSnapshot,
} from "../lib/dynamodb.js";
import { logger } from "../lib/logger.js";

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

// Amazon Nova Lite — Haiku より安価、日本語品質十分
const NOVA_MODEL = "amazon.nova-lite-v1:0";
const WEEKLY_HISTORY_WEEKS = 8;

// Bedrock API レート制限対策: 同時実行数を制限
const BEDROCK_CONCURRENCY = 1;

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

// 学級閉鎖数ベースの閾値（都道府県単位）
const CLOSURE_THRESHOLDS = [
  { level: 3, min: 30 },  // 流行: 30クラス以上
  { level: 2, min: 10 },  // 警戒: 10クラス以上
  { level: 1, min: 1  },  // 注意: 1クラス以上
  { level: 0, min: 0  },  // なし
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
  aiOutlook: string;
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


function isoWeekKey(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Amazon Nova Lite 呼び出し
// ---------------------------------------------------------------------------

async function invokeNova(
  client: BedrockRuntimeClient,
  prompt: string,
  maxTokens = 200
): Promise<string> {
  const maxRetries = 3;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
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
      
      // スロットリング対策: リクエスト間隔を長めに設定
      await sleep(3000);
      
      return body.output?.message?.content?.[0]?.text?.trim() ?? "";
    } catch (err) {
      lastError = err as Error;
      
      // ThrottlingException の場合は exponential backoff でリトライ
      if (err && typeof err === "object" && "name" in err && err.name === "ThrottlingException") {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        logger.warn({ attempt, backoffMs }, "Bedrock throttled, retrying...");
        await sleep(backoffMs);
        continue;
      }
      
      // その他のエラーは即座に throw
      throw err;
    }
  }
  
  throw lastError ?? new Error("invokeNova failed after retries");
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
  prefId: string,
  prefName: string,
  diseaseId: string,
  perSentinel: number,
  level: number
): Promise<string> {
  const trend =
    level === 3 ? "急増" : level === 2 ? "増加中" : level === 1 ? "散発" : "落ち着き";
  
  // 胃腸炎は具体的な注意喚起を追加
  const isGastro = diseaseId === "gastro" && level >= 1;
  const extraGuidance = isGastro
    ? "\n感染性胃腸炎が注意レベルです。手洗い・うがいの徹底、嘔吐物の適切な処理、症状がある場合は登園・登校を控えるなど、具体的な予防策を含めてください。"
    : "";
  
  // キャッシュキー: prefId#diseaseId を id とし、level 変化でキャッシュミス
  return getCachedOrGenerateSummary(
    client,
    `${prefId}#${diseaseId}`,
    level,
    () =>
      `${prefName}の感染症データを保護者向けに1〜2文で簡潔にコメントしてください。
疾患ID: ${diseaseId}
定点あたり患者数: ${perSentinel.toFixed(2)}
流行レベル: ${level} (0=なし, 1=注意, 2=警戒, 3=流行)
傾向: ${trend}${extraGuidance}
出力は日本語の1〜2文のみ。余分な説明不要。`
  );
}

async function generateDiseaseOutlook(
  client: BedrockRuntimeClient,
  prefId: string,
  prefName: string,
  diseaseId: string,
  weeklyHistory: number[],
  weekKey: string
): Promise<string> {
  // キャッシュキー: prefId + diseaseId + weekKey で都道府県ごとにキャッシュ
  const cacheKey = `${prefId}#${diseaseId}#outlook#${weekKey}`;
  const cached = await getSnapshotByKey<{ outlook: string }>(
    "PREF_SUMMARY_CACHE",
    cacheKey
  );
  if (cached?.outlook) return cached.outlook;

  const now = new Date();
  const month = now.getMonth() + 1;
  const season =
    month >= 12 || month <= 2 ? "冬（インフルエンザ流行期）" :
    month >= 3  && month <= 5  ? "春（学年末・新学期）" :
    month >= 6  && month <= 8  ? "夏（感染症落ち着き期）" :
    "秋（感染症増加準備期）";

  const outlook = await invokeNova(
    client,
    `${prefName}の感染症（疾患ID: ${diseaseId}）について、定点当り患者数の過去8週データに基づき、来週の見通しを保護者向けに1〜2文で予測してください。
過去8週の定点当り患者数（古い順）: ${weeklyHistory.map((v) => v.toFixed(2)).join(", ")}
現在: ${month}月（${season}）
出力は日本語の1〜2文のみ。増加・減少・横ばいなどの傾向を定性的に。具体的な数値の断言は避ける。`,
    120
  );
  if (outlook) {
    await putSnapshot("PREF_SUMMARY_CACHE", cacheKey, { outlook });
  }
  return outlook;
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
    const sentinelLevel = calcLevel(rec.perSentinel, FLU_THRESHOLDS);
    diseases.push({
      id: diseaseId,
      currentLevel: sentinelLevel,
      currentCount: rec.perSentinel,
      lastWeekCount: 0,
      twoWeeksAgoCount: 0,
      weeklyHistory: [],
      aiComment: "",
      aiOutlook: "",
    });
  }

  try {
    await buildWeeklyHistory(weekKey, diseases);
    logger.info({ weekKey }, "週次履歴 構築完了");
  } catch (err) {
    logger.warn({ err }, "週次履歴 構築失敗 — スキップ");
  }

  // 学級閉鎖データを取得して流行レベルを再計算
  const diseaseClosureData = await getLatestSnapshot<{ entries: Array<{ diseaseId: string; closedClasses: number }> }>(
    "CLOSURE"
  ).catch(() => null);

  for (const disease of diseases) {
    const closure = diseaseClosureData?.entries?.find((e) => e.diseaseId === disease.id);
    if (closure) {
      const closureLevel = calcLevel(closure.closedClasses, CLOSURE_THRESHOLDS);
      disease.currentLevel = Math.max(disease.currentLevel, closureLevel) as 0 | 1 | 2 | 3;
    }

    // レベル確定後にAIコメント生成
    try {
      disease.aiComment = await generateDiseaseComment(
        bedrock,
        "tokyo",
        "東京都",
        disease.id,
        disease.currentCount,
        disease.currentLevel
      );
    } catch (err) {
      logger.warn({ diseaseId: disease.id, err }, "疾患 AI コメント生成失敗 — スキップ");
    }
  }

  // 週次履歴が揃った後に来週の見通しを生成
  for (const disease of diseases) {
    if (disease.weeklyHistory.some((v) => v > 0)) {
      try {
        disease.aiOutlook = await generateDiseaseOutlook(
          bedrock,
          "tokyo",
          "東京都",
          disease.id,
          disease.weeklyHistory,
          weekKey
        );
      } catch (err) {
        logger.warn({ diseaseId: disease.id, err }, "疾患 AI 見通し生成失敗 — スキップ");
      }
    }
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

  // 都道府県 × 疾患 の perSentinel を集計 (全疾患)
  type PrefDisease = { flu: number; covid: number; all: Map<string, number> };
  const prefMap = new Map<string, PrefDisease>();

  for (const rec of idwrRecords) {
    if (!rec.prefectureId) continue;
    if (!prefMap.has(rec.prefectureId)) {
      prefMap.set(rec.prefectureId, { flu: 0, covid: 0, all: new Map() });
    }
    const entry = prefMap.get(rec.prefectureId)!;
    if (rec.diseaseId === "flu-a") entry.flu   = rec.perSentinel;
    if (rec.diseaseId === "covid") entry.covid = rec.perSentinel;
    if (!entry.all.has(rec.diseaseId)) {
      entry.all.set(rec.diseaseId, rec.perSentinel);
    }
  }

  // 週次履歴構築用: 過去 (WEEKLY_HISTORY_WEEKS-1) 週分の PREFECTURE_STATUS を一括取得
  type HistoryPrefDisease = { id: string; perSentinel: number };
  type HistoryPrefEntry   = { id: string; diseases: HistoryPrefDisease[] };
  type HistorySnap        = { prefectures: HistoryPrefEntry[] };

  const prevPrefSnaps = await querySnapshots<HistorySnap>({
    KeyConditionExpression: "pk = :pk AND sk < :sk",
    ExpressionAttributeValues: { ":pk": "PREFECTURE_STATUS", ":sk": weekKey },
    ScanIndexForward: false,
    Limit: WEEKLY_HISTORY_WEEKS - 1,
  }).then((snaps) => snaps.reverse());

  type PrefDiseaseEntry = {
    id: string;
    perSentinel: number;
    level: number;
    weeklyHistory: number[];
    lastWeekCount: number;
    twoWeeksAgoCount: number;
    aiComment: string;
    aiOutlook: string;
  };

  const prefectures: Array<{
    id: string;
    level: number;
    aiSummary: string;
    diseases: PrefDiseaseEntry[];
  }> = [];

  // 並列実行制限を設定（全都道府県で共有）
  const limit = pLimit(BEDROCK_CONCURRENCY);

  // 全都道府県のデータ準備（週次履歴構築）
  const prefDataList: Array<{
    prefId: string;
    prefName: string;
    level: 0 | 1 | 2 | 3;
    flu: number;
    covid: number;
    diseaseBreakdown: PrefDiseaseEntry[];
  }> = [];

  for (const [prefId, { flu, covid, all }] of prefMap) {
    const prefName = PREF_NAMES[prefId] ?? prefId;

    // 疾患ごとに週次履歴を構築
    const diseaseBreakdown: PrefDiseaseEntry[] = Array.from(all.entries()).map(
      ([diseaseId, perSentinel]) => ({
        id: diseaseId,
        perSentinel,
        level: calcLevel(perSentinel, diseaseId === "covid" ? COVID_THRESHOLDS : FLU_THRESHOLDS),
        weeklyHistory: [],
        lastWeekCount: 0,
        twoWeeksAgoCount: 0,
        aiComment: "",
        aiOutlook: "",
      })
    );

    // 全疾患の最大レベルを都道府県レベルとする
    const level = diseaseBreakdown.reduce(
      (max, d) => Math.max(max, d.level),
      0
    ) as 0 | 1 | 2 | 3;

    // 週次履歴: 過去スナップから perSentinel を抽出
    for (const disease of diseaseBreakdown) {
      const counts = prevPrefSnaps.map((snap) => {
        const pref = snap.prefectures?.find((p) => p.id === prefId);
        const d = pref?.diseases?.find((x) => x.id === disease.id);
        return (d as { perSentinel?: number } | undefined)?.perSentinel ?? 0;
      });
      while (counts.length < WEEKLY_HISTORY_WEEKS - 1) counts.unshift(0);
      disease.weeklyHistory    = [...counts, disease.perSentinel];
      disease.lastWeekCount    = counts[counts.length - 1] ?? 0;
      disease.twoWeeksAgoCount = counts[counts.length - 2] ?? 0;
    }

    prefDataList.push({ prefId, prefName, level, flu, covid, diseaseBreakdown });
  }

  // AI コメント生成タスクを全都道府県分まとめて並列実行制限
  const allAiTasks: Promise<void>[] = [];

  for (const { prefId, prefName, level, flu, covid, diseaseBreakdown } of prefDataList) {
    // 疾患別 AI コメント (level > 0 のみ)
    for (const disease of diseaseBreakdown) {
      if (disease.level === 0) continue;
      allAiTasks.push(
        limit(async () => {
          try {
            disease.aiComment = await generateDiseaseComment(
              bedrock, prefId, prefName, disease.id, disease.perSentinel, disease.level
            );
          } catch (err) {
            logger.warn({ prefId, diseaseId: disease.id, err }, "都道府県疾患 AI コメント生成失敗 — スキップ");
          }
        })
      );
    }

    // 都道府県サマリー
    allAiTasks.push(
      limit(async () => {
        try {
          const aiSummary = await generatePrefSummary(bedrock, prefId, level, flu, covid);
          prefectures.push({ id: prefId, level, aiSummary, diseases: diseaseBreakdown });
        } catch (err) {
          logger.warn({ prefId, err }, "都道府県 AI サマリー生成失敗 — スキップ");
          prefectures.push({ id: prefId, level, aiSummary: "", diseases: diseaseBreakdown });
        }
      })
    );
  }

  // 全タスクを並列実行（制限付き）
  await Promise.all(allAiTasks);

  // 学級閉鎖データを取得して流行レベルを再計算
  const prefClosureData = await getSnapshotByKey<{ prefectures: Array<{ id: string; hasData: boolean; diseases: Array<{ id: string; closedClasses: number }> }> }>(
    "CLOSURE_BY_PREF",
    weekKey
  );

  function calcClosureLevel(closedClasses: number): 0 | 1 | 2 | 3 {
    if (closedClasses >= 30) return 3;
    if (closedClasses >= 10) return 2;
    if (closedClasses >= 1) return 1;
    return 0;
  }

  // 定点サーベイランスと学級閉鎖の両方を考慮して流行レベルを再計算
  for (const pref of prefectures) {
    const closure = prefClosureData?.prefectures?.find((p: any) => p.id === pref.id);
    if (closure?.hasData) {
      const totalClosed = closure.diseases.reduce((sum: number, d: any) => sum + d.closedClasses, 0);
      const closureLevel = calcClosureLevel(totalClosed);
      pref.level = Math.max(pref.level, closureLevel);
    }
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
