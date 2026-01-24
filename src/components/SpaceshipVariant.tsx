import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

interface SpaceshipVariantProps {
  type: number;
  size?: number;
}

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function SpaceshipVariant({ type, size = 80 }: SpaceshipVariantProps) {
  const flame = useRef(new Animated.Value(0)).current;
  const led1 = useRef(new Animated.Value(0)).current;
  const led2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const flameAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(flame, { toValue: 1, duration: 240, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(flame, { toValue: 0, duration: 240, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    );
    const ledAnim1 = Animated.loop(
      Animated.sequence([
        Animated.timing(led1, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(led1, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    );
    const ledAnim2 = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(led2, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(led2, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
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

  if (type === 1) {
    return (
      <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
        <AnimatedG originX={100} originY={170} opacity={flameOpacity} transform={[{ scaleY: flameScaleY }]}>
          <Path d="M 85 170 Q 80 185 82 195 Q 85 180 85 170" fill="url(#fire1)" />
          <Path d="M 115 170 Q 120 185 118 195 Q 115 180 115 170" fill="url(#fire1)" />
        </AnimatedG>

        <Path d="M 70 130 L 55 155 L 75 145 Z" fill="url(#metal1)" stroke="#f97316" strokeWidth="1" />
        <Path d="M 130 130 L 145 155 L 125 145 Z" fill="url(#metal1)" stroke="#f97316" strokeWidth="1" />

        <Path
          d="M 85 165 L 80 90 L 85 50 L 92 30 L 100 15 L 108 30 L 115 50 L 120 90 L 115 165 Z"
          fill="url(#body1)"
          stroke="#f97316"
          strokeWidth="2"
        />

        <Ellipse cx="100" cy="70" rx="12" ry="18" fill="url(#cockpit1)" stroke="#fbbf24" strokeWidth="1" />
        <Ellipse cx="97" cy="65" rx="5" ry="9" fill="#fb923c" opacity="0.5" />

        <AnimatedCircle cx="90" cy="100" r="1.5" fill="#fbbf24" opacity={ledOpacity1} />
        <AnimatedCircle cx="110" cy="100" r="1.5" fill="#fbbf24" opacity={ledOpacity2} />

        <Defs>
          <LinearGradient id="fire1" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#fbbf24" />
            <Stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="metal1" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#c2410c" />
            <Stop offset="50%" stopColor="#f97316" />
            <Stop offset="100%" stopColor="#c2410c" />
          </LinearGradient>
          <LinearGradient id="body1" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#7c2d12" />
            <Stop offset="50%" stopColor="#f97316" />
            <Stop offset="100%" stopColor="#7c2d12" />
          </LinearGradient>
          <RadialGradient id="cockpit1">
            <Stop offset="0%" stopColor="#fb923c" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#c2410c" stopOpacity="0.9" />
          </RadialGradient>
        </Defs>
      </Svg>
    );
  }

  if (type === 2) {
    return (
      <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
        <AnimatedG originX={100} originY={165} opacity={flameOpacity} transform={[{ scaleY: flameScaleY }]}>
          <Path d="M 70 165 Q 65 178 67 188 Q 70 175 70 165" fill="url(#fire2)" />
          <Path d="M 100 170 Q 95 185 97 195 Q 100 180 100 170" fill="url(#fire2)" />
          <Path d="M 130 165 Q 135 178 133 188 Q 130 175 130 165" fill="url(#fire2)" />
        </AnimatedG>

        <Path d="M 60 120 L 40 150 L 65 145 Z" fill="url(#metal2)" stroke="#f97316" strokeWidth="1.5" />
        <Path d="M 140 120 L 160 150 L 135 145 Z" fill="url(#metal2)" stroke="#f97316" strokeWidth="1.5" />

        <Path
          d="M 70 160 L 65 100 L 70 60 L 80 35 L 100 20 L 120 35 L 130 60 L 135 100 L 130 160 Z"
          fill="url(#body2)"
          stroke="#f97316"
          strokeWidth="2.5"
        />

        <Rect x="75" y="80" width="50" height="4" fill="#c2410c" opacity="0.6" />
        <Rect x="75" y="100" width="50" height="4" fill="#c2410c" opacity="0.6" />
        <Rect x="75" y="120" width="50" height="4" fill="#c2410c" opacity="0.6" />

        <Ellipse cx="100" cy="60" rx="15" ry="20" fill="url(#cockpit2)" stroke="#fbbf24" strokeWidth="1.5" />
        <Ellipse cx="96" cy="56" rx="7" ry="10" fill="#fb923c" opacity="0.4" />

        <AnimatedCircle cx="85" cy="110" r="2" fill="#fbbf24" opacity={ledOpacity1} />
        <AnimatedCircle cx="115" cy="110" r="2" fill="#fbbf24" opacity={ledOpacity2} />

        <Defs>
          <LinearGradient id="fire2" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#fbbf24" />
            <Stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="metal2" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#c2410c" />
            <Stop offset="50%" stopColor="#f97316" />
            <Stop offset="100%" stopColor="#c2410c" />
          </LinearGradient>
          <LinearGradient id="body2" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#7c2d12" />
            <Stop offset="50%" stopColor="#ea580c" />
            <Stop offset="100%" stopColor="#7c2d12" />
          </LinearGradient>
          <RadialGradient id="cockpit2">
            <Stop offset="0%" stopColor="#fb923c" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#c2410c" stopOpacity="0.9" />
          </RadialGradient>
        </Defs>
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <AnimatedG originX={100} originY={168} opacity={flameOpacity} transform={[{ scaleY: flameScaleY }]}>
        <Path d="M 80 168 Q 75 183 77 193 Q 80 178 80 168" fill="url(#fire3)" />
        <Path d="M 100 170 Q 95 185 97 195 Q 100 180 100 170" fill="url(#fire3)" />
        <Path d="M 120 168 Q 125 183 123 193 Q 120 178 120 168" fill="url(#fire3)" />
      </AnimatedG>

      <Path d="M 65 125 L 50 152 L 72 142 Z" fill="url(#metal3)" stroke="#f97316" strokeWidth="1.2" />
      <Path d="M 135 125 L 150 152 L 128 142 Z" fill="url(#metal3)" stroke="#f97316" strokeWidth="1.2" />

      <Path d="M 75 90 L 68 105 L 78 100 Z" fill="#c2410c" />
      <Path d="M 125 90 L 132 105 L 122 100 Z" fill="#c2410c" />

      <Path
        d="M 82 165 L 75 95 L 80 55 L 88 35 L 100 18 L 112 35 L 120 55 L 125 95 L 118 165 Z"
        fill="url(#body3)"
        stroke="#f97316"
        strokeWidth="2"
      />

      <Rect x="72" y="110" width="8" height="3" fill="#f97316" opacity="0.8" />
      <Rect x="120" y="110" width="8" height="3" fill="#f97316" opacity="0.8" />

      <Ellipse cx="100" cy="65" rx="14" ry="20" fill="url(#cockpit3)" stroke="#fbbf24" strokeWidth="1.2" />
      <Ellipse cx="96" cy="60" rx="6" ry="10" fill="#fb923c" opacity="0.5" />

      <AnimatedCircle cx="88" cy="105" r="1.5" fill="#fbbf24" opacity={ledOpacity1} />
      <AnimatedCircle cx="112" cy="105" r="1.5" fill="#fbbf24" opacity={ledOpacity2} />

      <Defs>
        <LinearGradient id="fire3" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#fbbf24" />
          <Stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="metal3" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#c2410c" />
          <Stop offset="50%" stopColor="#f97316" />
          <Stop offset="100%" stopColor="#c2410c" />
        </LinearGradient>
        <LinearGradient id="body3" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#7c2d12" />
          <Stop offset="50%" stopColor="#f97316" />
          <Stop offset="100%" stopColor="#7c2d12" />
        </LinearGradient>
        <RadialGradient id="cockpit3">
          <Stop offset="0%" stopColor="#fb923c" stopOpacity="0.8" />
          <Stop offset="100%" stopColor="#c2410c" stopOpacity="0.9" />
        </RadialGradient>
      </Defs>
    </Svg>
  );
}
