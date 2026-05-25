import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import KeyboardDismissAccessory from "../components/ui/KeyboardDismissAccessory";
import ScreenBackground from "../components/ui/ScreenBackground";
import { colors } from "../theme/tokens";

const SIGN_IN_KEYBOARD_ACCESSORY_ID = "sign-in-keyboard-accessory";

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
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);

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
            ref={scrollViewRef}
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={require("../assets/images/welcome-hero.png")}
              style={[
                styles.heroImage,
                keyboardFocused && styles.heroImageKeyboardFocused,
              ]}
              resizeMode="contain"
            />

            <Text
              style={[
                styles.title,
                keyboardFocused && styles.titleKeyboardFocused,
              ]}
            >
              Where’s My Gear
            </Text>
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
              inputAccessoryViewID={
                Platform.OS === "ios" ? SIGN_IN_KEYBOARD_ACCESSORY_ID : undefined
              }

              onFocus={() => {
                setKeyboardFocused(true);
                setTimeout(() => {
                  scrollViewRef.current?.scrollTo({ y: 220, animated: true });
                }, 120);
              }}

              style={styles.input}
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              textContentType="none"
              autoComplete="off"
              importantForAutofill="no"
              inputAccessoryViewID={
                Platform.OS === "ios" ? SIGN_IN_KEYBOARD_ACCESSORY_ID : undefined
              }
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollTo({ y: 220, animated: true });
                }, 120);
              }}
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

            {Platform.OS === "ios" ? <Text style={styles.or}>OR</Text> : null}

            {Platform.OS === "ios" ? (
              isAppleAvailable ? (
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
              )
            ) : null}

            {signInError && <Text style={styles.errorText}>{signInError}</Text>}
          </ScrollView>

          <KeyboardDismissAccessory
            nativeID={SIGN_IN_KEYBOARD_ACCESSORY_ID}
            onDismiss={() => setKeyboardFocused(false)}
          />
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
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 180,
  },

  heroImage: {
    width: 220,
    height: 220,
    alignSelf: "center",
    borderRadius: 24,
    marginBottom: 12,
  },

  heroImageKeyboardFocused: {
    width: 150,
    height: 150,
    marginBottom: 8,
  },

  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },

  titleKeyboardFocused: {
    fontSize: 24,
    marginBottom: 4,
  },

  subtitle: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 20,
    paddingHorizontal: 10,
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
    color: "#93c5fd",
    textAlign: "center",
    marginBottom: 10,
    fontWeight: "700",
    fontSize: 15,
  },

  smallLink: {
    color: "#d1d5db",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 14,
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