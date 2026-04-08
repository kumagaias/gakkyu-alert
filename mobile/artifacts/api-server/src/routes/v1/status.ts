import { Router, type IRouter } from "express";
import { getLatestSnapshot } from "../../lib/dynamodb.js";
import { logger } from "../../lib/logger.js";

const router: IRouter = Router();

// GET /v1/status — 学級閉鎖・疾患状況・区市状況を一括返却
router.get("/status", async (_req, res) => {
  try {
    // 最新スナップショットを並列取得
    const [closureSnap, diseaseSnap, districtSnap, prefSnap] = await Promise.all([
      getLatestSnapshot<Record<string, unknown>>("CLOSURE"),
      getLatestSnapshot<Record<string, unknown>>("DISEASE_STATUS"),
      getLatestSnapshot<Record<string, unknown>>("DISTRICT_STATUS"),
      getLatestSnapshot<Record<string, unknown>>("PREFECTURE_STATUS"),
    ]);

    const schoolClosures = closureSnap
      ? {
          lastUpdated: (closureSnap.sk as string | undefined) ?? new Date().toISOString().slice(0, 10),
          sourceUrl: closureSnap.sourceUrl ?? "",
          tableauUrl: closureSnap.tableauUrl ?? "",
          entries: (closureSnap.entries as unknown[]) ?? [],
        }
      : { lastUpdated: "", sourceUrl: "", tableauUrl: "", entries: [] };

    // DynamoDB のフィールド名を OpenAPI スキーマに正規化
    // (collect-sentinel が level で保存していた旧データとの後方互換)
    const diseases = ((diseaseSnap?.diseases as Record<string, unknown>[] | undefined) ?? []).map(
      (d) => ({
        id: d.id,
        currentLevel: (d.currentLevel ?? d.level ?? 0) as number,
        currentCount: (d.currentCount ?? 0) as number,
        lastWeekCount: (d.lastWeekCount ?? 0) as number,
        twoWeeksAgoCount: (d.twoWeeksAgoCount ?? 0) as number,
        weeklyHistory: (d.weeklyHistory ?? []) as number[],
        aiComment: (d.aiComment ?? "") as string,
      })
    );
    const districts = ((districtSnap?.districts as Record<string, unknown>[] | undefined) ?? []).map(
      (d) => ({
        id: d.id,
        level: (d.level ?? 0) as number,
        aiSummary: (d.aiSummary ?? "") as string,
      })
    );

    const prefectures = ((prefSnap?.prefectures as Record<string, unknown>[] | undefined) ?? []).map(
      (p) => ({
        id: p.id,
        level: (p.level ?? 0) as number,
        aiSummary: (p.aiSummary ?? "") as string,
      })
    );

    res.json({
      asOf: new Date().toISOString(),
      schoolClosures,
      diseases,
      districts,
      prefectures,
    });
  } catch (err) {
    logger.error({ err }, "GET /v1/status エラー");
    res.status(500).json({ error: "サーバーエラー" });
  }
});

export default router;
