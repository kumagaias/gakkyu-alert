import * as Location from "expo-location";
import { Platform } from "react-native";
import { TOKYO_DISTRICTS, PREFECTURES, type District, type Prefecture } from "@/constants/data";
import geoData from "@/assets/data/tokyo.json";

// ── point-in-polygon (ray casting) ─────────────────────────────────────────
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// 2点間の距離 (km) を近似計算
export function geoDistKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 多摩地区・島嶼部 の重心座標テーブル (GPS フォールバック)
export const TAMA_CITY_CENTERS: { name: string; lat: number; lng: number }[] = [
  { name: "八王子市",    lat: 35.6665, lng: 139.3162 },
  { name: "立川市",      lat: 35.6985, lng: 139.4130 },
  { name: "武蔵野市",    lat: 35.7175, lng: 139.5659 },
  { name: "三鷹市",      lat: 35.6835, lng: 139.5602 },
  { name: "青梅市",      lat: 35.7879, lng: 139.2388 },
  { name: "府中市",      lat: 35.6692, lng: 139.4776 },
  { name: "昭島市",      lat: 35.7053, lng: 139.3534 },
  { name: "調布市",      lat: 35.6519, lng: 139.5444 },
  { name: "町田市",      lat: 35.5484, lng: 139.4459 },
  { name: "小金井市",    lat: 35.6991, lng: 139.5107 },
  { name: "小平市",      lat: 35.7295, lng: 139.4763 },
  { name: "日野市",      lat: 35.6718, lng: 139.3952 },
  { name: "東村山市",    lat: 35.7574, lng: 139.4683 },
  { name: "国分寺市",    lat: 35.7113, lng: 139.4592 },
  { name: "国立市",      lat: 35.6832, lng: 139.4411 },
  { name: "福生市",      lat: 35.7378, lng: 139.3338 },
  { name: "狛江市",      lat: 35.6360, lng: 139.5779 },
  { name: "東大和市",    lat: 35.7480, lng: 139.4202 },
  { name: "清瀬市",      lat: 35.7849, lng: 139.5263 },
  { name: "東久留米市",  lat: 35.7623, lng: 139.5315 },
  { name: "武蔵村山市",  lat: 35.7542, lng: 139.3873 },
  { name: "多摩市",      lat: 35.6374, lng: 139.4460 },
  { name: "稲城市",      lat: 35.6383, lng: 139.5062 },
  { name: "羽村市",      lat: 35.7681, lng: 139.3111 },
  { name: "あきる野市",  lat: 35.7289, lng: 139.2939 },
  { name: "西東京市",    lat: 35.7261, lng: 139.5391 },
  { name: "瑞穂町",      lat: 35.7933, lng: 139.3682 },
  { name: "日の出町",    lat: 35.7613, lng: 139.2638 },
  { name: "檜原村",      lat: 35.7122, lng: 139.1660 },
  { name: "奥多摩町",    lat: 35.8095, lng: 139.1021 },
  { name: "大島町",      lat: 34.7468, lng: 139.3494 },
  { name: "八丈町",      lat: 33.1082, lng: 139.7881 },
  { name: "小笠原村",    lat: 27.0943, lng: 142.1913 },
];

export function findWardByCoords(lng: number, lat: number): string | null {
  // まず23区のポリゴンで検索
  for (const feature of (geoData as any).features) {
    const { type, coordinates } = feature.geometry;
    const wardName: string = feature.properties.ward_ja;
    if (type === "Polygon") {
      if (pointInRing(lng, lat, coordinates[0])) return wardName;
    } else if (type === "MultiPolygon") {
      for (const poly of coordinates) {
        if (pointInRing(lng, lat, poly[0])) return wardName;
      }
    }
  }
  // 23区外 → 多摩地区・島嶼部の最近傍市区町村を検索 (30km以内)
  let nearest: string | null = null;
  let minDist = Infinity;
  for (const city of TAMA_CITY_CENTERS) {
    const dist = geoDistKm(lat, lng, city.lat, city.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = city.name;
    }
  }
  return minDist <= 30 ? nearest : null;
}

export async function lookupPostalCode(zip: string): Promise<string | null> {
  const clean = zip.replace(/[^\d]/g, "");
  if (clean.length !== 7) return null;
  const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${clean}`);
  const data = await res.json();
  if (data.results && data.results[0]) {
    const pref: string = data.results[0].address1;
    const city: string = data.results[0].address2;
    if (pref !== "東京都") return "__outside_tokyo__";
    return city;
  }
  return null;
}

// 名前からDistrictを検索
export function findDistrictByName(name: string): District | null {
  return TOKYO_DISTRICTS.find((d) => d.name === name) ?? null;
}

// GPS で District を解決 (エラー文字列 or null を返す)
export type GpsResult =
  | { type: "success"; district: District }
  | { type: "permission_denied" }
  | { type: "outside_tokyo" }
  | { type: "error" };

export async function resolveDistrictByGps(): Promise<GpsResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return { type: "permission_denied" };
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const ward = findWardByCoords(loc.coords.longitude, loc.coords.latitude);
    if (!ward) return { type: "outside_tokyo" };
    const district = findDistrictByName(ward);
    if (!district) return { type: "outside_tokyo" };
    return { type: "success", district };
  } catch {
    return { type: "error" };
  }
}

// 郵便番号で District を解決
export type ZipResult =
  | { type: "success"; district: District }
  | { type: "invalid_format" }
  | { type: "not_found" }
  | { type: "outside_tokyo" }
  | { type: "unsupported_area" }
  | { type: "error" };

export async function resolveDistrictByZip(zip: string): Promise<ZipResult> {
  const clean = zip.replace(/[^\d]/g, "");
  if (clean.length !== 7) return { type: "invalid_format" };
  try {
    const city = await lookupPostalCode(clean);
    if (!city) return { type: "not_found" };
    if (city === "__outside_tokyo__") return { type: "outside_tokyo" };
    const district = findDistrictByName(city);
    if (!district) return { type: "unsupported_area" };
    return { type: "success", district };
  } catch {
    return { type: "error" };
  }
}

// 都道府県名（日本語 or 英語）→ Prefecture を解決
const PREF_EN_MAP: Record<string, string> = {
  hokkaido: "hokkaido", aomori: "aomori", iwate: "iwate", miyagi: "miyagi",
  akita: "akita", yamagata: "yamagata", fukushima: "fukushima", ibaraki: "ibaraki",
  tochigi: "tochigi", gunma: "gunma", saitama: "saitama", chiba: "chiba",
  tokyo: "tokyo", kanagawa: "kanagawa", niigata: "niigata", toyama: "toyama",
  ishikawa: "ishikawa", fukui: "fukui", yamanashi: "yamanashi", nagano: "nagano",
  gifu: "gifu", shizuoka: "shizuoka", aichi: "aichi", mie: "mie",
  shiga: "shiga", kyoto: "kyoto", osaka: "osaka", hyogo: "hyogo",
  nara: "nara", wakayama: "wakayama", tottori: "tottori", shimane: "shimane",
  okayama: "okayama", hiroshima: "hiroshima", yamaguchi: "yamaguchi",
  tokushima: "tokushima", kagawa: "kagawa", ehime: "ehime", kochi: "kochi",
  fukuoka: "fukuoka", saga: "saga", nagasaki: "nagasaki", kumamoto: "kumamoto",
  oita: "oita", miyazaki: "miyazaki", kagoshima: "kagoshima", okinawa: "okinawa",
};

export function findPrefectureByName(name: string): Prefecture | null {
  const lower = name.toLowerCase().replace(/\s+/g, "");
  // 英語IDで直接マッチ
  const byId = PREF_EN_MAP[lower];
  if (byId) return PREFECTURES.find((p) => p.id === byId) ?? null;
  // 日本語名でマッチ
  return PREFECTURES.find((p) => name.includes(p.name) || p.name.includes(name)) ?? null;
}

// GPS で Prefecture を解決
export type GpsPrefResult =
  | { type: "success"; prefecture: Prefecture }
  | { type: "permission_denied" }
  | { type: "not_found" }
  | { type: "error" };

export async function resolvePrefectureByGps(): Promise<GpsPrefResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return { type: "permission_denied" };
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { latitude, longitude } = loc.coords;

    // Web環境では reverseGeocodeAsync が動作しないため Nominatim を使用
    if (Platform.OS === "web") {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ja`,
        { headers: { "User-Agent": "gakkyu-alert/1.0" } }
      );
      const data = await res.json();
      // address.state が存在しない場合は display_name から都道府県を探す
      const prefName: string = data?.address?.state ?? "";
      const pref = prefName
        ? findPrefectureByName(prefName)
        : PREFECTURES.find((p) => (data?.display_name as string | undefined)?.includes(p.name)) ?? null;
      if (!pref) return { type: "not_found" };
      return { type: "success", prefecture: pref };
    }

    const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
    // region (iOS: "東京都" / Android: "Tokyo"), subregion なども試す
    const candidates = [geo?.region, geo?.subregion, geo?.city].filter(Boolean) as string[];
    let pref: Prefecture | null = null;
    for (const c of candidates) {
      pref = findPrefectureByName(c);
      if (pref) break;
    }
    if (!pref) return { type: "not_found" };
    return { type: "success", prefecture: pref };
  } catch {
    return { type: "error" };
  }
}

// 郵便番号で Prefecture を解決
export type ZipPrefResult =
  | { type: "success"; prefecture: Prefecture }
  | { type: "invalid_format" }
  | { type: "not_found" }
  | { type: "error" };

export async function resolvePrefectureByZip(zip: string): Promise<ZipPrefResult> {
  const clean = zip.replace(/[^\d]/g, "");
  if (clean.length !== 7) return { type: "invalid_format" };
  try {
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${clean}`);
    const data = await res.json();
    if (!data.results?.[0]) return { type: "not_found" };
    const prefName: string = data.results[0].address1;
    const pref = findPrefectureByName(prefName);
    if (!pref) return { type: "not_found" };
    return { type: "success", prefecture: pref };
  } catch {
    return { type: "error" };
  }
}

// エリアグループ分け
export type DistrictGroup = {
  title: string;
  data: District[];
};

const ISLAND_IDS = new Set([
  "oshima", "toshima_island", "niijima", "kozushima",
  "miyake", "mikurajima", "hachijo", "aogashima", "ogasawara",
]);

export function getDistrictGroups(): DistrictGroup[] {
  const ku: District[] = [];
  const tama: District[] = [];
  const islands: District[] = [];

  for (const d of TOKYO_DISTRICTS) {
    if (d.name.slice(-1) === "区") {
      ku.push(d);
    } else if (ISLAND_IDS.has(d.id)) {
      islands.push(d);
    } else {
      tama.push(d);
    }
  }

  return [
    { title: "23特別区", data: ku },
    { title: "多摩地区", data: tama },
    { title: "島嶼部", data: islands },
  ];
}
