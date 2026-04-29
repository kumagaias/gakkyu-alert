import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { useEffect, useRef } from "react";
import { useRegisterDevice, useDeregisterDevice } from "@workspace/api-client-react";
import { useApp } from "@/contexts/AppContext";

// expo-notifications はネイティブモジュールが未リンクの環境（Expo Go / シミュレーター）で
// インポート時にクラッシュする場合があるため require で安全にロードする
type NotificationsModule = typeof import("expo-notifications");
let Notifications: NotificationsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require("expo-notifications") as NotificationsModule;
  // フォアグラウンドでも通知を表示する
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Expo Go / ネイティブモジュール未リンク環境ではスキップ
}

export function useNotificationSetup() {
  const { notifications, homeDistrictId, extraDistrictIds } = useApp();
  const tokenRef = useRef<string | null>(null);
  const { mutate: registerDevice } = useRegisterDevice();
  const { mutate: deregisterDevice } = useDeregisterDevice();

  useEffect(() => {
    // Web またはネイティブモジュール未利用時はスキップ
    if (Platform.OS === "web" || !Notifications) return;

    let cancelled = false;

    async function setup() {
      if (!notifications.enabled) {
        if (tokenRef.current) {
          deregisterDevice({ fcmToken: tokenRef.current });
          tokenRef.current = null;
        }
        return;
      }

      // 通知許可をリクエスト
      let status: string;
      try {
        const result = await Notifications!.requestPermissionsAsync();
        status = result.status;
      } catch {
        return;
      }
      if (status !== "granted" || cancelled) return;

      // Expo Push Token を取得
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      if (!projectId) return;

      let token: string;
      try {
        const result = await Notifications!.getExpoPushTokenAsync({ projectId });
        token = result.data;
      } catch {
        // シミュレーター等では取得不可
        return;
      }

      if (cancelled) return;
      tokenRef.current = token;

      // バックエンドにデバイス登録
      registerDevice({
        data: {
          fcmToken: token,
          platform: Platform.OS as "ios" | "android",
          homeDistrictId: homeDistrictId ?? "",
          extraDistrictIds: extraDistrictIds,
          alertLevel: notifications.alertLevel,
          deviceModel: Device.modelName ?? undefined,
        },
      });
    }

    setup();
    return () => { cancelled = true; };
  }, [
    notifications.enabled,
    notifications.alertLevel,
    homeDistrictId,
    extraDistrictIds,
    registerDevice,
    deregisterDevice,
  ]);
}
