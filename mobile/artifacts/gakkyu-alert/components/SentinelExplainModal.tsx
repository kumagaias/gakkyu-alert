import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const LEVEL_ITEMS = [
  { level: 3, label: "流行",  color: "#ef4444", bg: "#fef2f2", range: "30以上",    desc: "多くの医療機関で患者が急増しており、広範な流行が起きています。" },
  { level: 2, label: "警戒",  color: "#f97316", bg: "#fff7ed", range: "10〜29",    desc: "患者数が増加しており、学校・保育園での集団感染リスクが高まっています。" },
  { level: 1, label: "注意",  color: "#eab308", bg: "#fefce8", range: "1〜9",      desc: "散発的な患者報告があります。基本的な感染予防を心がけましょう。" },
  { level: 0, label: "平穏",  color: "#94a3b8", bg: "#f1f5f9", range: "1未満",     desc: "ほとんど患者報告がなく、流行の兆候はありません。" },
] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SentinelExplainModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(32, insets.bottom + 16) }]}
          onPress={() => {}}
        >
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>病名別トレンドとは？</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="閉じる" accessibilityRole="button">
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={[styles.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              全国の指定医療機関（定点）から毎週報告される患者数をもとに感染の広がりを把握する仕組みです。{"\n"}
              <Text style={{ fontWeight: "600" }}>定点あたり患者数</Text>とは、1つの定点医療機関が1週間に診た患者数の平均値です。
            </Text>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>定点あたり患者数による流行レベル</Text>

          {LEVEL_ITEMS.map((item) => (
            <View
              key={item.level}
              style={[styles.levelItem, { backgroundColor: item.bg, borderColor: item.color }]}
            >
              <View style={[styles.levelBadge, { backgroundColor: item.color }]}>
                <Text style={styles.levelBadgeNum}>{item.level}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.levelTitleRow}>
                  <Text style={[styles.levelLabel, { color: item.level === 0 ? colors.mutedForeground : item.color }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.levelRange, { color: colors.mutedForeground }]}>{item.range}</Text>
                </View>
                <Text style={[styles.levelDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
              </View>
            </View>
          ))}

          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
            ※ 東京都感染症情報センターのデータに基づく推計値です
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginTop: 4,
  },
  levelItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  levelBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  levelBadgeNum: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  levelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  levelLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  levelRange: {
    fontSize: 12,
    fontWeight: "500",
  },
  levelDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  footnote: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
});
