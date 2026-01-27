import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { RootStackParamList } from "../navigation";
import { Spaceship } from "../components/Spaceship";
import { theme } from "../theme";
import { clearAuthSession, getAuthToken, getAuthUser } from "../api/client";

const STAR_COUNT = 20;
const BG_IMAGE =
  "https://images.unsplash.com/photo-1709409903008-fbc1ce9b7dfa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGFjZSUyMHN0YXJzJTIwbmVidWxhfGVufDF8fHx8MTc2OTIzMjkzNXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

type Star = {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
};

function createStars(count: number): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 2 + Math.random() * 6,
    duration: 2000 + Math.random() * 3000,
    delay: Math.random() * 2000,
  }));
}

function ButtonGradient() {
  return (
    <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="btn" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#d97706" />
          <Stop offset="50%" stopColor="#ea580c" />
          <Stop offset="100%" stopColor="#b91c1c" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill="url(#btn)" />
    </Svg>
  );
}

export default function StartScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [isAuthed, setIsAuthed] = useState(false);
  const [introViewed, setIntroViewed] = useState(false);
  const { width, height } = useWindowDimensions();
  const stars = useMemo(() => createStars(STAR_COUNT), []);

  const twinkles = useRef(stars.map(() => new Animated.Value(0))).current;
  const float = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const hint = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const twinkleAnims = twinkles.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(stars[i].delay),
          Animated.timing(value, { toValue: 1, duration: stars[i].duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: stars[i].duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      )
    );
    twinkleAnims.forEach((anim) => anim.start());

    const floatAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    floatAnim.start();

    const pulseAnim = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    pulseAnim.start();

    const hintAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(hint, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(hint, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    hintAnim.start();

    return () => {
      twinkleAnims.forEach((anim) => anim.stop());
      floatAnim.stop();
      pulseAnim.stop();
      hintAnim.stop();
    };
  }, [float, hint, pulse, stars, twinkles]);

  const frame = useMemo(() => ({ width, height }), [height, width]);

  const isWide = frame.width >= 700;
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });
  const hintOpacity = hint.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const checkAuth = async () => {
        const token = await getAuthToken();
        const user = token ? await getAuthUser() : null;
        if (isActive) {
          setIsAuthed(Boolean(token));
          setIntroViewed(Boolean(user?.introViewed));
        }
      };
      checkAuth();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const handleLogout = useCallback(async () => {
    await clearAuthSession();
    setIsAuthed(false);
    setIntroViewed(false);
  }, []);

  return (
    <View style={s.root}>
      <View style={[s.frame, { width: frame.width, height: frame.height }]}>
        <ImageBackground source={{ uri: BG_IMAGE }} style={s.bg} resizeMode="cover">
          <View style={s.overlay} pointerEvents="none" />
          <View style={s.starLayer} pointerEvents="none">
            {stars.map((star, i) => {
              const opacity = twinkles[i].interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
              const scale = twinkles[i].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] });
              return (
                <Animated.View
                  key={star.id}
                  style={[
                    s.star,
                    {
                      left: `${star.left}%`,
                      top: `${star.top}%`,
                      width: star.size,
                      height: star.size,
                      opacity,
                      transform: [{ scale }],
                    },
                  ]}
                />
              );
            })}
          </View>

          <View style={[s.content, !isWide && s.contentStack]}>
            <View style={[s.left, !isWide && s.leftStack]}>
              <Animated.View style={{ transform: [{ translateY: floatY }] }}>
                <Spaceship size={isWide ? 130 : 110} />
              </Animated.View>
            </View>

            <View style={s.center}>
              <Text style={s.title}>Doge City in Mars</Text>

              {isAuthed ? (
                <>
                  <Pressable
                    style={({ pressed }) => [s.button, pressed && s.buttonPressed]}
                    onPress={() => nav.replace(introViewed ? "RocketSelect" : "Intro")}
                  >
                    <ButtonGradient />
                    <View style={s.buttonGlow} pointerEvents="none" />
                    <Animated.View style={[s.buttonPulse, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} pointerEvents="none" />
                    <View style={s.buttonContent}>
                      <Text style={s.buttonText}>GAME START</Text>
                    </View>
                  </Pressable>
                  <Pressable style={({ pressed }) => [s.logoutButton, pressed && s.authButtonPressed]} onPress={handleLogout}>
                    <Text style={s.logoutButtonText}>LOG OUT</Text>
                  </Pressable>
                  <Animated.Text style={[s.hint, { opacity: hintOpacity }]}>Press to begin your journey</Animated.Text>
                </>
              ) : (
                <>
                  <View style={s.authRow}>
                    <Pressable style={({ pressed }) => [s.authButton, pressed && s.authButtonPressed]} onPress={() => nav.navigate("Login")}>
                      <Text style={s.authButtonText}>LOG IN</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [s.authButton, s.authButtonFilled, pressed && s.authButtonPressed]}
                      onPress={() => nav.navigate("Signup")}
                    >
                      <Text style={[s.authButtonText, s.authButtonTextFilled]}>SIGN UP</Text>
                    </Pressable>
                  </View>
                  <Animated.Text style={[s.hint, { opacity: hintOpacity }]}>Log in to begin your journey</Animated.Text>
                </>
              )}
            </View>
          </View>
        </ImageBackground>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.black },
  frame: { backgroundColor: theme.colors.black, overflow: "hidden", borderRadius: theme.radius.xl },
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.overlay },
  starLayer: { ...StyleSheet.absoluteFillObject },
  star: { position: "absolute", backgroundColor: theme.colors.star, borderRadius: 99 },
  content: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 28 },
  contentStack: { flexDirection: "column", paddingHorizontal: 18 },
  left: { marginRight: 32 },
  leftStack: { marginRight: 0, marginBottom: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { color: theme.colors.accent, fontSize: 32, fontWeight: "900", textAlign: "center", letterSpacing: 0.5 },
  button: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: theme.radius.pill,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 200,
  },
  buttonPressed: { transform: [{ scale: 0.97 }] },
  buttonGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.accentBorderStrong,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.7,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  buttonPulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.accentBorder,
  },
  buttonContent: { flexDirection: "row", alignItems: "center" },
  buttonText: { color: theme.colors.textPrimary, fontWeight: "900", fontSize: 18, letterSpacing: 1 },
  authRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  authButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  authButtonFilled: { backgroundColor: theme.colors.accentTint, borderColor: theme.colors.accentBorderStrong },
  authButtonPressed: { transform: [{ scale: 0.96 }] },
  authButtonText: { color: theme.colors.textAccentStrong, fontWeight: "800", fontSize: 12, letterSpacing: 0.8 },
  authButtonTextFilled: { color: theme.colors.accent },
  hint: { marginTop: 10, color: theme.colors.textAccentStrong, fontSize: 12 },
  logoutButton: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  logoutButtonText: { color: theme.colors.textAccentStrong, fontWeight: "800", fontSize: 11, letterSpacing: 0.8 },
});
