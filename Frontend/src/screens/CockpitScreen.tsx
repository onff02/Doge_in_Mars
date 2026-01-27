import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View, ActivityIndicator } from "react-native";
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
import { getAuthToken, getChart, getFlightStatus, getRockets, startFlight, syncFlight, clearAuthSession } from "../api/client";

// --- Types ---
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

// --- Constants ---
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
  fail: "효율적인 연료 소모에 실패한 도지는 화성 도달에 실패했습니다.",
  success1: "효율적인 연료 사용에 성공한 도지는 안전하게 화성에 착륙했습니다.",
  success2: "완벽한 연료 사용에 성공한 도지는 화성에서 도지시티 건설에 성공하여 세를 키웠고 지구를 침공했습니다.",
};

const ROUND_ANSWERS: Record<number, { [key: string]: LeverChoice; default: LeverChoice }> = {
  1: { NVDA: "down", AAPL: "down", KO: "up", default: "down" },
  2: { NVDA: "down", AAPL: "up", KO: "up", default: "up" },
  3: { default: "up" },
  4: { NVDA: "up", AAPL: "down", KO: "down", default: "down" },
  5: { default: "down" },
  6: { NVDA: "up", AAPL: "up", KO: "up", default: "up" },
};

const PHASE_INTROS: Record<number, { title: string; lines: string[] }> = {
  1: { title: "리먼 블랙홀", lines: ["전방에 거대한 블랙홀이 형성되었습니다.", "튼튼한 우주선은 버틸 수 있을까요?"] },
  2: { title: "변동성의 소음", lines: ["중력파가 무작위로 요동치고 있습니다.", "패닉 속에서 방향을 읽을 수 있습니까?"] },
  3: { title: "불항성류 진입", lines: ["모든 중력장이 추진에 우호적입니다.", "하지만 과도한 출력이 과연 정답일까요?"] },
  4: { title: "규제 신호", lines: ["NASA로부터 규제 신호가 도착했습니다.", "규제에 대한 순응과 혁신, 무엇을 택하겠습니까?"] },
  5: { title: "시공간 반전 구역", lines: ["시공간이 반전되었습니다.", "도지의 우주선이 화성을 향하고 있을까요?"] },
  6: { title: "마지막 선택", lines: ["우주는 이상하리만큼 평화롭습니다.", "과연 당신의 선택도 쉬울까요?"] },
};

const PHASE_ONE_HINTS = [
  "좌측엔 어제까지의 중력장 안정도 차트가 표시됩니다. 클릭하면 확대해서 볼 수 있습니다.",
  "우측엔 운항에 필요한 정보 게시판이 있습니다. 클릭하면 확대해서 볼 수 있습니다.",
  "가운데 레버를 올리거나 내려서 연료 소모량을 결정합니다.",
  "도지가 무사히 화성에 도착할 수 있게 도와주세요!",
];

const BG_IMAGE = "https://images.unsplash.com/photo-1709409903008-fbc1ce9b7dfa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const MAX_ROUNDS = 6;
const SWIPE_THRESHOLD = 18;

// --- Global Helpers ---
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
  if (correct === "up") return chosen === "up" ? "upCorrect" : "downWrong";
  return chosen === "down" ? "downCorrect" : "upWrong";
}

function getFinalOutcomeKey(correctCount: number): FinalOutcomeKey {
  if (correctCount <= 2) return "fail";
  if (correctCount <= 5) return "success1";
  return "success2";
}

// --- Helper Components ---
function OutcomeVideo({ source, onEnd }: { source: number; onEnd: () => void }) {
  const [audioReady, setAudioReady] = useState(false);
  const player = useVideoPlayer(source, (vp) => {
    vp.loop = false;
    vp.muted = false;
    vp.volume = 1;
    vp.audioMixingMode = "doNotMix";
  });

  useEffect(() => {
    let isMounted = true;
    const configureAudio = async () => {
      try {
        await Audio.setIsEnabledAsync(true);
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        if (isMounted) setAudioReady(true);
      } catch {
        if (isMounted) setAudioReady(true);
      }
    };
    configureAudio();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => { if (audioReady) player.play(); }, [audioReady, player]);
  useEventListener(player, "playToEnd", onEnd);
  return <VideoView player={player} style={s.outcomeVideo} contentFit="cover" nativeControls={false} />;
}

// --- Main Component ---
export default function CockpitScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList, "Cockpit">>();
  const route = useRoute<RouteProp<RootStackParamList, "Cockpit">>();
  const rocketId = route.params?.rocketId ?? 1;
  const initialRound = route.params?.round ?? 1;
  const { width, height } = useWindowDimensions();

  // Views State
  const [view, setView] = useState<"cockpit" | "chart" | "info" | "round" | "outcome" | "finalPrompt" | "final" | "finalResult">(
    route.params?.startInRound ? "round" : "cockpit"
  );

  // Game Data State
  const [round, setRound] = useState(() => Math.min(Math.max(initialRound, 1), MAX_ROUNDS));
  const [leverPosition, setLeverPosition] = useState<"up" | "middle" | "down">("middle");
  const [telemetry, setTelemetry] = useState<Telemetry>({});
  const [chartValues, setChartValues] = useState<number[]>([]);
  const [stabilityValues, setStabilityValues] = useState<number[]>([]);
  const [symbol, setSymbol] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  // Flow State
  const [outcomeKey, setOutcomeKey] = useState<OutcomeKey | null>(null);
  const [finalOutcomeKey, setFinalOutcomeKey] = useState<FinalOutcomeKey | null>(null);
  const [pendingRound, setPendingRound] = useState<number | null>(null);
  const [pendingFinalKey, setPendingFinalKey] = useState<FinalOutcomeKey | null>(null);
  const [phaseOneHintStep, setPhaseOneHintStep] = useState(0);
  const chartCursor = useRef(1);

  // Animation Refs (Removed unused)
  const blackHolePulse = useRef(new Animated.Value(0)).current;
  const shakePulse = useRef(new Animated.Value(0)).current;
  const twinkleA = useRef(new Animated.Value(0)).current;

  // Error fix: fallbackData definition
  const fallbackData = useMemo(() => generateGsiData(40), []);
  const gsiData = chartValues.length ? chartValues : fallbackData;

  // Layout Calculations
  const frame = useMemo(() => {
    const targetRatio = 932 / 430;
    const padding = 24;
    const maxW = Math.max(0, width - padding * 2);
    const maxH = Math.max(0, height - padding * 2);
    let frameW = Math.min(maxW, 932);
    let frameH = frameW / targetRatio;
    if (frameH > maxH) { frameH = maxH; frameW = frameH * targetRatio; }
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
    leverPosition === "up" ? leverBottomMargin + leverRange : 
    leverPosition === "down" ? leverBottomMargin : 
    leverBottomMargin + leverRange / 2;

  // Error fix: contentTop definition
  const contentTop = Math.max(12, frame.height * 0.16);

  // --- Logic Functions ---
  const updateLeverPosition = useCallback((next: "up" | "middle" | "down") => {
    setLeverPosition(next);
    if (decisionError) setDecisionError("");
  }, [decisionError]);

  const fetchChartData = useCallback(async (tgtSymbol: string, tgtRound: number) => {
    if (!tgtSymbol) return;
    try {
      setIsLoading(true);
      const chart = await getChart(tgtSymbol, tgtRound);
      if (chart && chart.gravityData) {
        setChartValues(chart.gravityData.values);
        setStabilityValues(chart.gravityData.stability);
        chartCursor.current = 1;
      }
    } catch (e) { setError("중력파 수신 실패"); } 
    finally { setIsLoading(false); }
  }, []);

  const handleLogout = useCallback(async () => {
    await clearAuthSession();
    nav.reset({
      index: 0,
      routes: [{ name: "Start" }],
    });
  }, [nav]);

  useEffect(() => {
    let isMounted = true;
    const bootstrap = async () => {
      setIsLoading(true);
      try {
        const { rockets } = await getRockets();
        const currentRocket = rockets.find(r => r.id === rocketId);
        const rocketName = currentRocket?.name || "NVDA";

        const status = await getFlightStatus();
        let activeSymbol = rocketName;

        if (status.activeSession) {
          activeSymbol = status.activeSession.symbol || rocketName;
          if (isMounted) {
            setSymbol(activeSymbol);
            setTelemetry({
              fuel: status.activeSession.currentFuel,
              hull: status.activeSession.currentHull,
              progress: status.activeSession.progress,
            });
          }
        } else {
          const start = await startFlight({ rocketId, symbol: rocketName });
          activeSymbol = start.session.symbol;
          if (isMounted) {
            setSymbol(activeSymbol);
            setTelemetry({ fuel: 100, hull: 100, progress: 0 });
          }
        }
        if (isMounted) await fetchChartData(activeSymbol, round);
      } catch (e) { if (isMounted) setError("부팅 에러"); } 
      finally { if (isMounted) setIsLoading(false); }
    };
    bootstrap();
    return () => { isMounted = false; };
  }, [rocketId]);

  useEffect(() => { if (symbol && round > 1) fetchChartData(symbol, round); }, [round, symbol, fetchChartData]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy <= -SWIPE_THRESHOLD) updateLeverPosition(leverPosition === "down" ? "middle" : "up");
      else if (gesture.dy >= SWIPE_THRESHOLD) updateLeverPosition(leverPosition === "up" ? "middle" : "down");
    },
    onPanResponderTerminate: (_, gesture) => {
      if (gesture.dy <= -SWIPE_THRESHOLD) updateLeverPosition(leverPosition === "down" ? "middle" : "up");
      else if (gesture.dy >= SWIPE_THRESHOLD) updateLeverPosition(leverPosition === "up" ? "middle" : "down");
    },
  }), [leverPosition, updateLeverPosition]);

  const handleConfirm = useCallback(async () => {
    if (chartValues.length < 2) return;
    setIsConfirming(true);
    try {
      const chosenDirection: LeverChoice = leverPosition === "up" ? "up" : "down";
      const fuelInput = chosenDirection === "up" ? 80 : 20;
      const index = Math.min(chartCursor.current, chartValues.length - 1);
      
      const response = await syncFlight({ 
        fuelInput, 
        yValue: chartValues[index], 
        previousYValue: chartValues[index-1] || chartValues[index] 
      });

      setTelemetry({
        fuel: response.currentFuel,
        hull: response.currentHull,
        progress: response.progress,
        isStable: response.isStableZone,
        status: response.status,
      });

      const roundConfig = ROUND_ANSWERS[round];
      const correctDirection = roundConfig[symbol] || roundConfig.default;
      const isCorrect = chosenDirection === correctDirection;
      const nextCorrectCount = correctCount + (isCorrect ? 1 : 0);
      
      setCorrectCount(nextCorrectCount);
      setOutcomeKey(getOutcomeKey(correctDirection, chosenDirection));
      setPendingRound(Math.min(round + 1, MAX_ROUNDS));

      // Error fix: getFinalOutcomeKey call
      if (round >= MAX_ROUNDS) setPendingFinalKey(getFinalOutcomeKey(nextCorrectCount));
      
      setView("outcome");
      setLeverPosition("middle");
      chartCursor.current = Math.min(index + 1, chartValues.length - 1);
    } catch (e) { setDecisionError("전송 실패"); } 
    finally { setIsConfirming(false); }
  }, [chartValues, leverPosition, round, symbol, correctCount]);

  // --- Animations (Cleaned) ---
  useEffect(() => {
    if (view === "round") {
      if (round === 1) {
        Animated.loop(Animated.sequence([
          Animated.timing(blackHolePulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(blackHolePulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])).start();
      } else if (round === 2) {
        Animated.loop(Animated.timing(shakePulse, { toValue: 1, duration: 520, useNativeDriver: true })).start();
      } else if (round === 3) {
        Animated.loop(Animated.sequence([
          Animated.timing(twinkleA, { toValue: 1, duration: 1600, useNativeDriver: true }),
          Animated.timing(twinkleA, { toValue: 0, duration: 1600, useNativeDriver: true }),
        ])).start();
      }
    }
  }, [view, round]);

  const handleOutcomeEnd = useCallback(() => {
    if (pendingFinalKey) { setFinalOutcomeKey(pendingFinalKey); setView("finalPrompt"); }
    else { setRound(prev => pendingRound ?? prev); setView("round"); }
  }, [pendingFinalKey, pendingRound]);

  const handleFinalEnd = useCallback(() => setView("finalResult"), []);

  // --- Derived ---
  const stableSignal = telemetry.isStable ?? (stabilityValues[stabilityValues.length - 1] >= 0);
  const signalText = isLoading ? "Loading..." : stableSignal ? "Stable signal" : "Turbulent signal";
  const signalColor = stableSignal ? theme.colors.success : theme.colors.warning;
  const updates = useMemo<UpdateItem[]>(() => [
    { time: "NOW", message: `Phase ${round} 분석 활성화`, tone: "info" },
    { time: "SYS", message: `${symbol} 신호 ${stableSignal ? "잠금" : "불안정"}`, tone: stableSignal ? "success" : "warning" },
    { time: "NAV", message: telemetry.status || "항법 동기화 중", tone: "info" }
  ], [round, symbol, stableSignal, telemetry.status]);

  const panelUpdates = updates.slice(0, 3);

  // --- View Layer ---
  const windowLayer = (
    <View style={s.window} pointerEvents="none">
      <ImageBackground source={{ uri: BG_IMAGE }} style={StyleSheet.absoluteFillObject} resizeMode="cover">
        <View style={s.windowOverlay} />
      </ImageBackground>
      <View style={s.glassSheen} />
      <View style={s.windowRim} />
    </View>
  );

  if (view === "chart") return <ChartScreen data={gsiData} onBack={() => setView("cockpit")} symbol={symbol} round={round}/>;
  if (view === "info") return <InfoScreen rocketId={rocketId} onBack={() => setView("cockpit")} updates={updates} />;
  if (view === "outcome" && outcomeKey) return <OutcomeVideo source={OUTCOME_VIDEOS[outcomeKey]} onEnd={handleOutcomeEnd} />;
  if (view === "final" && finalOutcomeKey) return <OutcomeVideo source={FINAL_OUTCOME_VIDEOS[finalOutcomeKey]} onEnd={handleFinalEnd} />;

  if (view === "finalPrompt") return (
    <View style={s.root}>
      <View style={[s.frame, { width: frame.width, height: frame.height }]}>
        {windowLayer}
        <View style={s.finalPromptContent}>
          <View style={s.finalPromptCard}>
            <Text style={s.finalPromptTitle}>과연 도지는 화성에 안전하게 도착했을까요?</Text>
            <Pressable style={s.finalPromptButton} onPress={() => setView("final")}>
              <Text style={s.finalPromptButtonText}>결과 확인하기</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );

  if (view === "finalResult") return (
    <View style={s.root}>
      <View style={[s.frame, { width: frame.width, height: frame.height }]}>
        {windowLayer}
        <View style={s.finalContent}>
          <View style={s.finalCard}>
            <Text style={s.finalTitle}>RESULT</Text>
            <Text style={s.finalScore}>{correctCount} / {MAX_ROUNDS}</Text>
            <Text style={s.finalMessage}>{FINAL_MESSAGES[finalOutcomeKey!]}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={s.roundButton} onPress={() => nav.navigate("Start")}>
                <Text style={s.roundButtonText}>BASE</Text>
              </Pressable>
              <Pressable style={[s.roundButton, { backgroundColor: theme.colors.danger }]} onPress={handleLogout}>
                <Text style={s.roundButtonText}>LOGOUT</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <View style={[s.frame, { width: frame.width, height: frame.height }]}>
        <Animated.View style={s.roundBackground}>
          {windowLayer}
          {round === 1 && view === "round" && (
            <View style={s.blackHoleLayer}>
              <Animated.View style={[s.blackHoleHalo, { transform: [{ scale: blackHolePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) }] }]} />
              <View style={s.blackHoleCore} />
            </View>
          )}
        </Animated.View>

        {view === "round" ? (
          <View style={s.roundContent}>
            <View style={s.roundCard}>
              <Text style={s.roundEyebrow}>{`PHASE ${round}: ${PHASE_INTROS[round]?.title}`}</Text>
              <Text style={s.roundCopy}>{PHASE_INTROS[round]?.lines.join("\n")}</Text>
              <Pressable style={s.roundButton} onPress={() => setView("cockpit")}>
                <Text style={s.roundButtonText}>GO!</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {round === 1 && phaseOneHintStep < PHASE_ONE_HINTS.length && (
              <View style={s.phaseOneHint}>
                <Text style={s.phaseOneHintText}>{PHASE_ONE_HINTS[phaseOneHintStep]}</Text>
                <Pressable style={s.phaseOneHintButton} onPress={() => setPhaseOneHintStep(s => s + 1)}>
                  <Text style={s.phaseOneHintButtonText}>확인</Text>
                </Pressable>
              </View>
            )}
            <View style={s.console} />
            <View style={[s.content, { paddingTop: contentTop }]}>
              <View style={s.panelRow}>
                <Pressable onPress={() => setView("chart")} style={[s.sidePanel, {width: sidePanelWidth, height: sidePanelHeight}]}>
                  <Text style={s.panelTitle}>CHART</Text>
                  <View style={s.chartWindow}>
                    {isLoading ? <ActivityIndicator color={theme.colors.accent} /> : <TrajectoryGSIChart data={gsiData} width={chartWidth} height={chartHeight} />}
                  </View>
                  <View style={s.panelMeta}>
                    <View style={[s.statusDot, { backgroundColor: signalColor }]} />
                    <Text style={s.panelMetaText}>{signalText}</Text>
                  </View>
                </Pressable>

                <View style={[s.leverPanel, {width: centerWidth, height: centerHeight}]}>
                  <Text style={s.panelTitle}>LEVER</Text>
                  <View style={s.leverWell} {...panResponder.panHandlers}>
                    <View style={s.leverTrack} />
                    <View style={[s.leverHandle, { bottom: handleBottom }]} />
                  </View>
                  <View style={s.confirmDock}>
                    <Pressable 
                      style={[s.confirmButton, (isConfirming || leverPosition === "middle") && s.confirmDisabled]} 
                      onPress={handleConfirm}
                      disabled={isConfirming || leverPosition === "middle"}
                    >
                      <Text style={s.confirmText}>{isConfirming ? "SYNC..." : "CONFIRM"}</Text>
                    </Pressable>
                  </View>
                </View>

                <Pressable onPress={() => setView("info")} style={[s.sidePanel, {width: sidePanelWidth, height: sidePanelHeight}]}>
                  <Text style={s.panelTitle}>UPDATES</Text>
                  {panelUpdates.map((item, idx) => <Text key={idx} style={s.updateText}>{item.message}</Text>)}
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// --- Styles ---
const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.black },
  frame: { backgroundColor: theme.colors.frame, borderRadius: theme.radius.xl, overflow: "hidden", borderWidth: 1, borderColor: "rgba(251,191,36,0.2)" },
  outcomeVideo: { ...StyleSheet.absoluteFillObject },
  window: { ...StyleSheet.absoluteFillObject },
  windowOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.overlay },
  glassSheen: { position: "absolute", width: "120%", height: "40%", top: "-6%", left: "-12%", backgroundColor: "rgba(255,255,255,0.07)", transform: [{ rotate: "-12deg" }] },
  windowRim: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: "rgba(251,191,36,0.25)" },
  console: { position: "absolute", left: 0, right: 0, bottom: 0, height: "42%", backgroundColor: "rgba(4,7,14,0.92)" },
  content: { flex: 1, paddingHorizontal: 18, paddingBottom: 18, justifyContent: "flex-end" },
  panelRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 14 },
  sidePanel: { backgroundColor: "rgba(12,17,29,0.72)", borderRadius: theme.radius.lg, padding: 12, borderWidth: 1, borderColor: "rgba(251,191,36,0.3)" },
  panelTitle: { color: theme.colors.accent, fontWeight: "800", fontSize: 13, marginBottom: 8 },
  chartWindow: { borderRadius: theme.radius.md, padding: 6, backgroundColor: "rgba(0,0,0,0.35)", height: 100, justifyContent: 'center' },
  leverPanel: { backgroundColor: "rgba(10,14,22,0.78)", borderRadius: theme.radius.lg, padding: 12, paddingBottom: 54, borderWidth: 1, borderColor: "rgba(251,191,36,0.35)", alignItems: "center" },
  leverWell: { width: 86, height: 160, alignItems: "center", justifyContent: "center" },
  leverTrack: { position: "absolute", width: 40, height: 140, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", borderWidth: 1, borderColor: theme.colors.accentBorderSoft },
  leverHandle: { position: "absolute", width: 54, height: 46, backgroundColor: "rgba(234,88,12,0.9)", borderRadius: 10, borderWidth: 1, borderColor: theme.colors.accentBorderStrong },
  confirmDock: { position: "absolute", bottom: 12 },
  confirmButton: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: theme.radius.pill, backgroundColor: "rgba(234,88,12,0.55)", borderWidth: 1, borderColor: theme.colors.accentBorderStrong },
  confirmDisabled: { opacity: 0.4 },
  confirmText: { color: theme.colors.textPrimary, fontWeight: "800", fontSize: 12 },
  roundContent: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  roundCard: { width: "85%", backgroundColor: "rgba(12,17,29,0.85)", borderRadius: theme.radius.lg, padding: 24, alignItems: "center", borderWidth: 1, borderColor: theme.colors.accent },
  roundEyebrow: { color: theme.colors.accent, fontWeight: "800", fontSize: 18, marginBottom: 12 },
  roundCopy: { color: theme.colors.textMuted, textAlign: "center", marginBottom: 20, lineHeight: 22 },
  roundButton: { paddingVertical: 12, paddingHorizontal: 32, backgroundColor: theme.colors.accent, borderRadius: 30 },
  roundButtonText: { color: "black", fontWeight: "900" },
  phaseOneHint: { position: "absolute", top: 40, left: 20, right: 20, backgroundColor: "rgba(0,0,0,0.8)", padding: 16, borderRadius: 10, zIndex: 100 },
  phaseOneHintText: { color: "white", textAlign: "center", marginBottom: 10 },
  phaseOneHintButton: { alignSelf: "center", padding: 8, backgroundColor: theme.colors.accent, borderRadius: 5 },
  phaseOneHintButtonText: { fontWeight: "bold" },
  finalContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  finalCard: { padding: 40, backgroundColor: "rgba(0,0,0,0.9)", borderRadius: 20, alignItems: "center", width: '90%' },
  finalTitle: { color: theme.colors.accent, fontSize: 24, fontWeight: "bold", marginBottom: 10 },
  finalScore: { color: "white", fontSize: 40, fontWeight: "bold", marginBottom: 20 },
  finalMessage: { color: "white", textAlign: "center", marginBottom: 30 },
  updateText: { color: theme.colors.textMuted, fontSize: 11, marginBottom: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  panelMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  panelMetaText: { color: 'white', fontSize: 10 },
  roundBackground: { ...StyleSheet.absoluteFillObject },
  blackHoleLayer: { position: "absolute", top: "20%", left: "30%", width: 100, height: 100 },
  blackHoleHalo: { ...StyleSheet.absoluteFillObject, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.1)" },
  blackHoleCore: { flex: 1, borderRadius: 50, backgroundColor: "black" },
  finalPromptContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  finalPromptCard: { padding: 30, backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 20, alignItems: "center" },
  finalPromptTitle: { color: "white", fontSize: 18, textAlign: "center", marginBottom: 20 },
  finalPromptButton: { padding: 15, backgroundColor: theme.colors.accent, borderRadius: 10 },
  finalPromptButtonText: { fontWeight: "bold" },
});