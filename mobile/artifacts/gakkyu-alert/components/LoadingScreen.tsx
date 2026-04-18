import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

export function LoadingScreen() {
  const logoScale = useRef(new Animated.Value(0.65)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.55)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.35)).current;
  const dotsOpacity = [
    useRef(new Animated.Value(0.2)).current,
    useRef(new Animated.Value(0.2)).current,
    useRef(new Animated.Value(0.2)).current,
  ];

  useEffect(() => {
    // Logo pops in
    Animated.spring(logoScale, {
      toValue: 1,
      friction: 5,
      tension: 55,
      useNativeDriver: false,
    }).start();
    Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 280,
      useNativeDriver: false,
    }).start();

    // App name fades in after logo
    Animated.timing(textOpacity, {
      toValue: 1,
      duration: 350,
      delay: 320,
      useNativeDriver: false,
    }).start();

    // Pulsing rings
    const pulseRing = (scaleVal: Animated.Value, opacityVal: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scaleVal, {
              toValue: 1.9,
              duration: 1500,
              easing: Easing.out(Easing.ease),
              useNativeDriver: false,
            }),
            Animated.timing(opacityVal, {
              toValue: 0,
              duration: 1500,
              easing: Easing.out(Easing.ease),
              useNativeDriver: false,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scaleVal, { toValue: 1, duration: 0, useNativeDriver: false }),
            Animated.timing(opacityVal, { toValue: delay === 0 ? 0.55 : 0.35, duration: 0, useNativeDriver: false }),
          ]),
        ])
      ).start();
    };

    pulseRing(ring1Scale, ring1Opacity, 0);
    pulseRing(ring2Scale, ring2Opacity, 750);

    // Bouncing dots
    const animateDot = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 320, useNativeDriver: false }),
          Animated.timing(dot, { toValue: 0.2, duration: 320, useNativeDriver: false }),
          Animated.delay(640),
        ])
      ).start();
    };

    animateDot(dotsOpacity[0], 0);
    animateDot(dotsOpacity[1], 220);
    animateDot(dotsOpacity[2], 440);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        {/* Logo + pulsing rings */}
        <View style={styles.logoWrap}>
          <Animated.View
            style={[
              styles.ring,
              { transform: [{ scale: ring1Scale }], opacity: ring1Opacity },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              { transform: [{ scale: ring2Scale }], opacity: ring2Opacity },
            ]}
          />
          <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* App name */}
        <Animated.Text style={[styles.appName, { opacity: textOpacity }]}>
          学級アラート
        </Animated.Text>

        {/* Bouncing dots */}
        <Animated.View style={[styles.dotsRow, { opacity: textOpacity }]}>
          {dotsOpacity.map((anim, i) => (
            <Animated.View key={i} style={[styles.dot, { opacity: anim }]} />
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const PRIMARY = "#1a4bab";
const RING_COLOR = "#1a4bab";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8faf8",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    gap: 16,
  },
  logoWrap: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 2.5,
    borderColor: RING_COLOR,
  },
  logo: {
    width: 128,
    height: 128,
    borderRadius: 28,
  },
  appName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: -4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: PRIMARY,
  },
});
