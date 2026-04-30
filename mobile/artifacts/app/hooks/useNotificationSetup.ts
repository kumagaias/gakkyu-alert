/**
 * Push 通知セットアップフック
 *
 * アプリ起動時に一度呼び出す。
 * 1. 通知パーミッション要求
 * 2. Expo Push Token 取得
 * 3. バックエンドにデバイス登録 (PUT /api/v1/devices)
 */

import { useEffect } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { registerDevice } from "@workspace/api-client-react";
import type { DeviceRegistrationPlatform } from "@workspace/api-client-react";

// デフォルト設定 — 将来の設定画面で上書き可能
const DEFAULT_HOME_DISTRICT = "nerima";
const DEFAULT_ALERT_LEVEL = 2 as const; // 2 = 閉鎖があれば通知

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  // Web は Web Push が別途必要なため現バージョンではスキップ
  if (Platform.OS === "web") return null;

  // 実機以外（シミュレーター等）ではトークン取得不可
  if (!Device.isDevice) {
    console.warn("[Notifications] 実機でのみ Push トークンを取得できます");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[Notifications] 通知パーミッションが拒否されました");
    return null;
  }

  // EAS projectId があれば使用、なければ Expo Go 用フォールバック
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  return tokenData.data;
}

export function useNotificationSetup(): void {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await registerForPushNotifications();
        if (!token || cancelled) return;

        const platform: DeviceRegistrationPlatform =
          Platform.OS === "ios" ? "ios" : "android";

        await registerDevice(
          {
            fcmToken: token,
            platform,
            homeDistrictId: DEFAULT_HOME_DISTRICT,
            alertLevel: DEFAULT_ALERT_LEVEL,
          },
          { signal: AbortSignal.timeout(10_000) }
        );
      } catch (err) {
        // 通知登録の失敗はアプリの動作に影響させない
        console.warn("[Notifications] デバイス登録失敗:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
