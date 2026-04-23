import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { type EpidemicLevel, LEVEL_NAMES } from "@/constants/data";

const LEVEL_ICONS: Record<EpidemicLevel, string> = {
  0: "smile", 1: "meh", 2: "frown", 3: "thermometer",
};

const LEVEL_DESCRIPTIONS: Record<EpidemicLevel, string> = {
  0: "感染症の報告数が少なく、流行の兆候はありません。通常通りの生活が送れます。",
  1: "一部の感染症で患者数が増加傾向にあります。手洗い・うがいなど基本的な感染対策を徹底しましょう。",
  2: "複数の感染症が増加しており、学校・保育園での集団感染が報告されています。お子さんの体調変化に注意が必要です。",
  3: "複数の感染症が広く流行しています。学級閉鎖・学校閉鎖の可能性があります。登園・登校の判断は慎重に行ってください。",
};

const LEVEL_COLORS = ["#94a3b8", "#eab308", "#f97316", "#ef4444"];
const LEVEL_BG = ["#f1f5f9", "#fefce8", "#fff7ed", "#fef2f2"];

interface Props {
  visible: boolean;
  onClose: () => void;
  currentLevel?: EpidemicLevel;
}

export function LevelExplainModal({ visible, onClose, currentLevel }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(32, insets.bottom + 16) }]} onPress={() => {}}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>感染レベルとは？</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
            感染症サーベイランスデータをもとに、学校・保育園への影響度を0〜3の4段階で表示します。
          </Text>

          {([3, 2, 1, 0] as EpidemicLevel[]).map((lv) => (
            <View
              key={lv}
              style={[
                styles.levelItem,
                { backgroundColor: LEVEL_BG[lv], borderColor: LEVEL_COLORS[lv] },
                lv === currentLevel && styles.levelItemActive,
              ]}
            >
              <View style={[styles.levelBadge, { backgroundColor: LEVEL_COLORS[lv] }]}>
                <Feather name={LEVEL_ICONS[lv] as any} size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.levelTitleRow}>
                  <Text style={[styles.levelItemName, { color: LEVEL_COLORS[lv] === "#94a3b8" ? colors.mutedForeground : LEVEL_COLORS[lv] }]}>
                    {LEVEL_NAMES[lv]}
                  </Text>
                  {lv === currentLevel && (
                    <View style={[styles.nowBadge, { backgroundColor: LEVEL_COLORS[lv] }]}>
                      <Text style={styles.nowBadgeText}>現在</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.levelItemDesc, { color: colors.mutedForeground }]}>
                  {LEVEL_DESCRIPTIONS[lv]}
                </Text>
              </View>
            </View>
          ))}
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
  sheetSub: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  levelItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  levelItemActive: {
    borderWidth: 2,
  },
  levelBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  levelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  levelItemName: {
    fontSize: 15,
    fontWeight: "700",
  },
  nowBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nowBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  levelItemDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
});
