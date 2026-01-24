import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { theme } from "../theme";

interface InfoScreenProps {
  rocketId: number;
  onBack: () => void;
}

type InfoItem = {
  label: string;
  value: string;
  status: string;
  color: string;
};

const rocketNames = ["PIONEER", "TITAN", "STRIKER"];

export default function InfoScreen({ rocketId, onBack }: InfoScreenProps) {
  const { width, height } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<"internal" | "external">("internal");

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

  const internalData: InfoItem[] = [
    { label: "Cabin Temp", value: "22C", status: "optimal", color: "#22c55e" },
    { label: "Oxygen", value: "98%", status: "optimal", color: "#22c55e" },
    { label: "Power Reserves", value: "87%", status: "good", color: "#fbbf24" },
    { label: "Life Support", value: "Active", status: "optimal", color: "#22c55e" },
  ];

  const externalData: InfoItem[] = [
    { label: "Hull Temp", value: "-180C", status: "normal", color: "#38bdf8" },
    { label: "Shield Integrity", value: "96%", status: "optimal", color: "#22c55e" },
    { label: "Radiation", value: "Low", status: "safe", color: "#22c55e" },
    { label: "Solar Intake", value: "Charging", status: "good", color: "#fbbf24" },
  ];

  const data = activeTab === "internal" ? internalData : externalData;
  const rocketName = rocketNames[rocketId - 1] ?? "ROCKET";
  const columns = frame.width >= 760 ? 3 : 2;
  const gap = 10;
  const cardWidth = (frame.width - 48 - gap * (columns - 1)) / columns;

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
              <Text style={s.title}>{rocketName} DIAGNOSTICS</Text>
              <Text style={s.subtitle}>System overview</Text>
            </View>
            <View style={s.headerSpacer} />
          </View>

          <View style={s.tabs}>
            <Pressable
              onPress={() => setActiveTab("internal")}
              style={({ pressed }) => [
                s.tab,
                activeTab === "internal" && s.tabActive,
                pressed && s.tabPressed,
              ]}
            >
              <Text style={[s.tabText, activeTab === "internal" && s.tabTextActive]}>INTERNAL</Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("external")}
              style={({ pressed }) => [
                s.tab,
                activeTab === "external" && s.tabActive,
                pressed && s.tabPressed,
              ]}
            >
              <Text style={[s.tabText, activeTab === "external" && s.tabTextActive]}>EXTERNAL</Text>
            </Pressable>
          </View>

          <View style={[s.gridWrap, { columnGap: gap, rowGap: gap }]}>
            {data.map((item) => (
              <View key={item.label} style={[s.card, { width: cardWidth }]}>
                <Text style={s.cardLabel}>{item.label}</Text>
                <Text style={[s.cardValue, { color: item.color }]}>{item.value}</Text>
                <View style={s.cardStatus}>
                  <View style={[s.statusDot, { backgroundColor: item.color }]} />
                  <Text style={s.statusText}>{item.status.toUpperCase()}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={s.notice}>
            <View style={[s.statusDot, { backgroundColor: "#22c55e" }]} />
            <Text style={s.noticeText}>All systems nominal</Text>
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
  grid: { ...StyleSheet.absoluteFillObject, opacity: 0.12 },
  gridLineH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(251,191,36,0.3)" },
  gridLineV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(251,191,36,0.3)" },
  content: { flex: 1, padding: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  backButton: { paddingVertical: 4, paddingHorizontal: 6 },
  backPressed: { transform: [{ scale: 0.97 }] },
  backText: { color: theme.colors.accent, fontWeight: "800", fontSize: 11 },
  headerCenter: { alignItems: "center" },
  headerSpacer: { width: 90 },
  title: { color: theme.colors.accentDeep, fontWeight: "900", fontSize: 16, letterSpacing: 0.6 },
  subtitle: { color: "rgba(251,191,36,0.6)", fontSize: 10, marginTop: 2 },
  tabs: { flexDirection: "row", gap: 10, marginBottom: 12 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.panelBorderSoft,
    backgroundColor: "rgba(17,24,39,0.5)",
  },
  tabActive: { backgroundColor: "rgba(234,88,12,0.55)", borderColor: theme.colors.accentBorder },
  tabPressed: { transform: [{ scale: 0.98 }] },
  tabText: { color: "rgba(251,191,36,0.6)", fontWeight: "800", textAlign: "center", fontSize: 11 },
  tabTextActive: { color: theme.colors.textPrimary },
  gridWrap: { flexDirection: "row", flexWrap: "wrap" },
  card: {
    backgroundColor: theme.colors.panel,
    borderRadius: theme.radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.panelBorder,
  },
  cardLabel: { color: "rgba(251,191,36,0.65)", fontSize: 10, marginBottom: 6 },
  cardValue: { fontWeight: "900", fontSize: 14, marginBottom: 6 },
  cardStatus: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 99 },
  statusText: { color: theme.colors.textMuted, fontSize: 9, letterSpacing: 0.6 },
  notice: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.track,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
    alignSelf: "flex-start",
  },
  noticeText: { color: theme.colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
});
