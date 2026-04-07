import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
import { type District } from "@/constants/data";
import { resolveDistrictByGps, resolveDistrictByZip } from "@/utils/location";
import { DistrictPickerModal } from "@/components/DistrictPickerModal";

// ── component ───────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { completeOnboarding, isOnboarded } = useApp();

  const [selected, setSelected] = useState<District | null>(null);

  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [zipCode, setZipCode] = useState("");
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  // GPS button pulse animation
  const gpsPulseScale = useRef(new Animated.Value(1)).current;
  const gpsPulseOpacity = useRef(new Animated.Value(0)).current;
  const gpsPulseAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (locLoading) {
      gpsPulseOpacity.setValue(0.5);
      gpsPulseScale.setValue(1);
      gpsPulseAnim.current = Animated.loop(
        Animated.parallel([
          Animated.timing(gpsPulseScale, {
            toValue: 1.8,
            duration: 1000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(gpsPulseOpacity, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      );
      gpsPulseAnim.current.start();
    } else {
      gpsPulseAnim.current?.stop();
      gpsPulseScale.setValue(1);
      gpsPulseOpacity.setValue(0);
    }
  }, [locLoading]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (isOnboarded) router.replace("/");
  }, [isOnboarded]);

  // ── Welcome animation ───────────────────────────────────────────────────
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeWard, setWelcomeWard] = useState("");

  const wOverlay   = useRef(new Animated.Value(0)).current;
  const wLogoScale = useRef(new Animated.Value(0)).current;
  const wLogoOpacity = useRef(new Animated.Value(0)).current;
  const wCheckScale = useRef(new Animated.Value(0)).current;
  const wCheckOpacity = useRef(new Animated.Value(0)).current;
  const wWardY     = useRef(new Animated.Value(30)).current;
  const wWardOp    = useRef(new Animated.Value(0)).current;
  const wTag1Op    = useRef(new Animated.Value(0)).current;
  const wPitchOp   = useRef(new Animated.Value(0)).current;

  const handleBegin = useCallback((district: District) => {
    setWelcomeWard(district.name);
    setShowWelcome(true);

    // Reset all values
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
      // 1. Overlay fades in
      Animated.timing(wOverlay, { toValue: 1, duration: 350, useNativeDriver: false }),
      // 2. Logo springs in
      Animated.parallel([
        Animated.spring(wLogoScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: false }),
        Animated.timing(wLogoOpacity, { toValue: 1, duration: 250, useNativeDriver: false }),
      ]),
      // 3. Check badge pops in
      Animated.parallel([
        Animated.spring(wCheckScale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: false }),
        Animated.timing(wCheckOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
      ]),
      // 4. Ward name slides up
      Animated.parallel([
        Animated.timing(wWardY, { toValue: 0, duration: 400, easing: Easing.out(Easing.back(1.5)), useNativeDriver: false }),
        Animated.timing(wWardOp, { toValue: 1, duration: 350, useNativeDriver: false }),
      ]),
      // 5. Tagline & pitch fade in
      Animated.parallel([
        Animated.timing(wTag1Op, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.timing(wPitchOp, { toValue: 1, duration: 500, useNativeDriver: false }),
      ]),
      // 6. Hold
      Animated.delay(1400),
    ]).start(() => {
      completeOnboarding(district.id);
    });
  }, [completeOnboarding, wOverlay, wLogoScale, wLogoOpacity, wCheckScale, wCheckOpacity, wWardY, wWardOp, wTag1Op, wPitchOp]);


  const [showManualPicker, setShowManualPicker] = useState(false);

  // GPS handler
  const handleLocation = async () => {
    setLocLoading(true);
    setLocError(null);
    const result = await resolveDistrictByGps();
    setLocLoading(false);
    if (result.type === "success") {
      setSelected(result.district);
      setLocError(null);
      setZipError(null);
    } else {
      const msgs: Record<string, string> = {
        permission_denied: "位置情報の許可が必要です",
        outside_tokyo:     "東京都内の位置情報を取得できませんでした",
        error:             "位置情報の取得に失敗しました",
      };
      setLocError(msgs[result.type] ?? "エラーが発生しました");
    }
  };

  // Postal code handler
  const handleZipSearch = async () => {
    setZipLoading(true);
    setZipError(null);
    const result = await resolveDistrictByZip(zipCode);
    setZipLoading(false);
    if (result.type === "success") {
      setSelected(result.district);
      setLocError(null);
      setZipError(null);
    } else {
      const msgs: Record<string, string> = {
        invalid_format:  "7桁の数字で入力してください",
        not_found:       "郵便番号が見つかりませんでした",
        outside_tokyo:   "東京都の郵便番号を入力してください",
        unsupported_area:"対応していない地域です。東京都内の郵便番号を入力してください",
        error:           "通信エラーが発生しました",
      };
      setZipError(msgs[result.type] ?? "エラーが発生しました");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require("@/assets/images/logo.png")}
          style={styles.logoImage}
          resizeMode="cover"
        />
        <Text style={[styles.appName, { color: colors.foreground }]}>がっきゅうアラート</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          お子さんの学校・保育園のある区の{"\n"}感染症情報をチェック{"\n"}
          <Text style={{ fontSize: 12 }}>(あとから変更できます)</Text>
        </Text>
      </View>

      {/* Quick selection methods */}
      <View style={styles.quickSection}>
        {/* GPS button */}
        <View style={styles.gpsBtnWrap}>
          <Animated.View
            style={[
              styles.gpsPulseRing,
              { backgroundColor: colors.primary, transform: [{ scale: gpsPulseScale }], opacity: gpsPulseOpacity },
            ]}
            pointerEvents="none"
          />
          <TouchableOpacity
            style={[styles.gpsBtn, { backgroundColor: colors.primary }]}
            onPress={handleLocation}
            disabled={locLoading}
            activeOpacity={0.85}
          >
            {locLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="navigation" size={17} color="#fff" />
            )}
            <Text style={styles.gpsBtnText}>
              {locLoading ? "現在地を取得中..." : "現在地から取得"}
            </Text>
          </TouchableOpacity>
        </View>
        {locError && (
          <Text style={[styles.errorText, { color: colors.destructive }]}>{locError}</Text>
        )}

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerLabel, { color: colors.mutedForeground }]}>または郵便番号で検索</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Postal code row */}
        <View style={styles.zipRow}>
          <View style={[styles.zipWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.zipMark, { color: colors.mutedForeground }]}>〒</Text>
            <TextInput
              style={[styles.zipInput, { color: colors.foreground }]}
              placeholder="郵便番号（例：1000001）"
              placeholderTextColor={colors.mutedForeground}
              value={zipCode}
              onChangeText={(t) => {
                setZipCode(t);
                setZipError(null);
              }}
              keyboardType="number-pad"
              maxLength={8}
              onSubmitEditing={handleZipSearch}
              returnKeyType="search"
            />
            {zipCode.length > 0 && (
              <TouchableOpacity onPress={() => { setZipCode(""); setZipError(null); }}>
                <Feather name="x" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.zipBtn,
              { backgroundColor: colors.primary, opacity: zipLoading || zipCode.replace(/\D/g, "").length !== 7 ? 0.5 : 1 },
            ]}
            onPress={handleZipSearch}
            disabled={zipLoading || zipCode.replace(/\D/g, "").length !== 7}
            activeOpacity={0.85}
          >
            {zipLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.zipBtnText, { color: "#fff" }]}>検索</Text>
            )}
          </TouchableOpacity>
        </View>
        {zipError && (
          <Text style={[styles.errorText, { color: colors.destructive }]}>{zipError}</Text>
        )}
      </View>

      {/* Manual picker link */}
      <TouchableOpacity
        style={styles.manualPickerBtn}
        onPress={() => setShowManualPicker(true)}
        activeOpacity={0.7}
      >
        <Feather name="list" size={13} color={colors.mutedForeground} />
        <Text style={[styles.manualPickerText, { color: colors.mutedForeground }]}>
          一覧から手動で選択
        </Text>
      </TouchableOpacity>

      {/* Push CTA to bottom */}
      <View style={{ flex: 1 }} />

      {/* CTA */}
      <View style={[styles.footer, { paddingBottom: botPad + 16 }]}>
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: selected ? colors.primary : colors.muted }]}
          disabled={!selected}
          onPress={() => { if (selected) handleBegin(selected); }}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaText, { color: selected ? "#fff" : colors.mutedForeground }]}>
            {selected ? `${selected.name}で始める` : "エリアを選択してください"}
          </Text>
          {selected && <Feather name="arrow-right" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>

      {/* Manual district picker */}
      <DistrictPickerModal
        visible={showManualPicker}
        title="エリアを選択"
        selectedId={selected?.id}
        onClose={() => setShowManualPicker(false)}
        onSelect={(d) => {
          setSelected(d);
          setLocError(null);
          setZipError(null);
        }}
      />

      {/* ── Welcome overlay ── */}
      {showWelcome && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            styles.welcomeOverlay,
            { opacity: wOverlay, backgroundColor: colors.primary },
          ]}
          pointerEvents="box-none"
        >
          {/* Logo with check badge */}
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

          {/* Ward name */}
          <Animated.Text
            style={[
              styles.welcomeWard,
              { opacity: wWardOp, transform: [{ translateY: wWardY }] },
            ]}
          >
            {welcomeWard}を{"\n"}見守ります。
          </Animated.Text>

          {/* Tagline */}
          <Animated.Text style={[styles.welcomeTagline, { opacity: wTag1Op }]}>
            子どもの安心を、毎日に。
          </Animated.Text>

          {/* Elevator pitch */}
          <Animated.Text style={[styles.welcomePitch, { opacity: wPitchOp }]}>
            地域の感染症情報をリアルタイムで把握して、{"\n"}
            登校・登園の判断をもっと確かに。
          </Animated.Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  pillRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  // Quick methods
  quickSection: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  gpsBtnWrap: {
    position: "relative",
  },
  gpsPulseRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
  },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  gpsBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  zipRow: {
    flexDirection: "row",
    gap: 8,
  },
  zipWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  zipMark: {
    fontSize: 15,
    fontWeight: "600",
  },
  zipInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  zipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  zipBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 12,
    marginTop: -4,
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
  note: {
    fontSize: 12,
    textAlign: "center",
  },
  manualPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  manualPickerText: {
    fontSize: 13,
    fontWeight: "500",
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
