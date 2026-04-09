import React from "react";
import {
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { type Disease, type EpidemicLevel, LEVEL_NAMES } from "@/constants/data";

const { width } = Dimensions.get("window");
const BAR_MAX_W = width - 80;

interface Props {
  disease: Disease | null;
  onClose: () => void;
}

function MiniBar({ value, max, level }: { value: number; max: number; level: EpidemicLevel }) {
  const colors = useColors();
  const levelColors: Record<EpidemicLevel, string> = {
    0: colors.level0,
    1: colors.level1,
    2: colors.level2,
    3: colors.level3,
  };
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={{ height: 6, backgroundColor: colors.muted, borderRadius: 3, flex: 1 }}>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          width: `${pct}%`,
          backgroundColor: levelColors[level],
        }}
      />
    </View>
  );
}

const INSTITUTION_ROWS = [
  { key: "hoikuen" as const, label: "保育園・幼稚園（参考）", icon: "sun" as const },
  { key: "gakko" as const,   label: "小学校〜高校（共通）",   icon: "book" as const },
];

export function DiseaseModal({ disease, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (!disease) return null;

  const maxVal = Math.max(disease.currentCount, disease.lastWeekCount, disease.twoWeeksAgoCount, ...disease.weeklyHistory, 0.1);
  const levelColors: Record<EpidemicLevel, string> = {
    0: colors.level0,
    1: colors.level1,
    2: colors.level2,
    3: colors.level3,
  };
  const levelBg: Record<EpidemicLevel, string> = {
    0: colors.level0Bg,
    1: colors.level1Bg,
    2: colors.level2Bg,
    3: colors.level3Bg,
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
            {disease.name}
          </Text>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Level badge */}
          <View
            style={[
              styles.levelCard,
              { backgroundColor: levelBg[disease.currentLevel], borderColor: levelColors[disease.currentLevel] },
            ]}
          >
            <Text style={[styles.levelNum, { color: levelColors[disease.currentLevel] }]}>
              Lv.{disease.currentLevel}
            </Text>
            <Text style={[styles.levelName, { color: levelColors[disease.currentLevel] }]}>
              {LEVEL_NAMES[disease.currentLevel]}
            </Text>
          </View>

          {/* Weekly counts */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>定点あたり患者数</Text>
            {[
              { label: "今週", value: disease.currentCount },
              { label: "先週", value: disease.lastWeekCount },
              { label: "2週前", value: disease.twoWeeksAgoCount },
            ].map((row) => (
              <View key={row.label} style={styles.countRow}>
                <Text style={[styles.weekLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                <MiniBar value={row.value} max={maxVal} level={disease.currentLevel} />
                <Text style={[styles.countVal, { color: colors.foreground }]}>{row.value.toFixed(1)}</Text>
              </View>
            ))}
          </View>

          {/* 8-week chart */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>過去8週の推移</Text>
            <View style={styles.chartArea}>
              {disease.weeklyHistory.map((val, i) => {
                const h = maxVal > 0 ? (val / maxVal) * 80 : 2;
                return (
                  <View key={i} style={styles.barCol}>
                    <View style={{ flex: 1, justifyContent: "flex-end" }}>
                      <View
                        style={{
                          height: Math.max(h, 2),
                          width: 20,
                          borderRadius: 4,
                          backgroundColor: i === 5 ? levelColors[disease.currentLevel] : colors.muted,
                        }}
                      />
                    </View>
                    <Text style={[styles.weekNum, { color: colors.mutedForeground }]}>
                      {i - 7}W
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* School rules — split by institution */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.rowWithIcon}>
              <Feather name="book-open" size={14} color={colors.mutedForeground} />
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>出席停止規定（参考）</Text>
            </View>

            {INSTITUTION_ROWS.map((inst, idx) => (
              <View key={inst.key}>
                {idx > 0 && (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                )}
                <View style={styles.institutionRow}>
                  <View style={[styles.institutionLabelWrap, { backgroundColor: colors.muted }]}>
                    <Feather name={inst.icon} size={11} color={colors.mutedForeground} />
                    <Text style={[styles.institutionLabel, { color: colors.mutedForeground }]}>
                      {inst.label}
                    </Text>
                  </View>
                  <Text style={[styles.ruleText, { color: colors.foreground }]}>
                    {disease.schoolRules[inst.key]}
                  </Text>
                </View>
                {inst.key === "hoikuen" && (
                  <Text style={[styles.hoikuenNote, { color: colors.mutedForeground }]}>
                    ※ 各自治体・施設により異なる場合がありますのでお問い合わせください。
                  </Text>
                )}
              </View>
            ))}

          {/* TODO: 医師の許可証 — 将来実装
            <View style={[styles.clearanceRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.clearanceLabel, { color: colors.mutedForeground }]}>医師の許可証</Text>
              <View style={[styles.clearanceBadge, { backgroundColor: disease.doctorClearance ? colors.level1Bg : colors.successBg }]}>
                <Text style={[styles.clearanceText, { color: disease.doctorClearance ? "#854d0e" : "#166534" }]}>
                  {disease.doctorClearance ? "必要" : "不要"}
                </Text>
              </View>
            </View>
          */}
          </View>

          {/* Disclaimer */}
          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            ※ 出席停止の規定は学校保健安全法および保育所における感染症対策ガイドラインに基づく一般的な目安です。正確な規定はお子さまの通園・通学先の施設にご確認ください。
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
    ...(Platform.OS === "web" && {
      maxWidth: 680,
      width: "100%",
      alignSelf: "center" as const,
    }),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 20,
    gap: 12,
  },
  levelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  levelNum: {
    fontSize: 18,
    fontWeight: "700",
  },
  levelName: {
    fontSize: 18,
    fontWeight: "600",
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rowWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  weekLabel: {
    fontSize: 13,
    width: 36,
  },
  countVal: {
    fontSize: 14,
    fontWeight: "600",
    width: 36,
    textAlign: "right",
  },
  chartArea: {
    flexDirection: "row",
    height: 100,
    alignItems: "flex-end",
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    gap: 4,
  },
  weekNum: {
    fontSize: 9,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  institutionRow: {
    gap: 6,
    paddingVertical: 6,
  },
  institutionLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  institutionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  ruleText: {
    fontSize: 13,
    lineHeight: 20,
  },
  hoikuenNote: {
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 16,
    paddingBottom: 10,
    marginTop: -2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: -4,
  },
  clearanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 2,
  },
  clearanceLabel: {
    fontSize: 13,
  },
  clearanceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  clearanceText: {
    fontSize: 13,
    fontWeight: "600",
  },
  disclaimer: {
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    paddingHorizontal: 8,
    opacity: 0.7,
  },
});
