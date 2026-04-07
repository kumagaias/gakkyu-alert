import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { type District, type SchoolClosureEntry } from "@/constants/data";
import { useStatusData } from "@/hooks/useStatusData";
import { SchoolClosureModal } from "@/components/SchoolClosureModal";

interface Props {
  district?: District | null;
}

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  const colors = useColors();
  const delta = current - prev;
  if (delta > 0) {
    return (
      <View style={[styles.trendBadge, { backgroundColor: colors.level3Bg }]}>
        <Feather name="trending-up" size={11} color={colors.level3} />
        <Text style={[styles.trendText, { color: colors.level3 }]}>+{delta}</Text>
      </View>
    );
  }
  if (delta < 0) {
    return (
      <View style={[styles.trendBadge, { backgroundColor: colors.successBg }]}>
        <Feather name="trending-down" size={11} color={colors.success} />
        <Text style={[styles.trendText, { color: colors.success }]}>{delta}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.trendBadge, { backgroundColor: colors.muted }]}>
      <Feather name="minus" size={11} color={colors.mutedForeground} />
      <Text style={[styles.trendText, { color: colors.mutedForeground }]}>±0</Text>
    </View>
  );
}

function ClosureRow({
  entry,
  isFirst,
  onPress,
}: {
  entry: SchoolClosureEntry;
  isFirst: boolean;
  onPress: (entry: SchoolClosureEntry) => void;
}) {
  const colors = useColors();
  const { closedClasses, diseaseName, weekAgoClasses } = entry;

  const dotColor =
    closedClasses >= 3 ? colors.level3 :
    closedClasses >= 2 ? colors.level2 :
    closedClasses >= 1 ? colors.level1 :
    colors.level0;

  return (
    <TouchableOpacity
      style={[
        styles.closureRow,
        { backgroundColor: colors.card },
        !isFirst && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
      ]}
      onPress={() => onPress(entry)}
      activeOpacity={0.7}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={styles.rowInfo}>
        <Text style={[styles.diseaseName, { color: colors.foreground }]} numberOfLines={1}>
          {diseaseName}
        </Text>
        {closedClasses > 0 ? (
          <Text style={[styles.levelLabel, { color: dotColor }]}>閉鎖中</Text>
        ) : (
          <Text style={[styles.levelLabel, { color: colors.mutedForeground }]}>閉鎖なし</Text>
        )}
      </View>
      {closedClasses > 0 ? (
        <Text style={[styles.classCount, { color: dotColor }]}>{closedClasses}クラス</Text>
      ) : (
        <Text style={[styles.classCountZero, { color: colors.mutedForeground }]}>—</Text>
      )}
      <TrendBadge current={closedClasses} prev={weekAgoClasses} />
      <Feather name="chevron-right" size={14} color={colors.border} />
    </TouchableOpacity>
  );
}

export function SchoolClosureCard({ district }: Props) {
  const colors = useColors();
  const { schoolClosures } = useStatusData();
  const [expanded, setExpanded] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SchoolClosureEntry | null>(null);

  const active = schoolClosures.entries.filter((e) => e.closedClasses > 0);
  const inactive = schoolClosures.entries.filter((e) => e.closedClasses === 0);
  const totalClosed = active.reduce((sum, e) => sum + e.closedClasses, 0);
  const visibleEntries = expanded ? schoolClosures.entries : active;
  const allClear = totalClosed === 0;

  return (
    <View>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Feather name="alert-circle" size={16} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>学級閉鎖情報</Text>
        <View style={[styles.badge, { backgroundColor: allClear ? colors.successBg : colors.level1Bg }]}>
          <Text style={[styles.badgeText, { color: allClear ? colors.success : colors.level2 }]}>
            {allClear ? "閉鎖なし" : `計${totalClosed}クラス`}
          </Text>
        </View>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>東京都</Text>
      </View>

      {/* Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {allClear ? (
          <>
            {/* "all clear" status row — always visible */}
            <View style={styles.allClearRow}>
              <Feather name="check-circle" size={14} color={colors.success} />
              <Text style={[styles.allClearText, { color: colors.success }]}>
                現在、学級閉鎖の報告はありません
              </Text>
            </View>
            {/* Expanded list of all entries (hidden by default) */}
            {expanded && schoolClosures.entries.map((entry, i) => (
              <ClosureRow
                key={entry.diseaseId}
                entry={entry}
                isFirst={false}
                onPress={setSelectedEntry}
              />
            ))}
            {/* Toggle to show/hide all entries */}
            <TouchableOpacity
              style={[styles.moreBtn, { borderTopColor: colors.border }]}
              onPress={() => setExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Feather
                name={expanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={colors.mutedForeground}
              />
              <Text style={[styles.moreBtnText, { color: colors.mutedForeground }]}>
                {expanded
                  ? "閉じる"
                  : `疾患別に確認する（${schoolClosures.entries.length}件）`}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {visibleEntries.map((entry, i) => (
              <ClosureRow
                key={entry.diseaseId}
                entry={entry}
                isFirst={i === 0}
                onPress={setSelectedEntry}
              />
            ))}
            {inactive.length > 0 && (
              <TouchableOpacity
                style={[styles.moreBtn, { borderTopColor: colors.border }]}
                onPress={() => setExpanded((v) => !v)}
                activeOpacity={0.7}
              >
                <Feather
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={colors.mutedForeground}
                />
                <Text style={[styles.moreBtnText, { color: colors.mutedForeground }]}>
                  {expanded
                    ? "閉鎖なしを隠す"
                    : `閉鎖なし ${inactive.length}件を表示`}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Detail modal */}
      <SchoolClosureModal
        entry={selectedEntry}
        district={district}
        onClose={() => setSelectedEntry(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  headerSub: {
    fontSize: 11,
    marginLeft: "auto",
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  closureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  diseaseName: {
    fontSize: 15,
    fontWeight: "500",
  },
  levelLabel: {
    fontSize: 12,
  },
  classCount: {
    fontSize: 14,
    fontWeight: "700",
  },
  classCountZero: {
    fontSize: 14,
    fontWeight: "500",
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  trendText: {
    fontSize: 11,
    fontWeight: "700",
  },
  allClearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  allClearText: {
    fontSize: 14,
    fontWeight: "500",
  },
  moreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  moreBtnText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
