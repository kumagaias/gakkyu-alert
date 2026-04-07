import React, { useState } from "react";
import {
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
import { useStatusData } from "@/hooks/useStatusData";
import { DistrictInfoPanel } from "@/components/DistrictInfoPanel";
import { BannerCard } from "@/components/BannerCard";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { homeDistrict, children, notifications, isOnboarded } = useApp();
  const { districts, schoolClosures } = useStatusData();
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  if (!isOnboarded) return <Redirect href="/onboarding" />;

  // Merge real API district data (level + aiSummary) over the static homeDistrict
  const realHomeDistrict = homeDistrict
    ? { ...homeDistrict, ...(districts.find((d) => d.id === homeDistrict.id) ?? {}) }
    : null;

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.headerLeft}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.headerLogo}
            resizeMode="cover"
          />
          <View>
            <Text style={[styles.districtName, { color: colors.foreground }]}>
              {homeDistrict?.name ?? "区を選択してください"}
            </Text>
            <Text style={[styles.updatedAt, { color: colors.mutedForeground }]}>
              {schoolClosures.lastUpdated} 更新
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.settingsBtn, { backgroundColor: colors.muted }]}
          onPress={() => router.push("/(tabs)/settings")}
        >
          <Feather name="settings" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* District info: level card + AI summary + school closures + disease trends */}
        {realHomeDistrict && <DistrictInfoPanel district={realHomeDistrict} />}

        {/* Banners at bottom */}
        {children.length === 0 && (
          <BannerCard
            icon="edit"
            title="お子さんを登録する"
            subtitle="学校・保育園の年齢別アラートをお届け"
            onPress={() => router.push("/(tabs)/settings")}
          />
        )}
        {!notifications.enabled && (
          <BannerCard
            icon="bell"
            title="Push通知をオンにする"
            subtitle="学級閉鎖の目安になったらすぐお知らせ"
            onPress={() => router.push("/(tabs)/settings")}
          />
        )}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  headerLogo: {
    width: 48,
    height: 48,
    borderRadius: 13,
  },
  districtName: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  updatedAt: {
    fontSize: 12,
    marginTop: 3,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
    gap: 12,
  },
});
