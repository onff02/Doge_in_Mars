import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";

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
  root: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#050814" },
  text: { color: "rgba(255,255,255,0.8)" },
  btn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.10)" },
  btnText: { color: "white", fontWeight: "800" },
});