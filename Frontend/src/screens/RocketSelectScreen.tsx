import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import { SpaceshipVariant } from "../components/SpaceshipVariant";
import { theme } from "../theme";
import { getRockets, type Rocket } from "../api/client";

const fallbackRockets = [
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

type RocketCard = {
  id: number;
  name: string;
  description: string;
  stats: { speed: number; armor: number; power: number };
  raw?: Rocket;
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
  const [rocketCards, setRocketCards] = useState<RocketCard[]>(fallbackRockets);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    let isMounted = true;

    const toBoostScore = (per?: number) => {
      if (!per || per <= 0) return 1;
      return Math.min(10, Math.max(1, Math.round(30 / per)));
    };

    const toArmorScore = (pbr?: number) => {
      if (!pbr || pbr <= 0) return 1;
      return Math.min(10, Math.max(1, Math.round(10 / pbr)));
    };

    const toFuelScore = (roe?: number) => {
      if (!roe || roe <= 0) return 1;
      return Math.min(10, Math.max(1, Math.round(roe / 2)));
    };

    const loadRockets = async () => {
      try {
        const response = await getRockets();
        const cards = response.rockets.map((rocket) => {
          const boostValue = rocket.gameStats?.boost?.value ?? rocket.rawStats?.PER ?? 0;
          const armorValue = rocket.gameStats?.armor?.value ?? rocket.rawStats?.PBR ?? 0;
          const fuelValue = rocket.gameStats?.fuelEco?.value ?? rocket.rawStats?.ROE ?? 0;
          return {
            id: rocket.id,
            name: rocket.name,
            description: rocket.description || "Unknown specs",
            stats: {
              speed: toBoostScore(boostValue),
              armor: toArmorScore(armorValue),
              power: toFuelScore(fuelValue),
            },
            raw: rocket,
          };
        });

        if (isMounted) {
          setRocketCards(cards.length ? cards : fallbackRockets);
          setError("");
        }
      } catch (e) {
        if (isMounted) {
          const message = e instanceof Error ? e.message : "Failed to load rockets.";
          setError(message);
          setRocketCards(fallbackRockets);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadRockets();

    return () => {
      isMounted = false;
    };
  }, []);

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
      nav.replace("Cockpit", { rocketId: selectedRocket, round: 1, startInRound: true });
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

            {isLoading ? <Text style={s.loadingText}>Loading rockets...</Text> : null}
            {error ? <Text style={s.errorText}>{error}</Text> : null}

            <View style={[s.cards, !isWide && s.cardsStack]}>
              {rocketCards.map((rocket, index) => {
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
  content: { flex: 1, padding: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  backButton: { paddingVertical: 4, paddingHorizontal: 6 },
  backPressed: { transform: [{ scale: 0.97 }] },
  backText: { color: theme.colors.accent, fontWeight: "800", fontSize: 11 },
  headerTitle: { color: theme.colors.accent, fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  headerSpacer: { width: 60 },
  loadingText: { color: theme.colors.textMuted, textAlign: "center", marginBottom: 4 },
  errorText: { color: theme.colors.danger, textAlign: "center", marginBottom: 6 },
  cards: { flexDirection: "row", gap: 14, justifyContent: "space-between", flex: 1 },
  cardsStack: { flexDirection: "column" },
  card: {
    flex: 1,
    backgroundColor: theme.colors.panel,
    borderRadius: theme.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.panelBorder,
  },
  cardStack: { marginBottom: 10 },
  cardPressed: { transform: [{ scale: 0.99 }] },
  cardSelected: { borderColor: theme.colors.accentBorderStrong, backgroundColor: "rgba(234,88,12,0.2)" },
  checkBadge: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  checkText: { fontWeight: "800", fontSize: 10, color: theme.colors.frame },
  shipWrap: { alignItems: "center", marginBottom: 10 },
  cardInfo: { alignItems: "center", marginBottom: 10 },
  cardTitle: { color: theme.colors.textPrimary, fontWeight: "900", fontSize: 14, marginBottom: 4 },
  cardDesc: { color: theme.colors.textMuted, fontSize: 11, textAlign: "center" },
  stats: { gap: 8 },
  statRow: { gap: 6 },
  statHeader: { flexDirection: "row", justifyContent: "space-between" },
  statLabel: { color: theme.colors.textAccent, fontSize: 10 },
  statValue: { color: theme.colors.textPrimary, fontSize: 10, fontWeight: "800" },
  statTrack: { height: 6, borderRadius: 99, backgroundColor: theme.colors.track, overflow: "hidden" },
  statFill: { height: 6, borderRadius: 99, backgroundColor: theme.colors.accent },
  confirmWrap: { alignItems: "center", marginTop: 8 },
  confirmButton: {
    width: "70%",
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.accentBorderStrong,
    backgroundColor: "rgba(251,191,36,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmDisabled: { opacity: 0.5 },
  confirmPressed: { transform: [{ scale: 0.97 }] },
  confirmText: { color: theme.colors.textPrimary, fontWeight: "900", fontSize: 11, letterSpacing: 0.9 },
  confirmGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  confirmPulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.accentGlow,
  },
  grid: { ...StyleSheet.absoluteFillObject, opacity: 0.08 },
  gridLineH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: theme.colors.accent },
  gridLineV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: theme.colors.accent },
});
