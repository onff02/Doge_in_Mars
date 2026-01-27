import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageBackground, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEventListener } from "expo";
import { Audio } from "expo-av";
import { useVideoPlayer, VideoView } from "expo-video";
import type { RootStackParamList } from "../navigation";
import TrajectoryGSIChart from "../components/TrajectoryGSIChart";
import ChartScreen from "./ChartScreen";
import InfoScreen, { UpdateItem } from "./InfoScreen";
import { theme } from "../theme";
import { clearAuthSession, getAuthToken, getChart, getFlightStatus, startFlight, syncFlight } from "../api/client";

type Telemetry = {
  fuel?: number;
  hull?: number;
  progress?: number;
  isStable?: boolean;
  status?: string;
};

type LeverChoice = "up" | "down";
type OutcomeKey = "upCorrect" | "upWrong" | "downCorrect" | "downWrong";
type FinalOutcomeKey = "fail" | "success1" | "success2";

const OUTCOME_VIDEOS = {
  upCorrect: require("../../assets/videos/upCorrect.mp4"),
  upWrong: require("../../assets/videos/upWrong.mp4"),
  downCorrect: require("../../assets/videos/downCorrect.mp4"),
  downWrong: require("../../assets/videos/downWrong.mp4"),
} as const;

const FINAL_OUTCOME_VIDEOS = {
  fail: require("../../assets/videos/fail.mp4"),
  success1: require("../../assets/videos/success1.mp4"),
  success2: require("../../assets/videos/success2.mp4"),
} as const;

const FINAL_MESSAGES: Record<FinalOutcomeKey, string> = {
  fail: "효율적인 연료 소모에 실패한 도지는 화성 도달에 실패했다.",
  success1: "효율적인 연료 사용에 성공한 도지는 안전하게 화성에 착륙했다.",
  success2: "완벽한 연료 사용에 성공한 도지는 화성에서 도지시티 건설에 성공하여 세를 키웠고 지구를 침공했다.",
};

const ROUND_ANSWERS: Record<number, LeverChoice> = {
  1: "up",
  2: "down",
  3: "up",
  4: "down",
  5: "up",
  6: "down",
};

const BG_IMAGE =
  "https://images.unsplash.com/photo-1709409903008-fbc1ce9b7dfa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGFjZSUyMHN0YXJzJTIwbmVidWxhfGVufDF8fHx8MTc2OTIzMjkzNXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const MAX_ROUNDS = 6;

function generateGsiData(points: number) {
  const data: number[] = [];
  for (let i = 0; i < points; i += 1) {
    const base = 70 + Math.sin(i * 0.35) * 8;
    const jitter = (Math.random() - 0.5) * 6;
    data.push(Math.max(40, Math.min(95, base + jitter)));
  }
  return data;
}

function getOutcomeKey(correct: LeverChoice, chosen: LeverChoice): OutcomeKey {
  if (correct === "up") {
    return chosen === "up" ? "upCorrect" : "downWrong";
  }
  return chosen === "down" ? "downCorrect" : "upWrong";
}

function getFinalOutcomeKey(correctCount: number): FinalOutcomeKey {
  if (correctCount <= 2) return "fail";
  if (correctCount <= 5) return "success1";
  return "success2";
}

function OutcomeVideo({ source, onEnd }: { source: number; onEnd: () => void }) {
  const [audioReady, setAudioReady] = useState(false);
  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = false;
    videoPlayer.volume = 1;
    videoPlayer.audioMixingMode = "doNotMix";
  });

  useEffect(() => {
    let isMounted = true;
    const configureAudio = async () => {
      try {
        await Audio.setIsEnabledAsync(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
          staysActiveInBackground: false,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
        if (isMounted) setAudioReady(true);
      } catch {
        if (isMounted) setAudioReady(true);
      }
    };
    configureAudio();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (audioReady) {
      player.play();
    }
  }, [audioReady, player]);

  useEventListener(player, "playToEnd", onEnd);
  useEventListener(player, "availableAudioTracksChange", ({ availableAudioTracks }) => {
    if (!player.audioTrack && availableAudioTracks.length > 0) {
      player.audioTrack = availableAudioTracks[0];
    }
  });

  return <VideoView player={player} style={s.outcomeVideo} contentFit="cover" nativeControls={false} />;
}

export default function CockpitScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Cockpit">>();
  const rocketId = route.params?.rocketId ?? 1;
  const startInRound = route.params?.startInRound ?? false;
  const initialRound = route.params?.round ?? 1;
  const { width, height } = useWindowDimensions();
  const [view, setView] = useState<"cockpit" | "chart" | "info" | "round" | "outcome" | "final" | "finalResult">(
    startInRound ? "round" : "cockpit"
  );
  const [round, setRound] = useState(() => Math.min(Math.max(initialRound, 1), MAX_ROUNDS));
  const [leverPosition, setLeverPosition] = useState<"up" | "middle" | "down">("middle");
  const [telemetry, setTelemetry] = useState<Telemetry>({});
  const [chartValues, setChartValues] = useState<number[]>([]);
  const [stabilityValues, setStabilityValues] = useState<number[]>([]);
  const [symbol, setSymbol] = useState("AAPL");
  const [error, setError] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [outcomeKey, setOutcomeKey] = useState<OutcomeKey | null>(null);
  const [finalOutcomeKey, setFinalOutcomeKey] = useState<FinalOutcomeKey | null>(null);
  const [pendingRound, setPendingRound] = useState<number | null>(null);
  const [pendingFinalKey, setPendingFinalKey] = useState<FinalOutcomeKey | null>(null);
  const chartCursor = useRef(1);

  const fallbackData = useMemo(() => generateGsiData(40), []);
  const gsiData = chartValues.length ? chartValues : fallbackData;

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

  const sidePanelWidth = Math.max(190, Math.min(frame.width * 0.3, 260));
  const sidePanelHeight = Math.max(180, Math.min(frame.height * 0.55, 240));
  const centerWidth = Math.max(150, Math.min(frame.width * 0.22, 190));
  const centerHeight = Math.max(230, Math.min(frame.height * 0.65, 300));
  const chartWidth = Math.max(160, sidePanelWidth - 24);
  const chartHeight = Math.max(90, Math.min(sidePanelHeight * 0.45, 120));
  const trackHeight = Math.max(120, Math.min(centerHeight * 0.6, 150));
  const handleHeight = 46;
  const leverTopMargin = 10;
  const leverBottomMargin = 26;
  const leverRange = trackHeight - handleHeight - leverTopMargin - leverBottomMargin;
  const handleBottom =
    leverPosition === "up"
      ? leverBottomMargin + leverRange
      : leverPosition === "down"
        ? leverBottomMargin
        : leverBottomMargin + leverRange / 2;
  const leverRotation = "0deg";
  const swipeThreshold = 18;
  const contentTop = Math.max(12, frame.height * 0.16);
  const roundLabel = `ROUND ${round}`;
  const roundCopy = "중력장 안정도 차트와 최신 정보를 바탕으로 연료 소모량을 결정하세요!";
  const showRoundCopy = round === 1;
  const finalScoreLabel = `${correctCount} / ${MAX_ROUNDS}`;
  const finalMessage = finalOutcomeKey ? FINAL_MESSAGES[finalOutcomeKey] : "";
  const confirmDisabled = isConfirming || leverPosition === "middle";

  const updateLeverPosition = useCallback(
    (next: "up" | "middle" | "down") => {
      setLeverPosition(next);
      if (decisionError) {
        setDecisionError("");
      }
    },
    [decisionError]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy <= -swipeThreshold) {
            updateLeverPosition(leverPosition === "down" ? "middle" : "up");
          } else if (gesture.dy >= swipeThreshold) {
            updateLeverPosition(leverPosition === "up" ? "middle" : "down");
          }
        },
        onPanResponderTerminate: (_, gesture) => {
          if (gesture.dy <= -swipeThreshold) {
            updateLeverPosition(leverPosition === "down" ? "middle" : "up");
          } else if (gesture.dy >= swipeThreshold) {
            updateLeverPosition(leverPosition === "up" ? "middle" : "down");
          }
        },
      }),
    [leverPosition, swipeThreshold, updateLeverPosition]
  );

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      setIsLoading(true);
      setError("");

      const token = await getAuthToken();
      if (!token) {
        if (isMounted) {
          setError("Login required to start a flight.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const status = await getFlightStatus();
        let activeSymbol = symbol;

        if (status.activeSession) {
          activeSymbol = status.activeSession.symbol || symbol;
          if (isMounted) {
            setSymbol(activeSymbol);
            setTelemetry({
              fuel: status.activeSession.currentFuel,
              hull: status.activeSession.currentHull,
              progress: status.activeSession.progress,
            });
          }
        } else {
          const start = await startFlight({ rocketId, symbol });
          activeSymbol = start.session.symbol || symbol;
          if (isMounted) {
            const progress = (start.session.distance / start.session.targetDistance) * 100;
            setSymbol(activeSymbol);
            setTelemetry({
              fuel: start.session.currentFuel,
              hull: start.session.currentHull,
              progress,
            });
          }
        }

        const chart = await getChart(activeSymbol, round);
        if (isMounted) {
          setChartValues(chart.gravityData.values);
          setStabilityValues(chart.gravityData.stability);
          chartCursor.current = 1;
          const latestChange = chart.gravityData.stability[chart.gravityData.stability.length - 1] ?? 0;
          setTelemetry((prev) => ({ ...prev, isStable: latestChange >= 0 }));
        }
      } catch (e) {
        if (isMounted) {
          const message = e instanceof Error ? e.message : "Failed to load cockpit data.";
          setError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [rocketId, symbol, round]);

  const handleOutcomeEnd = useCallback(() => {
    if (pendingFinalKey) {
      setFinalOutcomeKey(pendingFinalKey);
      setPendingFinalKey(null);
      setOutcomeKey(null);
      setPendingRound(null);
      setView("final");
      return;
    }
    setOutcomeKey(null);
    setRound((prev) => (pendingRound ?? prev));
    setPendingRound(null);
    setView("round");
  }, [pendingFinalKey, pendingRound]);

  const handleFinalEnd = useCallback(() => {
    setView("finalResult");
  }, []);

  const handleLogout = useCallback(async () => {
    await clearAuthSession();
    nav.reset({ index: 0, routes: [{ name: "Start" }] });
  }, [nav]);

  const handleConfirm = useCallback(async () => {
    setDecisionError("");
    if (chartValues.length < 2) {
      setDecisionError("차트 데이터를 불러오는 중입니다.");
      return;
    }

    setIsConfirming(true);
    try {
      const status = await getFlightStatus();
      if (!status.activeSession) {
        const start = await startFlight({ rocketId, symbol });
        const progress = (start.session.distance / start.session.targetDistance) * 100;
        setSymbol(start.session.symbol || symbol);
        setTelemetry({
          fuel: start.session.currentFuel,
          hull: start.session.currentHull,
          progress,
        });
      }

      const chosenDirection: LeverChoice = leverPosition === "up" ? "up" : "down";
      const fuelInput = chosenDirection === "up" ? 80 : 20;
      const index = Math.min(chartCursor.current, chartValues.length - 1);
      const yValue = chartValues[index];
      const previousYValue = chartValues[index - 1] ?? yValue;
      const response = await syncFlight({ fuelInput, yValue, previousYValue });
      setTelemetry({
        fuel: response.currentFuel,
        hull: response.currentHull,
        progress: response.progress,
        isStable: response.isStableZone,
        status: response.status,
      });
      chartCursor.current = Math.min(index + 1, chartValues.length - 1);
      setLeverPosition("middle");
      const nextRound = Math.min(round + 1, MAX_ROUNDS);
      const correctDirection = ROUND_ANSWERS[round] ?? "up";
      const isCorrect = chosenDirection === correctDirection;
      const nextCorrectCount = correctCount + (isCorrect ? 1 : 0);
      setCorrectCount(nextCorrectCount);
      const outcome = getOutcomeKey(correctDirection, chosenDirection);
      setPendingRound(nextRound);
      setOutcomeKey(outcome);
      if (round >= MAX_ROUNDS) {
        const finalKey = getFinalOutcomeKey(nextCorrectCount);
        setPendingFinalKey(finalKey);
      }
      setView("outcome");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed.";
      setDecisionError(message);
    } finally {
      setIsConfirming(false);
    }
  }, [chartValues, correctCount, leverPosition, round, rocketId, symbol]);

  const latestChange = stabilityValues[stabilityValues.length - 1] ?? 0;
  const stableSignal = telemetry.isStable ?? latestChange >= 0;
  const signalText = isLoading ? "Loading signal" : stableSignal ? "Stable signal" : "Turbulent signal";
  const signalColor = stableSignal ? theme.colors.success : theme.colors.warning;

  const fuelValue = telemetry.fuel !== undefined ? `${Math.round(telemetry.fuel)}%` : "Optimal";
  const hullValue = telemetry.hull !== undefined ? `${Math.round(telemetry.hull)}%` : "Nominal";
  const progressValue = telemetry.progress !== undefined ? `${Math.round(telemetry.progress)}%` : "Pending";

  const updates = useMemo<UpdateItem[]>(() => {
    const items: UpdateItem[] = [];
    if (error) {
      items.push({ time: "00:38", message: `Alert: ${error}`, tone: "warning" });
    }
    items.push({
      time: "00:34",
      message: `Round ${round} / ${MAX_ROUNDS} briefing active`,
      tone: "info",
    });
    items.push({
      time: "00:31",
      message: `Signal ${stableSignal ? "locked" : "drifting"} on ${symbol}`,
      tone: stableSignal ? "success" : "warning",
    });
    items.push({
      time: "00:28",
      message: telemetry.status ? `Guidance: ${telemetry.status}` : "Guidance loop synchronized",
      tone: "info",
    });
    items.push({
      time: "00:24",
      message: `Fuel flow ${
        leverPosition === "up" ? "boosted" : leverPosition === "down" ? "reduced" : "balanced"
      } | ${fuelValue} remaining`,
      tone: "info",
    });
    items.push({
      time: "00:21",
      message: `Hull ${hullValue} | Jump ${progressValue}`,
      tone: telemetry.hull !== undefined && telemetry.hull < 30 ? "warning" : "info",
    });
    return items;
  }, [error, round, stableSignal, symbol, telemetry.status, leverPosition, fuelValue, hullValue, progressValue, telemetry.hull]);

  const panelUpdates = updates.slice(0, 3);
  const windowLayer = (
    <View style={s.window} pointerEvents="none">
      <ImageBackground source={{ uri: BG_IMAGE }} style={StyleSheet.absoluteFillObject} resizeMode="cover">
        <View style={s.windowOverlay} />
      </ImageBackground>
      <View style={s.glassSheen} />
      <View style={s.glassSheenSecondary} />
      <View style={s.windowRim} />
    </View>
  );

  if (view === "chart") {
    return <ChartScreen data={gsiData} onBack={() => setView("cockpit")} />;
  }

  if (view === "info") {
    return <InfoScreen rocketId={rocketId} onBack={() => setView("cockpit")} updates={updates} />;
  }

  if (view === "outcome" && outcomeKey) {
    return (
      <View style={s.root}>
        <View style={[s.frame, { width: frame.width, height: frame.height }]}>
          <OutcomeVideo source={OUTCOME_VIDEOS[outcomeKey]} onEnd={handleOutcomeEnd} />
          <View style={s.outcomeOverlay} pointerEvents="none" />
        </View>
      </View>
    );
  }

  if (view === "final" && finalOutcomeKey) {
    return (
      <View style={s.root}>
        <View style={[s.frame, { width: frame.width, height: frame.height }]}>
          <OutcomeVideo source={FINAL_OUTCOME_VIDEOS[finalOutcomeKey]} onEnd={handleFinalEnd} />
          <View style={s.outcomeOverlay} pointerEvents="none" />
        </View>
      </View>
    );
  }

  if (view === "finalResult" && finalOutcomeKey) {
    return (
      <View style={s.root}>
        <View style={[s.frame, { width: frame.width, height: frame.height }]}>
          {windowLayer}
          <View style={s.finalContent}>
            <View style={s.finalCard}>
              <Text style={s.finalTitle}>RESULT</Text>
              <Text style={s.finalScore}>{finalScoreLabel}</Text>
              <Text style={s.finalMessage}>{finalMessage}</Text>
              <Pressable style={({ pressed }) => [s.finalLogout, pressed && s.finalLogoutPressed]} onPress={handleLogout}>
                <Text style={s.finalLogoutText}>LOG OUT</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (view === "round") {
    return (
      <View style={s.root}>
        <View style={[s.frame, { width: frame.width, height: frame.height }]}>
          {windowLayer}
          <View style={s.roundContent}>
            <View style={s.roundCard}>
              <Text style={s.roundEyebrow}>{roundLabel}</Text>
              {showRoundCopy ? <Text style={s.roundCopy}>{roundCopy}</Text> : null}
              <Pressable style={({ pressed }) => [s.roundButton, pressed && s.roundButtonPressed]} onPress={() => setView("cockpit")}>
                <Text style={s.roundButtonText}>GO!</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={[s.frame, { width: frame.width, height: frame.height }]}>
        {windowLayer}

        <View style={s.console} pointerEvents="none">
          <View style={s.consoleEdge} />
          <View style={s.consoleGlow} />
        </View>

        <View style={[s.content, { paddingTop: contentTop }]}>
          <View style={s.panelRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setView("chart")}
              style={({ pressed }) => [
                s.sidePanel,
                { width: sidePanelWidth, height: sidePanelHeight },
                pressed && s.panelPressed,
              ]}
            >
              <Text style={s.panelTitle}>TRAJECTORY CHART</Text>
              <View style={s.chartWindow}>
                <TrajectoryGSIChart data={gsiData} width={chartWidth} height={chartHeight} />
              </View>
              <View style={s.panelMeta}>
                <View style={[s.statusDot, { backgroundColor: signalColor }]} />
                <Text style={s.panelMetaText}>{signalText}</Text>
              </View>
              {error ? <Text style={s.errorText}>{error}</Text> : null}
              <Text style={s.panelHint}>Tap to expand</Text>
            </Pressable>

            <View style={[s.leverPanel, { width: centerWidth, height: centerHeight }]}>
              <Text style={s.panelTitle}>CONTROL LEVER</Text>
              <Text style={s.roundBadge}>{`ROUND ${round} / ${MAX_ROUNDS}`}</Text>
              <View style={[s.leverWell, { height: trackHeight + 34 }]}>
                <View style={[s.leverTrack, { height: trackHeight }]} />
                <View style={[s.leverStop, { top: 10 }]} />
                <View style={[s.leverStop, { bottom: 10 }]} />
                <View style={[s.leverHandle, { bottom: handleBottom, transform: [{ rotate: leverRotation }] }]} {...panResponder.panHandlers}>
                  <View style={s.leverKnob}>
                    <View style={s.leverKnobInset} />
                  </View>
                  <View style={s.leverStem} />
                </View>
                <View style={s.leverBase} />
              </View>
              <Text style={s.leverState}>
                {leverPosition === "up" ? "THRUST UP" : leverPosition === "down" ? "THRUST DOWN" : "THRUST HOLD"}
              </Text>
              <Text style={s.leverHint}>Swipe up or down</Text>
              <View style={s.confirmDock}>
                <Pressable
                  style={({ pressed }) => [
                    s.confirmButton,
                    confirmDisabled && s.confirmDisabled,
                    pressed && !confirmDisabled && s.confirmPressed,
                  ]}
                  onPress={handleConfirm}
                  disabled={confirmDisabled}
                >
                  <Text style={s.confirmText}>{isConfirming ? "CONFIRMING..." : "CONFIRM"}</Text>
                </Pressable>
              </View>
              {decisionError ? <Text style={s.decisionError}>{decisionError}</Text> : null}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setView("info")}
              style={({ pressed }) => [
                s.sidePanel,
                { width: sidePanelWidth, height: sidePanelHeight },
                pressed && s.panelPressed,
              ]}
            >
              <Text style={s.panelTitle}>UPDATES</Text>
              <View style={s.updateList}>
                {panelUpdates.map((item, index) => (
                  <View key={`${item.time}-${index}`} style={s.updateRow}>
                    <View style={[s.updateDot, { backgroundColor: theme.colors.accent }]} />
                    <View style={s.updateCopy}>
                      <Text style={s.updateTime}>{item.time}</Text>
                      <Text style={s.updateText} numberOfLines={2}>
                        {item.message}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              <Text style={s.panelHint}>Tap to expand</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.black },
  frame: {
    backgroundColor: theme.colors.frame,
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.2)",
  },
  outcomeVideo: { ...StyleSheet.absoluteFillObject },
  outcomeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.08)" },
  window: { ...StyleSheet.absoluteFillObject },
  windowOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.overlay },
  glassSheen: {
    position: "absolute",
    width: "120%",
    height: "40%",
    top: "-6%",
    left: "-12%",
    backgroundColor: "rgba(255,255,255,0.07)",
    transform: [{ rotate: "-12deg" }],
  },
  glassSheenSecondary: {
    position: "absolute",
    width: "120%",
    height: "28%",
    top: "34%",
    left: "-20%",
    backgroundColor: "rgba(255,255,255,0.04)",
    transform: [{ rotate: "-9deg" }],
  },
  windowRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
  },
  console: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "42%",
    backgroundColor: "rgba(4,7,14,0.92)",
  },
  consoleEdge: { position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: "rgba(251,191,36,0.22)" },
  consoleGlow: {
    position: "absolute",
    top: -18,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: "rgba(251,191,36,0.08)",
  },
  content: { flex: 1, paddingHorizontal: 18, paddingBottom: 18, justifyContent: "flex-end" },
  panelRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 14 },
  roundContent: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  finalContent: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  roundCard: {
    width: "80%",
    maxWidth: 420,
    backgroundColor: "rgba(12,17,29,0.78)",
    borderRadius: theme.radius.lg,
    paddingVertical: 20,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
    alignItems: "center",
  },
  finalCard: {
    width: "82%",
    maxWidth: 460,
    backgroundColor: "rgba(12,17,29,0.8)",
    borderRadius: theme.radius.lg,
    paddingVertical: 22,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
    alignItems: "center",
  },
  roundEyebrow: { color: theme.colors.accent, fontWeight: "800", fontSize: 18, letterSpacing: 1, marginBottom: 8 },
  roundTitle: { color: theme.colors.textPrimary, fontWeight: "900", fontSize: 20, marginBottom: 8 },
  roundCopy: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center", marginBottom: 16 },
  finalTitle: { color: theme.colors.accent, fontWeight: "800", fontSize: 16, letterSpacing: 1, marginBottom: 8 },
  finalScore: { color: theme.colors.textPrimary, fontWeight: "900", fontSize: 26, letterSpacing: 1, marginBottom: 10 },
  finalMessage: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  finalLogout: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.accentBorderStrong,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  finalLogoutPressed: { transform: [{ scale: 0.98 }] },
  finalLogoutText: { color: theme.colors.textAccentStrong, fontWeight: "800", fontSize: 11, letterSpacing: 0.8 },
  roundButton: {
    paddingVertical: 10,
    paddingHorizontal: 26,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(234,88,12,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.accentBorderStrong,
  },
  roundButtonPressed: { transform: [{ scale: 0.97 }] },
  roundButtonText: { color: theme.colors.textPrimary, fontWeight: "900", letterSpacing: 1 },
  sidePanel: {
    backgroundColor: "rgba(12,17,29,0.72)",
    borderRadius: theme.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.3)",
  },
  panelPressed: { transform: [{ scale: 0.98 }] },
  panelTitle: { color: theme.colors.accent, fontWeight: "800", fontSize: 13, letterSpacing: 0.8, marginBottom: 8 },
  chartWindow: { borderRadius: theme.radius.md, padding: 6, backgroundColor: "rgba(0,0,0,0.35)" },
  panelMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  panelMetaText: { color: theme.colors.textMuted, fontSize: 11 },
  errorText: { color: theme.colors.danger, fontSize: 10, marginTop: 6 },
  panelHint: { color: theme.colors.textHint, fontSize: 10, marginTop: "auto", letterSpacing: 0.4 },
  leverPanel: {
    backgroundColor: "rgba(10,14,22,0.78)",
    borderRadius: theme.radius.lg,
    padding: 12,
    paddingBottom: 54,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
    alignItems: "center",
  },
  roundBadge: { color: theme.colors.textAccentStrong, fontSize: 12, letterSpacing: 0.8, marginBottom: 6 },
  leverWell: { width: 86, alignItems: "center", justifyContent: "center", position: "relative", marginTop: 4 },
  leverTrack: {
    position: "absolute",
    width: 60,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.accentBorderSoft,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  leverStop: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(251,191,36,0.4)",
  },
  leverHandle: { position: "absolute", width: 54, height: 46, alignItems: "center", justifyContent: "flex-start" },
  leverKnob: {
    width: 46,
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(234,88,12,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.accentBorderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  leverKnobInset: { width: 24, height: 5, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.35)" },
  leverStem: {
    marginTop: 4,
    width: 6,
    height: 26,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  leverBase: {
    position: "absolute",
    bottom: 2,
    width: 26,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.3)",
  },
  leverState: { marginTop: 10, color: theme.colors.textAccentStrong, fontSize: 12, letterSpacing: 0.7 },
  leverHint: { marginTop: 4, color: theme.colors.textHint, fontSize: 10 },
  confirmDock: { position: "absolute", left: 0, right: 0, bottom: 12, alignItems: "center" },
  confirmButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.accentBorderStrong,
    backgroundColor: "rgba(234,88,12,0.55)",
  },
  confirmPressed: { transform: [{ scale: 0.98 }] },
  confirmDisabled: { opacity: 0.4 },
  confirmText: { color: theme.colors.textPrimary, fontWeight: "800", fontSize: 12, letterSpacing: 0.8 },
  decisionError: { marginTop: 6, color: theme.colors.warning, fontSize: 10, textAlign: "center" },
  updateList: { gap: 10, marginTop: 4 },
  updateRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  updateDot: { width: 6, height: 6, borderRadius: 999, marginTop: 6 },
  updateCopy: { flex: 1 },
  updateTime: { color: theme.colors.textAccent, fontSize: 10, marginBottom: 2 },
  updateText: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 16 },
});
