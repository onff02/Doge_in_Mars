import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import TrajectoryGSIChart from "../components/TrajectoryGSIChart";

interface ChartScreenProps {
  onBack: () => void;
  data: number[];
}

export default function ChartScreen({ onBack, data }: ChartScreenProps) {
  const { width, height } = useWindowDimensions();

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

  const chartWidth = Math.max(240, Math.min(frame.width - 80, 680));
  const chartHeight = Math.max(160, Math.min(frame.height - 160, 260));

  return (
    <View style={s.root}>
      <View style={[s.frame, { width: frame.width, height: frame.height }]}>
        <View style={s.bg} />
        <View style={s.grid} pointerEvents="none">
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={`h-${i}`} style={[s.gridLineH, { top: `${i * 16}%` }]} />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <View key={`v-${i}`} style={[s.gridLineV, { left: `${i * 10}%` }]} />
          ))}
        </View>

        <View style={s.content}>
          <View style={s.header}>
            <Pressable style={({ pressed }) => [s.backButton, pressed && s.backPressed]} onPress={onBack}>
              <Text style={s.backText}>{"< BACK TO COCKPIT"}</Text>
            </Pressable>
            <View style={s.headerCenter}>
              <Text style={s.title}>GRAVITY WAVE ANALYSIS</Text>
              <Text style={s.subtitle}>Real-time monitoring</Text>
            </View>
            <View style={s.headerSpacer} />
          </View>

          <View style={s.chartCard}>
            <TrajectoryGSIChart data={data} width={chartWidth} height={chartHeight} />
          </View>

          <View style={s.footer}>
            <View style={s.footerBadge}>
              <View style={[s.statusDot, { backgroundColor: "#22c55e" }]} />
              <Text style={s.footerText}>STATUS: STABLE</Text>
            </View>
            <Text style={s.footerMeta}>Update: 1s</Text>
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
  grid: { ...StyleSheet.absoluteFillObject, opacity: 0.12 },
  gridLineH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(251,191,36,0.3)" },
  gridLineV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(251,191,36,0.3)" },
  content: { flex: 1, padding: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  backButton: { paddingVertical: 4, paddingHorizontal: 6 },
  backPressed: { transform: [{ scale: 0.97 }] },
  backText: { color: "#fbbf24", fontWeight: "800", fontSize: 11 },
  headerCenter: { alignItems: "center" },
  headerSpacer: { width: 90 },
  title: { color: "#f59e0b", fontWeight: "900", fontSize: 16, letterSpacing: 0.6 },
  subtitle: { color: "rgba(251,191,36,0.6)", fontSize: 10, marginTop: 2 },
  chartCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "rgba(17,24,39,0.78)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  footerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.4)",
  },
  statusDot: { width: 6, height: 6, borderRadius: 99 },
  footerText: { color: "#22c55e", fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  footerMeta: { color: "rgba(251,191,36,0.7)", fontSize: 10 },
});
