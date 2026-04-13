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
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { type Disease, type EpidemicLevel, LEVEL_NAMES } from "@/constants/data";

const { width } = Dimensions.get("window");
const BAR_MAX_W = width - 80;

const CHART_W = Math.min(width - 48, 640);
const CHART_H = 120;
const PAD = { top: 12, bottom: 28, left: 32, right: 16 };

/** 過去4週 + 未来2週の折れ線グラフ */
function TrendLineChart({ history, current, level }: { history: number[]; current: number; level: EpidemicLevel }) {
  const colors = useColors();
  const levelColors: Record<EpidemicLevel, string> = {
    0: colors.level0, 1: colors.level1, 2: colors.level2, 3: colors.level3,
  };
  const lineColor = levelColors[level];

  // 過去4週 (history の末尾5つのうち最新を除く) + 今週
  // history の末尾 = 今週の値なので、-5〜-1 で過去4週を取得
  const past4 = history.slice(-5, -1);
  const realPoints = [...past4, current]; // 5点 (index 0〜4)
  // 未来2週: 今週の値を横ばいで仮表示 (TODO: Nova予測に置き換え)
  const futurePoints = [current, current]; // index 5〜6

  const allVals = [...realPoints, ...futurePoints];
  const maxVal = Math.max(...allVals, 0.1);

  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const totalPoints = 7; // 5実績 + 2予測

  const xOf = (i: number) => PAD.left + (i / (totalPoints - 1)) * innerW;
  const yOf = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

  // 実績の折れ線パス
  const realPath = realPoints
    .map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`)
    .join(" ");

  // 予測の折れ線パス (今週の点から続く)
  const futurePath = [realPoints[realPoints.length - 1], ...futurePoints]
    .map((v, i) => `${i === 0 ? "M" : "L"}${xOf(realPoints.length - 1 + i).toFixed(1)},${yOf(v).toFixed(1)}`)
    .join(" ");

  const labels = ["-4W", "-3W", "-2W", "-1W", "今週", "+1W", "+2W"];

  return (
    <Svg width={CHART_W} height={CHART_H}>
      {/* Y軸ガイドライン + ラベル */}
      {[0, 0.5, 1].map((r) => {
        const yPos = PAD.top + innerH * (1 - r);
        const labelVal = maxVal * r;
        const label = labelVal === 0 ? "0" : labelVal >= 10 ? labelVal.toFixed(0) : labelVal.toFixed(1);
        return (
          <React.Fragment key={r}>
            <Line
              x1={PAD.left} y1={yPos}
              x2={CHART_W - PAD.right} y2={yPos}
              stroke={colors.border} strokeWidth={0.5}
            />
            <SvgText
              x={PAD.left - 4} y={yPos + 3.5}
              textAnchor="end" fontSize={9} fill={colors.mutedForeground}
            >{label}</SvgText>
          </React.Fragment>
        );
      })}
      {/* 今週の縦線 */}
      <Line
        x1={xOf(4)} y1={PAD.top}
        x2={xOf(4)} y2={PAD.top + innerH}
        stroke={colors.border} strokeWidth={1} strokeDasharray="3,3"
      />
      {/* 実績折れ線 */}
      <Path d={realPath} stroke={lineColor} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* 予測折れ線（点線） */}
      <Path d={futurePath} stroke={lineColor} strokeWidth={2} fill="none" strokeDasharray="5,4" strokeLinecap="round" />
      {/* 実績の点 */}
      {realPoints.map((v, i) => (
        <Circle key={i} cx={xOf(i)} cy={yOf(v)} r={i === 4 ? 5 : 3.5}
          fill={i === 4 ? lineColor : colors.background}
          stroke={lineColor} strokeWidth={2}
        />
      ))}
      {/* X軸ラベル */}
      {labels.map((l, i) => (
        <SvgText key={i} x={xOf(i)} y={CHART_H - 4} textAnchor="middle"
          fontSize={9} fill={i >= 5 ? colors.mutedForeground + "99" : colors.mutedForeground}
        >{l}</SvgText>
      ))}
      {/* 今週の値ラベル */}
      <SvgText x={xOf(4)} y={yOf(current) - 8} textAnchor="middle"
        fontSize={10} fontWeight="700" fill={lineColor}
      >{current.toFixed(1)}</SvgText>
    </Svg>
  );
}

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
      <View style={[styles.outer, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
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

          {/* Weekly trend chart */}
          {disease.weeklyHistory.length >= 5 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>週次推移（定点あたり患者数）</Text>
            <View style={styles.chartWrap}>
              <TrendLineChart
                history={disease.weeklyHistory}
                current={disease.currentCount}
                level={disease.currentLevel}
              />
            </View>
            <View style={styles.chartLegendRow}>
              <View style={styles.chartLegendItem}>
                <View style={[styles.chartLegendLine, { backgroundColor: levelColors[disease.currentLevel] }]} />
                <Text style={[styles.chartLegendText, { color: colors.mutedForeground }]}>実績</Text>
              </View>
              <View style={styles.chartLegendItem}>
                <View style={[styles.chartLegendDash, { borderColor: levelColors[disease.currentLevel] }]} />
                <Text style={[styles.chartLegendText, { color: colors.mutedForeground }]}>予測（参考）</Text>
              </View>
            </View>
          </View>
          )}

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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    ...(Platform.OS === "web" && {
      alignItems: "center" as const,
    }),
  },
  container: {
    flex: 1,
    paddingTop: 8,
    ...(Platform.OS === "web" && {
      maxWidth: 680,
      width: "100%",
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
  chartWrap: {
    alignItems: "center",
    marginTop: 8,
  },
  chartLegendRow: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
    marginTop: 8,
  },
  chartLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chartLegendLine: {
    width: 16,
    height: 2.5,
    borderRadius: 2,
  },
  chartLegendDash: {
    width: 16,
    height: 0,
    borderTopWidth: 2,
    borderStyle: "dashed",
  },
  chartLegendText: {
    fontSize: 11,
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
