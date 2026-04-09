import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
import { PREFECTURES, type Prefecture } from "@/constants/data";
import { PrefecturePickerModal } from "@/components/PrefecturePickerModal";

// ── Prefecture lookup helpers ────────────────────────────────────────────────

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

function findPrefByRegion(region: string): Prefecture | null {
  // Japanese name exact / prefix match (e.g. "東京都", "大阪府")
  const byName = PREFECTURES.find((p) => p.name === region || region.startsWith(p.name));
  if (byName) return byName;
  // English name match (iOS/Android may return English)
  const id = EN_TO_ID[region];
  return id ? (PREFECTURES.find((p) => p.id === id) ?? null) : null;
}

// ── component ────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { completeOnboarding, isOnboarded } = useApp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (isOnboarded) router.replace("/");
  }, [isOnboarded]);

  // ── Prefecture candidate ────────────────────────────────────────────────
  const [candidate, setCandidate] = useState<Prefecture | null>(null);

  // ── Location state ──────────────────────────────────────────────────────
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleLocate = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    setCandidate(null);
    setPostalCode("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("位置情報の利用が許可されていません");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let pref: Prefecture | null = null;

      if (Platform.OS === "web") {
        // expo-location の reverseGeocodeAsync は web では都道府県名を正しく
        // 返せないことがある。Nominatim を直接 ja ロケールで叩く。
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.coords.latitude}&lon=${loc.coords.longitude}`,
          { headers: { "Accept-Language": "ja" } }
        );
        const data = (await res.json()) as { address?: { state?: string } };
        const state = data.address?.state ?? "";
        pref = PREFECTURES.find((p) => p.name === state) ?? null;
      } else {
        const [result] = await Location.reverseGeocodeAsync(loc.coords);
        // region (iOS: "東京都") / subregion (Android fallback) の両方を試す
        for (const field of [result?.region, result?.subregion]) {
          if (!field) continue;
          pref = findPrefByRegion(field);
          if (pref) break;
        }
      }

      if (pref) {
        setCandidate(pref);
      } else {
        setLocationError("現在地から都道府県を特定できませんでした");
      }
    } catch {
      setLocationError("位置情報の取得に失敗しました");
    } finally {
      setLocating(false);
    }
  }, []);

  // ── Postal code state ───────────────────────────────────────────────────
  const [showPostal, setShowPostal] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [postalLoading, setPostalLoading] = useState(false);
  const [postalError, setPostalError] = useState<string | null>(null);

  const lookupPostal = useCallback(async (code: string) => {
    const clean = code.replace(/-/g, "");
    if (clean.length !== 7) return;
    setPostalLoading(true);
    setPostalError(null);
    setCandidate(null);
    try {
      const res = await fetch(
        `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${clean}`
      );
      const json = (await res.json()) as {
        status: number;
        results: Array<{ address1: string }> | null;
      };
      const addr1 = json.results?.[0]?.address1;
      if (addr1) {
        const pref = PREFECTURES.find((p) => p.name === addr1);
        if (pref) {
          setCandidate(pref);
        } else {
          setPostalError("該当する都道府県が見つかりませんでした");
        }
      } else {
        setPostalError("郵便番号が見つかりませんでした");
      }
    } catch {
      setPostalError("通信エラーが発生しました");
    } finally {
      setPostalLoading(false);
    }
  }, []);

  const handlePostalChange = useCallback(
    (text: string) => {
      setPostalCode(text);
      setCandidate(null);
      setPostalError(null);
      if (text.replace(/-/g, "").length === 7) {
        lookupPostal(text);
      }
    },
    [lookupPostal]
  );

  // ── Manual picker ───────────────────────────────────────────────────────
  const [showManualPicker, setShowManualPicker] = useState(false);

  // ── Welcome animation ───────────────────────────────────────────────────
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeWard, setWelcomeWard] = useState("");

  const wOverlay     = useRef(new Animated.Value(0)).current;
  const wLogoScale   = useRef(new Animated.Value(0)).current;
  const wLogoOpacity = useRef(new Animated.Value(0)).current;
  const wCheckScale  = useRef(new Animated.Value(0)).current;
  const wCheckOpacity = useRef(new Animated.Value(0)).current;
  const wWardY       = useRef(new Animated.Value(30)).current;
  const wWardOp      = useRef(new Animated.Value(0)).current;
  const wTag1Op      = useRef(new Animated.Value(0)).current;
  const wPitchOp     = useRef(new Animated.Value(0)).current;

  const handleBegin = useCallback(
    (district: Prefecture) => {
      setWelcomeWard(district.name);
      setShowWelcome(true);

      wOverlay.setValue(0);
      wLogoScale.setValue(0.4);
      wLogoOpacity.setValue(0);
      wCheckScale.setValue(0);
      wCheckOpacity.setValue(0);
      wWardY.setValue(28);
      wWardOp.setValue(0);
      wTag1Op.setValue(0);
      wPitchOp.setValue(0);

      Animated.sequence([
        Animated.timing(wOverlay, { toValue: 1, duration: 350, useNativeDriver: false }),
        Animated.parallel([
          Animated.spring(wLogoScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: false }),
          Animated.timing(wLogoOpacity, { toValue: 1, duration: 250, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.spring(wCheckScale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: false }),
          Animated.timing(wCheckOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(wWardY, { toValue: 0, duration: 400, easing: Easing.out(Easing.back(1.5)), useNativeDriver: false }),
          Animated.timing(wWardOp, { toValue: 1, duration: 350, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(wTag1Op, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(wPitchOp, { toValue: 1, duration: 500, useNativeDriver: false }),
        ]),
        Animated.delay(1400),
      ]).start(() => {
        completeOnboarding(district.id);
      });
    },
    [completeOnboarding, wOverlay, wLogoScale, wLogoOpacity, wCheckScale, wCheckOpacity, wWardY, wWardOp, wTag1Op, wPitchOp]
  );

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.inner, { paddingTop: topPad }]}>
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.logoImage}
            resizeMode="cover"
          />
          <Text style={[styles.appName, { color: colors.foreground }]}>がっきゅうアラート</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            お住まいの地域の感染症情報を{"\n"}すぐにチェック
            {"  "}
            <Text style={{ fontSize: 12 }}>(あとから変更できます)</Text>
          </Text>
        </View>

        {/* Input methods */}
        <View style={styles.inputSection}>
          {/* — Location button — */}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }, locating && styles.btnDisabled]}
            onPress={handleLocate}
            disabled={locating}
            activeOpacity={0.85}
          >
            {locating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="navigation" size={18} color="#fff" />
            )}
            <Text style={styles.primaryBtnText}>
              {locating ? "現在地を取得中..." : "現在地で設定"}
            </Text>
          </TouchableOpacity>

          {locationError && (
            <Text style={[styles.errorText, { color: colors.destructive ?? "#ef4444" }]}>
              {locationError}
            </Text>
          )}

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>または</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* — Postal code — */}
          {showPostal ? (
            <View style={[styles.postalBox, { borderColor: colors.border, backgroundColor: colors.card ?? colors.background }]}>
              <View style={styles.postalInputRow}>
                <Text style={[styles.postalPrefix, { color: colors.mutedForeground }]}>〒</Text>
                <TextInput
                  style={[styles.postalInput, { color: colors.foreground }]}
                  placeholder="1234567"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  maxLength={8}
                  value={postalCode}
                  onChangeText={handlePostalChange}
                  autoFocus
                />
                {postalLoading && <ActivityIndicator size="small" color={colors.primary} />}
              </View>
              <Text style={[styles.postalHint, { color: colors.mutedForeground }]}>
                ハイフンなし7桁で自動検索
              </Text>
              {postalError && (
                <Text style={[styles.errorText, { color: colors.destructive ?? "#ef4444" }]}>
                  {postalError}
                </Text>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.border }]}
              onPress={() => { setShowPostal(true); setLocationError(null); }}
              activeOpacity={0.85}
            >
              <Feather name="mail" size={18} color={colors.foreground} />
              <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
                郵便番号で検索
              </Text>
            </TouchableOpacity>
          )}

          {/* Detected prefecture preview */}
          {candidate && (
            <View style={[styles.candidateCard, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}>
              <Feather name="check-circle" size={16} color={colors.primary} />
              <Text style={[styles.candidateName, { color: colors.primary }]}>
                {candidate.name} を検出しました
              </Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1 }} />

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: botPad + 16 }]}>
          <TouchableOpacity
            style={[styles.cta, { backgroundColor: candidate ? colors.primary : colors.muted }]}
            disabled={!candidate}
            onPress={() => { if (candidate) handleBegin(candidate); }}
            activeOpacity={0.85}
          >
            <Text style={[styles.ctaText, { color: candidate ? "#fff" : colors.mutedForeground }]}>
              {candidate ? `${candidate.name}で始める` : "エリアを選択してください"}
            </Text>
            {candidate && <Feather name="arrow-right" size={18} color="#fff" />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manualLink}
            onPress={() => setShowManualPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.manualLinkText, { color: colors.mutedForeground }]}>
              一覧から選ぶ
            </Text>
            <Feather name="chevron-right" size={13} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Prefecture picker (manual fallback) */}
      <PrefecturePickerModal
        visible={showManualPicker}
        title="都道府県を選択"
        selectedId={candidate?.id}
        onClose={() => setShowManualPicker(false)}
        onSelect={(p) => { setCandidate(p); setShowManualPicker(false); }}
      />

      {/* Welcome overlay */}
      {showWelcome && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            styles.welcomeOverlay,
            { opacity: wOverlay, backgroundColor: colors.primary },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.welcomeLogoWrap}>
            <Animated.Image
              source={require("@/assets/images/logo.png")}
              style={[
                styles.welcomeLogo,
                { opacity: wLogoOpacity, transform: [{ scale: wLogoScale }] },
              ]}
              resizeMode="contain"
            />
            <Animated.View
              style={[
                styles.welcomeCheck,
                { opacity: wCheckOpacity, transform: [{ scale: wCheckScale }] },
              ]}
            >
              <Feather name="check" size={18} color={colors.primary} />
            </Animated.View>
          </View>

          <Animated.Text
            style={[styles.welcomeWard, { opacity: wWardOp, transform: [{ translateY: wWardY }] }]}
          >
            {welcomeWard}を{"\n"}見守ります。
          </Animated.Text>

          <Animated.Text style={[styles.welcomeTagline, { opacity: wTag1Op }]}>
            子どもの安心を、毎日に。
          </Animated.Text>

          <Animated.Text style={[styles.welcomePitch, { opacity: wPitchOp }]}>
            地域の感染症情報をリアルタイムで把握して、{"\n"}
            登校・登園の判断をもっと確かに。
          </Animated.Text>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  header: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 8,
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 18,
    marginBottom: 2,
  },
  appName: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  inputSection: {
    paddingHorizontal: 16,
    gap: 12,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  btnDisabled: {
    opacity: 0.7,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 12,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  postalBox: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  postalInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  postalPrefix: {
    fontSize: 16,
    fontWeight: "600",
  },
  postalInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 3,
    paddingVertical: 4,
  },
  postalHint: {
    fontSize: 11,
  },
  errorText: {
    fontSize: 12,
    marginTop: 2,
  },
  candidateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  candidateName: {
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "700",
  },
  manualLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 8,
  },
  manualLinkText: {
    fontSize: 13,
  },
  // Welcome overlay
  welcomeOverlay: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 32,
  },
  welcomeLogoWrap: {
    position: "relative",
    marginBottom: 8,
  },
  welcomeLogo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  welcomeCheck: {
    position: "absolute",
    bottom: -6,
    right: -6,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  welcomeWard: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  welcomeTagline: {
    fontSize: 17,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
  },
  welcomePitch: {
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 4,
  },
});
