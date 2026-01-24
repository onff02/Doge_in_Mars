import React, { useMemo } from "react";
import { View } from "react-native";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";

export default function TrajectoryGSIChart({ data, width = 320, height = 180 }: { data: number[]; width?: number; height?: number }) {
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    if (data.length < 2) return p;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = Math.max(1e-6, max - min);

    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    });
    return p;
  }, [data, width, height]);

  return (
    <View style={{ borderRadius: 14, overflow: "hidden" }}>
      <Canvas style={{ width, height }}>
        <Path path={path} style="stroke" strokeWidth={3} />
      </Canvas>
    </View>
  );
}