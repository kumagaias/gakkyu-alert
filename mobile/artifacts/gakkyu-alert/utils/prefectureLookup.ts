import { PREFECTURES, type Prefecture } from "@/constants/data";

const EN_TO_ID: Record<string, string> = {
  Hokkaido: "hokkaido", Aomori: "aomori", Iwate: "iwate", Miyagi: "miyagi",
  Akita: "akita", Yamagata: "yamagata", Fukushima: "fukushima", Ibaraki: "ibaraki",
  Tochigi: "tochigi", Gunma: "gunma", Saitama: "saitama", Chiba: "chiba",
  Tokyo: "tokyo", Kanagawa: "kanagawa", Niigata: "niigata", Toyama: "toyama",
  Ishikawa: "ishikawa", Fukui: "fukui", Yamanashi: "yamanashi", Nagano: "nagano",
  Gifu: "gifu", Shizuoka: "shizuoka", Aichi: "aichi", Mie: "mie",
  Shiga: "shiga", Kyoto: "kyoto", Osaka: "osaka", Hyogo: "hyogo",
  Nara: "nara", Wakayama: "wakayama", Tottori: "tottori", Shimane: "shimane",
  Okayama: "okayama", Hiroshima: "hiroshima", Yamaguchi: "yamaguchi",
  Tokushima: "tokushima", Kagawa: "kagawa", Ehime: "ehime", Kochi: "kochi",
  Fukuoka: "fukuoka", Saga: "saga", Nagasaki: "nagasaki", Kumamoto: "kumamoto",
  Oita: "oita", Miyazaki: "miyazaki", Kagoshima: "kagoshima", Okinawa: "okinawa",
};

export function findPrefByRegion(region: string): Prefecture | null {
  // Japanese name exact / prefix match (e.g. "東京都", "大阪府")
  const byName = PREFECTURES.find((p) => p.name === region || region.startsWith(p.name));
  if (byName) return byName;
  // English name match (iOS/Android may return English)
  const id = EN_TO_ID[region];
  return id ? (PREFECTURES.find((p) => p.id === id) ?? null) : null;
}
