import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
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
import { clearAuthSession, getAuthToken, getChart, getFlightStatus, getRockets, startFlight, syncFlight } from "../api/client";

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
  fail: "효율적인 연료 소모에 실패한 도지는 화성 도달에 실패했습니다.",
  success1: "효율적인 연료 사용에 성공한 도지는 안전하게 화성에 착륙했습니다.",
  success2: "완벽한 연료 사용에 성공한 도지는 화성에서 도지시티 건설에 성공하여 세를 키웠고 지구를 침공했습니다.",
};

const ROUND_ANSWERS: Record<number, LeverChoice> = {
  1: "up",
  2: "down",
  3: "up",
  4: "down",
  5: "up",
  6: "down",
};

const PHASE_INTROS: Record<number, { title: string; lines: string[] }> = {
  1: {
    title: "리먼 블랙홀",
    lines: ["전방에 거대한 블랙홀이 형성되었습니다.", "튼튼한 우주선은 버틸 수 있을까요?"],
  },
  2: {
    title: "변동성의 소음",
    lines: ["중력파가 무작위로 요동치고 있습니다.", "패닉 속에서 방향을 읽을 수 있습니까?"],
  },
  3: {
    title: "불항성류 진입",
    lines: ["모든 중력장이 추진에 우호적입니다.", "하지만 과도한 출력이 과연 정답일까요?"],
  },
  4: {
    title: "규제 신호",
    lines: ["NASA로부터 규제 신호가 도착했습니다.", "규제에 대한 순응과 혁신, 무엇을 택하겠습니까?"],
  },
  5: {
    title: "시공간 반전 구역",
    lines: ["시공간이 반전되었습니다.", "도지의 우주선이 화성을 향하고 있을까요?"],
  },
  6: {
    title: "마지막 선택",
    lines: ["우주는 이상하리만큼 평화롭습니다.", "과연 당신의 선택도 쉬울까요?"],
  },
};

const STAR_POSITIONS = [
  { top: "12%", left: "18%", size: 3 },
  { top: "18%", left: "48%", size: 2 },
  { top: "10%", left: "72%", size: 3 },
  { top: "26%", left: "30%", size: 2 },
  { top: "32%", left: "60%", size: 2 },
  { top: "20%", left: "82%", size: 3 },
  { top: "38%", left: "22%", size: 2 },
  { top: "42%", left: "70%", size: 3 },
];

const PHASE_ONE_HINTS = [
  "좌측엔 어제까지의 중력장 안정도 차트가 표시됩니다. 클릭하면 확대해서 볼 수 있습니다.",
  "우측엔 운항에 필요한 정보 게시판이 있습니다. 클릭하면 확대해서 볼 수 있습니다.",
  "가운데 레버를 올리거나 내려서 연료 소모량을 결정합니다. 오직 2가지 선택지만 있으며, 둘 중 하나가 정답입니다.",
  "도지가 무사히 화성에 도착할 수 있게 도와주세요!",
];

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
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList, "Cockpit">>();
  const route = useRoute<RouteProp<RootStackParamList, "Cockpit">>();
  const rocketId = route.params?.rocketId ?? 1;
  const startInRound = route.params?.startInRound ?? false;
  const initialRound = route.params?.round ?? 1;
  const { width, height } = useWindowDimensions();
  const [view, setView] = useState<
    "cockpit" | "chart" | "info" | "round" | "outcome" | "finalPrompt" | "final" | "finalResult"
  >(startInRound ? "round" : "cockpit");
  const [round, setRound] = useState(() => Math.min(Math.max(initialRound, 1), MAX_ROUNDS));
  const [leverPosition, setLeverPosition] = useState<"up" | "middle" | "down">("middle");
  const [telemetry, setTelemetry] = useState<Telemetry>({});
  const [chartValues, setChartValues] = useState<number[]>([]);
  const [stabilityValues, setStabilityValues] = useState<number[]>([]);
  const [symbol, setSymbol] = useState("");
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
  const [phaseOneHintStep, setPhaseOneHintStep] = useState(0);
  const blackHolePulse = useRef(new Animated.Value(0)).current;
  const shakePulse = useRef(new Animated.Value(0)).current;
  const twinkleA = useRef(new Animated.Value(0)).current;
  const twinkleB = useRef(new Animated.Value(0)).current;
  const radioPulse = useRef(new Animated.Value(0)).current;
  const explosionA = useRef(new Animated.Value(0)).current;
  const explosionB = useRef(new Animated.Value(0)).current;
  const explosionC = useRef(new Animated.Value(0)).current;
  const explosionD = useRef(new Animated.Value(0)).current;

  const fallbackData = useMemo(() => generateGsiData(40), []);
  const gsiData = chartValues.length ? chartValues : fallbackData;

  const frame = useMemo(() => ({ width, height }), [height, width]);

  const contentPaddingX = Math.max(10, Math.round(frame.width * 0.02));
  const contentPaddingBottom = Math.max(10, Math.round(frame.height * 0.04));
  const panelGap = Math.max(8, Math.round(frame.width * 0.02));
  const contentWidth = Math.max(0, frame.width - contentPaddingX * 2);
  const availableWidth = Math.max(0, contentWidth - panelGap * 2);
  const sidePanelWidth = Math.round(availableWidth * 0.36);
  const centerWidth = Math.max(0, availableWidth - sidePanelWidth * 2);
  const sidePanelHeight = Math.max(180, Math.min(frame.height * 0.55, 240));
  const centerHeight = Math.max(230, Math.min(frame.height * 0.65, 300));
  const chartWidth = Math.max(0, sidePanelWidth - 24);
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
  const phaseIntro = PHASE_INTROS[round] ?? { title: `Phase ${round}`, lines: [] };
  const phaseLabel = `Phase ${round}: ${phaseIntro.title}`;
  const phaseCopy = phaseIntro.lines.join("\n");
  const blackHoleScale = blackHolePulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.05] });
  const blackHoleOpacity = blackHolePulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] });
  const blackHoleHaloScale = blackHolePulse.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1.3] });
  const blackHoleHaloOpacity = blackHolePulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.35] });
  const blackHoleRotate = blackHolePulse.interpolate({ inputRange: [0, 1], outputRange: ["-10deg", "8deg"] });
  const shakeX = shakePulse.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -6, 6, -4, 0] });
  const shakeY = shakePulse.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 5, -5, 4, 0] });
  const shakeRotate = shakePulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["0deg", "0.6deg", "0deg"] });
  const twinkleOpacityA = twinkleA.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 0.95, 0.2] });
  const twinkleOpacityB = twinkleB.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.9, 0.25, 0.9] });
  const radioScaleA = radioPulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.2] });
  const radioScaleB = radioPulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.5] });
  const radioScaleC = radioPulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.85] });
  const radioOpacityA = radioPulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.4, 0.2, 0] });
  const radioOpacityB = radioPulse.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.35, 0.15, 0] });
  const radioOpacityC = radioPulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.1, 0] });
  const explosionScaleA = explosionA.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.7] });
  const explosionOpacityA = explosionA.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.9, 0] });
  const explosionScaleB = explosionB.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.6] });
  const explosionOpacityB = explosionB.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.85, 0] });
  const explosionScaleC = explosionC.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.5] });
  const explosionOpacityC = explosionC.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.8, 0] });
  const explosionScaleD = explosionD.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.8] });
  const explosionOpacityD = explosionD.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.9, 0] });
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

  const fetchChartData = useCallback(async (targetSymbol: string, targetRound: number) => {
    if (!targetSymbol) return; // 종목이 없으면 요청하지 않음
    try {
      setIsLoading(true);
      const chart = await getChart(targetSymbol, targetRound);
      if (chart && chart.gravityData) {
        setChartValues(chart.gravityData.values);
        setStabilityValues(chart.gravityData.stability);
        chartCursor.current = 1;
      }
    } catch (e) {
      console.error("차트 로드 실패:", e);
      setError("중력파 데이터를 가져올 수 없습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // 1. 서버에서 전체 로켓 목록을 가져와 현재 선택한 로켓의 이름(Symbol)을 찾음
        const { rockets } = await getRockets();
        const currentRocket = rockets.find((r) => r.id === rocketId);
        const rocketName = currentRocket?.name || "NVDA"; // 찾지 못할 경우 기본값

        // 2. 현재 진행 중인 비행 세션 확인
        const status = await getFlightStatus();
        let activeSymbol = rocketName;

        if (status.activeSession) {
          activeSymbol = status.activeSession.symbol;
        } else {
          // 세션이 없으면 새로 시작
          const start = await startFlight({ rocketId, symbol: rocketName });
          activeSymbol = start.session.symbol;
        }

        setSymbol(activeSymbol); // 기호 확정
        await fetchChartData(activeSymbol, round); // 첫 라운드 데이터 로드
      } catch (e) {
        console.error("초기 설정 실패:", e);
      }
    };
    bootstrap();
  }, [rocketId]); // 로켓이 바뀔 때만 실행

  useEffect(() => {
    if (symbol && round > 1) {
      fetchChartData(symbol, round);
    }
  }, [round, symbol, fetchChartData]);

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
        // Get rocket info to determine the symbol (rocket name = symbol)
        const { rockets } = await getRockets();
        const currentRocket = rockets.find((r) => r.id === rocketId);
        const rocketSymbol = currentRocket?.name || "AAPL";

        const status = await getFlightStatus();
        let activeSymbol = rocketSymbol;

        if (status.activeSession) {
          activeSymbol = status.activeSession.symbol || rocketSymbol;
          if (isMounted) {
            setSymbol(activeSymbol);
            setTelemetry({
              fuel: status.activeSession.currentFuel,
              hull: status.activeSession.currentHull,
              progress: status.activeSession.progress,
            });
          }
        } else {
          const start = await startFlight({ rocketId, symbol: rocketSymbol });
          activeSymbol = start.session.symbol || rocketSymbol;
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

  useEffect(() => {
    if (round !== 1) {
      setPhaseOneHintStep(0);
    }
  }, [round]);

  useEffect(() => {
    if (view === "round" && round === 1) {
      blackHolePulse.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(blackHolePulse, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(blackHolePulse, {
            toValue: 0,
            duration: 1800,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    blackHolePulse.stopAnimation();
    blackHolePulse.setValue(0);
    return undefined;
  }, [blackHolePulse, round, view]);

  useEffect(() => {
    if (view === "round" && round === 2) {
      shakePulse.setValue(0);
      const loop = Animated.loop(
        Animated.timing(shakePulse, {
          toValue: 1,
          duration: 520,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    }
    shakePulse.stopAnimation();
    shakePulse.setValue(0);
    return undefined;
  }, [round, shakePulse, view]);

  useEffect(() => {
    if (view === "round" && round === 3) {
      twinkleA.setValue(0);
      twinkleB.setValue(0);
      const loopA = Animated.loop(
        Animated.sequence([
          Animated.timing(twinkleA, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(twinkleA, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      );
      const loopB = Animated.loop(
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(twinkleB, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(twinkleB, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      );
      loopA.start();
      loopB.start();
      return () => {
        loopA.stop();
        loopB.stop();
      };
    }
    twinkleA.stopAnimation();
    twinkleB.stopAnimation();
    twinkleA.setValue(0);
    twinkleB.setValue(0);
    return undefined;
  }, [round, twinkleA, twinkleB, view]);

  useEffect(() => {
    if (view === "round" && round === 4) {
      radioPulse.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(radioPulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(radioPulse, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    radioPulse.stopAnimation();
    radioPulse.setValue(0);
    return undefined;
  }, [radioPulse, round, view]);

  useEffect(() => {
    if (view === "round" && round === 5) {
      explosionA.setValue(0);
      explosionB.setValue(0);
      explosionC.setValue(0);
      explosionD.setValue(0);
      const makeLoop = (value: Animated.Value, delay: number, duration: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(value, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        );
      const loopA = makeLoop(explosionA, 100, 720);
      const loopB = makeLoop(explosionB, 360, 760);
      const loopC = makeLoop(explosionC, 620, 680);
      const loopD = makeLoop(explosionD, 880, 740);
      loopA.start();
      loopB.start();
      loopC.start();
      loopD.start();
      return () => {
        loopA.stop();
        loopB.stop();
        loopC.stop();
        loopD.stop();
      };
    }
    explosionA.stopAnimation();
    explosionB.stopAnimation();
    explosionC.stopAnimation();
    explosionD.stopAnimation();
    explosionA.setValue(0);
    explosionB.setValue(0);
    explosionC.setValue(0);
    explosionD.setValue(0);
    return undefined;
  }, [explosionA, explosionB, explosionC, explosionD, round, view]);

  const handleOutcomeEnd = useCallback(() => {
    if (pendingFinalKey) {
      setFinalOutcomeKey(pendingFinalKey);
      setPendingFinalKey(null);
      setOutcomeKey(null);
      setPendingRound(null);
      setView("finalPrompt");
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

  const handleRestart = useCallback(() => {
    nav.reset({ index: 0, routes: [{ name: "RocketSelect" }] });
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
      message: `Phase ${round} / ${MAX_ROUNDS} briefing active`,
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
    return <ChartScreen data={gsiData} onBack={() => setView("cockpit")} symbol={symbol} round={round}/>;
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

  if (view === "finalPrompt" && finalOutcomeKey) {
    return (
      <View style={s.root}>
        <View style={[s.frame, { width: frame.width, height: frame.height }]}>
          {windowLayer}
          <View style={s.finalPromptContent}>
            <View style={s.finalPromptCard}>
              <Text style={s.finalPromptTitle}>과연 도지는 화성에 안전하게 도착했을까요?</Text>
              <Pressable
                style={({ pressed }) => [s.finalPromptButton, pressed && s.finalPromptButtonPressed]}
                onPress={() => setView("final")}
              >
                <Text style={s.finalPromptButtonText}>결과 확인하기</Text>
              </Pressable>
            </View>
          </View>
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
              <View style={s.finalActions}>
                <Pressable style={({ pressed }) => [s.finalActionButton, pressed && s.finalActionPressed]} onPress={handleRestart}>
                  <Text style={s.finalActionText}>RESTART</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.finalActionButton, s.finalActionButtonSecondary, pressed && s.finalActionPressed]}
                  onPress={handleLogout}
                >
                  <Text style={s.finalActionText}>LOG OUT</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (view === "round") {
    const shakeStyle =
      round === 2
        ? {
            transform: [{ translateX: shakeX }, { translateY: shakeY }, { rotate: shakeRotate }],
          }
        : null;
    return (
      <View style={s.root}>
        <View style={[s.frame, { width: frame.width, height: frame.height }]}>
          <Animated.View style={[s.roundBackground, shakeStyle]} pointerEvents="none">
            {windowLayer}
            {round === 1 ? (
              <View style={s.blackHoleLayer}>
                <Animated.View
                  style={[
                    s.blackHoleHalo,
                    { opacity: blackHoleHaloOpacity, transform: [{ scale: blackHoleHaloScale }] },
                  ]}
                />
                <Animated.View
                  style={[
                    s.blackHoleRing,
                    { opacity: blackHoleOpacity, transform: [{ scale: blackHoleScale }, { rotate: blackHoleRotate }] },
                  ]}
                />
                <View style={s.blackHoleCore} />
              </View>
            ) : null}
            {round === 3 ? (
              <View style={s.starLayer}>
                {STAR_POSITIONS.map((star, index) => {
                  const opacity = index % 2 === 0 ? twinkleOpacityA : twinkleOpacityB;
                  return (
                    <Animated.View
                      key={`star-${index}`}
                      style={[
                        s.star,
                        { width: star.size, height: star.size, top: star.top, left: star.left, opacity },
                      ]}
                    />
                  );
                })}
              </View>
            ) : null}
            {round === 4 ? (
              <View style={s.radioLayer}>
                <View style={s.radioSource} />
                <Animated.View style={[s.radioRing, { opacity: radioOpacityA, transform: [{ scale: radioScaleA }] }]} />
                <Animated.View style={[s.radioRing, { opacity: radioOpacityB, transform: [{ scale: radioScaleB }] }]} />
                <Animated.View style={[s.radioRing, { opacity: radioOpacityC, transform: [{ scale: radioScaleC }] }]} />
              </View>
            ) : null}
            {round === 5 ? (
              <View style={s.explosionLayer}>
                <Animated.View
                  style={[
                    s.explosionBurst,
                    { top: "18%", left: "16%", opacity: explosionOpacityA, transform: [{ scale: explosionScaleA }] },
                  ]}
                >
                  <View style={s.explosionCore} />
                  <View style={s.explosionSpark} />
                  <View style={s.explosionSparkAlt} />
                </Animated.View>
                <Animated.View
                  style={[
                    s.explosionBurst,
                    { top: "12%", right: "18%", opacity: explosionOpacityB, transform: [{ scale: explosionScaleB }] },
                  ]}
                >
                  <View style={s.explosionCore} />
                  <View style={s.explosionSpark} />
                  <View style={s.explosionSparkAlt} />
                </Animated.View>
                <Animated.View
                  style={[
                    s.explosionBurst,
                    { bottom: "22%", left: "24%", opacity: explosionOpacityC, transform: [{ scale: explosionScaleC }] },
                  ]}
                >
                  <View style={s.explosionCore} />
                  <View style={s.explosionSpark} />
                  <View style={s.explosionSparkAlt} />
                </Animated.View>
                <Animated.View
                  style={[
                    s.explosionBurst,
                    { bottom: "18%", right: "20%", opacity: explosionOpacityD, transform: [{ scale: explosionScaleD }] },
                  ]}
                >
                  <View style={s.explosionCore} />
                  <View style={s.explosionSpark} />
                  <View style={s.explosionSparkAlt} />
                </Animated.View>
              </View>
            ) : null}
          </Animated.View>
          <View style={s.roundContent}>
            <View style={s.roundCard}>
              <Text style={s.roundEyebrow}>{phaseLabel}</Text>
              {phaseCopy ? <Text style={s.roundCopy}>{phaseCopy}</Text> : null}
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
        {round === 1 && view === "cockpit" && phaseOneHintStep < PHASE_ONE_HINTS.length ? (
          <View style={[s.phaseOneHint, { left: contentPaddingX, right: contentPaddingX }]}>
            <Text style={s.phaseOneHintText}>{PHASE_ONE_HINTS[phaseOneHintStep]}</Text>
            <Pressable
              style={({ pressed }) => [s.phaseOneHintButton, pressed && s.phaseOneHintButtonPressed]}
              onPress={() => setPhaseOneHintStep((prev) => Math.min(prev + 1, PHASE_ONE_HINTS.length))}
            >
              <Text style={s.phaseOneHintButtonText}>확인</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={s.console} pointerEvents="none">
          <View style={s.consoleEdge} />
          <View style={s.consoleGlow} />
        </View>

        <View style={[s.content, { paddingTop: contentTop, paddingHorizontal: contentPaddingX, paddingBottom: contentPaddingBottom }]}>
          <View style={[s.panelRow, { gap: panelGap }]}>
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
              <Text style={s.roundBadge}>{`PHASE ${round} / ${MAX_ROUNDS}`}</Text>
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
  outcomeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
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
  phaseOneHint: {
    position: "absolute",
    top: 12,
    left: 24,
    right: 24,
    paddingVertical: 8,
    paddingHorizontal: 12,
    paddingRight: 56,
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(4,7,14,0.6)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
  },
  phaseOneHintText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  phaseOneHintButton: {
    position: "absolute",
    right: 10,
    bottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.accentBorderStrong,
    backgroundColor: "rgba(234,88,12,0.7)",
  },
  phaseOneHintButtonPressed: { transform: [{ scale: 0.97 }] },
  phaseOneHintButtonText: { color: theme.colors.textPrimary, fontWeight: "800", fontSize: 10, letterSpacing: 0.5 },
  roundBackground: { ...StyleSheet.absoluteFillObject },
  blackHoleLayer: {
    position: "absolute",
    top: "6%",
    left: "4%",
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  blackHoleHalo: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(251,191,36,0.35)",
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  blackHoleRing: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "rgba(234,88,12,0.55)",
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  blackHoleCore: {
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.9)",
    shadowColor: "rgba(0,0,0,0.9)",
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 6,
  },
  starLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(251,191,36,0.9)",
  },
  radioLayer: {
    position: "absolute",
    top: "8%",
    right: "6%",
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSource: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(56,189,248,0.9)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,0.8)",
  },
  radioRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(125,211,252,0.7)",
    backgroundColor: "rgba(14,116,144,0.05)",
  },
  explosionLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  explosionBurst: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(251,191,36,0.9)",
    backgroundColor: "rgba(249,115,22,0.35)",
    shadowColor: "rgba(234,88,12,0.9)",
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  explosionCore: {
    width: "42%",
    height: "42%",
    borderRadius: 999,
    backgroundColor: "rgba(254,215,170,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    shadowColor: "rgba(255,237,213,0.9)",
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
  },
  explosionSpark: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 999,
    top: "12%",
    right: "16%",
    backgroundColor: "rgba(254,215,170,0.85)",
  },
  explosionSparkAlt: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 999,
    bottom: "18%",
    left: "14%",
    backgroundColor: "rgba(255,255,255,0.7)",
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
  finalPromptContent: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
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
  finalPromptCard: {
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
  finalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  finalActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.accentBorderStrong,
    backgroundColor: "rgba(234,88,12,0.85)",
  },
  finalActionButtonSecondary: { backgroundColor: "rgba(0,0,0,0.35)", borderColor: theme.colors.accentBorderSoft },
  finalActionPressed: { transform: [{ scale: 0.97 }] },
  finalActionText: { color: theme.colors.textPrimary, fontWeight: "900", fontSize: 12, letterSpacing: 0.8 },
  finalPromptTitle: { color: theme.colors.textPrimary, fontWeight: "900", fontSize: 18, lineHeight: 26, textAlign: "center" },
  finalPromptButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(234,88,12,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.accentBorderStrong,
  },
  finalPromptButtonPressed: { transform: [{ scale: 0.97 }] },
  finalPromptButtonText: { color: theme.colors.textPrimary, fontWeight: "900", letterSpacing: 0.8 },
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
