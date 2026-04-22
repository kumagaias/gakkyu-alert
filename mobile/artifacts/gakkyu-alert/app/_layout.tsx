import { useFonts } from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { setBaseUrl } from "@workspace/api-client-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/contexts/AppContext";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useNotificationSetup } from "@/hooks/useNotificationSetup";
import AdminPage from "./admin/index";

SplashScreen.preventAutoHideAsync();

setBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL ??
    "https://rrxho9axj1.execute-api.ap-northeast-1.amazonaws.com/dev"
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60 * 60 * 1000, retry: 2 } },
});

const APP_MAX_WIDTH = 480;

function ResponsiveShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;

  if (!isDesktop) return <>{children}</>;

  return (
    <View style={styles.desktopOuter}>
      <View style={[styles.desktopInner, { maxWidth: width >= 1280 ? APP_MAX_WIDTH : Math.min(APP_MAX_WIDTH, width * 0.6) }]}>
        {children}
      </View>
    </View>
  );
}

function NotificationSetup() {
  useNotificationSetup();
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular: require("../assets/fonts/Inter_400Regular.ttf"),
    Inter_500Medium: require("../assets/fonts/Inter_500Medium.ttf"),
    Inter_600SemiBold: require("../assets/fonts/Inter_600SemiBold.ttf"),
    Inter_700Bold: require("../assets/fonts/Inter_700Bold.ttf"),
    // 'feather' is the font family name used by @expo/vector-icons Feather
    feather: require("../assets/fonts/Feather.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return <LoadingScreen />;

  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location.hostname.startsWith("admin.")
  ) {
    return <AdminPage />;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AppProvider>
              <NotificationSetup />
              <ResponsiveShell>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="onboarding" />
                </Stack>
              </ResponsiveShell>
            </AppProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  desktopOuter: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#e8edf2",
  },
  desktopInner: {
    flex: 1,
    width: "100%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
  },
});
