import React from "react";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const SOURCES = [
  {
    title: "感染症週報（IDWR）",
    provider: "国立健康・危機管理研究機構（JIHS）",
    description:
      "全国の定点医療機関から報告される疾患別の患者数データ。インフルエンザ・COVID-19など10疾患の定点当たり患者数を都道府県別に集計しています。",
    url: "https://www.jihs.go.jp/",
    icon: "activity",
  },
  {
    title: "学校等欠席者・感染症情報システム",
    provider: "日本学校保健会（JSSH）",
    description:
      "全国の学校から報告される学級閉鎖・出席停止の情報。都道府県別の閉鎖クラス数の集計に使用しています。",
    url: "https://www.gakkohoken.jp/",
    icon: "book",
  },
  {
    title: "東京都感染症週報",
    provider: "東京都立健康安全研究センター（TMIPH）",
    description:
      "東京都内の保健所ごとの感染症サーベイランスデータ。練馬区・杉並区・武蔵野市など地区レベルの流行状況の算出に使用しています。",
    url: "https://www.tmiph.metro.tokyo.lg.jp/",
    icon: "map-pin",
  },
] as const;

export default function DataSourcesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          データソース
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lead, { color: colors.mutedForeground }]}>
          学級アラートは、公的機関が公開する感染症サーベイランスデータを使用しています。AIコメントはAmazon Nova Liteにより生成しています。
        </Text>

        {SOURCES.map((src) => (
          <View
            key={src.title}
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
                <Feather name={src.icon} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                  {src.title}
                </Text>
                <Text style={[styles.cardProvider, { color: colors.mutedForeground }]}>
                  {src.provider}
                </Text>
              </View>
            </View>
            <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
              {src.description}
            </Text>
            <TouchableOpacity
              style={[styles.linkBtn, { borderColor: colors.border }]}
              onPress={() => Linking.openURL(src.url)}
              activeOpacity={0.7}
            >
              <Feather name="external-link" size={13} color={colors.primary} />
              <Text style={[styles.linkText, { color: colors.primary }]}>
                公式サイトを開く
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={[styles.note, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} style={{ marginTop: 1 }} />
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            データは毎週月曜日の早朝に自動更新されます。最新情報は各公式サイトをご確認ください。
          </Text>
        </View>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  lead: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  cardProvider: {
    fontSize: 12,
    marginTop: 2,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 2,
  },
  linkText: {
    fontSize: 13,
    fontWeight: "600",
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
