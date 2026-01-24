import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import { theme } from "../theme";

export default function IntroVideoScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={s.root}>
      <Text style={s.text}>[Intro Video Placeholder]</Text>
      <Pressable style={s.btn} onPress={() => nav.navigate("RocketSelect")}>
        <Text style={s.btnText}>SKIP</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.frame },
  text: { color: theme.colors.textMuted },
  btn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSoft,
  },
  btnText: { color: theme.colors.textPrimary, fontWeight: "800" },
});
