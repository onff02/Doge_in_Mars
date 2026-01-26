import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import TrajectoryGSIChart from "../components/TrajectoryGSIChart";
import { theme } from "../theme";
import { getChart } from "../api/client";

interface ChartScreenProps {
  onBack: () => void;
  round?: number;    // 현재 라운드 (기본값 1)
  symbol?: string;   // 로켓 종목 심볼 (기본값 NVDA)
}

export default function ChartScreen({ 
  onBack, 
  round = 1, 
  symbol = "NVDA" 
}: ChartScreenProps) {
  const { width, height } = useWindowDimensions();
  
  // 상태 관리: 로딩 여부 및 중력파 데이터
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<number[]>([]);
  const [stabilityStatus, setStabilityStatus] = useState("STABLE");

  // 1. API 데이터 페칭
  useEffect(() => {
    const fetchGravityData = async () => {
      try {
        setLoading(true);
        // 백엔드 /api/charts 엔드포인트 호출
        const response = await getChart(symbol, round);
        
        if (response.gravityData) {
          setChartData(response.gravityData.values);
        }
      } catch (error) {
        console.error("중력파 데이터를 불러오는 중 오류 발생:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGravityData();
  }, [round, symbol]);

  // 2. 프레임 레이아웃 계산 (제공해주신 로직 유지)
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
            <Pressable 
              style={({ pressed }) => [s.backButton, pressed && s.backPressed]} 
              onPress={onBack}
            >
              <Text style={s.backText}>{"< BACK TO COCKPIT"}</Text>
            </Pressable>
            <View style={s.headerCenter}>
              <Text style={s.title}>GRAVITY WAVE ANALYSIS</Text>
              <Text style={s.subtitle}>{symbol} - Round {round} Monitoring</Text>
            </View>
            <View style={s.headerSpacer} />
          </View>

          <View style={s.chartCard}>
            {loading ? (
              <ActivityIndicator size="large" color={theme.colors.accent} />
            ) : chartData.length > 0 ? (
              <TrajectoryGSIChart data={chartData} width={chartWidth} height={chartHeight} />
            ) : (
              <Text style={{ color: theme.colors.textAccent }}>데이터를 찾을 수 없습니다.</Text>
            )}
          </View>

          <View style={s.footer}>
            <View style={[
              s.footerBadge, 
              { borderColor: stabilityStatus === "STABLE" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)" }
            ]}>
              <View style={[
                s.statusDot, 
                { backgroundColor: stabilityStatus === "STABLE" ? "#22c55e" : "#ef4444" }
              ]} />
              <Text style={[
                s.footerText, 
                { color: stabilityStatus === "STABLE" ? theme.colors.success : "#ef4444" }
              ]}>
                STATUS: {stabilityStatus}
              </Text>
            </View>
            <Text style={s.footerMeta}>Update: Historical Sync</Text>
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
  chartCard: {
    flex: 1,
    borderRadius: theme.radius.lg,
    padding: 12,
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.panelBorder,
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
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.track,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 99 },
  footerText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  footerMeta: { color: theme.colors.textAccent, fontSize: 10 },
});