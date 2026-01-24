import React, { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation";
import TrajectoryGSIChart from "../components/TrajectoryGSIChart";
import ChartScreen from "./ChartScreen";
import InfoScreen from "./InfoScreen";

type StatusItem = {
  label: string;
  value: string;
  color: string;
};

function generateGsiData(points: number) {
  const data: number[] = [];
  for (let i = 0; i < points; i += 1) {
    const base = 70 + Math.sin(i * 0.35) * 8;
    const jitter = (Math.random() - 0.5) * 6;
    data.push(Math.max(40, Math.min(95, base + jitter)));
  }
  return data;
}

export default function CockpitScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "Cockpit">>();
  const rocketId = route.params?.rocketId ?? 1;
  const { width, height } = useWindowDimensions();
  const [view, setView] = useState<"cockpit" | "chart" | "info">("cockpit");
  const [leverPosition, setLeverPosition] = useState<"up" | "down">("down");

  const gsiData = useMemo(() => generateGsiData(40), []);

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

  const chartWidth = Math.max(200, Math.min(frame.width * 0.33, 260));
  const chartHeight = Math.max(120, Math.min(frame.height * 0.45, 180));
  const trackHeight = 170;
  const knobHeight = 30;
  const topInset = 16;
  const bottomInset = 18;
  const knobBottom = leverPosition === "down" ? bottomInset : trackHeight - topInset - knobHeight;
  const swipeThreshold = 18;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy <= -swipeThreshold) setLeverPosition("up");
        else if (gesture.dy >= swipeThreshold) setLeverPosition("down");
      },
      onPanResponderTerminate: (_, gesture) => {
        if (gesture.dy <= -swipeThreshold) setLeverPosition("up");
        else if (gesture.dy >= swipeThreshold) setLeverPosition("down");
      },
    })
  ).current;

  const statusItems: StatusItem[] = [
    { label: "Engine", value: "Optimal", color: "#22c55e" },
    { label: "Hull", value: "Nominal", color: "#fbbf24" },
    { label: "Life Support", value: "Active", color: "#22c55e" },
  ];

  if (view === "chart") {
    return <ChartScreen data={gsiData} onBack={() => setView("cockpit")} />;
  }

  if (view === "info") {
    return <InfoScreen rocketId={rocketId} onBack={() => setView("cockpit")} />;
  }

  return (
    <View style={s.root}>
      <View style={[s.frame, { width: frame.width, height: frame.height }]}>
        <View style={s.bg} />
        <View style={s.topPanel} pointerEvents="none" />
        <View style={s.bottomPanel} pointerEvents="none" />

        <View style={s.content}>
          <View style={s.panel}>
            <Text style={s.panelTitle}>GRAVITY WAVE MONITOR</Text>
            <View style={s.screen}>
              <TrajectoryGSIChart data={gsiData} width={chartWidth} height={chartHeight} />
            </View>
            <View style={s.statusRow}>
              <View style={[s.statusDot, { backgroundColor: "#22c55e" }]} />
              <Text style={s.statusText}>Stable signal</Text>
            </View>
            <Pressable style={({ pressed }) => [s.actionButton, pressed && s.actionPressed]} onPress={() => setView("chart")}>
              <Text style={s.actionText}>VIEW CHART</Text>
            </Pressable>
          </View>

          <View style={s.centerPanel}>
            <Text style={s.panelTitle}>FUEL CONTROL</Text>
            <View style={s.fuelWrap}>
              <Text style={s.fuelLabel}>CHOOSE ACTION</Text>
            </View>
            <View style={s.leverTrack}>
              <View style={s.leverStem} />
              <View style={[s.leverKnob, { bottom: knobBottom }]} {...panResponder.panHandlers}>
                <View style={s.leverKnobInner} />
              </View>
            </View>
            <Text style={s.fuelHint}>Swipe up or down to choose</Text>
          </View>

          <View style={s.panel}>
            <Text style={s.panelTitle}>SHIP STATUS</Text>
            <View style={s.statusList}>
              {statusItems.map((item) => (
                <View key={item.label} style={s.statusCard}>
                  <Text style={s.statusLabel}>{item.label}</Text>
                  <Text style={[s.statusValue, { color: item.color }]}>{item.value}</Text>
                </View>
              ))}
            </View>
            <Pressable style={({ pressed }) => [s.actionButton, pressed && s.actionPressed]} onPress={() => setView("info")}>
              <Text style={s.actionText}>DETAILS</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
  frame: { backgroundColor: "#05070f", borderRadius: 16, overflow: "hidden" },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0b0f1c" },
  topPanel: { position: "absolute", top: 0, left: 0, right: 0, height: 40, backgroundColor: "rgba(17,24,39,0.6)" },
  bottomPanel: { position: "absolute", bottom: 0, left: 0, right: 0, height: 48, backgroundColor: "rgba(17,24,39,0.6)" },
  content: { flex: 1, flexDirection: "row", padding: 16, gap: 12 },
  panel: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.78)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
  },
  centerPanel: {
    flex: 0.9,
    backgroundColor: "rgba(17,24,39,0.78)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
    alignItems: "center",
  },
  panelTitle: { color: "#fbbf24", fontWeight: "800", fontSize: 12, letterSpacing: 0.8, marginBottom: 10 },
  screen: { borderRadius: 12, padding: 8, backgroundColor: "rgba(0,0,0,0.35)" },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 10, marginBottom: 12, gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  statusText: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  actionButton: {
    marginTop: "auto",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.5)",
    backgroundColor: "rgba(234,88,12,0.4)",
  },
  actionPressed: { transform: [{ scale: 0.98 }] },
  actionText: { color: "white", fontWeight: "800", fontSize: 11, textAlign: "center", letterSpacing: 0.8 },
  fuelWrap: { alignItems: "center", marginTop: 4, width: "100%" },
  fuelLabel: { color: "rgba(251,191,36,0.7)", fontSize: 11, marginBottom: 8, letterSpacing: 0.6 },
  leverTrack: {
    width: 64,
    height: 170,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 18,
  },
  leverStem: { position: "absolute", width: 6, top: 16, bottom: 16, borderRadius: 999, backgroundColor: "rgba(251,191,36,0.25)" },
  leverKnob: {
    position: "absolute",
    width: 46,
    height: 30,
    borderRadius: 12,
    backgroundColor: "rgba(234,88,12,0.75)",
    borderWidth: 2,
    borderColor: "rgba(251,191,36,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  leverKnobInner: { width: 18, height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.6)" },
  fuelHint: { marginTop: 10, color: "rgba(255,255,255,0.65)", fontSize: 10 },
  statusList: { gap: 10 },
  statusCard: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.2)",
  },
  statusLabel: { color: "rgba(251,191,36,0.7)", fontSize: 10, marginBottom: 4, letterSpacing: 0.6 },
  statusValue: { fontWeight: "800", fontSize: 12 },
});
