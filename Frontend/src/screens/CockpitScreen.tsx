import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation";
import TrajectoryGSIChart from "../components/TrajectoryGSIChart";
import ChartScreen from "./ChartScreen";
import InfoScreen from "./InfoScreen";
import { theme } from "../theme";
import { getAuthToken, getChart, getFlightStatus, startFlight, syncFlight } from "../api/client";

type StatusItem = {
  label: string;
  value: string;
  color: string;
};

type Telemetry = {
  fuel?: number;
  hull?: number;
  progress?: number;
  isStable?: boolean;
  status?: string;
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
  const [telemetry, setTelemetry] = useState<Telemetry>({});
  const [chartValues, setChartValues] = useState<number[]>([]);
  const [stabilityValues, setStabilityValues] = useState<number[]>([]);
  const [symbol, setSymbol] = useState("AAPL");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
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

  const chartWidth = Math.max(200, Math.min(frame.width * 0.33, 260));
  const chartHeight = Math.max(120, Math.min(frame.height * 0.45, 180));
  const trackHeight = 170;
  const knobHeight = 30;
  const topInset = 16;
  const bottomInset = 18;
  const knobBottom = leverPosition === "down" ? bottomInset : trackHeight - topInset - knobHeight;
  const swipeThreshold = 18;

  const updateLeverPosition = useCallback((next: "up" | "down") => {
    setLeverPosition(next);
    setHasInteracted(true);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy <= -swipeThreshold) updateLeverPosition("up");
        else if (gesture.dy >= swipeThreshold) updateLeverPosition("down");
      },
      onPanResponderTerminate: (_, gesture) => {
        if (gesture.dy <= -swipeThreshold) updateLeverPosition("up");
        else if (gesture.dy >= swipeThreshold) updateLeverPosition("down");
      },
    })
  ).current;

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

        const chart = await getChart(activeSymbol, 120);
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
  }, [rocketId, symbol]);

  useEffect(() => {
    if (!hasInteracted || chartValues.length < 2) return;

    let isMounted = true;

    const sync = async () => {
      try {
        const fuelInput = leverPosition === "up" ? 80 : 20;
        const index = Math.min(chartCursor.current, chartValues.length - 1);
        const yValue = chartValues[index];
        const previousYValue = chartValues[index - 1] ?? yValue;
        const response = await syncFlight({ fuelInput, yValue, previousYValue });
        if (isMounted) {
          setTelemetry({
            fuel: response.currentFuel,
            hull: response.currentHull,
            progress: response.progress,
            isStable: response.isStableZone,
            status: response.status,
          });
          chartCursor.current = Math.min(index + 1, chartValues.length - 1);
        }
      } catch (e) {
        if (isMounted) {
          const message = e instanceof Error ? e.message : "Sync failed.";
          setError(message);
        }
      }
    };

    sync();

    return () => {
      isMounted = false;
    };
  }, [chartValues, hasInteracted, leverPosition]);

  const latestChange = stabilityValues[stabilityValues.length - 1] ?? 0;
  const stableSignal = telemetry.isStable ?? latestChange >= 0;
  const signalText = isLoading ? "Loading signal" : stableSignal ? "Stable signal" : "Turbulent signal";
  const signalColor = stableSignal ? theme.colors.success : theme.colors.warning;

  const fuelValue = telemetry.fuel !== undefined ? `${Math.round(telemetry.fuel)}%` : "Optimal";
  const hullValue = telemetry.hull !== undefined ? `${Math.round(telemetry.hull)}%` : "Nominal";
  const fuelColor = telemetry.fuel !== undefined && telemetry.fuel < 30 ? theme.colors.warning : theme.colors.success;
  const hullColor = telemetry.hull !== undefined && telemetry.hull < 30 ? theme.colors.danger : theme.colors.accent;

  const statusItems: StatusItem[] = [
    { label: "Engine", value: stableSignal ? "Stable" : "Turbulent", color: signalColor },
    { label: "Hull", value: hullValue, color: hullColor },
    { label: "Fuel", value: fuelValue, color: fuelColor },
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
              <View style={[s.statusDot, { backgroundColor: signalColor }]} />
              <Text style={s.statusText}>{signalText}</Text>
            </View>
            {error ? <Text style={s.errorText}>{error}</Text> : null}
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
  root: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.black },
  frame: { backgroundColor: theme.colors.frame, borderRadius: theme.radius.xl, overflow: "hidden" },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.bg },
  topPanel: { position: "absolute", top: 0, left: 0, right: 0, height: 40, backgroundColor: theme.colors.panelEdge },
  bottomPanel: { position: "absolute", bottom: 0, left: 0, right: 0, height: 48, backgroundColor: theme.colors.panelEdge },
  content: { flex: 1, flexDirection: "row", padding: 16, gap: 12 },
  panel: {
    flex: 1,
    backgroundColor: theme.colors.panel,
    borderRadius: theme.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.panelBorder,
  },
  centerPanel: {
    flex: 0.9,
    backgroundColor: theme.colors.panel,
    borderRadius: theme.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.panelBorder,
    alignItems: "center",
  },
  panelTitle: { color: theme.colors.accent, fontWeight: "800", fontSize: 12, letterSpacing: 0.8, marginBottom: 10 },
  screen: { borderRadius: theme.radius.md, padding: 8, backgroundColor: theme.colors.track },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 10, marginBottom: 12, gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  statusText: { color: theme.colors.textMuted, fontSize: 11 },
  errorText: { color: theme.colors.danger, fontSize: 10, marginBottom: 6 },
  actionButton: {
    marginTop: "auto",
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    backgroundColor: "rgba(234,88,12,0.4)",
  },
  actionPressed: { transform: [{ scale: 0.98 }] },
  actionText: { color: theme.colors.textPrimary, fontWeight: "800", fontSize: 11, textAlign: "center", letterSpacing: 0.8 },
  fuelWrap: { alignItems: "center", marginTop: 4, width: "100%" },
  fuelLabel: { color: theme.colors.textAccent, fontSize: 11, marginBottom: 8, letterSpacing: 0.6 },
  leverTrack: {
    width: 64,
    height: 170,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.accentBorderSoft,
    backgroundColor: theme.colors.track,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 18,
  },
  leverStem: { position: "absolute", width: 6, top: 16, bottom: 16, borderRadius: 999, backgroundColor: theme.colors.panelBorder },
  leverKnob: {
    position: "absolute",
    width: 46,
    height: 30,
    borderRadius: 12,
    backgroundColor: "rgba(234,88,12,0.75)",
    borderWidth: 2,
    borderColor: theme.colors.accentBorderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  leverKnobInner: { width: 18, height: 6, borderRadius: 999, backgroundColor: theme.colors.textSubtle },
  fuelHint: { marginTop: 10, color: theme.colors.textHint, fontSize: 10 },
  statusList: { gap: 10 },
  statusCard: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.panelBorderSoft,
  },
  statusLabel: { color: theme.colors.textAccent, fontSize: 10, marginBottom: 4, letterSpacing: 0.6 },
  statusValue: { fontWeight: "800", fontSize: 12 },
});
