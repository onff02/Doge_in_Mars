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
import type { AnalysisResult, GameSession, MarketPhase, RoundLog } from "../api/client";
import { analyzeDecisions, clearAuthSession, getChart, getFlightStatus, getRockets, startFlight, syncFlight, resetFlight } from "../api/client";

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

const BACKGROUNDS: Record<number, any> = {
  0: require("../../assets/correction0.png"),
  1: require("../../assets/correction1.png"),
  2: require("../../assets/correction2.png"),
  3: require("../../assets/correction3.png"),
  4: require("../../assets/cockpit.png"), // [요청사항] 현재 배경을 4개일 때 사용
  5: require("../../assets/correction5.png"),
};

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

const MARKET_PHASES: Record<number, MarketPhase> = {
  1: "systemic_crash",
  2: "high_volatility",
  3: "expansion",
  4: "regulatory_fog",
  5: "bubble_collapse",
  6: "final_approach",
};

const ROCKET_TYPES: Record<string, "growth" | "bluechip" | "defensive"> = {
  NVDA: "growth",
  AAPL: "bluechip",
  KO: "defensive",
};

const ROUND_UPDATES: Record<number, Record<string, string[]>> = {
  1: {
    NVDA: [
      "인근 고출력 함선들이 단기 가속에 성공하고 있습니다",
      "선원들 사이에서 \"지금이 기회\"라는 낙관 무전이 증가 중입니다",
      "일부 파일럿은 출력 증폭으로 항로를 돌파했습니다",
      "중력 간섭이 고출력 엔진에 더 크게 작용하고 있습니다",
      "장거리 예측 모듈의 오차가 임계치를 초과했습니다",
    ],
    AAPL: [
      "대형 함선들이 안정 항로를 유지하며 전진 중입니다",
      "\"이 정도 환경은 충분히 견딜 수 있다\"는 의견이 우세합니다",
      "방어막이 유지되는 한 전진 시도도 가능해 보입니다",
      "추진 여유가 빠르게 감소하고 있습니다",
      "전진 대비 회복 비용이 점점 커지고 있습니다",
    ],
    KO: [
      "주변 항로의 빠른 전진과 비교하면 정체가 두드러집니다",
      "일부는 \"지금 올라타지 않으면 뒤처진다\"고 주장합니다",
      "출력 변화에도 항로 이탈 가능성이 낮습니다",
      "보급 모듈이 환경 변화에 거의 영향을 받지 않습니다",
      "느리지만 안정적인 전진이 관측됩니다",
    ],
  },
  2: {
    NVDA: [
      "짧은 가속으로 큰 이동에 성공한 사례가 반복 보고됩니다",
      "\"타이밍만 맞으면 큰 보상\"이라는 무전이 확산 중입니다",
      "주변 소형 함선들이 빠르게 치고 나가고 있습니다",
      "출력 조작에 따른 결과 편차가 극단적으로 커졌습니다",
      "실패 시 손실 회복이 어려운 구간입니다",
    ],
    AAPL: [
      "항로 중심선이 자주 흔들리고 있습니다",
      "외부 소음이 잦아 조작 판단이 어렵습니다",
      "노이즈 이후 항로 복구 빈도가 높습니다",
      "급격한 조작 없이도 전진이 누적됩니다",
      "방어와 전진의 균형이 유지되고 있습니다",
    ],
    KO: [
      "결정적인 가속 신호는 여전히 희미합니다",
      "주변 항로와 비교하면 이동 속도가 느립니다",
      "환경 변화에도 출력이 거의 변하지 않습니다",
      "전진 결과의 분산이 작습니다",
      "안정적 누적 이동이 관측됩니다",
    ],
  },
  3: {
    NVDA: [
      "과열 경고가 점등되기 시작했습니다",
      "일부 파일럿은 \"지금은 너무 빠르다\"고 우려합니다",
      "출력 증폭이 리스크를 키운다는 분석도 존재합니다",
      "고출력 상태에서 항로 저항이 급감합니다",
      "출력 증가가 즉각적인 전진으로 연결됩니다",
    ],
    AAPL: [
      "급격한 가속이 없어 체감 속도가 느립니다",
      "\"지루한 항로\"라는 평가가 일부에서 나옵니다",
      "지금은 다른 함선이 더 매력적으로 보입니다",
      "출력 없이도 위치가 꾸준히 개선됩니다",
      "방향성은 일관되게 유지됩니다",
    ],
    KO: [
      "큰 이동이 없어 전진이 눈에 띄지 않습니다",
      "일부는 \"이 환경에서 굳이?\"라고 의문을 제기합니다",
      "기회 비용이 커 보입니다",
      "항로 전체가 완만한 전진 흐름을 보입니다",
      "손실 신호 없이 위치가 개선됩니다",
    ],
  },
  4: {
    NVDA: [
      "통제 필드가 예고 없이 작동하는 구간이 있습니다",
      "실패 시 손실이 크다는 경고가 반복됩니다",
      "일부 파일럿은 접근 자체를 회피 중입니다",
      "고출력 엔진이 통제 구간을 우회하는 반응을 보입니다",
      "위험 구간 돌파 시 전진 폭이 큽니다",
    ],
    AAPL: [
      "선체 안정성이 여전히 신뢰를 주고 있습니다",
      "집단 이동 선단이 전진을 선택했습니다",
      "\"지금은 유지보다 전진\"이라는 의견도 존재합니다",
      "추가 점검 절차로 추진 효율이 감소했습니다",
      "전진 대비 소모가 커지고 있습니다",
    ],
    KO: [
      "방어적 항해가 심리적으로 답처럼 보입니다",
      "\"천천히라도 가는 게 낫다\"는 무전이 반복됩니다",
      "주변 함선들이 미세 전진을 이어가고 있습니다",
      "확장 시 손실 누적 패턴이 감지됩니다",
      "유지 전략이 상대적으로 유리해 보입니다",
    ],
  },
  5: {
    ALL: [
      "인근 항로에서 예상 외의 반등 로그가 포착되었습니다",
      "일부 함선이 고출력 돌파로 단기 성공을 보고했습니다",
      "\"이 정도 공포는 과하다\"는 의견이 늘어나고 있습니다",
      "출력 대비 손실 비율이 전반적으로 증가했습니다",
      "실패 후 회복 시간이 길어지고 있습니다",
    ],
  },
  6: {
    ALL: [
      "일부는 \"지금이 마지막 고점\"이라고 경고합니다",
      "과도한 낙관이 위험하다는 분석도 병존합니다",
      "작은 충격에도 조정이 올 수 있다는 의견이 있습니다",
      "환경과 엔진 반응의 정렬도가 높아졌습니다",
      "전진 결과가 예측과 점점 일치합니다",
    ],
  },
};

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
  const [decisionLog, setDecisionLog] = useState<RoundLog[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState("");
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
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const screenWidth = clamp(Math.round(frame.width * 0.22), 160, Math.round(frame.width * 0.28));
  const screenHeight = clamp(Math.round(frame.height * 0.16), 115, Math.round(frame.height * 0.22));
  
  // 1. screenTop 위치를 약간 아래로 조정 (사진상 검정 칸 위치)
  const screenTop = clamp(Math.round(frame.height * 0.65), 0, frame.height - screenHeight - 10);
  
  // 2. 화면 안쪽으로 더 들어오도록 screenInsetX 조정
  const screenInsetX = clamp(Math.round(frame.width * 0.18), 35, Math.round(frame.width * 0.25));
  
  const screenPad = clamp(Math.round(screenWidth * 0.06), 10, 18);
  const screenInnerWidth = Math.max(0, screenWidth - screenPad * 2);
  const screenInnerHeight = Math.max(0, screenHeight - screenPad * 2);
  const chartPanelWidth = Math.round(screenInnerWidth * 0.9);
  const chartPanelOffset = Math.max(0, screenInnerWidth - chartPanelWidth);
  
  // 3. 미세 조정을 위한 Offset 값 변경
  const screenOffsetX = Math.round(frame.width * 0.01); // 수평 중앙 정렬 최적화
  const screenOffsetY = Math.round(frame.height * 0.04); // 수직 정렬 최적화
  
  const screenTopInner = screenTop + screenPad - screenOffsetY;
  const leftScreenX = screenInsetX + screenPad - screenOffsetX + 6 + chartPanelOffset; // 오른쪽 끝 고정 + 너비 축소
  const rightScreenX = Math.round(frame.width - screenInsetX - screenWidth + screenPad + screenOffsetX);
  const leverWidth = clamp(Math.round(frame.width * 0.17), 120, 200);
  const centerHeight = clamp(Math.round(frame.height * 0.28), 200, 300);
  const leverTop = clamp(Math.round(screenTop - frame.height * 0.03), 0, frame.height - centerHeight - 16);
  const leverLeft = Math.round((frame.width - leverWidth) / 2);
  const sidePanelWidth = chartPanelWidth;
  const updatesPanelWidth = screenInnerWidth;
  const sidePanelPadding = 6;
  const chartWindowPadding = 0;
  const chartReservedHeight = 18;
  const chartMaxHeight = Math.max(0, screenInnerHeight - sidePanelPadding * 2 - chartReservedHeight);
  const chartWidth = Math.max(0, sidePanelWidth - sidePanelPadding * 2 - chartWindowPadding * 2);
  const chartHeight = Math.max(0, chartMaxHeight);
  const trackHeight = Math.max(110, Math.min(centerHeight * 0.58, 140));
  const handleHeight = 40;
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

  const currentBg = useMemo(() => {
    const index = Math.min(Math.max(correctCount, 0), 6);
    return BACKGROUNDS[index] || BACKGROUNDS[4];
  }, [correctCount]);

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
        // 진행 중인 세션의 로켓 ID와 현재 선택한 rocketId가 다른 경우
          if (status.activeSession.rocket.id !== rocketId) {
            console.log("로켓이 변경되었습니다. 기존 세션을 초기화하고 새로 시작합니다.");
            await resetFlight(); // 기존 애플 세션 삭제
            const start = await startFlight({ rocketId, symbol: rocketName }); // 코카콜라 세션 생성
            activeSymbol = start.session.symbol;
          } else {
            // 로켓이 같으면 기존 세션 유지 (이어하기)
            activeSymbol = status.activeSession.symbol;
          }
        } else {
          // 세션이 아예 없으면 새로 시작
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

  const runAnalysis = useCallback(async () => {
    if (analysisStatus === "loading") return;
    if (!decisionLog.length) {
      setAnalysisResult(null);
      setAnalysisStatus("done");
      return;
    }

    try {
      setAnalysisStatus("loading");
      setAnalysisError("");
      const rocketSymbol = (symbol || "NVDA").toUpperCase();
      const session: GameSession = {
        rocket: rocketSymbol,
        rocketType: ROCKET_TYPES[rocketSymbol] ?? "growth",
        rounds: decisionLog,
        summary: {
          accuracy: Number((correctCount / MAX_ROUNDS).toFixed(2)),
          fuelLeft: telemetry.fuel ?? 0,
          hullIntegrity: telemetry.hull ?? 0,
        },
      };
      const result = await analyzeDecisions(session);
      setAnalysisResult(result.analysis ?? null);
      setAnalysisStatus("done");
    } catch (e) {
      setAnalysisStatus("error");
      setAnalysisError(e instanceof Error ? e.message : "분석 요청에 실패했습니다.");
    }
  }, [analysisStatus, correctCount, decisionLog, symbol, telemetry.fuel, telemetry.hull]);
  
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
      const correctDirection = ROUND_ANSWERS[round]?.[symbol] ?? ROUND_ANSWERS[round]?.default ?? "up";
      const isCorrect = chosenDirection === correctDirection;
      const nextCorrectCount = correctCount + (isCorrect ? 1 : 0);
      setDecisionLog((prev) => {
        const symbolKey = (symbol || "NVDA").toUpperCase();
        const updatesForRound = ROUND_UPDATES[round]?.[symbolKey] ?? ROUND_UPDATES[round]?.ALL ?? [];
        const roundLog: RoundLog = {
          round,
          marketPhase: MARKET_PHASES[round] ?? "expansion",
          updates: updatesForRound.slice(0, 5),
          userChoice: chosenDirection,
          correctAnswer: correctDirection,
        };
        return [...prev, roundLog];
      });
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
      items.push({ time: "00:40", message: `Alert: ${error}`, tone: "warning" });
    }

    const times = ["00:34", "00:31", "00:28", "00:25", "00:22"];
    const roundKey = Math.min(Math.max(round, 1), MAX_ROUNDS);
    const symbolKey = (symbol || "NVDA").toUpperCase();
    const selectedUpdates = ROUND_UPDATES[roundKey]?.[symbolKey] ?? ROUND_UPDATES[roundKey]?.ALL ?? [];
    const toneOrder: UpdateItem["tone"][] = ["warning", "warning", "warning", "success", "success"];
    const mapped = selectedUpdates.map((text, index) => ({
      time: times[index] ?? "00:20",
      message: text,
      tone: toneOrder[index] ?? "warning",
    }));
    return items.concat(mapped);
  }, [error, round, symbol]);

  const panelUpdates = updates.slice(0, 5);
  // [수정] windowLayer 구성 (배경 이미지 동적 적용)
  const windowLayer = (
    <View style={s.window} pointerEvents="none">
      <ImageBackground source={currentBg} style={StyleSheet.absoluteFillObject} resizeMode="stretch">
        <View style={s.windowOverlay} />
      </ImageBackground>
      <View style={s.glassSheen} />
      <View style={s.glassSheenSecondary} />
      <View style={s.windowRim} />
    </View>
  );

  // [수정] cockpitWindowLayer 구성 (배경 이미지 동적 적용)
  const cockpitWindowLayer = (
    <View style={s.window} pointerEvents="none">
      <ImageBackground source={currentBg} style={StyleSheet.absoluteFillObject} resizeMode="stretch" />
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
              <View style={s.analysisBlock}>
                <Pressable
                  style={({ pressed }) => [
                    s.analysisButton,
                    analysisStatus === "loading" && s.analysisButtonDisabled,
                    pressed && analysisStatus !== "loading" && s.analysisButtonPressed,
                  ]}
                  onPress={runAnalysis}
                  disabled={analysisStatus === "loading"}
                >
                  <Text style={s.analysisButtonText}>
                    {analysisStatus === "loading" ? "분석 중..." : analysisStatus === "done" ? "다시 분석" : "AI 분석"}
                  </Text>
                </Pressable>
                {analysisStatus === "idle" ? (
                  <Text style={s.analysisHint}>AI 분석 버튼을 눌러 성향을 확인하세요.</Text>
                ) : (
                  <Text style={s.analysisResult}>
                    {analysisStatus === "error"
                      ? analysisError || "분석 요청에 실패했습니다."
                      : analysisResult
                        ? JSON.stringify(analysisResult, null, 2)
                        : "분석 결과가 없습니다."}
                  </Text>
                )}
              </View>
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
                        { width: star.size, height: star.size, top: star.top as any, left: star.left as any, opacity },
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
        {cockpitWindowLayer}
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

        <View style={s.content}>
          <View style={s.panelStage}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setView("chart")}
              style={({ pressed }) => [
                s.sidePanel,
                { width: sidePanelWidth, height: screenInnerHeight, left: leftScreenX, top: screenTopInner },
                pressed && s.panelPressed,
              ]}
            >
              <Text style={s.panelTitle}>GSI CHART</Text>
              <View style={s.chartWindow}>
                <TrajectoryGSIChart data={gsiData} width={chartWidth} height={chartHeight} />
              </View>
            </Pressable>

            <View style={[s.leverPanel, { width: leverWidth, height: centerHeight, left: leverLeft, top: leverTop }]}>
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
                s.sidePanelTight,
                s.sidePanelRightTight,
                { width: updatesPanelWidth, height: screenInnerHeight, left: rightScreenX, top: screenTopInner },
                pressed && s.panelPressed,
              ]}
            >
              <Text style={[s.panelTitle, s.panelTitleTight]}>UPDATES</Text>
              <View style={s.updateList}>
                {panelUpdates.map((item, index) => (
                  <View key={`${item.time}-${index}`} style={s.updateRow}>
                    <View style={[s.updateDot, { backgroundColor: theme.colors.accent }]} />
                    <Text style={s.updateTimeOnly}>{item.time}</Text>
                  </View>
                ))}
              </View>
              <Text style={[s.panelHint, s.panelHintCompact]}>Tap to expand</Text>
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
  windowOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.12)" },
  windowAurora: {
    position: "absolute",
    width: "140%",
    height: "140%",
    top: "-20%",
    left: "-10%",
    backgroundColor: "rgba(14,116,144,0.18)",
    transform: [{ rotate: "-8deg" }],
  },
  windowAuroraAlt: {
    position: "absolute",
    width: "120%",
    height: "90%",
    top: "20%",
    left: "-10%",
    backgroundColor: "rgba(234,88,12,0.12)",
    transform: [{ rotate: "6deg" }],
  },
  windowVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  windowFrame: { ...StyleSheet.absoluteFillObject },
  frameBeamTop: {
    position: "absolute",
    top: 0,
    left: "-5%",
    right: "-5%",
    height: 26,
    backgroundColor: "rgba(8,12,20,0.9)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(56,189,248,0.25)",
  },
  frameBeamBottom: {
    position: "absolute",
    bottom: 0,
    left: "-6%",
    right: "-6%",
    height: 28,
    backgroundColor: "rgba(6,10,16,0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(251,191,36,0.25)",
  },
  frameBeamLeft: {
    position: "absolute",
    left: -18,
    top: "6%",
    bottom: "6%",
    width: 30,
    backgroundColor: "rgba(7,11,18,0.9)",
    borderRightWidth: 1,
    borderRightColor: "rgba(56,189,248,0.2)",
    transform: [{ rotate: "-6deg" }],
  },
  frameBeamRight: {
    position: "absolute",
    right: -18,
    top: "6%",
    bottom: "6%",
    width: 30,
    backgroundColor: "rgba(7,11,18,0.9)",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(56,189,248,0.2)",
    transform: [{ rotate: "6deg" }],
  },
  frameStrut: {
    position: "absolute",
    height: 12,
    backgroundColor: "rgba(10,14,22,0.9)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(251,191,36,0.25)",
  },
  frameStrutLeft: {
    width: "60%",
    top: "26%",
    left: "-8%",
    transform: [{ rotate: "-12deg" }],
  },
  frameStrutRight: {
    width: "60%",
    top: "26%",
    right: "-8%",
    transform: [{ rotate: "12deg" }],
  },
  frameStrutCenter: {
    width: "18%",
    top: "18%",
    left: "41%",
    height: 18,
    borderRadius: 6,
    backgroundColor: "rgba(12,17,29,0.95)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
  },
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
  hudRingOuter: {
    position: "absolute",
    width: "110%",
    height: "110%",
    top: "-5%",
    left: "-5%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.18)",
  },
  hudRingInner: {
    position: "absolute",
    width: "78%",
    height: "78%",
    top: "11%",
    left: "11%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.2)",
  },
  hudCorner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "rgba(251,191,36,0.45)",
  },
  hudCornerTL: { top: 10, left: 10, borderTopWidth: 2, borderLeftWidth: 2 },
  hudCornerTR: { top: 10, right: 10, borderTopWidth: 2, borderRightWidth: 2 },
  hudCornerBL: { bottom: 10, left: 10, borderBottomWidth: 2, borderLeftWidth: 2 },
  hudCornerBR: { bottom: 10, right: 10, borderBottomWidth: 2, borderRightWidth: 2 },
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
  content: { ...StyleSheet.absoluteFillObject },
  panelStage: { flex: 1 },
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
  analysisBlock: {
    width: "100%",
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.accentBorderSoft,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
  },
  analysisButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.accentBorderStrong,
    backgroundColor: "rgba(234,88,12,0.85)",
  },
  analysisButtonPressed: { transform: [{ scale: 0.97 }] },
  analysisButtonDisabled: { opacity: 0.7 },
  analysisButtonText: { color: theme.colors.textPrimary, fontWeight: "900", fontSize: 12, letterSpacing: 0.8 },
  analysisHint: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 8 },
  analysisResult: { color: theme.colors.textPrimary, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 8 },
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
    position: "absolute",
    backgroundColor: "transparent",
    borderRadius: theme.radius.lg,
    padding: 6,
    borderWidth: 0,
    overflow: "hidden",
  },
  panelPressed: { transform: [{ scale: 0.98 }] },
  sidePanelTight: { padding: 4 },
  sidePanelRightTight: { paddingRight: 0 },
  panelTitle: { color: theme.colors.accent, fontWeight: "800", fontSize: 10, letterSpacing: 1, marginBottom: 2 },
  panelTitleTight: { marginBottom: 2 },
  chartWindow: { borderRadius: theme.radius.md, padding: 0, backgroundColor: "rgba(0,0,0,0.35)" },
  panelMeta: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  statusDot: { width: 3, height: 3, borderRadius: 999 },
  panelMetaText: { color: theme.colors.textMuted, fontSize: 8 },
  errorText: { color: theme.colors.danger, fontSize: 8, marginTop: 3 },
  panelHint: { color: theme.colors.textHint, fontSize: 8, marginTop: 3, letterSpacing: 0.2 },
  panelHintCompact: { marginTop: 4 },
  leverPanel: {
    position: "absolute",
    backgroundColor: "transparent",
    borderRadius: theme.radius.lg,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 54,
    borderWidth: 0,
    alignItems: "center",
  },
  leverWell: { width: 72, alignItems: "center", justifyContent: "center", position: "relative", marginTop: 4 },
  leverTrack: {
    position: "absolute",
    width: 50,
    borderRadius: 16,
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
  leverHandle: { position: "absolute", width: 46, height: 40, alignItems: "center", justifyContent: "flex-start" },
  leverKnob: {
    width: 40,
    height: 14,
    borderRadius: 999,
    backgroundColor: "rgba(234,88,12,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.accentBorderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  leverKnobInset: { width: 18, height: 5, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.35)" },
  leverStem: {
    marginTop: 4,
    width: 5,
    height: 22,
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
  updateList: { gap: 3, marginTop: 2, paddingRight: 0 },
  updateRow: { flexDirection: "row", gap: 3, alignItems: "center" },
  updateDot: { width: 3, height: 3, borderRadius: 999 },
  updateTimeOnly: { color: theme.colors.textAccent, fontSize: 9, letterSpacing: 0.3 },
});
