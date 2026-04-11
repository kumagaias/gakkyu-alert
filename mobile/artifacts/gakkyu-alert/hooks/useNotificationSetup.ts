import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useEffect, useRef } from "react";
import { useRegisterDevice, useDeregisterDevice } from "@workspace/api-client-react";
import { useApp } from "@/contexts/AppContext";

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

export function useNotificationSetup() {
  const { notifications, homeDistrictId, extraDistrictIds } = useApp();
  const tokenRef = useRef<string | null>(null);
  const { mutate: registerDevice } = useRegisterDevice();
  const { mutate: deregisterDevice } = useDeregisterDevice();

  useEffect(() => {
    // Web・シミュレーターでは push token が取れないためスキップ
    if (Platform.OS === "web") return;

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
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted" || cancelled) return;

      // Expo Push Token を取得
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      if (!projectId) return;

      let token: string;
      try {
        const result = await Notifications.getExpoPushTokenAsync({ projectId });
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
