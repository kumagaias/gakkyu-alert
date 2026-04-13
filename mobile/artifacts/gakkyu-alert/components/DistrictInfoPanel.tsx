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
import { DISEASES, PREF_IDSC_URLS, type Disease, type District } from "@/constants/data";
import { useStatusData } from "@/hooks/useStatusData";
import { EpidemicLevelCard } from "@/components/EpidemicLevelCard";
import { DiseaseRow } from "@/components/DiseaseRow";
import { DiseaseModal } from "@/components/DiseaseModal";
import { SchoolClosureCard } from "@/components/SchoolClosureCard";

const NIID_LINK = {
  id: "niid",
  icon: "globe" as const,
  title: "国立感染症研究所（NIID）",
  sub: "全国の感染症発生動向・IDWR",
  url: "https://www.niid.go.jp/niid/ja/",
};

function getRelatedLinks(districtId: string) {
  const idscUrl = PREF_IDSC_URLS[districtId];
  const links = [];
  if (idscUrl) {
    links.push({
      id: "idsc",
      icon: "activity" as const,
      title: "感染症情報センター",
      sub: "最新の感染症発生動向データ",
      url: idscUrl,
    });
  }
  links.push(NIID_LINK);
  return links;
}

interface Props {
  district: District;
  showFootnote?: boolean;
}

export function DistrictInfoPanel({ district, showFootnote = true }: Props) {
  const colors = useColors();
  const { diseases: tokyoDiseases, prefClosureMap, schoolClosures } = useStatusData();

  // 学校閉鎖データから来週の見通し（閉鎖クラス数が多い順、なければ最初の非空文字列）
  const topOutlook = schoolClosures.entries
    .slice()
    .sort((a, b) => b.closedClasses - a.closedClasses)
    .find((e) => !!e.aiOutlook)?.aiOutlook;
  const [selectedDisease, setSelectedDisease] = useState<Disease | null>(null);
  const [showAllDiseases, setShowAllDiseases] = useState(false);

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
      {/* Epidemic level card */}
      <EpidemicLevelCard level={district.level} aiOutlook={topOutlook} />

      {/* School closure info */}
      {district.id === "tokyo"
        ? <SchoolClosureCard district={district} />
        : prefClosureMap[district.id] !== undefined && (
            <SchoolClosureCard
              district={district}
              prefClosure={prefClosureMap[district.id]}
              prefName={district.name}
            />
          )
      }

      {/* Disease trend section */}
      <View>
        <View style={styles.sectionHeader}>
          <Feather name="book-open" size={16} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>病名別トレンド</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.countText, { color: colors.mutedForeground }]}>
              {activeDiseases.length}/{sortedDiseases.length}疾患
            </Text>
          </View>
        </View>

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

        {showFootnote && (
          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
            ※ 定点あたり患者数は東京都感染症情報センターのデータに基づく推計値です
          </Text>
        )}

        {/* Related links */}
        <View style={styles.sectionHeader}>
          <Feather name="link" size={16} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>関連リンク</Text>
        </View>

        <View style={[styles.linksCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {getRelatedLinks(district.id).map((link, i) => (
            <TouchableOpacity
              key={link.id}
              style={[
                styles.linkRow,
                { borderTopColor: colors.border },
                i === 0 && { borderTopWidth: 0 },
              ]}
              onPress={() => Linking.openURL(link.url)}
              activeOpacity={0.7}
            >
              <View style={[styles.linkIcon, { backgroundColor: colors.muted }]}>
                <Feather name={link.icon} size={14} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.linkTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {link.title}
                </Text>
                <Text style={[styles.linkSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {link.sub}
                </Text>
              </View>
              <Feather name="chevron-right" size={14} color={colors.border} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Disease detail modal */}
      <DiseaseModal disease={selectedDisease} onClose={() => setSelectedDisease(null)} />
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
    fontSize: 17,
    fontWeight: "700",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  countText: {
    fontSize: 11,
    fontWeight: "600",
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
  footnote: {
    fontSize: 11,
    marginTop: 8,
    lineHeight: 16,
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
