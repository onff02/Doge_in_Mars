import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import { SpaceshipVariant } from "../components/SpaceshipVariant";
import { theme } from "../theme";

const rockets = [
  { id: 1, name: "PIONEER", description: "Speed & Agility", stats: { speed: 9, armor: 5, power: 7 } },
  { id: 2, name: "TITAN", description: "Heavy & Durable", stats: { speed: 5, armor: 10, power: 8 } },
  { id: 3, name: "STRIKER", description: "Balanced Fighter", stats: { speed: 7, armor: 7, power: 9 } },
];

const STAR_COUNT = 15;
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
    size: 2 + Math.random() * 5,
    duration: 2000 + Math.random() * 2500,
    delay: Math.random() * 1800,
  }));
}

function StatBar({ value, delay }: { value: number; delay: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, { toValue: 1, duration: 500, delay, easing: Easing.out(Easing.ease), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [delay, progress]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", `${value * 10}%`] });

  return <Animated.View style={[s.statFill, { width }]} />;
}

export default function RocketSelectScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedRocket, setSelectedRocket] = useState<number | null>(null);
  const { width, height } = useWindowDimensions();
  const stars = useMemo(() => createStars(STAR_COUNT), []);

  const twinkles = useRef(stars.map(() => new Animated.Value(0))).current;
  const float = useRef(new Animated.Value(0)).current;
  const confirmPulse = useRef(new Animated.Value(0)).current;

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
        Animated.timing(float, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    floatAnim.start();

    const pulseAnim = Animated.loop(
      Animated.timing(confirmPulse, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    pulseAnim.start();

    return () => {
      twinkleAnims.forEach((anim) => anim.stop());
      floatAnim.stop();
      pulseAnim.stop();
    };
  }, [confirmPulse, float, stars, twinkles]);

  const frame = useMemo(() => {
    const targetRatio = 932 / 430;
    const padding = 24;
    const maxW = Math.max(0, width - padding * 2);
    const maxH = Math.max(0, height - padding * 2);
    let frameW = Math.min(maxW, 932);
    let frameH = frameW / targetRatio;
    if (frameH > maxH) {
      frameH = maxH;
      frameW = frameH * targetRatio;
    }
    return { width: frameW, height: frameH };
  }, [height, width]);

  const isWide = frame.width >= 720;
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const pulseScale = confirmPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
  const pulseOpacity = confirmPulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  const handleConfirm = () => {
    if (selectedRocket) {
      nav.navigate("Cockpit", { rocketId: selectedRocket });
    }
  };

  return (
    <View style={s.root}>
      <View style={[s.frame, { width: frame.width, height: frame.height }]}>
        <ImageBackground source={{ uri: BG_IMAGE }} style={s.bg} resizeMode="cover">
          <View style={s.overlay} pointerEvents="none" />
          <View style={s.starLayer} pointerEvents="none">
            {stars.map((star, i) => {
              const opacity = twinkles[i].interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
              const scale = twinkles[i].interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.1] });
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

          <View style={s.content}>
            <View style={s.header}>
              <Pressable style={({ pressed }) => [s.backButton, pressed && s.backPressed]} onPress={() => nav.goBack()}>
                <Text style={s.backText}>{"< BACK"}</Text>
              </Pressable>
              <Text style={s.headerTitle}>SELECT YOUR ROCKET</Text>
              <View style={s.headerSpacer} />
            </View>

            <View style={[s.cards, !isWide && s.cardsStack]}>
              {rockets.map((rocket, index) => {
                const selected = selectedRocket === rocket.id;
                return (
                  <Pressable
                    key={rocket.id}
                    onPress={() => setSelectedRocket(rocket.id)}
                    style={({ pressed }) => [
                      s.card,
                      selected && s.cardSelected,
                      pressed && s.cardPressed,
                      !isWide && s.cardStack,
                    ]}
                  >
                    {selected ? (
                      <View style={s.checkBadge}>
                        <Text style={s.checkText}>OK</Text>
                      </View>
                    ) : null}

                    <View style={s.shipWrap}>
                      <Animated.View style={selected ? { transform: [{ translateY: floatY }] } : undefined}>
                        <SpaceshipVariant type={rocket.id} size={80} />
                      </Animated.View>
                    </View>

                    <View style={s.cardInfo}>
                      <Text style={s.cardTitle}>{rocket.name}</Text>
                      <Text style={s.cardDesc}>{rocket.description}</Text>
                    </View>

                    <View style={s.stats}>
                      {Object.entries(rocket.stats).map(([key, value]) => (
                        <View key={key} style={s.statRow}>
                          <View style={s.statHeader}>
                            <Text style={s.statLabel}>{key.toUpperCase()}</Text>
                            <Text style={s.statValue}>{value}</Text>
                          </View>
                          <View style={s.statTrack}>
                            <StatBar value={value} delay={500 + index * 120} />
                          </View>
                        </View>
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={s.confirmWrap}>
              <Pressable
                onPress={handleConfirm}
                disabled={!selectedRocket}
                style={({ pressed }) => [
                  s.confirmButton,
                  !selectedRocket && s.confirmDisabled,
                  pressed && selectedRocket && s.confirmPressed,
                ]}
              >
                <View style={s.confirmGlow} pointerEvents="none" />
                <Text style={s.confirmText}>CONFIRM SELECTION</Text>
                {selectedRocket ? (
                  <Animated.View style={[s.confirmPulse, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} pointerEvents="none" />
                ) : null}
              </Pressable>
            </View>
          </View>

          <View style={s.grid} pointerEvents="none">
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={`h-${i}`} style={[s.gridLineH, { top: `${i * 20}%` }]} />
            ))}
            {Array.from({ length: 8 }).map((_, i) => (
              <View key={`v-${i}`} style={[s.gridLineV, { left: `${i * 12.5}%` }]} />
            ))}
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
  content: { flex: 1, paddingHorizontal: 24, paddingVertical: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  backButton: { paddingVertical: 6, paddingHorizontal: 8 },
  backPressed: { transform: [{ scale: 0.96 }] },
  backText: { color: theme.colors.accent, fontWeight: "800", fontSize: 12 },
  headerTitle: { color: theme.colors.accentDeep, fontWeight: "900", fontSize: 18, letterSpacing: 0.6 },
  headerSpacer: { width: 70 },
  cards: { flex: 1, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center" },
  cardsStack: { justifyContent: "flex-start" },
  card: {
    width: 180,
    marginHorizontal: 10,
    marginVertical: 8,
    padding: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: "rgba(17, 6, 3, 0.65)",
    borderWidth: 2,
    borderColor: "rgba(124, 45, 18, 0.6)",
  },
  cardStack: { width: 200 },
  cardPressed: { transform: [{ scale: 0.98 }] },
  cardSelected: {
    borderColor: theme.colors.accentBorderStrong,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  checkBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 6,
    zIndex: 2,
  },
  checkText: { color: "#000", fontWeight: "900", fontSize: 10 },
  shipWrap: { alignItems: "center", marginBottom: 8 },
  cardInfo: { alignItems: "center", marginBottom: 8 },
  cardTitle: { color: theme.colors.accent, fontWeight: "900", fontSize: 14, letterSpacing: 0.4 },
  cardDesc: { color: "rgba(251,191,36,0.65)", fontSize: 10 },
  stats: {},
  statRow: { marginBottom: 6 },
  statHeader: { flexDirection: "row", justifyContent: "space-between" },
  statLabel: { color: theme.colors.textAccent, fontSize: 9, fontWeight: "700" },
  statValue: { color: theme.colors.textAccentStrong, fontSize: 9, fontWeight: "800" },
  statTrack: { height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(69, 10, 10, 0.6)" },
  statFill: { height: 6, borderRadius: 999, backgroundColor: theme.colors.accentDeep },
  confirmWrap: { alignItems: "center", marginTop: 8 },
  confirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.accentBorderStrong,
    backgroundColor: "rgba(234,88,12,0.6)",
    overflow: "hidden",
  },
  confirmDisabled: { opacity: 0.5 },
  confirmPressed: { transform: [{ scale: 0.97 }] },
  confirmText: { color: theme.colors.textPrimary, fontWeight: "900", letterSpacing: 0.8, fontSize: 13, textAlign: "center" },
  confirmGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.accentBorder,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  confirmPulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.accentBorder,
  },
  grid: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    opacity: 0.12,
    transform: [{ perspective: 400 }, { rotateX: "60deg" }],
  },
  gridLineH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(251,191,36,0.3)" },
  gridLineV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(251,191,36,0.3)" },
});
