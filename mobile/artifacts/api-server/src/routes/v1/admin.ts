import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getLatestSnapshot, querySnapshots, queryAllDevices } from "../../lib/dynamodb.js";
import { logger } from "../../lib/logger.js";

interface DeviceRecord { pk: string; sk: string; }

async function sendExpoPush(tokens: string[], title: string, body: string): Promise<{ success: number; failure: number }> {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(tokens.map((to) => ({ to, title, body, sound: "default", priority: "high" }))),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Expo Push API: ${res.status}`);
  const json = (await res.json()) as { data: Array<{ status: string }> };
  return {
    success: json.data.filter((t) => t.status === "ok").length,
    failure: json.data.filter((t) => t.status !== "ok").length,
  };
}

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

// ---------------------------------------------------------------------------
// POST /v1/admin/test-push — テスト Push 通知送信
// body: { token?: string, title?: string, body?: string }
//   token が未指定の場合は登録済み全デバイスに送信
// ---------------------------------------------------------------------------

router.post("/admin/test-push", async (req, res) => {
  const { token, title, body } = req.body as { token?: string; title?: string; body?: string };
  const notifTitle = title?.trim() || "テスト通知";
  const notifBody  = body?.trim()  || "これはテスト通知です";

  try {
    let tokens: string[];
    if (token?.trim()) {
      tokens = [token.trim()];
    } else {
      const devices = await queryAllDevices<DeviceRecord>();
      tokens = devices.map((d) => d.sk);
    }

    if (tokens.length === 0) {
      res.json({ sent: 0, success: 0, failure: 0, message: "登録済みデバイスなし" });
      return;
    }

    const BATCH = 100;
    let success = 0, failure = 0;
    for (let i = 0; i < tokens.length; i += BATCH) {
      const r = await sendExpoPush(tokens.slice(i, i + BATCH), notifTitle, notifBody);
      success += r.success;
      failure += r.failure;
    }

    logger.info({ sent: tokens.length, success, failure }, "テスト Push 送信完了");
    res.json({ sent: tokens.length, success, failure });
  } catch (err) {
    logger.error({ err }, "POST /v1/admin/test-push エラー");
    res.status(500).json({ error: "送信失敗" });
  }
});

export default router;
