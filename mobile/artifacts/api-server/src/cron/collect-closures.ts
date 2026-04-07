/**
 * Lambda cron ハンドラー — 学級閉鎖データ収集
 *
 * トリガー: EventBridge 毎日 6:00 JST (cron(0 21 * * ? *))
 * データ: Tableau CSV → gakkyu-snapshots (pk=CLOSURE, sk=<YYYY-MM-DD>)
 */

import { fetchAllClosures } from "../lib/tableau.js";
import { putSnapshot } from "../lib/dynamodb.js";
import { logger } from "../lib/logger.js";

export const handler = async (): Promise<void> => {
  logger.info("学級閉鎖データ収集 開始");

  const { entries, fetchedAt } = await fetchAllClosures();
  logger.info({ count: entries.length }, "Tableau CSV 取得完了");

  const today = fetchedAt.slice(0, 10); // YYYY-MM-DD

  await putSnapshot("CLOSURE", today, {
    entries,
    sourceUrl: "https://public.tableau.com/app/profile/jssh.absence.information.mapping.service/viz/____17095533629730/1",
    tableauUrl: "https://public.tableau.com/views/____17095533629730/1",
  });

  logger.info({ sk: today }, "スナップショット保存完了");
};
