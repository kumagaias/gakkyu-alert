/**
 * Lambda cron ハンドラー — Push 通知送信
 *
 * トリガー: EventBridge 毎日 6:30 JST (cron(30 21 * * ? *))
 *
 * フロー:
 *   1. 当日の学級閉鎖スナップショットを取得
 *   2. アラートレベルを判定 (2=警戒 / 3=流行 / 1=通常)
 *   3. 登録デバイスを全件取得
 *   4. device.alertLevel <= 当日レベル のデバイスに Expo Push API で通知を送信
 */

import { ALL_CLOSURE_DISEASES, type ClosureEntry } from "../lib/tableau.js";
import { getLatestSnapshot, queryAllDevices } from "../lib/dynamodb.js";
import { logger } from "../lib/logger.js";

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

interface ClosureSnapshot {
  pk: string;
  sk: string;
  entries: ClosureEntry[];
  fetchedAt?: string;
}

interface DeviceRecord {
  pk: string;
  sk: string;           // = fcmToken
  alertLevel: 2 | 3;
  homeDistrictId: string;
  platform?: string;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushResponse {
  data: ExpoPushTicket[];
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

/** Lambda は UTC で動くため JST (UTC+9) の日付文字列を返す */
function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 本日のアラートレベルを判定
 *   level 1: 閉鎖なし
 *   level 2: いずれかの疾患で閉鎖あり
 *   level 3: いずれかの疾患が alertThreshold 以上
 */
function computeAlertLevel(entries: ClosureEntry[]): 1 | 2 | 3 {
  const isHigh = ALL_CLOSURE_DISEASES.some((d) => {
    const e = entries.find((en) => en.diseaseId === d.diseaseId);
    return (e?.closedClasses ?? 0) >= d.alertThreshold;
  });
  if (isHigh) return 3;

  const hasAny = entries.some((e) => e.closedClasses > 0);
  if (hasAny) return 2;

  return 1;
}

/** 通知本文を生成（閉鎖数が多い疾患を先頭に） */
function buildNotificationBody(entries: ClosureEntry[]): string {
  const active = [...entries]
    .filter((e) => e.closedClasses > 0)
    .sort((a, b) => b.closedClasses - a.closedClasses);

  if (active.length === 0) return "";

  const top = active[0];
  const total = active.reduce((s, e) => s + e.closedClasses, 0);
  const suffix = active.length > 1 ? `（計 ${total} クラス）` : "";
  return `${top.diseaseName} ${top.closedClasses} クラス閉鎖${suffix}。アプリで詳細を確認してください。`;
}

/** Expo Push API にバッチ送信 (最大 100 トークン / リクエスト) */
async function sendExpoBatch(
  tokens: string[],
  title: string,
  body: string
): Promise<{ success: number; failure: number }> {
  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    sound: "default",
    data: { type: "closure_alert" },
    priority: "high",
  }));

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Expo Push API エラー: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as ExpoPushResponse;
  const success = json.data.filter((t) => t.status === "ok").length;
  const failure = json.data.filter((t) => t.status === "error").length;
  return { success, failure };
}

// ---------------------------------------------------------------------------
// Lambda ハンドラー
// ---------------------------------------------------------------------------

export const handler = async (): Promise<void> => {
  const today = todayJst();
  logger.info({ today }, "Push 通知送信 開始");

  // 1. 当日の学級閉鎖スナップショットを取得
  const snapshot = await getLatestSnapshot<ClosureSnapshot>("CLOSURE");
  if (!snapshot) {
    logger.warn("本日の学級閉鎖スナップショットが存在しません。スキップします。");
    return;
  }

  const { entries } = snapshot;
  const alertLevel = computeAlertLevel(entries);
  logger.info({ alertLevel, snapshotSk: snapshot.sk }, "アラートレベル判定");

  // 閉鎖なし → 通知不要
  if (alertLevel === 1) {
    logger.info("本日の学級閉鎖なし。通知をスキップします。");
    return;
  }

  // 2. 全デバイスを取得
  const allDevices = await queryAllDevices<DeviceRecord>();
  logger.info({ total: allDevices.length }, "デバイス取得完了");

  // 3. 当日レベル以下の alertLevel を持つデバイスに通知
  //    alertLevel 2 → レベル 2 以上のすべてのデバイス (設定 2 も 3 も)
  //    alertLevel 3 → レベル 3 のみのデバイス
  const targets = allDevices.filter((d) => d.alertLevel <= alertLevel);
  logger.info({ targets: targets.length, alertLevel }, "通知対象デバイス数");

  if (targets.length === 0) {
    logger.info("通知対象デバイスなし。終了します。");
    return;
  }

  const title = "がっきゅうアラート 🏫";
  const body = buildNotificationBody(entries);

  // 4. Expo Push 送信 (100 件ずつバッチ)
  const BATCH_SIZE = 100;
  let totalSuccess = 0;
  let totalFailure = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE).map((d) => d.sk);
    const { success, failure } = await sendExpoBatch(batch, title, body);
    totalSuccess += success;
    totalFailure += failure;
    logger.info({ batchIndex: i / BATCH_SIZE, success, failure }, "Expo Push バッチ送信");
  }

  logger.info(
    { totalSuccess, totalFailure, totalTargets: targets.length },
    "Push 通知送信 完了"
  );
};
