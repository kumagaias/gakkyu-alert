import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { type Disease, type EpidemicLevel, LEVEL_NAMES } from "@/constants/data";

interface Props {
  disease: Disease;
  onPress: (disease: Disease) => void;
}

export function DiseaseRow({ disease, onPress }: Props) {
  const colors = useColors();

  const levelDots: Record<EpidemicLevel, string> = {
    0: colors.level0,
    1: colors.level1,
    2: colors.level2,
    3: colors.level3,
  };

  const trend =
    disease.currentCount > disease.lastWeekCount
      ? "up"
      : disease.currentCount < disease.lastWeekCount
        ? "down"
        : "flat";

  const trendIcon = trend === "up" ? "trending-up" : trend === "down" ? "trending-down" : "minus";
  const trendColor = trend === "up" ? colors.level3 : trend === "down" ? colors.success : colors.mutedForeground;

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => onPress(disease)}
      activeOpacity={0.7}
    >
      <View style={[styles.levelDot, { backgroundColor: levelDots[disease.currentLevel] }]} />
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {disease.name}
        </Text>
        <Text style={[styles.levelLabel, { color: colors.mutedForeground }]}>
          {LEVEL_NAMES[disease.currentLevel]}
        </Text>
      </View>
      <View style={styles.right}>
        <Feather name={trendIcon} size={14} color={trendColor} />
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {disease.currentCount.toFixed(1)}
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color={colors.border} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  levelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: "500",
  },
  levelLabel: {
    fontSize: 12,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  count: {
    fontSize: 13,
    fontWeight: "500",
  },
});
