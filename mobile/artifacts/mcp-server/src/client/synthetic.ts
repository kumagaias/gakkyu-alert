import type {
  StatusResponse,
  ClosureEntry,
  DiseaseStatus,
  DistrictStatus,
  PrefectureStatus,
  PrefClosureStatus,
} from "./api.js";

// ---------------------------------------------------------------------------
// Deterministic seed based on the current date (stable within a day)
// ---------------------------------------------------------------------------

function dateSeed(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

/** Simple LCG pseudo-random number generator seeded with a number. */
function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    // LCG constants from Numerical Recipes
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// Seasonal / trend helpers
// ---------------------------------------------------------------------------

/** Returns a value in [min, max] shaped by a sine wave + noise. */
function seasonalValue(
  weekIndex: number,
  totalWeeks: number,
  baseMin: number,
  baseMax: number,
  rand: () => number,
  peakPhase = 0.0, // 0–1: fraction of year where the disease peaks
): number {
  const yearFraction = (new Date().getMonth() + weekIndex / 52) / 12;
  const seasonal = 0.5 + 0.5 * Math.sin(2 * Math.PI * (yearFraction - peakPhase));
  const noise = (rand() - 0.5) * 0.3;
  const normalised = Math.max(0, Math.min(1, seasonal + noise));
  const value = baseMin + normalised * (baseMax - baseMin);
  return Math.round(value);
}

/** Generate an 8-week history array for a disease count. */
function weeklyCountHistory(
  baseMin: number,
  baseMax: number,
  rand: () => number,
  peakPhase = 0.0,
): number[] {
  return Array.from({ length: 8 }, (_, i) =>
    seasonalValue(i, 8, baseMin, baseMax, rand, peakPhase),
  );
}

// ---------------------------------------------------------------------------
// District data
// ---------------------------------------------------------------------------

const DISTRICT_IDS = [
  "nerima",
  "suginami",
  "musashino",
  "itabashi",
  "toshima",
  "nakano",
  "setagaya",
  "mitaka",
] as const;

const DISTRICT_NAMES: Record<string, string> = {
  nerima: "練馬区",
  suginami: "杉並区",
  musashino: "武蔵野市",
  itabashi: "板橋区",
  toshima: "豊島区",
  nakano: "中野区",
  setagaya: "世田谷区",
  mitaka: "三鷹市",
};

/** Level weights: 0→50%, 1→35%, 2→13%, 3→2% */
function weightedLevel(r: number): number {
  if (r < 0.5) return 0;
  if (r < 0.85) return 1;
  if (r < 0.98) return 2;
  return 3;
}

const LEVEL_SUMMARIES: Record<number, (district: string) => string> = {
  0: (d) => `${d}では現在、感染症の流行は確認されていません。引き続き手洗い・換気を心がけてください。`,
  1: (d) => `${d}では一部の学校でインフルエンザ等の感染者が報告されています。体調管理にご注意ください。`,
  2: (d) => `${d}では感染症が散発的に流行しており、複数の学校で学級閉鎖が発生しています。外出時はマスクを着用してください。`,
  3: (d) => `${d}では感染症が急速に拡大しており、多数の学級閉鎖が報告されています。不要不急の外出を控え、感染予防を徹底してください。`,
};

function generateDistricts(rand: () => number): DistrictStatus[] {
  return DISTRICT_IDS.map((id) => {
    const level = weightedLevel(rand());
    return {
      id,
      level,
      aiSummary: LEVEL_SUMMARIES[level](DISTRICT_NAMES[id] ?? id),
    };
  });
}

// ---------------------------------------------------------------------------
// Disease data
// ---------------------------------------------------------------------------

interface DiseaseConfig {
  id: string;
  minCount: number;
  maxCount: number;
  peakPhase: number; // 0–1, fraction of year (0 = Jan, 0.5 = Jul)
  comments: string[];
}

const DISEASE_CONFIGS: DiseaseConfig[] = [
  {
    id: "flu-a",
    minCount: 0,
    maxCount: 50,
    peakPhase: 0.0, // peaks in Jan
    comments: [
      "インフルエンザAは先週比で増加傾向にあります。学校での集団感染に注意が必要です。",
      "インフルエンザAの患者数は横ばいで推移しています。引き続き経過を観察中です。",
      "インフルエンザAの報告数は減少傾向です。感染予防対策の継続をお勧めします。",
    ],
  },
  {
    id: "covid",
    minCount: 0,
    maxCount: 30,
    peakPhase: 0.08, // slight peak late Jan
    comments: [
      "新型コロナウイルス感染症の報告が増加しています。換気と手洗いを徹底してください。",
      "新型コロナウイルス感染症は散発的な報告にとどまっています。",
      "新型コロナウイルス感染症の患者数は低水準で安定しています。",
    ],
  },
  {
    id: "rsv",
    minCount: 0,
    maxCount: 25,
    peakPhase: 0.75, // peaks in Oct
    comments: [
      "RSウイルス感染症の報告が増えています。乳幼児のいるご家庭は特にご注意ください。",
      "RSウイルス感染症は例年並みの水準です。",
      "RSウイルスの流行は落ち着いています。",
    ],
  },
  {
    id: "hand-foot",
    minCount: 0,
    maxCount: 20,
    peakPhase: 0.5, // peaks in Jul
    comments: [
      "手足口病の報告が夏季に向けて増加しています。乳幼児への感染に注意が必要です。",
      "手足口病は散発的な報告が続いています。",
      "手足口病の患者数は落ち着いた水準です。",
    ],
  },
  {
    id: "herpangina",
    minCount: 0,
    maxCount: 15,
    peakPhase: 0.5, // peaks in Jul
    comments: [
      "ヘルパンギーナの報告が増えています。保育所・幼稚園での感染拡大に注意してください。",
      "ヘルパンギーナは散発的な報告にとどまっています。",
      "ヘルパンギーナの流行は落ち着いています。",
    ],
  },
  {
    id: "gastro",
    minCount: 0,
    maxCount: 20,
    peakPhase: 0.92, // peaks in Dec
    comments: [
      "感染性胃腸炎の報告が増加しています。手洗いと食品衛生の徹底をお願いします。",
      "感染性胃腸炎は例年並みの水準で推移しています。",
      "感染性胃腸炎の患者数は低水準です。",
    ],
  },
  {
    id: "strep",
    minCount: 0,
    maxCount: 20,
    peakPhase: 0.25, // peaks in Apr
    comments: [
      "溶連菌感染症の報告が増えています。のどの痛みがある場合は医療機関を受診してください。",
      "溶連菌感染症は散発的な報告です。",
      "溶連菌感染症の患者数は安定しています。",
    ],
  },
  {
    id: "chickenpox",
    minCount: 0,
    maxCount: 15,
    peakPhase: 0.25, // peaks in spring
    comments: [
      "水痘（水ぼうそう）の報告が増加しています。未接種のお子さんのワクチン接種をご検討ください。",
      "水痘の報告は散発的にとどまっています。",
      "水痘の患者数は低水準で安定しています。",
    ],
  },
];

function levelFromCount(count: number, max: number): number {
  const ratio = count / max;
  if (ratio < 0.15) return 0;
  if (ratio < 0.45) return 1;
  if (ratio < 0.75) return 2;
  return 3;
}

function generateDiseases(rand: () => number): DiseaseStatus[] {
  return DISEASE_CONFIGS.map((cfg) => {
    const history = weeklyCountHistory(cfg.minCount, cfg.maxCount, rand, cfg.peakPhase);
    const currentCount = history[history.length - 1] ?? 0;
    const lastWeekCount = history[history.length - 2] ?? 0;
    const twoWeeksAgoCount = history[history.length - 3] ?? 0;
    const currentLevel = levelFromCount(currentCount, cfg.maxCount);
    const commentIndex = Math.floor(rand() * cfg.comments.length);
    const aiComment = cfg.comments[commentIndex] ?? cfg.comments[0] ?? "";

    return {
      id: cfg.id,
      currentLevel,
      currentCount,
      lastWeekCount,
      twoWeeksAgoCount,
      weeklyHistory: history,
      aiComment,
    };
  });
}

// ---------------------------------------------------------------------------
// School closure data
// ---------------------------------------------------------------------------

const CLOSURE_DISEASE_IDS = ["flu-a", "covid", "rsv", "gastro"] as const;

const CLOSURE_DISEASE_NAMES: Record<string, string> = {
  "flu-a": "インフルエンザA",
  covid: "新型コロナウイルス感染症",
  rsv: "RSウイルス感染症",
  gastro: "感染性胃腸炎",
};

const CLOSURE_OUTLOOKS: Record<string, string> = {
  "flu-a": "来週にかけて学級閉鎖数が増加する可能性があります。引き続き状況を注視してください。",
  covid: "新型コロナウイルスによる学級閉鎖は現状維持と見込まれます。",
  rsv: "RSウイルスによる学級閉鎖は増加傾向にあります。乳幼児クラスへの影響に注意してください。",
  gastro: "感染性胃腸炎による学級閉鎖は落ち着く見通しです。手洗いを継続してください。",
};

function generateClosures(rand: () => number): ClosureEntry[] {
  return CLOSURE_DISEASE_IDS.map((id) => {
    const history = weeklyCountHistory(0, 15, rand, 0.0);
    const closedClasses = history[history.length - 1] ?? 0;
    const weekAgoClasses = history[history.length - 2] ?? 0;

    return {
      diseaseId: id,
      diseaseName: CLOSURE_DISEASE_NAMES[id] ?? id,
      closedClasses,
      weekAgoClasses,
      weeklyHistory: history,
      aiOutlook: CLOSURE_OUTLOOKS[id],
    };
  });
}

// ---------------------------------------------------------------------------
// Prefecture data (synthetic, mirrors district structure)
// ---------------------------------------------------------------------------

const PREFECTURE_IDS = ["tokyo"] as const;

function generatePrefectures(
  diseases: DiseaseStatus[],
  rand: () => number,
): PrefectureStatus[] {
  return PREFECTURE_IDS.map((id) => {
    const level = weightedLevel(rand());
    return {
      id,
      level,
      aiSummary:
        "東京都全体では感染症の動向を継続的に監視しています。各区市の状況を参考に感染予防対策をお取りください。",
      diseases: diseases.map((d) => ({
        id: d.id,
        perSentinel: Math.round(rand() * 10 * 10) / 10,
        level: d.currentLevel,
        weeklyHistory: d.weeklyHistory,
        lastWeekCount: d.lastWeekCount,
        twoWeeksAgoCount: d.twoWeeksAgoCount,
        aiComment: d.aiComment,
      })),
    };
  });
}

function generatePrefClosures(rand: () => number): PrefClosureStatus[] {
  return PREFECTURE_IDS.map((id) => ({
    id,
    hasData: true,
    diseases: CLOSURE_DISEASE_IDS.map((diseaseId) => ({
      id: diseaseId,
      closedClasses: Math.floor(rand() * 30),
      weekAgoClasses: Math.floor(rand() * 30),
    })),
  }));
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function generateSyntheticStatus(): StatusResponse {
  const seed = dateSeed();
  const rand = makePrng(seed);

  const now = new Date();
  const asOf = now.toISOString();
  const lastUpdated = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1 hour ago

  const districts = generateDistricts(rand);
  const diseases = generateDiseases(rand);
  const closures = generateClosures(rand);
  const prefectures = generatePrefectures(diseases, rand);
  const prefClosures = generatePrefClosures(rand);

  return {
    asOf,
    schoolClosures: {
      lastUpdated,
      entries: closures,
    },
    diseases,
    districts,
    prefectures,
    prefClosures,
  };
}
