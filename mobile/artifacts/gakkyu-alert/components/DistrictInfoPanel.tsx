import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { DISEASES, type Disease, type District } from "@/constants/data";
import { useStatusData } from "@/hooks/useStatusData";
import { EpidemicLevelCard } from "@/components/EpidemicLevelCard";
import { DiseaseRow } from "@/components/DiseaseRow";
import { DiseaseModal } from "@/components/DiseaseModal";
import { SchoolClosureCard } from "@/components/SchoolClosureCard";
import { SentinelExplainModal } from "@/components/SentinelExplainModal";
import { LevelExplainModal } from "@/components/LevelExplainModal";

interface Props {
  district: District;
  showFootnote?: boolean;
}

export function DistrictInfoPanel({ district, showFootnote = true }: Props) {
  const colors = useColors();
  const { diseases: tokyoDiseases, prefClosureMap, schoolClosures, diseaseWeekDate } = useStatusData();

  // 学校閉鎖データから来週の見通し（閉鎖クラス数が多い順、なければ最初の非空文字列）
  const topOutlook = schoolClosures.entries
    .slice()
    .sort((a, b) => b.closedClasses - a.closedClasses)
    .find((e) => !!e.aiOutlook)?.aiOutlook;
  const [selectedDisease, setSelectedDisease] = useState<Disease | null>(null);
  const [showAllDiseases, setShowAllDiseases] = useState(false);
  const [showSentinelModal, setShowSentinelModal] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);

  // 都道府県別疾患データがあればそちらを使い、静的 DISEASES とマージする
  const diseases: Disease[] = district.diseases && district.diseases.length > 0
    ? DISEASES.map((d) => {
        const pd = district.diseases!.find((dd) => dd.id === d.id);
        if (!pd) return { ...d, currentLevel: 0 as const, currentCount: 0, lastWeekCount: 0, twoWeeksAgoCount: 0, weeklyHistory: [], aiComment: "" };
        const rawHistory = pd.weeklyHistory ?? [];
        const weeklyHistory = rawHistory.length >= 5
          ? rawHistory
          : [0, 0, 0, 0, 0, pd.twoWeeksAgoCount ?? 0, pd.lastWeekCount ?? 0, pd.perSentinel];
        return {
          ...d,
          currentLevel: pd.level as 0 | 1 | 2 | 3,
          currentCount: pd.perSentinel,
          lastWeekCount: pd.lastWeekCount ?? 0,
          twoWeeksAgoCount: pd.twoWeeksAgoCount ?? 0,
          weeklyHistory,
          aiComment: pd.aiComment ?? "",
        };
      })
    : tokyoDiseases;

  const sortedDiseases = [...diseases].sort((a, b) => {
    if (b.currentLevel !== a.currentLevel) return b.currentLevel - a.currentLevel;
    return b.currentCount - a.currentCount;
  });
  const activeDiseases = sortedDiseases.filter((d) => d.currentLevel >= 1);
  const calmDiseases = sortedDiseases.filter((d) => d.currentLevel === 0);
  const visibleDiseases = showAllDiseases ? sortedDiseases : activeDiseases;

  return (
    <>
      {/* Epidemic level section */}
      <View>
        <View style={styles.sectionHeader}>
          <Feather name="activity" size={18} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>感染レベル</Text>
          <TouchableOpacity
            style={[styles.helpChip, { backgroundColor: colors.muted }]}
            onPress={() => setShowLevelModal(true)}
            activeOpacity={0.7}
            accessibilityLabel="感染レベルの解説"
            accessibilityRole="button"
          >
            <Text style={[styles.helpChipText, { color: colors.mutedForeground }]}>?</Text>
          </TouchableOpacity>
        </View>
        <EpidemicLevelCard level={district.level} />
      </View>

      {/* Disease trend section */}
      <View>
        <View style={styles.sectionHeader}>
          <Feather name="book-open" size={18} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>病名別トレンド</Text>
          {showFootnote && (
            <TouchableOpacity
              style={[styles.helpChip, { backgroundColor: colors.muted }]}
              onPress={() => setShowSentinelModal(true)}
              activeOpacity={0.7}
              accessibilityLabel="定点あたり患者数について"
              accessibilityRole="button"
            >
              <Text style={[styles.helpChipText, { color: colors.mutedForeground }]}>?</Text>
            </TouchableOpacity>
          )}
        </View>

        {!!district.aiSummary && (
          <View style={styles.aiBox}>
            <Text style={styles.aiBoxText}>{district.aiSummary}</Text>
          </View>
        )}

        <View style={[styles.diseaseList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {activeDiseases.length === 0 && !showAllDiseases ? (
            <View style={styles.noneRow}>
              <Feather name="check-circle" size={14} color={colors.success} />
              <Text style={[styles.noneText, { color: colors.success }]}>
                現在、流行中の感染症はありません
              </Text>
            </View>
          ) : (
            visibleDiseases.map((disease) => (
              <DiseaseRow
                key={disease.id}
                disease={disease}
                onPress={setSelectedDisease}
              />
            ))
          )}
          {calmDiseases.length > 0 && (
            <TouchableOpacity
              style={[
                styles.showMoreBtn,
                { borderTopColor: colors.border },
                activeDiseases.length === 0 && !showAllDiseases && { borderTopWidth: 0 },
              ]}
              onPress={() => setShowAllDiseases((v) => !v)}
              activeOpacity={0.7}
            >
              <Feather
                name={showAllDiseases ? "chevron-up" : "chevron-down"}
                size={15}
                color={colors.mutedForeground}
              />
              <Text style={[styles.showMoreText, { color: colors.mutedForeground }]}>
                {showAllDiseases
                  ? "平穏の疾患を隠す"
                  : activeDiseases.length === 0
                  ? `疾患別に確認する（${calmDiseases.length}件）`
                  : `平穏の疾患をもっと見る（${calmDiseases.length}件）`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

      </View>

      {/* School closure info */}
      {district.id === "tokyo"
        ? <SchoolClosureCard district={district} aiSummary={topOutlook} />
        : <SchoolClosureCard
            district={district}
            prefClosure={prefClosureMap[district.id] ?? { id: district.id, hasData: false, diseases: [] }}
            prefName={district.name}
            prefId={district.id}
          />
      }

      {/* Disease detail modal */}
      <DiseaseModal disease={selectedDisease} weekDate={diseaseWeekDate} onClose={() => setSelectedDisease(null)} />
      <SentinelExplainModal visible={showSentinelModal} onClose={() => setShowSentinelModal(false)} />
      <LevelExplainModal visible={showLevelModal} onClose={() => setShowLevelModal(false)} currentLevel={district.level} />
    </>
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
  helpChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  helpChipText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 15,
  },
  diseaseList: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  noneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noneText: {
    fontSize: 14,
    fontWeight: "500",
  },
  showMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: "500",
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


  /* Related links */
  linksHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    marginBottom: 10,
  },
  linksTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  linksCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
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
});
