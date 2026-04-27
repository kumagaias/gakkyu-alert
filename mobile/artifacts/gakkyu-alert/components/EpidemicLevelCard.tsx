import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { type EpidemicLevel, LEVEL_NAMES, HOME_AI_SUMMARIES } from "@/constants/data";
import { LevelExplainModal } from "@/components/LevelExplainModal";

const LEVEL_ICONS: Record<EpidemicLevel, React.ComponentProps<typeof Feather>["name"]> = {
  0: "smile",
  1: "meh",
  2: "frown",
  3: "thermometer",
};

interface Props {
  level: EpidemicLevel;
  aiOutlook?: string;
}


export function EpidemicLevelCard({ level, aiOutlook }: Props) {
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
              <Text style={[styles.schoolLabel, { color: lc.text, opacity: 0.65 }]}>学校・保育園・幼稚園の感染状況</Text>
              <Text style={[styles.levelName, { color: lc.text }]}>{LEVEL_NAMES[level]}</Text>
            </View>
          </View>
          <View style={[styles.schoolIconWrap, { backgroundColor: lc.badge }]}>
            <Feather name={LEVEL_ICONS[level]} size={22} color="#fff" />
          </View>
        </View>
        <Text style={[styles.summary, { color: lc.text }]}>{HOME_AI_SUMMARIES[level]}</Text>
        {!!aiOutlook && (
          <View style={[styles.outlookBox, { borderTopColor: lc.border }]}>
            <View style={styles.outlookHeader}>
              <Feather name="cpu" size={12} color={lc.text} style={{ opacity: 0.6 }} />
              <Text style={[styles.outlookLabel, { color: lc.text, opacity: 0.6 }]}>来週の見通し（AI）</Text>
            </View>
            <Text style={[styles.outlookText, { color: lc.text }]}>{aiOutlook}</Text>
          </View>
        )}
      </View>

      <LevelExplainModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        currentLevel={level}
      />
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
  outlookBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 6,
  },
  outlookHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  outlookLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  outlookText: {
    fontSize: 13,
    lineHeight: 20,
  },

});
