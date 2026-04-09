import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
import { type Prefecture } from "@/constants/data";
import { PrefecturePickerModal } from "@/components/PrefecturePickerModal";

// ── component ───────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { completeOnboarding, isOnboarded } = useApp();

  const [selected, setSelected] = useState<Prefecture | null>(null);

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

  const handleBegin = useCallback((district: Prefecture) => {
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
          お住まいの都道府県の{"\n"}感染症情報をチェック{"\n"}
          <Text style={{ fontSize: 12 }}>(あとから変更できます)</Text>
        </Text>
      </View>

      {/* Prefecture select button */}
      <View style={styles.quickSection}>
        <TouchableOpacity
          style={[styles.selectBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowManualPicker(true)}
          activeOpacity={0.85}
        >
          <Feather name="map-pin" size={17} color="#fff" />
          <Text style={styles.selectBtnText}>
            {selected ? selected.name : "都道府県を選択"}
          </Text>
          <Feather name="chevron-right" size={17} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

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

      {/* Prefecture picker */}
      <PrefecturePickerModal
        visible={showManualPicker}
        title="都道府県を選択"
        selectedId={selected?.id}
        onClose={() => setShowManualPicker(false)}
        onSelect={(p) => setSelected(p)}
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
  quickSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  selectBtnText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
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
