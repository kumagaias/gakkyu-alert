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
  type PrefClosureStatus,
  type PrefectureDisease,
  type SchoolClosureData,
} from "@/constants/data";

export interface StatusData {
  diseases: Disease[];
  schoolClosures: SchoolClosureData;
  districts: District[];
  prefectures: Prefecture[];
  prefClosureMap: Record<string, PrefClosureStatus>;
  asOf: string | null;
  diseaseWeekDate: string | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useStatusData(): StatusData {
  const { data, isLoading, isError, refetch } = useGetStatus();

  if (!data) {
    return {
      diseases: DISEASES,
      schoolClosures: SCHOOL_CLOSURES,
      districts: TOKYO_DISTRICTS,
      prefectures: PREFECTURES,
      prefClosureMap: {},
      asOf: null,
      diseaseWeekDate: null,
      isLoading,
      isError,
      refetch,
    };
  }

  // Merge API disease data with static data (keeps schoolRules, doctorClearance, nameEn)
  const diseases: Disease[] = DISEASES.map((d) => {
    const api = data.diseases.find((ad) => ad.id === d.id);
    if (!api) return d;
    const weeklyHistory = api.weeklyHistory.length >= 5
      ? api.weeklyHistory
      : [0, 0, 0, 0, 0, api.twoWeeksAgoCount, api.lastWeekCount, api.currentCount];
    return {
      ...d,
      currentLevel: api.currentLevel as EpidemicLevel,
      currentCount: api.currentCount,
      lastWeekCount: api.lastWeekCount,
      twoWeeksAgoCount: api.twoWeeksAgoCount,
      weeklyHistory,
      aiComment: api.aiComment || d.aiComment,
      aiOutlook: api.aiOutlook || undefined,
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
      aiOutlook: e.aiOutlook || undefined,
    })),
  };

  // Tokyo-wide max level — fallback when API prefecture data is unavailable
  const tokyoMaxLevel = diseases.reduce(
    (max: number, d) => Math.max(max, d.currentLevel),
    0
  ) as EpidemicLevel;

  // 都道府県: API データを静的リストにオーバーレイ
  const prefectures: Prefecture[] = PREFECTURES.map((p) => {
    const api = data.prefectures?.find((ap) => ap.id === p.id);
    if (!api) return p;
    return {
      ...p,
      level: api.level as EpidemicLevel,
      aiSummary: api.aiSummary || p.aiSummary,
      diseases: (api.diseases ?? []) as PrefectureDisease[],
    };
  });

  // 東京都レベルを都道府県データから取得し、全区市で統一して使う
  const tokyoPref = prefectures.find((p) => p.id === "tokyo");
  const tokyoLevel = (tokyoPref?.level ?? tokyoMaxLevel) as EpidemicLevel;

  const districts: District[] = TOKYO_DISTRICTS.map((d) => ({
    ...d,
    level: tokyoLevel,
    aiSummary: tokyoPref?.aiSummary || d.aiSummary,
  }));

  const prefClosureMap: Record<string, PrefClosureStatus> = {};
  for (const pc of (data.prefClosures ?? [])) {
    prefClosureMap[pc.id] = pc as PrefClosureStatus;
  }

  return { diseases, schoolClosures, districts, prefectures, prefClosureMap, asOf: data.asOf, diseaseWeekDate: (data as any).diseaseWeekDate as string ?? null, isLoading, isError, refetch };
}
