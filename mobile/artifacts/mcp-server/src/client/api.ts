import { generateSyntheticStatus } from "./synthetic.js";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";

export interface ClosureEntry {
  diseaseId: string;
  diseaseName: string;
  closedClasses: number;
  weekAgoClasses: number;
  weeklyHistory: number[];
  aiOutlook?: string;
}

export interface DiseaseStatus {
  id: string;
  currentLevel: number;
  currentCount: number;
  lastWeekCount: number;
  twoWeeksAgoCount: number;
  weeklyHistory: number[];
  aiComment: string;
  aiOutlook?: string;
}

export interface DistrictStatus {
  id: string;
  level: number;
  aiSummary: string;
}

export interface PrefectureDisease {
  id: string;
  perSentinel: number;
  level: number;
  weeklyHistory?: number[];
  lastWeekCount?: number;
  twoWeeksAgoCount?: number;
  aiComment?: string;
  aiOutlook?: string;
}

export interface PrefectureStatus {
  id: string;
  level: number;
  aiSummary: string;
  diseases: PrefectureDisease[];
}

export interface PrefClosureStatus {
  id: string;
  hasData: boolean;
  diseases: { id: string; closedClasses: number; weekAgoClasses: number }[];
}

export interface StatusResponse {
  asOf: string;
  schoolClosures: {
    lastUpdated: string;
    sourceUrl?: string;
    tableauUrl?: string;
    entries: ClosureEntry[];
  };
  diseases: DiseaseStatus[];
  districts: DistrictStatus[];
  prefectures: PrefectureStatus[];
  prefClosures: PrefClosureStatus[];
}

export async function fetchStatus(): Promise<StatusResponse> {
  if (process.env.SYNTHETIC_MODE === "true") {
    return generateSyntheticStatus();
  }
  const res = await fetch(`${API_BASE_URL}/api/v1/status`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<StatusResponse>;
}
