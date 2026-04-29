export type EpidemicLevel = 0 | 1 | 2 | 3;

export const LEVEL_NAMES: Record<EpidemicLevel, string> = {
  0: "平穏",
  1: "注意",
  2: "警戒",
  3: "流行",
};

export interface SchoolRules {
  hoikuen: string;  // 保育園・幼稚園（参考）
  gakko: string;    // 小学校〜高校（共通）
}

export interface Disease {
  id: string;
  name: string;
  nameEn: string;
  currentLevel: EpidemicLevel;
  currentCount: number;
  lastWeekCount: number;
  twoWeeksAgoCount: number;
  weeklyHistory: number[];
  schoolRules: SchoolRules;
  doctorClearance: boolean;
  aiComment: string;
  aiOutlook?: string;
}

/** 都道府県別疾患内訳 (API から取得) */
export interface PrefectureDisease {
  id: string;              // 疾患ID (例: "flu-a")
  perSentinel: number;     // 定点あたり患者数
  level: EpidemicLevel;
  weeklyHistory?: number[]; // 過去8週の定点当り患者数（古い順）
  lastWeekCount?: number;
  twoWeeksAgoCount?: number;
  aiComment?: string;
}

/** 都道府県別・疾患別閉鎖クラス数 (学校等欠席者・感染症情報システム) */
export interface PrefClosureDisease {
  id: string;             // 疾患ID (例: "flu", "covid")
  closedClasses: number;  // 今週の閉鎖クラス数
  weekAgoClasses?: number; // 先週の閉鎖クラス数（オプション）
  weeklyHistory?: number[]; // 過去8週分の推移（オプション）
}

export interface PrefClosureStatus {
  id: string;      // 都道府県ID
  hasData: boolean;
  diseases: PrefClosureDisease[];
}

export interface District {
  id: string;
  name: string;
  level: EpidemicLevel;
  aiSummary: string;
  diseases?: PrefectureDisease[];
}

/** 都道府県 — 将来的に市区町村への分解を見越した構造 */
export interface Prefecture {
  id: string;    // 英字ID (例: "tokyo")
  name: string;  // 日本語名 (例: "東京都")
  /** 将来: municipalities?: Municipality[] */
  level: EpidemicLevel;
  aiSummary: string;
  diseases?: PrefectureDisease[];
}

export const PREFECTURES: Prefecture[] = [
  { id: "hokkaido",   name: "北海道",   level: 0, aiSummary: "" },
  { id: "aomori",     name: "青森県",   level: 0, aiSummary: "" },
  { id: "iwate",      name: "岩手県",   level: 0, aiSummary: "" },
  { id: "miyagi",     name: "宮城県",   level: 0, aiSummary: "" },
  { id: "akita",      name: "秋田県",   level: 0, aiSummary: "" },
  { id: "yamagata",   name: "山形県",   level: 0, aiSummary: "" },
  { id: "fukushima",  name: "福島県",   level: 0, aiSummary: "" },
  { id: "ibaraki",    name: "茨城県",   level: 0, aiSummary: "" },
  { id: "tochigi",    name: "栃木県",   level: 0, aiSummary: "" },
  { id: "gunma",      name: "群馬県",   level: 0, aiSummary: "" },
  { id: "saitama",    name: "埼玉県",   level: 0, aiSummary: "" },
  { id: "chiba",      name: "千葉県",   level: 0, aiSummary: "" },
  { id: "tokyo",      name: "東京都",   level: 0, aiSummary: "" },
  { id: "kanagawa",   name: "神奈川県", level: 0, aiSummary: "" },
  { id: "niigata",    name: "新潟県",   level: 0, aiSummary: "" },
  { id: "toyama",     name: "富山県",   level: 0, aiSummary: "" },
  { id: "ishikawa",   name: "石川県",   level: 0, aiSummary: "" },
  { id: "fukui",      name: "福井県",   level: 0, aiSummary: "" },
  { id: "yamanashi",  name: "山梨県",   level: 0, aiSummary: "" },
  { id: "nagano",     name: "長野県",   level: 0, aiSummary: "" },
  { id: "gifu",       name: "岐阜県",   level: 0, aiSummary: "" },
  { id: "shizuoka",   name: "静岡県",   level: 0, aiSummary: "" },
  { id: "aichi",      name: "愛知県",   level: 0, aiSummary: "" },
  { id: "mie",        name: "三重県",   level: 0, aiSummary: "" },
  { id: "shiga",      name: "滋賀県",   level: 0, aiSummary: "" },
  { id: "kyoto",      name: "京都府",   level: 0, aiSummary: "" },
  { id: "osaka",      name: "大阪府",   level: 0, aiSummary: "" },
  { id: "hyogo",      name: "兵庫県",   level: 0, aiSummary: "" },
  { id: "nara",       name: "奈良県",   level: 0, aiSummary: "" },
  { id: "wakayama",   name: "和歌山県", level: 0, aiSummary: "" },
  { id: "tottori",    name: "鳥取県",   level: 0, aiSummary: "" },
  { id: "shimane",    name: "島根県",   level: 0, aiSummary: "" },
  { id: "okayama",    name: "岡山県",   level: 0, aiSummary: "" },
  { id: "hiroshima",  name: "広島県",   level: 0, aiSummary: "" },
  { id: "yamaguchi",  name: "山口県",   level: 0, aiSummary: "" },
  { id: "tokushima",  name: "徳島県",   level: 0, aiSummary: "" },
  { id: "kagawa",     name: "香川県",   level: 0, aiSummary: "" },
  { id: "ehime",      name: "愛媛県",   level: 0, aiSummary: "" },
  { id: "kochi",      name: "高知県",   level: 0, aiSummary: "" },
  { id: "fukuoka",    name: "福岡県",   level: 0, aiSummary: "" },
  { id: "saga",       name: "佐賀県",   level: 0, aiSummary: "" },
  { id: "nagasaki",   name: "長崎県",   level: 0, aiSummary: "" },
  { id: "kumamoto",   name: "熊本県",   level: 0, aiSummary: "" },
  { id: "oita",       name: "大分県",   level: 0, aiSummary: "" },
  { id: "miyazaki",   name: "宮崎県",   level: 0, aiSummary: "" },
  { id: "kagoshima",  name: "鹿児島県", level: 0, aiSummary: "" },
  { id: "okinawa",    name: "沖縄県",   level: 0, aiSummary: "" },
];

export interface SchoolClosureEntry {
  diseaseId: string;
  diseaseName: string;
  closedClasses: number;
  weekAgoClasses: number;
  weeklyHistory: number[]; // 8 weeks oldest→newest, last = current
  aiOutlook?: string;
}

export interface SchoolClosureData {
  lastUpdated: string;
  entries: SchoolClosureEntry[];
  sourceUrl: string;
  tableauUrl: string;
}

export const SCHOOL_CLOSURES: SchoolClosureData = {
  lastUpdated: "2026/04/04",
  sourceUrl: "https://www.fukushihoken.metro.tokyo.lg.jp/iryo/kansen/gakkyu.html",
  tableauUrl: "https://public.tableau.com/app/profile/tokyo.fukushihoken/viz/shared/SCHOOL_CLOSURES",
  entries: [
    {
      diseaseId: "flu-a",
      diseaseName: "インフルエンザA型",
      closedClasses: 1,
      weekAgoClasses: 1,
      weeklyHistory: [0, 0, 1, 2, 3, 2, 1, 1],
    },
    {
      diseaseId: "flu-b",
      diseaseName: "インフルエンザB型",
      closedClasses: 1,
      weekAgoClasses: 2,
      weeklyHistory: [0, 1, 2, 4, 5, 3, 2, 1],
    },
    {
      diseaseId: "covid",
      diseaseName: "新型コロナ",
      closedClasses: 0,
      weekAgoClasses: 0,
      weeklyHistory: [0, 0, 0, 1, 1, 0, 0, 0],
    },
    {
      diseaseId: "flu-other",
      diseaseName: "その他インフルエンザ",
      closedClasses: 0,
      weekAgoClasses: 0,
      weeklyHistory: [0, 0, 0, 0, 0, 0, 0, 0],
    },
  ],
};

export const DISEASES: Disease[] = [
  {
    id: "flu-a",
    name: "インフルエンザA型",
    nameEn: "Influenza A",
    currentLevel: 3,
    currentCount: 18.4,
    lastWeekCount: 12.1,
    twoWeeksAgoCount: 7.3,
    weeklyHistory: [2.1, 3.4, 5.0, 7.3, 12.1, 18.4, 18.4, 18.4],
    schoolRules: {
      hoikuen:  "発症後5日、かつ解熱後3日を経過するまで（幼児規定）",
      gakko:    "発症後5日、かつ解熱後2日を経過するまで",
    },
    doctorClearance: false,
    aiComment: "",
  },
  {
    id: "flu-b",
    name: "インフルエンザB型",
    nameEn: "Influenza B",
    currentLevel: 2,
    currentCount: 6.2,
    lastWeekCount: 4.1,
    twoWeeksAgoCount: 2.8,
    weeklyHistory: [0.5, 1.0, 1.8, 2.8, 4.1, 6.2, 6.2, 6.2],
    schoolRules: {
      hoikuen:  "発症後5日、かつ解熱後3日を経過するまで（幼児規定）",
      gakko:    "発症後5日、かつ解熱後2日を経過するまで",
    },
    doctorClearance: false,
    aiComment: "",
  },
  {
    id: "noro",
    name: "ノロウイルス",
    nameEn: "Norovirus",
    currentLevel: 2,
    currentCount: 4.8,
    lastWeekCount: 5.3,
    twoWeeksAgoCount: 6.0,
    weeklyHistory: [8.1, 7.5, 6.8, 6.0, 5.3, 4.8, 4.8, 4.8],
    schoolRules: {
      hoikuen:  "嘔吐・下痢症状が消失してから2日経過するまで",
      gakko:    "病状により医師が感染のおそれなしと認めるまで（第三種感染症）",
    },
    doctorClearance: false,
    aiComment: "",
  },
  {
    id: "rsv",
    name: "RSウイルス",
    nameEn: "RSV",
    currentLevel: 1,
    currentCount: 2.1,
    lastWeekCount: 2.4,
    twoWeeksAgoCount: 2.8,
    weeklyHistory: [3.5, 3.2, 3.0, 2.8, 2.4, 2.1, 2.1, 2.1],
    schoolRules: {
      hoikuen:  "医師が感染のおそれがないと認めるまで",
      gakko:    "病状により医師が感染のおそれなしと認めるまで（第三種感染症）",
    },
    doctorClearance: true,
    aiComment: "",
  },
  {
    id: "strep",
    name: "溶連菌感染症",
    nameEn: "Streptococcal",
    currentLevel: 1,
    currentCount: 3.2,
    lastWeekCount: 2.9,
    twoWeeksAgoCount: 2.5,
    weeklyHistory: [1.8, 2.0, 2.2, 2.5, 2.9, 3.2, 3.2, 3.2],
    schoolRules: {
      hoikuen:  "抗菌薬内服開始後24〜48時間経過し、症状が消失するまで",
      gakko:    "抗菌薬内服開始後24〜48時間経過し、症状が消失するまで",
    },
    doctorClearance: false,
    aiComment: "",
  },
  {
    id: "mycoplasma",
    name: "マイコプラズマ肺炎",
    nameEn: "Mycoplasma",
    currentLevel: 1,
    currentCount: 1.8,
    lastWeekCount: 1.6,
    twoWeeksAgoCount: 1.4,
    weeklyHistory: [0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 1.8, 1.8],
    schoolRules: {
      hoikuen:  "医師が感染のおそれがないと認めるまで",
      gakko:    "病状により医師が感染のおそれなしと認めるまで（第三種感染症）",
    },
    doctorClearance: true,
    aiComment: "",
  },
  {
    id: "covid",
    name: "新型コロナウイルス",
    nameEn: "COVID-19",
    currentLevel: 1,
    currentCount: 2.5,
    lastWeekCount: 2.3,
    twoWeeksAgoCount: 2.1,
    weeklyHistory: [1.5, 1.8, 2.0, 2.1, 2.3, 2.5, 2.5, 2.5],
    schoolRules: {
      hoikuen:  "発症後5日、かつ症状軽快後1日を経過するまで",
      gakko:    "発症後5日、かつ症状軽快後1日を経過するまで",
    },
    doctorClearance: false,
    aiComment: "",
  },
  {
    id: "hand-foot",
    name: "手足口病",
    nameEn: "HFMD",
    currentLevel: 0,
    currentCount: 0.4,
    lastWeekCount: 0.5,
    twoWeeksAgoCount: 0.6,
    weeklyHistory: [2.1, 1.8, 1.2, 0.8, 0.6, 0.5, 0.4, 0.4],
    schoolRules: {
      hoikuen:  "医師が感染のおそれがないと認めるまで",
      gakko:    "病状により医師が感染のおそれなしと認めるまで（第三種感染症）",
    },
    doctorClearance: true,
    aiComment: "",
  },
  {
    id: "mumps",
    name: "おたふくかぜ",
    nameEn: "Mumps",
    currentLevel: 0,
    currentCount: 0.2,
    lastWeekCount: 0.2,
    twoWeeksAgoCount: 0.3,
    weeklyHistory: [0.5, 0.4, 0.4, 0.3, 0.3, 0.2, 0.2, 0.2],
    schoolRules: {
      hoikuen:  "耳下腺等の腫脹が発現してから5日経過し、全身状態が良好になるまで",
      gakko:    "耳下腺等の腫脹が発現してから5日経過し、全身状態が良好になるまで",
    },
    doctorClearance: false,
    aiComment: "",
  },
  {
    id: "chickenpox",
    name: "水痘（みずぼうそう）",
    nameEn: "Chickenpox",
    currentLevel: 0,
    currentCount: 0.6,
    lastWeekCount: 0.7,
    twoWeeksAgoCount: 0.8,
    weeklyHistory: [1.2, 1.0, 0.9, 0.8, 0.7, 0.6, 0.6, 0.6],
    schoolRules: {
      hoikuen:  "すべての発疹が痂皮化するまで",
      gakko:    "すべての発疹が痂皮化するまで",
    },
    doctorClearance: false,
    aiComment: "",
  },
  {
    id: "measles",
    name: "麻疹（はしか）",
    nameEn: "Measles",
    currentLevel: 0,
    currentCount: 0.0,
    lastWeekCount: 0.0,
    twoWeeksAgoCount: 0.0,
    weeklyHistory: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    schoolRules: {
      hoikuen:  "解熱後3日を経過するまで",
      gakko:    "解熱後3日を経過するまで",
    },
    doctorClearance: false,
    aiComment: "",
  },
  {
    id: "rubella",
    name: "風疹",
    nameEn: "Rubella",
    currentLevel: 0,
    currentCount: 0.0,
    lastWeekCount: 0.0,
    twoWeeksAgoCount: 0.0,
    weeklyHistory: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    schoolRules: {
      hoikuen:  "発疹が消失するまで",
      gakko:    "発疹が消失するまで",
    },
    doctorClearance: false,
    aiComment: "",
  },
  {
    id: "pertussis",
    name: "百日咳",
    nameEn: "Whooping Cough",
    currentLevel: 0,
    currentCount: 0.1,
    lastWeekCount: 0.1,
    twoWeeksAgoCount: 0.1,
    weeklyHistory: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
    schoolRules: {
      hoikuen:  "特有の咳が消失するまで、または5日間の抗菌薬療法を終了するまで",
      gakko:    "特有の咳が消失するまで、または5日間の抗菌薬療法を終了するまで",
    },
    doctorClearance: false,
    aiComment: "",
  },
  {
    id: "adeno",
    name: "咽頭結膜熱（プール熱）",
    nameEn: "Adenovirus",
    currentLevel: 0,
    currentCount: 0.8,
    lastWeekCount: 0.9,
    twoWeeksAgoCount: 0.7,
    weeklyHistory: [0.5, 0.6, 0.7, 0.7, 0.9, 0.8, 0.8, 0.8],
    schoolRules: {
      hoikuen:  "主要症状が消退した後2日を経過するまで",
      gakko:    "主要症状が消退した後2日を経過するまで",
    },
    doctorClearance: false,
    aiComment: "",
  },
  {
    id: "gastro",
    name: "感染性胃腸炎",
    nameEn: "Gastroenteritis",
    currentLevel: 1,
    currentCount: 3.8,
    lastWeekCount: 3.5,
    twoWeeksAgoCount: 3.1,
    weeklyHistory: [2.0, 2.5, 3.0, 3.1, 3.5, 3.8, 3.8, 3.8],
    schoolRules: {
      hoikuen:  "嘔吐・下痢症状が消失してから2日経過するまで",
      gakko:    "病状により医師が感染のおそれなしと認めるまで（第三種感染症）",
    },
    doctorClearance: true,
    aiComment: "",
  },
  {
    id: "herpangina",
    name: "ヘルパンギーナ",
    nameEn: "Herpangina",
    currentLevel: 0,
    currentCount: 0.3,
    lastWeekCount: 0.3,
    twoWeeksAgoCount: 0.4,
    weeklyHistory: [1.5, 1.2, 0.8, 0.5, 0.4, 0.3, 0.3, 0.3],
    schoolRules: {
      hoikuen:  "医師が感染のおそれがないと認めるまで",
      gakko:    "病状により医師が感染のおそれなしと認めるまで（第三種感染症）",
    },
    doctorClearance: true,
    aiComment: "",
  },
];

export const TOKYO_DISTRICTS: District[] = [
  // ── 23特別区 ────────────────────────────────────────────────────────────────
  { id: "chiyoda", name: "千代田区", level: 2, aiSummary: "インフルエンザA型が警戒レベルに達しています。オフィス街のため成人から家庭内感染が拡大中。" },
  { id: "chuo", name: "中央区", level: 2, aiSummary: "インフルエンザA型と感染性胃腸炎が同時に増加中。年末年始の人流増加の影響と見られます。" },
  { id: "minato", name: "港区", level: 1, aiSummary: "インフルエンザA型が注意レベル。外資系企業からの輸入株が確認されています。" },
  { id: "shinjuku", name: "新宿区", level: 3, aiSummary: "インフルエンザA型が流行レベルに達しました。繁華街での飛沫感染が拡大しています。今週最も注意が必要な地域です。" },
  { id: "bunkyo", name: "文京区", level: 2, aiSummary: "インフルエンザA型が警戒レベル。学校・大学が集中する地域のため集団感染に注意。" },
  { id: "taito", name: "台東区", level: 1, aiSummary: "インフルエンザA型が注意レベル。観光客からの感染が散見されます。" },
  { id: "sumida", name: "墨田区", level: 1, aiSummary: "全体的に落ち着いた状態。インフルエンザA型が注意レベルを維持しています。" },
  { id: "koto", name: "江東区", level: 2, aiSummary: "インフルエンザA・B型が同時増加。複数の保育園で集団感染が報告されています。" },
  { id: "shinagawa", name: "品川区", level: 1, aiSummary: "インフルエンザA型が注意レベル。通勤者が多いターミナル駅周辺での感染報告あり。" },
  { id: "meguro", name: "目黒区", level: 1, aiSummary: "各感染症とも低水準。引き続き基本的な感染対策を続けましょう。" },
  { id: "ota", name: "大田区", level: 2, aiSummary: "インフルエンザA型が警戒レベル。羽田空港周辺での輸入例が増加しています。" },
  { id: "setagaya", name: "世田谷区", level: 2, aiSummary: "インフルエンザA型と溶連菌感染症が増加中。小学校での集団感染が複数報告されています。" },
  { id: "shibuya", name: "渋谷区", level: 3, aiSummary: "インフルエンザA型が流行レベル。若者の集まる商業施設での感染拡大が確認されています。" },
  { id: "nakano", name: "中野区", level: 1, aiSummary: "全体的に落ち着いた状態。インフルエンザA型が注意レベルを維持。" },
  { id: "suginami", name: "杉並区", level: 2, aiSummary: "インフルエンザA型が警戒レベル。複数の小学校で学級閉鎖が検討されています。" },
  { id: "toshima", name: "豊島区", level: 2, aiSummary: "インフルエンザA型が警戒レベル。池袋周辺での飛沫感染リスクが高まっています。" },
  { id: "kita", name: "北区", level: 1, aiSummary: "各感染症とも注意レベル以下。基本的な手洗い・うがいを続けましょう。" },
  { id: "arakawa", name: "荒川区", level: 1, aiSummary: "インフルエンザA型が注意レベル。隣接する台東区・足立区の状況に注意が必要です。" },
  { id: "itabashi", name: "板橋区", level: 1, aiSummary: "全体的に落ち着いた状態を維持しています。" },
  { id: "nerima", name: "練馬区", level: 2, aiSummary: "インフルエンザA型が警戒レベルに上昇しました。複数の学校でのクラスター発生が報告されています。" },
  { id: "adachi", name: "足立区", level: 2, aiSummary: "インフルエンザA型が警戒レベル。ノロウイルスも同時に増加中です。" },
  { id: "katsushika", name: "葛飾区", level: 1, aiSummary: "各感染症とも注意レベル以下で推移しています。" },
  { id: "edogawa", name: "江戸川区", level: 1, aiSummary: "インフルエンザA型が注意レベル。隣接する千葉県からの感染流入に注意。" },
  // ── 多摩地区 市部 ────────────────────────────────────────────────────────────
  { id: "hachioji", name: "八王子市", level: 2, aiSummary: "インフルエンザA型が警戒レベル。市内複数の小学校で学級閉鎖が実施されています。" },
  { id: "tachikawa", name: "立川市", level: 1, aiSummary: "インフルエンザA型が注意レベル。ターミナル駅周辺での感染リスクに注意してください。" },
  { id: "musashino", name: "武蔵野市", level: 1, aiSummary: "感染症は全体的に落ち着いた水準です。引き続き手洗い・うがいを続けましょう。" },
  { id: "mitaka", name: "三鷹市", level: 1, aiSummary: "インフルエンザA型が注意レベル。保育園・幼稚園での感染対策を徹底しましょう。" },
  { id: "ome", name: "青梅市", level: 0, aiSummary: "今週は感染症の大きな流行はありません。基本的な感染予防を心がけましょう。" },
  { id: "fuchu", name: "府中市", level: 2, aiSummary: "インフルエンザA型が警戒レベル。市内の複数施設でクラスターが発生しています。" },
  { id: "akishima", name: "昭島市", level: 0, aiSummary: "感染症は平穏な状態が続いています。" },
  { id: "chofu", name: "調布市", level: 1, aiSummary: "インフルエンザA型が注意レベル。市内の小学校での感染報告があります。" },
  { id: "machida", name: "町田市", level: 2, aiSummary: "インフルエンザA型が警戒レベル。神奈川県境からの感染流入が影響しています。" },
  { id: "koganei", name: "小金井市", level: 1, aiSummary: "インフルエンザA型が注意レベルで推移しています。" },
  { id: "kodaira", name: "小平市", level: 1, aiSummary: "インフルエンザA型が注意レベル。近隣市との往来による感染に注意。" },
  { id: "hino", name: "日野市", level: 1, aiSummary: "インフルエンザA型が注意レベル。保育園での感染対策強化をお勧めします。" },
  { id: "higashimurayama", name: "東村山市", level: 0, aiSummary: "今週の感染症報告は少なく平穏な状態です。" },
  { id: "kokubunji", name: "国分寺市", level: 1, aiSummary: "インフルエンザA型が注意レベル。市内の幼稚園からの報告があります。" },
  { id: "kunitachi", name: "国立市", level: 0, aiSummary: "感染症の報告数は低水準です。引き続き予防に努めましょう。" },
  { id: "fussa", name: "福生市", level: 1, aiSummary: "インフルエンザA型が注意レベル。基地周辺での感染リスクに注意。" },
  { id: "komae", name: "狛江市", level: 1, aiSummary: "インフルエンザA型が注意レベルで推移しています。" },
  { id: "higashiyamato", name: "東大和市", level: 0, aiSummary: "感染症は平穏な状態です。" },
  { id: "kiyose", name: "清瀬市", level: 1, aiSummary: "インフルエンザA型が注意レベル。病院・施設での感染管理を徹底しましょう。" },
  { id: "higashikurume", name: "東久留米市", level: 0, aiSummary: "今週は感染症の大きな動きはありません。" },
  { id: "musashimurayama", name: "武蔵村山市", level: 1, aiSummary: "インフルエンザA型が注意レベル。市内保育施設での感染報告あり。" },
  { id: "tama", name: "多摩市", level: 1, aiSummary: "インフルエンザA型が注意レベル。ニュータウンの集合住宅での感染に注意。" },
  { id: "inagi", name: "稲城市", level: 0, aiSummary: "感染症の報告数は低水準で平穏です。" },
  { id: "hamura", name: "羽村市", level: 0, aiSummary: "今週の感染症報告は少なく落ち着いています。" },
  { id: "akiruno", name: "あきる野市", level: 0, aiSummary: "感染症は平穏な状態です。基本的な予防を続けましょう。" },
  { id: "nishitokyo", name: "西東京市", level: 1, aiSummary: "インフルエンザA型が注意レベル。市内の保育園・小学校での感染報告があります。" },
  // ── 多摩地区 郡部 ────────────────────────────────────────────────────────────
  { id: "mizuho", name: "瑞穂町", level: 0, aiSummary: "感染症の報告数は低水準です。引き続き手洗い・うがいを続けましょう。" },
  { id: "hinode", name: "日の出町", level: 0, aiSummary: "今週は感染症の流行はありません。" },
  { id: "hinohara", name: "檜原村", level: 0, aiSummary: "感染症の報告はありません。" },
  { id: "okutama", name: "奥多摩町", level: 0, aiSummary: "感染症の報告はありません。" },
  // ── 島嶼部 ───────────────────────────────────────────────────────────────────
  { id: "oshima", name: "大島町", level: 0, aiSummary: "感染症の報告はありません。島内での感染対策を続けましょう。" },
  { id: "toshima_island", name: "利島村", level: 0, aiSummary: "感染症の報告はありません。" },
  { id: "niijima", name: "新島村", level: 0, aiSummary: "感染症の報告はありません。" },
  { id: "kozushima", name: "神津島村", level: 0, aiSummary: "感染症の報告はありません。" },
  { id: "miyake", name: "三宅村", level: 0, aiSummary: "感染症の報告はありません。" },
  { id: "mikurajima", name: "御蔵島村", level: 0, aiSummary: "感染症の報告はありません。" },
  { id: "hachijo", name: "八丈町", level: 0, aiSummary: "感染症の報告はありません。島内での基本的な感染対策を継続してください。" },
  { id: "aogashima", name: "青ヶ島村", level: 0, aiSummary: "感染症の報告はありません。" },
  { id: "ogasawara", name: "小笠原村", level: 0, aiSummary: "感染症の報告はありません。" },
];

export const HOME_AI_SUMMARIES: Record<EpidemicLevel, string> = {
  0: "今週はすべての感染症が平穏な状態です。引き続き手洗い・うがいなど基本的な感染予防を心がけましょう。",
  1: "インフルエンザA型が注意レベルに達しています。体調の変化に気をつけ、マスクの着用や手洗いの徹底をお勧めします。",
  2: "インフルエンザA型が警戒レベルに上昇しました。不要不急の外出を控え、学校や保育園での感染対策を強化してください。学級閉鎖の可能性に備えましょう。",
  3: "インフルエンザA型が流行レベルに達しています。お子さんの体調確認を毎朝行い、発熱・咳などの症状があれば早めに医療機関を受診してください。",
};

/** 都道府県別 感染症情報センター URL */
export const PREF_IDSC_URLS: Record<string, string> = {
  hokkaido:   "https://www.iph.pref.hokkaido.jp/kansen/index.html",
  aomori:     "https://www.pref.aomori.lg.jp/soshiki/kenko/eisei/infection-survey.html",
  iwate:      "https://www2.pref.iwate.jp/~hp1353/kansen/index.html",
  miyagi:     "https://www.pref.miyagi.jp/site/hokans/kansen-center.html",
  akita:      "https://idsc.pref.akita.jp/kss/",
  yamagata:   "https://www.eiken.yamagata.yamagata.jp/kansen.html",
  fukushima:  "https://www.pref.fukushima.lg.jp/sec/21910a/kansenshoujouhou.html",
  ibaraki:    "https://www.pref.ibaraki.jp/hokenfukushi/eiken/idwr/index.html",
  tochigi:    "https://www.pref.tochigi.lg.jp/e60/tidctop.html",
  gunma:      "https://www.pref.gunma.jp/page/3296.html",
  saitama:    "https://www.pref.saitama.lg.jp/b0714/surveillance/index.html",
  chiba:      "https://www.pref.chiba.lg.jp/eiken/c-idsc/index.html",
  tokyo:      "https://idsc.tmiph.metro.tokyo.lg.jp/",
  kanagawa:   "https://www.pref.kanagawa.jp/sys/eiken/003_center/03_center_main.htm",
  niigata:    "https://www.pref.niigata.lg.jp/sec/hokanken/1207674051500.html",
  toyama:     "https://www.pref.toyama.jp/1279/kansen/",
  ishikawa:   "https://www.pref.ishikawa.lg.jp/hokan/kansenjoho/top/top.html",
  fukui:      "https://info.pref.fukui.lg.jp/kansensyou/",
  yamanashi:  "https://www.pref.yamanashi.jp/kansensho_portal/index.html",
  nagano:     "https://www.pref.nagano.lg.jp/shippei-kansen/kenko/kenko/kansensho/joho/index.html",
  gifu:       "https://www.pref.gifu.lg.jp/page/9550.html",
  shizuoka:   "https://www.pref.shizuoka.jp/kenkofukushi/shippeikansensho/kansensho/1003065/index.html",
  aichi:      "https://www.pref.aichi.jp/eiseiken/kansentop.html",
  mie:        "https://www.kenkou.pref.mie.jp/",
  shiga:      "https://www.pref.shiga.lg.jp/eiseikagaku/kansensyou/",
  kyoto:      "https://www.pref.kyoto.jp/idsc/",
  osaka:      "https://www.iph.pref.osaka.jp/",
  hyogo:      "https://web.pref.hyogo.lg.jp/iphs01/kansensho_jyoho/infectdis.html",
  nara:       "https://www.pref.nara.jp/27874.htm",
  wakayama:   "https://www.pref.wakayama.lg.jp/prefg/031801/idsw/d00153659.html",
  tottori:    "https://www.pref.tottori.lg.jp/idsc/",
  shimane:    "https://pref.shimane.didss.dsvc.jp/",
  okayama:    "https://www.pref.okayama.jp/soshiki/309/",
  hiroshima:  "https://www.pref.hiroshima.lg.jp/site/hcdc/",
  yamaguchi:  "https://pref.yamaguchi.didss.dsvc.jp/",
  tokushima:  "https://www.pref.tokushima.lg.jp/ippannokata/kenko/kansensho/2004062300038/",
  kagawa:     "https://www.pref.kagawa.lg.jp/kansensyo/kansensyoujouhou/kfvn.html",
  ehime:      "https://www.pref.ehime.jp/site/kanjyo/",
  kochi:      "https://www.pref.kochi.lg.jp/soshiki/130000/130120/",
  fukuoka:    "https://www.fihes.pref.fukuoka.jp/~idsc_fukuoka/",
  saga:       "https://kansen.pref.saga.jp/",
  nagasaki:   "https://www.pref.nagasaki.jp/bunrui/hukushi-hoken/kansensho/kansen-c/",
  kumamoto:   "https://www.pref.kumamoto.jp/soshiki/30/",
  oita:       "https://www.pref.oita.jp/site/bosaianzen/shuuhou.html",
  miyazaki:   "https://www.pref.miyazaki.lg.jp/contents/org/fukushi/eikanken/center/index.html",
  kagoshima:  "https://www.pref.kagoshima.jp/kenko-fukushi/kenko-iryo/kansen/index.html",
  okinawa:    "https://www.pref.okinawa.jp/iryokenko/shippeikansensho/1005861/1006484.html",
};
