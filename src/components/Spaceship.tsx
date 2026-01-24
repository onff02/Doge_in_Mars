import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

interface SpaceshipProps {
  size?: number;
}

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function Spaceship({ size = 200 }: SpaceshipProps) {
  const flame = useRef(new Animated.Value(0)).current;
  const led1 = useRef(new Animated.Value(0)).current;
  const led2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const flameAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(flame, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(flame, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    );
    const ledAnim1 = Animated.loop(
      Animated.sequence([
        Animated.timing(led1, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(led1, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    );
    const ledAnim2 = Animated.loop(
      Animated.sequence([
        Animated.delay(375),
        Animated.timing(led2, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(led2, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    );

    flameAnim.start();
    ledAnim1.start();
    ledAnim2.start();

    return () => {
      flameAnim.stop();
      ledAnim1.stop();
      ledAnim2.stop();
    };
  }, [flame, led1, led2]);

  const flameOpacity = flame.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const flameScaleY = flame.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] });
  const ledOpacity1 = led1.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const ledOpacity2 = led2.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <AnimatedG originX={100} originY={160} opacity={flameOpacity} transform={[{ scaleY: flameScaleY }]}>
        <Path d="M 75 160 Q 70 175 72 190 Q 75 175 75 160" fill="url(#fireGradient1)" opacity="0.9" />
        <Path d="M 125 160 Q 130 175 128 190 Q 125 175 125 160" fill="url(#fireGradient1)" opacity="0.9" />
        <Path d="M 95 165 Q 90 180 92 195 Q 100 185 108 195 Q 110 180 105 165" fill="url(#fireGradient2)" />
      </AnimatedG>

      <Ellipse cx="75" cy="158" rx="8" ry="6" fill="#5a3a1a" />
      <Ellipse cx="125" cy="158" rx="8" ry="6" fill="#5a3a1a" />
      <Ellipse cx="100" cy="163" rx="10" ry="7" fill="#5a3a1a" />

      <Ellipse cx="75" cy="156" rx="6" ry="4" fill="#8b5a2b" />
      <Ellipse cx="125" cy="156" rx="6" ry="4" fill="#8b5a2b" />
      <Ellipse cx="100" cy="161" rx="7" ry="5" fill="#8b5a2b" />

      <Path d="M 60 140 L 50 160 L 70 155 Z" fill="url(#metalGradient)" stroke="#f97316" strokeWidth="1" />
      <Path d="M 140 140 L 150 160 L 130 155 Z" fill="url(#metalGradient)" stroke="#f97316" strokeWidth="1" />

      <Path d="M 58 145 L 54 155 L 68 152 Z" fill="#c2410c" opacity="0.6" />
      <Path d="M 142 145 L 146 155 L 132 152 Z" fill="#c2410c" opacity="0.6" />

      <Path
        d="M 80 150 L 70 100 L 75 60 L 85 40 L 100 20 L 115 40 L 125 60 L 130 100 L 120 150 Z"
        fill="url(#bodyGradient)"
        stroke="#f97316"
        strokeWidth="2"
      />

      <Line x1="100" y1="25" x2="100" y2="150" stroke="#c2410c" strokeWidth="1" opacity="0.5" />

      <Ellipse cx="100" cy="70" rx="18" ry="25" fill="url(#cockpitGradient)" stroke="#f97316" strokeWidth="1.5" />
      <Ellipse cx="95" cy="65" rx="8" ry="12" fill="#fb923c" opacity="0.4" />
      <Ellipse cx="100" cy="70" rx="18" ry="25" fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.6" />

      <Path d="M 95 40 L 100 20 L 105 40" fill="#d97706" stroke="#f97316" strokeWidth="1" />

      <Path d="M 78 80 L 122 80" stroke="#c2410c" strokeWidth="1" opacity="0.4" />
      <Path d="M 76 100 L 124 100" stroke="#c2410c" strokeWidth="1" opacity="0.4" />
      <Path d="M 74 120 L 126 120" stroke="#c2410c" strokeWidth="1" opacity="0.4" />

      <AnimatedCircle cx="85" cy="110" r="2" fill="#fbbf24" opacity={ledOpacity1} />
      <AnimatedCircle cx="115" cy="110" r="2" fill="#fbbf24" opacity={ledOpacity2} />

      <Rect x="68" y="95" width="8" height="3" fill="#f97316" opacity="0.7" />
      <Rect x="124" y="95" width="8" height="3" fill="#f97316" opacity="0.7" />

      <Defs>
        <LinearGradient id="fireGradient1" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
          <Stop offset="50%" stopColor="#f97316" stopOpacity="0.8" />
          <Stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="fireGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
          <Stop offset="50%" stopColor="#3b82f6" stopOpacity="0.8" />
          <Stop offset="100%" stopColor="#1e40af" stopOpacity="0" />
        </LinearGradient>

        <LinearGradient id="metalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#c2410c" />
          <Stop offset="50%" stopColor="#f97316" />
          <Stop offset="100%" stopColor="#c2410c" />
        </LinearGradient>

        <LinearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#7c2d12" />
          <Stop offset="30%" stopColor="#ea580c" />
          <Stop offset="50%" stopColor="#f97316" />
          <Stop offset="70%" stopColor="#ea580c" />
          <Stop offset="100%" stopColor="#7c2d12" />
        </LinearGradient>

        <RadialGradient id="cockpitGradient" cx="50%" cy="50%">
          <Stop offset="0%" stopColor="#fb923c" stopOpacity="0.8" />
          <Stop offset="60%" stopColor="#f97316" stopOpacity="0.6" />
          <Stop offset="100%" stopColor="#c2410c" stopOpacity="0.9" />
        </RadialGradient>
      </Defs>
    </Svg>
  );
}
