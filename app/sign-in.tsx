import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../components/auth/AuthProvider";
import HapticPressable from "../components/ui/HapticPressable";
import ScreenBackground from "../components/ui/ScreenBackground";
import { colors } from "../theme/tokens";

export default function SignInScreen() {
  const {
    user,
    initializing,
    signInWithApple,
    signInWithEmail,
    createAccountWithEmail,
    sendPasswordReset,
  } = useAuth();

  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");

  useEffect(() => {
    if (!initializing && user) {
      router.replace("/");
    }
  }, [initializing, user]);

  useEffect(() => {
    let isMounted = true;

    async function checkAvailability() {
      try {
        const available = await AppleAuthentication.isAvailableAsync();
        if (isMounted) setIsAppleAvailable(available);
      } catch (error) {
        console.error("Failed to check Apple sign-in availability:", error);
        if (isMounted) setIsAppleAvailable(false);
      }
    }

    checkAvailability();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleAppleSignIn() {
    if (signingIn) return;

    try {
      setSigningIn(true);
      setSignInError(null);

      await signInWithApple();
    } catch (error: any) {
      if (error?.code === "ERR_REQUEST_CANCELED") return;

      const errorCode = error?.code ? String(error.code) : "unknown";
      const errorMessage = error?.message
        ? String(error.message)
        : "Unknown Apple Sign-In error.";

      console.error("Apple sign-in failed:", {
        code: errorCode,
        message: errorMessage,
      });

      setSignInError(`${errorCode}: ${errorMessage}`);
      Alert.alert("Sign in failed", `${errorCode}\n\n${errorMessage}`);
    } finally {
      setSigningIn(false);
    }
  }

  async function handleEmailAuth() {
    try {
      setSigningIn(true);
      setSignInError(null);

      if (!email || !password) {
        Alert.alert("Missing Info", "Please enter email and password.");
        return;
      }

      if (mode === "signIn") {
        await signInWithEmail(email, password);
      } else {
        await createAccountWithEmail(email, password);
      }
    } catch (error: any) {
      console.error("Email auth failed:", error);
      Alert.alert("Authentication Error", error?.message ?? "Unknown error");
    } finally {
      setSigningIn(false);
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
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "Unable to send reset email");
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardAvoiding}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={require("../assets/images/welcome-hero.png")}
              style={styles.heroImage}
              resizeMode="contain"
            />

            <Text style={styles.title}>Where’s My Gear</Text>
            <Text style={styles.subtitle}>
              Organize your gear, track your storage, and never lose anything again.
            </Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              style={styles.input}
            />

            <HapticPressable style={styles.primaryBtn} onPress={handleEmailAuth}>
              {signingIn ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {mode === "signIn" ? "Sign In" : "Create Account"}
                </Text>
              )}
            </HapticPressable>

            <HapticPressable
              onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
            >
              <Text style={styles.link}>
                {mode === "signIn"
                  ? "Need an account? Sign up"
                  : "Have an account? Sign in"}
              </Text>
            </HapticPressable>

            <HapticPressable onPress={handleResetPassword}>
              <Text style={styles.smallLink}>Forgot password?</Text>
            </HapticPressable>

            <Text style={styles.or}>OR</Text>

            {isAppleAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                }
                cornerRadius={14}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            ) : (
              <Text style={styles.helperText}>
                Apple Sign-In is only available on supported Apple devices.
              </Text>
            )}

            {signInError && <Text style={styles.errorText}>{signInError}</Text>}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  keyboardAvoiding: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
  },

  heroImage: {
    width: 220,
    height: 220,
    alignSelf: "center",
    borderRadius: 24,
    marginBottom: 12,
  },

  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },

  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },

  input: {
    backgroundColor: "#1f2937",
    padding: 12,
    borderRadius: 8,
    color: "#fff",
    marginBottom: 12,
  },

  primaryBtn: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },

  primaryBtnText: {
    color: "#fff",
    fontWeight: "600",
  },

  link: {
    color: "#60a5fa",
    textAlign: "center",
    marginBottom: 10,
  },

  smallLink: {
    color: "#9ca3af",
    textAlign: "center",
  },

  or: {
    textAlign: "center",
    color: "#6b7280",
    marginVertical: 16,
  },

  appleButton: {
    width: "100%",
    height: 52,
  },

  helperText: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
  },

  errorText: {
    marginTop: 12,
    color: "#ffb4b4",
    fontSize: 12,
    textAlign: "center",
  },
});