import React, { useMemo } from "react";
import { View } from "react-native";
import { Canvas, Path, Skia, LinearGradient, vec } from "@shopify/react-native-skia";
import { theme } from "../theme";

interface TrajectoryGSIChartProps {
  data: number[];    // 주가 데이터 (values)
  width: number;     // 차트 너비
  height: number;    // 차트 높이
}

export default function TrajectoryGSIChart({ data, width, height }: TrajectoryGSIChartProps) {
  // 1. 데이터를 차트 경로(Path)로 변환하는 로직
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    
    // 데이터가 없거나 2개 미만이면 빈 경로 반환
    if (!data || data.length < 2) return p;

    // 데이터 정규화를 위한 최소/최대값 계산
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = Math.max(max - min, 0.001); // 0으로 나누기 방지

    // 차트 내부 여백 설정 (작은 화면에서 잘림 방지)
    const paddingY = Math.min(18, Math.max(6, Math.round(height * 0.14)));
    const drawHeight = height - paddingY * 2;

    data.forEach((v, i) => {
      // X좌표: 데이터 인덱스에 따라 전체 너비에 균등 배분
      const x = (i / (data.length - 1)) * width;
      
      // Y좌표: 가격 데이터를 차트 높이에 매핑
      // 가격이 높을수록(max) Y좌표는 위쪽(paddingY), 낮을수록(min) 아래쪽(height - paddingY)
      const y = height - paddingY - ((v - min) / range) * drawHeight;

      if (i === 0) {
        p.moveTo(x, y);
      } else {
        // 부드러운 연결을 위해 lineTo 사용 (추후 베지어 곡선으로 고도화 가능)
        p.lineTo(x, y);
      }
    });

    return p;
  }, [data, width, height]);

  // 데이터가 없을 경우 렌더링하지 않음
  if (!data || data.length === 0) return null;

  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <Canvas style={{ width, height }}>
        {/* 중력파 경로 렌더링 */}
        <Path
          path={path}
          style="stroke"
          strokeWidth={3}
          strokeJoin="round"
          strokeCap="round"
        >
          {/* 중력파 느낌을 내기 위한 수평 그라데이션 효과 */}
          <LinearGradient
            start={vec(0, 0)}
            end={vec(width, 0)}
            colors={[
              theme.colors.accent,    // 시작: 황금색 (테마 컬러)
              "#60a5fa",              // 중간: 푸른색 (에너지 파동 느낌)
              theme.colors.accent     // 끝: 황금색
            ]}
          />
        </Path>
      </Canvas>
    </View>
  );
}
