import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@workspace/api-client-react";
import { useNotificationSetup } from "../hooks/useNotificationSetup";

// API Gateway URL — override with EXPO_PUBLIC_API_BASE_URL env var if needed
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://rrxho9axj1.execute-api.ap-northeast-1.amazonaws.com/dev";

setBaseUrl(API_BASE_URL);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 60 * 1000, // 1 hour — matches CloudFront cache TTL
      retry: 2,
    },
  },
});

function AppContent() {
  useNotificationSetup();
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
