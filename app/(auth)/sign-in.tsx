import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";

import { useAuth } from "../../components/auth/AuthProvider";

export default function SignInScreen() {
  const {
    signInWithApple,
    signInWithEmail,
    createAccountWithEmail,
    sendPasswordReset,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");

  async function handleApple() {
    try {
      setLoading(true);
      await signInWithApple();
    } catch (e: any) {
      Alert.alert("Apple Sign-In Failed", e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailAuth() {
    try {
      setLoading(true);

      if (!email || !password) {
        Alert.alert("Missing Info", "Please enter email and password.");
        return;
      }

      if (mode === "signIn") {
        await signInWithEmail(email, password);
      } else {
        await createAccountWithEmail(email, password);
      }
    } catch (e: any) {
      Alert.alert("Authentication Error", e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    try {
      if (!email) {
        Alert.alert("Enter Email", "Please enter your email first.");
        return;
      }

      await sendPasswordReset(email);
      Alert.alert("Password Reset", "Check your email for reset instructions.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Unable to send reset email");
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.inner}
      >
        <Text style={styles.title}>Where’s My Gear</Text>
        <Text style={styles.subtitle}>
          Organize your gear, storage, and trips
        </Text>

        <View style={styles.card}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            style={styles.input}
          />

          <Pressable style={styles.primaryBtn} onPress={handleEmailAuth}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === "signIn" ? "Sign In" : "Create Account"}
              </Text>
            )}
          </Pressable>

          <View style={styles.row}>
            <Pressable onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
              <Text style={styles.link}>
                {mode === "signIn"
                  ? "Need an account? Sign up"
                  : "Have an account? Sign in"}
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={handleResetPassword}>
            <Text style={styles.smallLink}>Forgot password?</Text>
          </Pressable>
        </View>

        <Text style={styles.or}>OR</Text>

        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={styles.appleBtn}
          onPress={handleApple}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  input: {
    backgroundColor: "#1f2937",
    padding: 12,
    borderRadius: 8,
    color: "#fff",
  },
  primaryBtn: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
  row: {
    alignItems: "center",
  },
  link: {
    color: "#60a5fa",
    marginTop: 4,
  },
  smallLink: {
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 8,
  },
  or: {
    textAlign: "center",
    color: "#6b7280",
    marginVertical: 16,
  },
  appleBtn: {
    height: 44,
  },
});