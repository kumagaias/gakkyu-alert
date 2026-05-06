/**
 * Lambda cron ハンドラー — 学級閉鎖データ収集 + AI 来週見通し生成（定点サーベイランスデータ連携）
 *
 * トリガー: EventBridge 毎日 6:00 JST (cron(0 21 * * ? *))
 * データ: Tableau CSV → gakkyu-snapshots (pk=CLOSURE, sk=<YYYY-MM-DD>)
 * AI:    weeklyHistory が変化した時のみ Nova Lite で来週の見通しを生成・キャッシュ
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { fetchAllClosures, fetchExtraClosures, fetchAllPrefClosures, type ClosureEntry } from "../lib/tableau.js";
import { putSnapshot, getSnapshotByKey, getLatestSnapshot } from "../lib/dynamodb.js";
import { logger } from "../lib/logger.js";

const NOVA_MODEL = "amazon.nova-lite-v1:0";

// ---------------------------------------------------------------------------
// Nova Lite 呼び出し
// ---------------------------------------------------------------------------

interface NovaResponseBody {
  output: { message: { content: Array<{ text: string }> } };
}

async function invokeNova(client: BedrockRuntimeClient, prompt: string): Promise<string> {
  const res = await client.send(
    new InvokeModelCommand({
      modelId: NOVA_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { max_new_tokens: 120 },
      }),
    })
  );
  return (
    (JSON.parse(new TextDecoder().decode(res.body)) as NovaResponseBody)
      .output?.message?.content?.[0]?.text?.trim() ?? ""
  );
}

// ---------------------------------------------------------------------------
// 来週の見通し生成 (キャッシュ付き)
// キャッシュキー: pk=CLOSURE_OUTLOOK_CACHE, sk={diseaseId}#{historyHash}
// weeklyHistory が変わると sk が変わり自動的にキャッシュミスになる
// ---------------------------------------------------------------------------

function historyHash(history: number[]): string {
  return history.join(",");
}

async function getOrGenerateOutlook(
  client: BedrockRuntimeClient,
  entry: ClosureEntry,
  today: Date,
  perSentinel: number | null,
): Promise<string> {
  const hash = historyHash(entry.weeklyHistory);
  const sentinelPart = perSentinel !== null ? `|s${perSentinel.toFixed(2)}` : "";
  // 今週の閉鎖クラス数もキャッシュキーに含め、0 に変化した場合も正しく再生成する
  const cacheKey = `${entry.diseaseId}#${hash}|c${entry.closedClasses}${sentinelPart}`;

  const cached = await getSnapshotByKey<{ outlook: string }>(
    "CLOSURE_OUTLOOK_CACHE",
    cacheKey
  );
  if (cached?.outlook) return cached.outlook;

  const month = today.getMonth() + 1;
  const season =
    month >= 12 || month <= 2 ? "冬（インフルエンザ流行期）" :
    month >= 3  && month <= 5  ? "春（学年末・新学期）" :
    month >= 6  && month <= 8  ? "夏（夏休み・感染症落ち着き期）" :
    "秋（感染症増加準備期）";

  const sentinelLine = perSentinel !== null
    ? `\n定点あたり患者数（東京都・今週）: ${perSentinel.toFixed(2)}人`
    : "";

  const prompt =
    `東京都の${entry.diseaseName}による学級閉鎖について、過去8週のデータから来週の見通しを保護者向けに1〜2文で予測してください。
過去8週の閉鎖クラス数（古い順）: ${entry.weeklyHistory.join(", ")}
今週の閉鎖クラス数: ${entry.closedClasses}${sentinelLine}
現在: ${month}月（${season}）
出力は日本語の1〜2文のみ。増加・減少・横ばいなどの傾向を定性的に。具体的な数値の断言は避ける。`;

  const outlook = await invokeNova(client, prompt);
  if (outlook) {
    await putSnapshot("CLOSURE_OUTLOOK_CACHE", cacheKey, { outlook });
  }
  return outlook;
}

// ---------------------------------------------------------------------------
// Lambda ハンドラー
// ---------------------------------------------------------------------------

interface DiseaseStatusSnap {
  diseases: Array<{ id: string; currentCount: number }>;
}

export const handler = async (): Promise<void> => {
  logger.info("学級閉鎖データ収集 開始");

  const [{ entries: mainEntries, fetchedAt }, { entries: extraEntries }] = await Promise.all([
    fetchAllClosures(),
    fetchExtraClosures(),
  ]);
  const entries = [...mainEntries, ...extraEntries];
  logger.info({ count: entries.length }, "Tableau CSV 取得完了（既存 + 追加疾患）");

  const bedrock = new BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? "ap-northeast-1",
  });
  const today = new Date(fetchedAt);

  // 最新の定点サーベイランスデータ（IDWR）を取得して AI プロンプトに活用
  const diseaseSnap = await getLatestSnapshot<DiseaseStatusSnap>("DISEASE_STATUS").catch(() => null);
  const sentinelMap = new Map<string, number>(
    (diseaseSnap?.diseases ?? []).map((d) => [d.id, d.currentCount])
  );
  logger.info({ diseaseCount: sentinelMap.size }, "定点サーベイランスデータ取得完了");

  const entriesWithOutlook: (ClosureEntry & { aiOutlook: string })[] = [];
  for (const entry of entries) {
    let aiOutlook = "";
    // データがある週だけ生成 (全週 0 はスキップ)
    if (entry.weeklyHistory.some((v) => v > 0)) {
      const perSentinel = sentinelMap.get(entry.diseaseId) ?? null;
      try {
        aiOutlook = await getOrGenerateOutlook(bedrock, entry, today, perSentinel);
      } catch (err) {
        logger.warn({ diseaseId: entry.diseaseId, err }, "来週見通し生成失敗 — スキップ");
      }
    }
    entriesWithOutlook.push({ ...entry, aiOutlook });
  }

  const today10 = fetchedAt.slice(0, 10); // YYYY-MM-DD
  await putSnapshot("CLOSURE", today10, {
    entries: entriesWithOutlook,
    sourceUrl: "https://public.tableau.com/app/profile/jssh.absence.information.mapping.service/viz/____17095533629730/1",
    tableauUrl: "https://public.tableau.com/views/____17095533629730/1",
  });

  logger.info({ sk: today10 }, "スナップショット保存完了");

  // 全都道府県の学級閉鎖データを取得して CLOSURE_BY_PREF に保存
  try {
    const { weekKey, prefectures } = await fetchAllPrefClosures();
    await putSnapshot("CLOSURE_BY_PREF", weekKey, {
      prefectures,
      loadedAt: new Date().toISOString(),
    });
    logger.info({ sk: weekKey, prefCount: prefectures.filter((p) => p.hasData).length }, "CLOSURE_BY_PREF 保存完了");
  } catch (err) {
    logger.error({ err }, "CLOSURE_BY_PREF 取得・保存失敗 — スキップ");
  }
};
