import { Router, type IRouter } from "express";
import { putDevice, deleteDevice } from "../../lib/dynamodb.js";
import { logger } from "../../lib/logger.js";

const router: IRouter = Router();

// POST /v1/devices — デバイス登録 / 設定同期（アップサート）
router.post("/devices", async (req, res) => {
  const {
    fcmToken,
    platform,
    homeDistrictId,
    extraDistrictIds,
    alertLevel,
    deviceModel,
  } = req.body as {
    fcmToken: string;
    platform: string;
    homeDistrictId: string;
    extraDistrictIds?: string[];
    alertLevel: 2 | 3;
    deviceModel?: string;
  };

  if (!fcmToken || !platform || !homeDistrictId || alertLevel == null) {
    res.status(400).json({ error: "必須パラメータが不足しています" });
    return;
  }

  try {
    await putDevice(fcmToken, {
      platform,
      homeDistrictId,
      extraDistrictIds: extraDistrictIds ?? [],
      alertLevel,
      ...(deviceModel ? { deviceModel } : {}),
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /v1/devices エラー");
    res.status(500).json({ error: "サーバーエラー" });
  }
});

// DELETE /v1/devices/:fcmToken — デバイス解除
router.delete("/devices/:fcmToken", async (req, res) => {
  const { fcmToken } = req.params;

  if (!fcmToken) {
    res.status(400).json({ error: "fcmToken が必要です" });
    return;
  }

  try {
    await deleteDevice(fcmToken);
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "DELETE /v1/devices エラー");
    res.status(500).json({ error: "サーバーエラー" });
  }
});

export default router;
