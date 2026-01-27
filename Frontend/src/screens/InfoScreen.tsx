import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { theme } from "../theme";

export type UpdateItem = {
  time: string;
  message: string;
  tone: "info" | "warning" | "success";
};

interface InfoScreenProps {
  rocketId: number;
  onBack: () => void;
  updates: UpdateItem[];
}

const rocketNames = ["PIONEER", "TITAN", "STRIKER"];

export default function InfoScreen({ rocketId, onBack, updates }: InfoScreenProps) {
  const { width, height } = useWindowDimensions();

  const frame = useMemo(() => ({ width, height }), [height, width]);

  const rocketName = rocketNames[rocketId - 1] ?? "ROCKET";
  const logItems = updates.length
    ? updates
    : [{ time: "00:00", message: "No new updates available.", tone: "info" }];

  const lastSync = logItems[0]?.time ?? "00:00";

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
              <Text style={s.title}>{rocketName} UPDATES</Text>
              <Text style={s.subtitle}>Comms and diagnostics log</Text>
            </View>
            <View style={s.headerSpacer} />
          </View>

          <View style={s.metaRow}>
            <View style={s.metaBadge}>
              <View style={[s.statusDot, { backgroundColor: theme.colors.success }]} />
              <Text style={s.metaText}>LIVE FEED</Text>
            </View>
            <Text style={s.metaTime}>Last sync {lastSync}</Text>
          </View>

          <ScrollView style={s.logList} contentContainerStyle={s.logContent}>
            {logItems.map((item, index) => {
              return (
                <View key={`${item.time}-${index}`} style={s.logRow}>
                  <View style={s.logDot} />
                  <View style={s.logCard}>
                    <View style={s.logHeader}>
                      <Text style={s.logTime}>{item.time}</Text>
                    </View>
                    <Text style={s.logText} numberOfLines={1} ellipsizeMode="tail">
                      {item.message}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
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
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.track,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.4)",
  },
  statusDot: { width: 6, height: 6, borderRadius: 99 },
  metaText: { color: theme.colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  metaTime: { color: theme.colors.textMuted, fontSize: 10 },
  logList: { flex: 1 },
  logContent: { gap: 10, paddingBottom: 12 },
  logRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  logDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: theme.colors.accentBorderSoft },
  logCard: {
    flex: 1,
    backgroundColor: theme.colors.panel,
    borderRadius: theme.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.panelBorder,
  },
  logHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  logTime: { color: theme.colors.textAccent, fontSize: 12, letterSpacing: 0.6 },
  logTone: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  logText: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 },
});
