import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useEventListener } from "expo";
import { Audio } from "expo-av";
import { useVideoPlayer, VideoView } from "expo-video";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import { theme } from "../theme";
import { markIntroComplete } from "../api/client";

export default function IntroVideoScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [audioReady, setAudioReady] = useState(false);
  const player = useVideoPlayer(require("../../assets/videos/output.mp4"), (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = false;
    videoPlayer.volume = 1;
    videoPlayer.audioMixingMode = "doNotMix";
  });

  useEffect(() => {
    let isMounted = true;
    const configureAudio = async () => {
      try {
        await Audio.setIsEnabledAsync(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
          staysActiveInBackground: false,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
        if (isMounted) setAudioReady(true);
      } catch {
        // Best effort for audio setup.
        if (isMounted) setAudioReady(true);
      }
    };
    configureAudio();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (audioReady) {
      player.play();
    }
  }, [audioReady, player]);

  const handleSkip = useCallback(() => {
    nav.replace("RocketSelect");
    markIntroComplete().catch(() => {});
  }, [nav]);

  const handleFinish = useCallback(() => {
    nav.replace("RocketSelect");
    markIntroComplete().catch(() => {});
  }, [nav]);

  useEventListener(player, "playToEnd", handleFinish);
  useEventListener(player, "availableAudioTracksChange", ({ availableAudioTracks }) => {
    if (!player.audioTrack && availableAudioTracks.length > 0) {
      player.audioTrack = availableAudioTracks[0];
    }
  });

  return (
    <View style={s.root}>
      <VideoView player={player} style={s.video} contentFit="cover" nativeControls={false} />
      <View style={s.overlay} pointerEvents="none" />
      <Pressable style={s.btn} onPress={handleSkip}>
        <Text style={s.btnText}>SKIP</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.black },
  video: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.overlay },
  btn: {
    position: "absolute",
    bottom: 28,
    right: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(15,23,42,0.75)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
  },
  btnText: { color: theme.colors.textPrimary, fontWeight: "800", letterSpacing: 0.8 },
});
