import React, { useState } from "react";
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import {
  DISEASES,
  type District,
  type PrefClosureStatus,
  type SchoolClosureEntry,
} from "@/constants/data";
import { useStatusData } from "@/hooks/useStatusData";
import { SchoolClosureModal } from "@/components/SchoolClosureModal";

interface Props {
  district?: District | null;
  prefClosure?: PrefClosureStatus;
  prefName?: string;
  prefId?: string;
  aiSummary?: string;
}

const SYSTEM_URL = "https://www.gakkohoken.jp/system_information/";

// IDs not in DISEASES (e.g. combined "flu", "gastro", "other")
const FALLBACK_DISEASE_NAMES: Record<string, string> = {
  flu:    "インフルエンザ",
  gastro: "感染性胃腸炎",
  other:  "その他感染症",
};

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
  onPress?: (entry: SchoolClosureEntry) => void;
}) {
  const colors = useColors();
  const { closedClasses, diseaseName, weekAgoClasses } = entry;

  const dotColor =
    closedClasses >= 3 ? colors.level3 :
    closedClasses >= 2 ? colors.level2 :
    closedClasses >= 1 ? colors.level1 :
    colors.level0;

  const inner = (
    <>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={styles.rowInfo}>
        <Text style={[styles.diseaseName, { color: colors.foreground }]} numberOfLines={1}>
          {diseaseName}
        </Text>
        {closedClasses > 0 && (
          <Text style={[styles.levelLabel, { color: dotColor }]}>閉鎖中</Text>
        )}
      </View>
      {closedClasses > 0 ? (
        <Text style={[styles.classCount, { color: dotColor }]}>{closedClasses}クラス</Text>
      ) : (
        <Text style={[styles.classCountZero, { color: colors.mutedForeground }]}>—</Text>
      )}
      <TrendBadge current={closedClasses} prev={weekAgoClasses} />
      {onPress && <Feather name="chevron-right" size={14} color={colors.border} />}
    </>
  );

  const rowStyle = [
    styles.closureRow,
    { backgroundColor: colors.card },
    !isFirst && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  ];

  if (onPress) {
    return (
      <TouchableOpacity 
        style={rowStyle} 
        onPress={() => onPress(entry)} 
        activeOpacity={0.7}
        accessibilityLabel={`${entry.diseaseName}の学級閉鎖情報を表示`}
        accessibilityRole="button"
      >
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={rowStyle}>{inner}</View>;
}

/** 都道府県別閉鎖クラス表示（学校等欠席者・感染症情報システムデータ） */
function PrefClosureContent({
  prefClosure,
  prefId,
  onPress,
}: {
  prefClosure: PrefClosureStatus;
  prefId?: string;
  onPress: (entry: SchoolClosureEntry) => void;
}) {
  const colors = useColors();
  const { prefectures } = useStatusData();

  if (!prefClosure.hasData) {
    return (
      <View style={styles.noDataRow}>
        <Text style={[styles.noDataText, { color: colors.mutedForeground }]}>
          <Text
            style={{ color: colors.primary, textDecorationLine: "underline" }}
            onPress={() => Linking.openURL(SYSTEM_URL)}
          >
            学校等欠席者・感染症情報システム
          </Text>
          {"に就学生徒の情報がないため、データがありません"}
        </Text>
      </View>
    );
  }

  const pref = prefId ? prefectures.find((p) => p.id === prefId) : undefined;

  const entries: SchoolClosureEntry[] = prefClosure.diseases.map((d) => {
    const disease = DISEASES.find((dis) => dis.id === d.id);
    const prefDisease = pref?.diseases?.find((pd) => pd.id === d.id);
    return {
      diseaseId: d.id,
      diseaseName: disease?.name ?? FALLBACK_DISEASE_NAMES[d.id] ?? d.id,
      closedClasses: d.closedClasses ?? 0,
      weekAgoClasses: d.weekAgoClasses ?? 0,
      weeklyHistory: prefDisease?.weeklyHistory ?? d.weeklyHistory ?? [],
    };
  }).sort((a, b) => b.closedClasses - a.closedClasses);

  const totalClosed = entries.reduce((sum, e) => sum + e.closedClasses, 0);
  const [expanded, setExpanded] = useState(false);
  
  // 過去データがある疾患（weeklyHistoryに0以外がある）
  const entriesWithHistory = entries.filter((e) => 
    e.weeklyHistory.some((v) => v > 0)
  );

  if (entries.length === 0) {
    return (
      <View style={styles.allClearRow}>
        <Feather name="check-circle" size={14} color={colors.success} />
        <Text style={[styles.allClearText, { color: colors.success }]}>
          現在、学級閉鎖の報告はありません
        </Text>
      </View>
    );
  }

  // 現在閉鎖がある疾患
  const activeEntries = entries.filter((e) => e.closedClasses > 0);
  // 現在閉鎖0だが過去データがある疾患
  const inactiveWithHistory = entries.filter((e) => 
    e.closedClasses === 0 && e.weeklyHistory.some((v) => v > 0)
  );

  const visibleEntries = expanded 
    ? [...activeEntries, ...inactiveWithHistory]
    : activeEntries.length > 0 
      ? activeEntries 
      : inactiveWithHistory;

  if (visibleEntries.length === 0) {
    return (
      <View style={styles.allClearRow}>
        <Feather name="check-circle" size={14} color={colors.success} />
        <Text style={[styles.allClearText, { color: colors.success }]}>
          現在、学級閉鎖の報告はありません
        </Text>
      </View>
    );
  }

  return (
    <>
      {totalClosed === 0 && (
        <View style={[styles.allClearRow, { marginBottom: 8 }]}>
          <Feather name="check-circle" size={14} color={colors.success} />
          <Text style={[styles.allClearText, { color: colors.success }]}>
            現在、学級閉鎖の報告はありません
          </Text>
        </View>
      )}
      {visibleEntries.map((entry, i) => (
        <ClosureRow key={entry.diseaseId} entry={entry} isFirst={i === 0} onPress={onPress} />
      ))}
      {!expanded && inactiveWithHistory.length > 0 && activeEntries.length > 0 && (
        <TouchableOpacity
          style={[styles.expandButton, { borderColor: colors.border }]}
          onPress={() => setExpanded(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.expandText, { color: colors.mutedForeground }]}>
            平穏の疾患をもっと見る ({inactiveWithHistory.length})
          </Text>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
    </>
  );
}

export function SchoolClosureCard({ district, prefClosure, prefName, prefId, aiSummary }: Props) {
  const colors = useColors();
  const { schoolClosures } = useStatusData();
  const [expanded, setExpanded] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SchoolClosureEntry | null>(null);

  // Prefecture-mode: show CLOSURE_BY_PREF data
  if (prefClosure) {
    const totalClosed = prefClosure.hasData
      ? prefClosure.diseases.reduce((sum, d) => sum + (d.closedClasses ?? 0), 0)
      : 0;
    const allClear = !prefClosure.hasData || totalClosed === 0;

    return (
      <View>
        <View style={styles.sectionHeader}>
          <Feather name="alert-circle" size={18} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>学級閉鎖情報</Text>
          <View style={[styles.badge, { backgroundColor: allClear ? colors.successBg : colors.level1Bg }]}>
            <Text style={[styles.badgeText, { color: allClear ? colors.success : colors.level2 }]}>
              {!prefClosure.hasData ? "データなし" : allClear ? "" : `計${totalClosed}クラス`}
            </Text>
          </View>
        </View>
        {!!aiSummary && (
          <View style={styles.aiBox}>
            <Text style={styles.aiBoxText}>{aiSummary}</Text>
          </View>
        )}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <PrefClosureContent prefClosure={prefClosure} prefId={prefId} onPress={setSelectedEntry} />
        </View>
        <SchoolClosureModal
          entry={selectedEntry}
          prefName={prefName}
          lastUpdated={schoolClosures.lastUpdated}
          onClose={() => setSelectedEntry(null)}
        />
      </View>
    );
  }

  // Tokyo home mode: existing CLOSURE (Tokyo Tableau) data
  const active = schoolClosures.entries.filter((e) => e.closedClasses > 0);
  const inactive = schoolClosures.entries.filter((e) => e.closedClasses === 0);
  const totalClosed = active.reduce((sum, e) => sum + e.closedClasses, 0);
  const visibleEntries = expanded ? schoolClosures.entries : active;
  const allClear = totalClosed === 0;

  return (
    <View>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Feather name="alert-circle" size={18} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>学級閉鎖情報</Text>
        {!allClear && (
          <View style={[styles.badge, { backgroundColor: colors.level1Bg }]}>
            <Text style={[styles.badgeText, { color: colors.level2 }]}>
              {`計${totalClosed}クラス`}
            </Text>
          </View>
        )}
      </View>

      {!!aiSummary && (
        <View style={styles.aiBox}>
          <Text style={styles.aiBoxText}>{aiSummary}</Text>
        </View>
      )}

      {/* Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {allClear ? (
          <>
            <View style={styles.allClearRow}>
              <Feather name="check-circle" size={14} color={colors.success} />
              <Text style={[styles.allClearText, { color: colors.success }]}>
                現在、学級閉鎖の報告はありません
              </Text>
            </View>
            {expanded && schoolClosures.entries.map((entry) => (
              <ClosureRow
                key={entry.diseaseId}
                entry={entry}
                isFirst={false}
                onPress={setSelectedEntry}
              />
            ))}
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
        lastUpdated={schoolClosures.lastUpdated}
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
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 22,
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
  noDataRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noDataText: {
    fontSize: 13,
    lineHeight: 20,
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
    fontWeight: "600",
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  expandText: {
    fontSize: 13,
    fontWeight: "600",
  },
  aiBox: {
    backgroundColor: "#e0f2fe",
    borderColor: "#7dd3fc",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  aiBoxText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#0369a1",
  },
});
