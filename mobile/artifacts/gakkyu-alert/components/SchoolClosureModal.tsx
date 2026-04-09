import React, { useState } from "react";
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Polyline,
  Line as SvgLine,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { SCHOOL_CLOSURES, type SchoolClosureEntry, type District } from "@/constants/data";

interface Props {
  entry: SchoolClosureEntry | null;
  district?: District | null;
  onClose: () => void;
}

// ── Date label helpers ───────────────────────────────────────────────────────

function computeDateLabels(lastUpdated: string, count: number): string[] {
  const [y, m, d] = lastUpdated.split("/").map(Number);
  const base = new Date(y, m - 1, d);
  return Array.from({ length: count }, (_, i) => {
    const daysAgo = (count - 1 - i) * 7;
    const dt = new Date(base.getTime() - daysAgo * 86_400_000);
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  });
}

// ── Line chart ───────────────────────────────────────────────────────────────

function TrendLineChart({ history, lastUpdated }: { history: number[]; lastUpdated: string }) {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();

  // section padding: content(20) + section(14) + border(1) each side = 70 total
  const [chartWidth, setChartWidth] = useState(screenWidth - 70);

  const PAD_TOP = 22;
  const PAD_BOT = 38;
  const PAD_H   = 4;
  const HEIGHT  = 130;

  const n      = history.length;
  const maxVal = Math.max(...history, 1);
  const labels = computeDateLabels(lastUpdated, n);
  const plotW  = chartWidth - PAD_H * 2;
  const plotH  = HEIGHT - PAD_TOP - PAD_BOT;

  const pts = history.map((val, i) => ({
    x:         PAD_H + (i / (n - 1)) * plotW,
    y:         PAD_TOP + (1 - val / maxVal) * plotH,
    val,
    label:     labels[i],
    isCurrent: i === n - 1,
    isPrev:    i === n - 2,
  }));

  const linePts = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const fillPath = [
    `M ${pts[0].x} ${PAD_TOP + plotH}`,
    ...pts.map((p) => `L ${p.x} ${p.y}`),
    `L ${pts[n - 1].x} ${PAD_TOP + plotH}`,
    "Z",
  ].join(" ");

  // 3 horizontal grid lines: top / mid / bottom
  const gridYs = [0, 0.5, 1].map((f) => PAD_TOP + (1 - f) * plotH);

  return (
    <View
      onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
      style={{ marginTop: 4 }}
    >
      <Svg width={chartWidth} height={HEIGHT}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.18" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {gridYs.map((y, i) => (
          <SvgLine
            key={i}
            x1={PAD_H} y1={y} x2={chartWidth - PAD_H} y2={y}
            stroke={colors.border}
            strokeWidth={0.8}
            strokeDasharray={i === 2 ? undefined : "3,3"}
          />
        ))}

        {/* Area fill */}
        <Path d={fillPath} fill="url(#areaGrad)" />

        {/* Line */}
        <Polyline
          points={linePts}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Per-point: value label, dot, date label */}
        {pts.map((p, i) => {
          const anchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
          return (
            <G key={i}>
              {/* Value above dot */}
              <SvgText
                x={p.x} y={p.y - 8}
                textAnchor={anchor}
                fontSize={9}
                fontWeight={p.isCurrent ? "700" : "400"}
                fill={p.isCurrent ? colors.primary : colors.mutedForeground}
              >
                {p.val}
              </SvgText>

              {/* Dot */}
              <Circle
                cx={p.x} cy={p.y}
                r={p.isCurrent ? 5.5 : 3.5}
                fill={p.isCurrent ? colors.primary : colors.background}
                stroke={colors.primary}
                strokeWidth={2}
              />

              {/* Date (M/D) */}
              <SvgText
                x={p.x} y={HEIGHT - PAD_BOT + 14}
                textAnchor={anchor}
                fontSize={9}
                fontWeight={p.isCurrent ? "700" : "400"}
                fill={p.isCurrent ? colors.primary : colors.mutedForeground}
              >
                {p.label}
              </SvgText>

              {/* 今週 / 先週 tag */}
              {(p.isCurrent || p.isPrev) && (
                <SvgText
                  x={p.x} y={HEIGHT - PAD_BOT + 26}
                  textAnchor={anchor}
                  fontSize={8}
                  fontWeight="700"
                  fill={p.isCurrent ? colors.primary : colors.mutedForeground}
                >
                  {p.isCurrent ? "今週" : "先週"}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function getSummaryText(entry: SchoolClosureEntry): string {
  const { diseaseName, closedClasses, weekAgoClasses } = entry;
  const delta = closedClasses - weekAgoClasses;

  if (closedClasses === 0) {
    if (weekAgoClasses > 0) {
      return `東京都全体で${diseaseName}の学級閉鎖は現在ありません。先週は${weekAgoClasses}クラス閉鎖されていましたが、解消されました。引き続き手洗い・換気など基本的な感染対策を続けましょう。`;
    }
    return `東京都全体で${diseaseName}の学級閉鎖は報告されていません。感染状況は落ち着いています。`;
  }
  if (delta > 0) {
    return `東京都全体で${diseaseName}が${closedClasses}クラス閉鎖中です。先週比+${delta}クラスと増加傾向にあります。お子さんの体調管理と毎朝の検温を徹底してください。`;
  }
  if (delta < 0) {
    return `東京都全体で${diseaseName}が${closedClasses}クラス閉鎖中です。先週（${weekAgoClasses}クラス）から${Math.abs(delta)}クラス減少しており、改善傾向にあります。`;
  }
  return `東京都全体で${diseaseName}が${closedClasses}クラス閉鎖中です。先週から横ばいの状況が続いています。登校前に体調確認を行ってください。`;
}


export function SchoolClosureModal({ entry, district, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (!entry) return null;

  const delta = entry.closedClasses - entry.weekAgoClasses;
  const dotColor =
    entry.closedClasses >= 3 ? colors.level3 :
    entry.closedClasses >= 2 ? colors.level2 :
    entry.closedClasses >= 1 ? colors.level1 :
    colors.level0;

  const deltaColor = delta > 0 ? colors.level3 : delta < 0 ? colors.success : colors.mutedForeground;
  const deltaText = delta > 0 ? `+${delta}クラス` : delta < 0 ? `${delta}クラス` : "±0";
  const deltaIcon = delta > 0 ? "trending-up" : delta < 0 ? "trending-down" : "minus";

  return (
    <Modal
      visible={!!entry}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.diseaseName, { color: colors.foreground }]}>
              {entry.diseaseName}
            </Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: entry.closedClasses > 0 ? colors.level1Bg : colors.successBg,
                  borderColor: entry.closedClasses > 0 ? colors.level1 : colors.success,
                },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
              <Text
                style={[
                  styles.statusText,
                  { color: entry.closedClasses > 0 ? colors.level2 : colors.success },
                ]}
              >
                {entry.closedClasses > 0 ? `${entry.closedClasses}クラス閉鎖中` : "閉鎖なし"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.muted }]}
          >
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats row */}
          <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>今週</Text>
              <Text style={[styles.statValue, { color: dotColor }]}>
                {entry.closedClasses}クラス
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>先週</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {entry.weekAgoClasses}クラス
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>先週比</Text>
              <View style={styles.deltaRow}>
                <Feather name={deltaIcon as any} size={14} color={deltaColor} />
                <Text style={[styles.statValue, { color: deltaColor }]}>{deltaText}</Text>
              </View>
            </View>
          </View>

          {/* Line chart — 8 week trend */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name="trending-up" size={14} color={colors.mutedForeground} />
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                過去8週間のトレンド（東京都全体）
              </Text>
            </View>
            <TrendLineChart
              history={entry.weeklyHistory}
              lastUpdated={SCHOOL_CLOSURES.lastUpdated}
            />
          </View>

          {/* Summary text */}
          <View style={[styles.section, { backgroundColor: colors.accent, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name="zap" size={14} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>状況サマリー</Text>
            </View>
            <Text style={[styles.summaryText, { color: colors.foreground }]}>
              {getSummaryText(entry)}
            </Text>
          </View>

          {/* AI outlook */}
          {!!entry.aiOutlook && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Feather name="cpu" size={14} color={colors.mutedForeground} />
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>来週の見通し（AI）</Text>
              </View>
              <Text style={[styles.summaryText, { color: colors.foreground }]}>
                {entry.aiOutlook}
              </Text>
              <Text style={[styles.aiDisclaimer, { color: colors.mutedForeground }]}>
                ※ Amazon Nova Lite による自動生成です。参考情報としてご利用ください。
              </Text>
            </View>
          )}

          {/* Links */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name="link" size={14} color={colors.mutedForeground} />
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>関連リンク</Text>
            </View>

            <TouchableOpacity
              style={[styles.linkRow, { borderTopColor: colors.border }]}
              onPress={() => Linking.openURL(SCHOOL_CLOSURES.sourceUrl)}
              activeOpacity={0.7}
            >
              <View style={[styles.linkIcon, { backgroundColor: colors.muted }]}>
                <Feather name="external-link" size={14} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.linkTitle, { color: colors.foreground }]}>
                  東京都 学級閉鎖状況
                </Text>
                <Text style={[styles.linkSub, { color: colors.mutedForeground }]}>
                  東京都福祉保健局 公式ページ
                </Text>
              </View>
              <Feather name="chevron-right" size={15} color={colors.border} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.linkRow, { borderTopColor: colors.border }]}
              onPress={() => Linking.openURL(SCHOOL_CLOSURES.tableauUrl)}
              activeOpacity={0.7}
            >
              <View style={[styles.linkIcon, { backgroundColor: colors.muted }]}>
                <Feather name="bar-chart" size={14} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.linkTitle, { color: colors.foreground }]}>
                  週次データ（Tableau）
                </Text>
                <Text style={[styles.linkSub, { color: colors.mutedForeground }]}>
                  疾患別・週別の詳細グラフ
                </Text>
              </View>
              <Feather name="chevron-right" size={15} color={colors.border} />
            </TouchableOpacity>

            {district && (
              <TouchableOpacity
                style={[styles.linkRow, { borderTopColor: colors.border }]}
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps/search/${encodeURIComponent(district.name + " 小学校 中学校")}`
                  )
                }
                activeOpacity={0.7}
              >
                <View style={[styles.linkIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="map-pin" size={14} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.linkTitle, { color: colors.foreground }]}>
                    {district.name}の学校一覧
                  </Text>
                  <Text style={[styles.linkSub, { color: colors.mutedForeground }]}>
                    地図で近くの学校を確認
                  </Text>
                </View>
                <Feather name="chevron-right" size={15} color={colors.border} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
            ※ 学級閉鎖データは東京都全体の集計値です。区市町村別の内訳は公開されていません。
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
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  diseaseName: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  content: {
    padding: 20,
    gap: 12,
  },

  /* Stats row */
  statsRow: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    gap: 4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  /* Section */
  section: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    padding: 14,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
  },
  aiDisclaimer: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },

  /* Links */
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  linkIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  linkTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  linkSub: {
    fontSize: 11,
    marginTop: 1,
  },

  footnote: {
    fontSize: 11,
    lineHeight: 16,
  },
});
