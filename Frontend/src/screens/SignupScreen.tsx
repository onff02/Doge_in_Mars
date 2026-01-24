import React, { useState } from "react";
import { ImageBackground, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RootStackParamList } from "../navigation";
import { theme } from "../theme";

const BG_IMAGE =
  "https://images.unsplash.com/photo-1709409903008-fbc1ce9b7dfa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGFjZSUyMHN0YXJzJTIwbmVidWxhfGVufDF8fHx8MTc2OTIzMjkzNXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const USER_KEY = "auth_user";
const SESSION_KEY = "auth_session";

type StoredUser = {
  email: string;
  password: string;
};

export default function SignupScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async () => {
    setError("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || !confirm) {
      setError("Please fill in all fields.");
      return;
    }
    if (!trimmedEmail.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      const stored = await AsyncStorage.getItem(USER_KEY);
      if (stored) {
        const user: StoredUser = JSON.parse(stored);
        if (user.email === trimmedEmail) {
          setError("Account already exists. Please log in.");
          return;
        }
      }
      await AsyncStorage.setItem(USER_KEY, JSON.stringify({ email: trimmedEmail, password }));
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ email: trimmedEmail, loggedInAt: Date.now() }));
      nav.navigate("Intro");
    } catch (e) {
      setError("Sign up failed. Please try again.");
    }
  };

  return (
    <View style={s.root}>
      <ImageBackground source={{ uri: BG_IMAGE }} style={s.bg} resizeMode="cover">
        <View style={s.overlay} pointerEvents="none" />
        <KeyboardAvoidingView style={s.content} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Text style={s.title}>Sign Up</Text>

          <View style={s.form}>
            <TextInput
              style={s.input}
              placeholder="Email"
              placeholderTextColor="rgba(255,255,255,0.5)"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={s.input}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.5)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TextInput
              style={s.input}
              placeholder="Confirm Password"
              placeholderTextColor="rgba(255,255,255,0.5)"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
            />
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable style={({ pressed }) => [s.primaryButton, pressed && s.buttonPressed]} onPress={handleSignup}>
            <Text style={s.primaryButtonText}>SIGN UP</Text>
          </Pressable>

          <View style={s.footerRow}>
            <Text style={s.footerText}>Already have an account?</Text>
            <Pressable onPress={() => nav.navigate("Login")}>
              <Text style={s.link}>Log in</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.black },
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.overlayStrong },
  content: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  title: { color: theme.colors.accent, fontSize: 28, fontWeight: "900", marginBottom: 20, letterSpacing: 0.8 },
  form: { width: "100%", maxWidth: 320, gap: 12 },
  input: {
    height: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.accentBorderSoft,
    paddingHorizontal: 12,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.track,
  },
  error: { marginTop: 10, color: theme.colors.danger, textAlign: "center" },
  primaryButton: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.accentBorderStrong,
    backgroundColor: theme.colors.accentTint,
  },
  buttonPressed: { transform: [{ scale: 0.97 }] },
  primaryButtonText: { color: theme.colors.accent, fontWeight: "900", letterSpacing: 1 },
  footerRow: { flexDirection: "row", gap: 6, marginTop: 14 },
  footerText: { color: theme.colors.textMuted },
  link: { color: theme.colors.accent, fontWeight: "800" },
});
