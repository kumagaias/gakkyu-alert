import React from "react";
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { SCHOOL_CLOSURES, type SchoolClosureEntry, type District } from "@/constants/data";

interface Props {
  entry: SchoolClosureEntry | null;
  district?: District | null;
  onClose: () => void;
}

const WEEK_LABELS = ["8W前", "7W前", "6W前", "5W前", "4W前", "3W前", "先週", "今週"];

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

function MiniBarChart({ history }: { history: number[] }) {
  const colors = useColors();
  const maxVal = Math.max(...history, 1);

  return (
    <View style={styles.chartWrap}>
      {history.map((val, i) => {
        const isCurrent = i === history.length - 1;
        const barColor = isCurrent ? colors.primary : colors.border;
        const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;

        return (
          <View key={i} style={styles.barCol}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${Math.max(heightPct, val > 0 ? 8 : 0)}%`,
                    backgroundColor: val > 0 ? barColor : colors.muted,
                    opacity: isCurrent ? 1 : 0.6,
                  },
                ]}
              />
            </View>
            <Text style={[styles.barVal, { color: isCurrent ? colors.primary : colors.mutedForeground }]}>
              {val}
            </Text>
            {i === history.length - 1 && (
              <Text style={[styles.barLabel, { color: colors.primary }]}>今</Text>
            )}
            {i === history.length - 2 && (
              <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>先</Text>
            )}
            {i !== history.length - 1 && i !== history.length - 2 && (
              <Text style={[styles.barLabel, { color: colors.mutedForeground }]} />
            )}
          </View>
        );
      })}
    </View>
  );
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

          {/* Mini bar chart — 8 week trend */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name="bar-chart-2" size={14} color={colors.mutedForeground} />
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                過去8週間のトレンド（東京都全体）
              </Text>
            </View>
            <MiniBarChart history={entry.weeklyHistory} />
            <Text style={[styles.chartNote, { color: colors.mutedForeground }]}>
              「今」= 今週 / 「先」= 先週
            </Text>
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

  /* Chart */
  chartWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 80,
    paddingHorizontal: 4,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    gap: 3,
  },
  barTrack: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderRadius: 3,
    minHeight: 3,
  },
  barVal: {
    fontSize: 9,
    fontWeight: "600",
  },
  barLabel: {
    fontSize: 9,
    fontWeight: "700",
  },
  chartNote: {
    fontSize: 10,
    marginTop: 6,
    textAlign: "right",
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
