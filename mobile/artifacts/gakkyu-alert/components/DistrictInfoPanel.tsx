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
import { type Disease, type District } from "@/constants/data";
import { useStatusData } from "@/hooks/useStatusData";
import { EpidemicLevelCard } from "@/components/EpidemicLevelCard";
import { DiseaseRow } from "@/components/DiseaseRow";
import { DiseaseModal } from "@/components/DiseaseModal";
import { SchoolClosureCard } from "@/components/SchoolClosureCard";

const RELATED_LINKS = [
  {
    id: "idsc",
    icon: "activity" as const,
    title: "東京都感染症情報センター",
    sub: "最新の感染症発生動向データ",
    url: "https://idsc.tmiph.metro.tokyo.lg.jp/",
  },
  {
    id: "flu-weekly",
    icon: "bar-chart-2" as const,
    title: "インフルエンザ週報（東京都）",
    sub: "週次インフルエンザ・新型コロナ統計",
    url: "https://idsc.tmiph.metro.tokyo.lg.jp/diseases/influ/influ-wkly/",
  },
  {
    id: "hokeniryo",
    icon: "shield" as const,
    title: "東京都保健医療局 感染症対策",
    sub: "感染症対策・注意報・警報情報",
    url: "https://www.hokeniryo.metro.tokyo.lg.jp/kansen/",
  },
  {
    id: "niid",
    icon: "globe" as const,
    title: "国立感染症研究所（NIID）",
    sub: "全国の感染症発生動向・IDWR",
    url: "https://www.niid.go.jp/niid/ja/",
  },
];

interface Props {
  district: District;
  showFootnote?: boolean;
}

export function DistrictInfoPanel({ district, showFootnote = true }: Props) {
  const colors = useColors();
  const { diseases: DISEASES } = useStatusData();
  const [selectedDisease, setSelectedDisease] = useState<Disease | null>(null);
  const [showAllDiseases, setShowAllDiseases] = useState(false);

  const sortedDiseases = [...DISEASES].sort((a, b) => {
    if (b.currentLevel !== a.currentLevel) return b.currentLevel - a.currentLevel;
    return b.currentCount - a.currentCount;
  });
  const activeDiseases = sortedDiseases.filter((d) => d.currentLevel >= 1);
  const calmDiseases = sortedDiseases.filter((d) => d.currentLevel === 0);
  const visibleDiseases = showAllDiseases ? sortedDiseases : activeDiseases;

  return (
    <>
      {/* Epidemic level card */}
      <EpidemicLevelCard level={district.level} />

      {/* School closure info — Tokyo-wide, above disease trends */}
      <SchoolClosureCard district={district} />

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
        <View style={styles.linksHeader}>
          <Feather name="link" size={14} color={colors.mutedForeground} />
          <Text style={[styles.linksTitle, { color: colors.mutedForeground }]}>関連リンク</Text>
        </View>

        <View style={[styles.linksCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {RELATED_LINKS.map((link, i) => (
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
