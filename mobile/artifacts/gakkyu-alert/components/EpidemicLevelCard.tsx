import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { type EpidemicLevel, LEVEL_NAMES, HOME_AI_SUMMARIES } from "@/constants/data";

const LEVEL_ICONS: Record<EpidemicLevel, string> = {
  0: "smile",
  1: "meh",
  2: "frown",
  3: "thermometer",
};

interface Props {
  level: EpidemicLevel;
}

const LEVEL_DESCRIPTIONS: Record<EpidemicLevel, string> = {
  0: "感染症の報告数が少なく、流行の兆候はありません。通常通りの生活が送れます。",
  1: "一部の感染症で患者数が増加傾向にあります。手洗い・うがいなど基本的な感染対策を徹底しましょう。",
  2: "複数の感染症が増加しており、学校・保育園での集団感染が報告されています。お子さんの体調変化に注意が必要です。",
  3: "複数の感染症が広く流行しています。学級閉鎖・学校閉鎖の可能性があります。登園・登校の判断は慎重に行ってください。",
};

const LEVEL_COLORS = ["#94a3b8", "#eab308", "#f97316", "#ef4444"];
const LEVEL_BG = ["#f1f5f9", "#fefce8", "#fff7ed", "#fef2f2"];

export function EpidemicLevelCard({ level }: Props) {
  const colors = useColors();
  const [showModal, setShowModal] = useState(false);

  const levelColors: Record<EpidemicLevel, { bg: string; border: string; text: string; badge: string; badgeText: string }> = {
    0: { bg: colors.muted, border: colors.border, text: colors.mutedForeground, badge: colors.level0, badgeText: "#fff" },
    1: { bg: colors.level1Bg, border: colors.level1, text: "#854d0e", badge: colors.level1, badgeText: "#fff" },
    2: { bg: colors.level2Bg, border: colors.level2, text: "#9a3412", badge: colors.level2, badgeText: "#fff" },
    3: { bg: colors.level3Bg, border: colors.level3, text: "#991b1b", badge: colors.level3, badgeText: "#fff" },
  };

  const lc = levelColors[level];

  return (
    <>
      <View style={[styles.card, { backgroundColor: lc.bg, borderColor: lc.border }]}>
        <View style={styles.header}>
          <View style={styles.levelRow}>
            {/* Tappable badge */}
            <TouchableOpacity
              style={[styles.badge, { backgroundColor: lc.badge }]}
              onPress={() => setShowModal(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.badgeNum, { color: lc.badgeText }]}>{level}</Text>
              <View style={[styles.questionDot, { borderColor: lc.bg }]}>
                <Text style={styles.questionMark}>?</Text>
              </View>
            </TouchableOpacity>

            <View>
              <Text style={[styles.schoolLabel, { color: lc.text, opacity: 0.65 }]}>学校・保育園の感染状況</Text>
              <Text style={[styles.levelName, { color: lc.text }]}>{LEVEL_NAMES[level]}</Text>
            </View>
          </View>
          <View style={[styles.schoolIconWrap, { backgroundColor: lc.badge }]}>
            <Feather name={LEVEL_ICONS[level] as any} size={22} color="#fff" />
          </View>
        </View>
        <Text style={[styles.summary, { color: lc.text }]}>{HOME_AI_SUMMARIES[level]}</Text>
      </View>

      {/* Level explanation modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowModal(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>感染レベルとは？</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={12}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
              東京都感染症情報センターのデータをもとに、学校・保育園への影響度を0〜3の4段階で表示します。
            </Text>

            {/* Level rows */}
            {([3, 2, 1, 0] as EpidemicLevel[]).map((lv) => (
              <View
                key={lv}
                style={[
                  styles.levelItem,
                  { backgroundColor: LEVEL_BG[lv], borderColor: LEVEL_COLORS[lv] },
                  lv === level && styles.levelItemActive,
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
                    {lv === level && (
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
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badgeNum: {
    fontSize: 22,
    fontWeight: "700",
  },
  questionDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  questionMark: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748b",
    lineHeight: 12,
  },
  schoolLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginBottom: 1,
  },
  levelName: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  schoolIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "400",
  },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
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
