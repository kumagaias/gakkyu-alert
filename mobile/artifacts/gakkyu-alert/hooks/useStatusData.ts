import { useGetStatus } from "@workspace/api-client-react";
import {
  DISEASES,
  PREFECTURES,
  SCHOOL_CLOSURES,
  TOKYO_DISTRICTS,
  type Disease,
  type District,
  type EpidemicLevel,
  type Prefecture,
  type SchoolClosureData,
} from "@/constants/data";

export interface StatusData {
  diseases: Disease[];
  schoolClosures: SchoolClosureData;
  districts: District[];
  prefectures: Prefecture[];
  asOf: string | null;
  isLoading: boolean;
  isError: boolean;
}

export function useStatusData(): StatusData {
  const { data, isLoading, isError } = useGetStatus();

  if (!data) {
    return {
      diseases: DISEASES,
      schoolClosures: SCHOOL_CLOSURES,
      districts: TOKYO_DISTRICTS,
      prefectures: PREFECTURES,
      asOf: null,
      isLoading,
      isError,
    };
  }

  // Merge API disease data with static data (keeps schoolRules, doctorClearance, nameEn)
  const diseases: Disease[] = DISEASES.map((d) => {
    const api = data.diseases.find((ad) => ad.id === d.id);
    if (!api) return d;
    return {
      ...d,
      currentLevel: api.currentLevel as EpidemicLevel,
      currentCount: api.currentCount,
      lastWeekCount: api.lastWeekCount,
      twoWeeksAgoCount: api.twoWeeksAgoCount,
      weeklyHistory: api.weeklyHistory,
      aiComment: api.aiComment || d.aiComment,
    };
  });

  const schoolClosures: SchoolClosureData = {
    lastUpdated: data.schoolClosures.lastUpdated,
    sourceUrl: data.schoolClosures.sourceUrl ?? SCHOOL_CLOSURES.sourceUrl,
    tableauUrl: data.schoolClosures.tableauUrl ?? SCHOOL_CLOSURES.tableauUrl,
    entries: data.schoolClosures.entries.map((e) => ({
      diseaseId: e.diseaseId,
      diseaseName: e.diseaseName,
      closedClasses: e.closedClasses,
      weekAgoClasses: e.weekAgoClasses,
      weeklyHistory: e.weeklyHistory,
    })),
  };

  // Tokyo-wide max level — fallback for districts without per-district API data
  const tokyoMaxLevel = diseases.reduce(
    (max: number, d) => Math.max(max, d.currentLevel),
    0
  ) as EpidemicLevel;

  // Overlay real district levels/summaries; non-API districts use Tokyo-wide level
  const districts: District[] = TOKYO_DISTRICTS.map((d) => {
    const api = data.districts.find((ad) => ad.id === d.id);
    if (!api) return { ...d, level: tokyoMaxLevel };
    return {
      ...d,
      level: api.level as EpidemicLevel,
      aiSummary: api.aiSummary || d.aiSummary,
    };
  });

  // 都道府県: API データを静的リストにオーバーレイ
  const prefectures: Prefecture[] = PREFECTURES.map((p) => {
    const api = data.prefectures?.find((ap) => ap.id === p.id);
    if (!api) return p;
    return {
      ...p,
      level: api.level as EpidemicLevel,
      aiSummary: api.aiSummary || p.aiSummary,
    };
  });

  return { diseases, schoolClosures, districts, prefectures, asOf: data.asOf, isLoading, isError };
}
