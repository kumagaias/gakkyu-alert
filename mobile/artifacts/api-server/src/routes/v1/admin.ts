import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getLatestSnapshot, querySnapshots } from "../../lib/dynamodb.js";
import { logger } from "../../lib/logger.js";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// 認証ミドルウェア — Authorization: Bearer <token> or ?token=<token>
// ---------------------------------------------------------------------------

function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    res.status(503).json({ error: "Admin not configured" });
    return;
  }

  const bearer = req.headers.authorization?.replace("Bearer ", "");
  const query = req.query["token"] as string | undefined;
  const token = bearer ?? query;

  if (token !== adminToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.use("/admin", requireAdminToken);

// ---------------------------------------------------------------------------
// GET /v1/admin/status — バッチ稼働状況
// ---------------------------------------------------------------------------

router.get("/admin/status", async (_req, res) => {
  try {
    const [closureSnap, diseaseSnap, districtSnap] = await Promise.all([
      getLatestSnapshot<{ sk: string; updatedAt?: string }>("CLOSURE"),
      getLatestSnapshot<{ sk: string; updatedAt?: string; generatedAt?: string }>("DISEASE_STATUS"),
      getLatestSnapshot<{ sk: string; updatedAt?: string; generatedAt?: string }>("DISTRICT_STATUS"),
    ]);

    res.json({
      jobs: [
        {
          name: "collect-closures",
          schedule: "毎日 6:00 JST",
          lastRunSk: closureSnap?.sk ?? null,
          lastUpdatedAt: closureSnap?.updatedAt ?? null,
          status: closureSnap ? "ok" : "no-data",
        },
        {
          name: "collect-sentinel",
          schedule: "毎週月曜 5:00 JST",
          lastRunSk: diseaseSnap?.sk ?? null,
          lastUpdatedAt: (diseaseSnap?.generatedAt ?? diseaseSnap?.updatedAt) ?? null,
          status: diseaseSnap ? "ok" : "no-data",
        },
        {
          name: "send-alerts (district data)",
          schedule: "毎日 6:30 JST",
          lastRunSk: districtSnap?.sk ?? null,
          lastUpdatedAt: (districtSnap?.generatedAt ?? districtSnap?.updatedAt) ?? null,
          status: districtSnap ? "ok" : "no-data",
        },
      ],
    });
  } catch (err) {
    logger.error({ err }, "GET /v1/admin/status エラー");
    res.status(500).json({ error: "サーバーエラー" });
  }
});

// ---------------------------------------------------------------------------
// GET /v1/admin/closures — 学級閉鎖一覧（直近 7 件）
// ---------------------------------------------------------------------------

router.get("/admin/closures", async (_req, res) => {
  try {
    const snaps = await querySnapshots<Record<string, unknown>>({
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "CLOSURE" },
      ScanIndexForward: false,
      Limit: 7,
    });

    res.json({
      closures: snaps.map((s) => ({
        date: s.sk,
        updatedAt: s.updatedAt ?? null,
        entries: s.entries ?? [],
      })),
    });
  } catch (err) {
    logger.error({ err }, "GET /v1/admin/closures エラー");
    res.status(500).json({ error: "サーバーエラー" });
  }
});

// ---------------------------------------------------------------------------
// GET /v1/admin/diseases — 病気トレンド（直近 8 週）
// ---------------------------------------------------------------------------

router.get("/admin/diseases", async (_req, res) => {
  try {
    const snaps = await querySnapshots<Record<string, unknown>>({
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "DISEASE_STATUS" },
      ScanIndexForward: false,
      Limit: 8,
    });

    res.json({
      weeks: snaps.map((s) => ({
        weekKey: s.sk,
        generatedAt: s.generatedAt ?? s.updatedAt ?? null,
        diseases: s.diseases ?? [],
      })),
    });
  } catch (err) {
    logger.error({ err }, "GET /v1/admin/diseases エラー");
    res.status(500).json({ error: "サーバーエラー" });
  }
});

export default router;
