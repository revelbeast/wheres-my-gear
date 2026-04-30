import * as AppleAuthentication from "expo-apple-authentication";
import React, { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ScreenBackground from "../components/ui/ScreenBackground";
import { useAuth } from "../components/auth/AuthProvider";
import { colors } from "../theme/tokens";

export default function SignInScreen() {
  const { signInWithApple } = useAuth();
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkAvailability() {
      try {
        const available = await AppleAuthentication.isAvailableAsync();
        if (isMounted) {
          setIsAppleAvailable(available);
        }
      } catch (error) {
        console.error("Failed to check Apple sign-in availability:", error);
        if (isMounted) {
          setIsAppleAvailable(false);
        }
      }
    }

    checkAvailability();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleAppleSignIn() {
    try {
      setSigningIn(true);
      await signInWithApple();
    } catch (error: any) {
      if (error?.code === "ERR_REQUEST_CANCELED") {
        return;
      }

      console.error("Apple sign-in failed:", error);
      Alert.alert(
        "Sign in failed",
        "We could not sign you in with Apple. Please try again."
      );
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>Where&apos;s My Gear</Text>
            <Text style={styles.title}>Organize your gear with your own secure account</Text>
            <Text style={styles.subtitle}>
              Sign in with Apple to start your 7-day trial, save your gear data, and keep your gear organized privately.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Continue with Apple</Text>
            <Text style={styles.cardText}>
              Your checklists, inventory, notes, templates, and compartments will be tied to your personal account.
            </Text>

            {isAppleAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={14}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
                disabled={signingIn}
              />
            ) : (
              <View style={styles.unavailableBox}>
                <Text style={styles.unavailableText}>
                  Sign in with Apple is only available on supported Apple devices.
                </Text>
              </View>
            )}

            {signingIn ? (
              <Text style={styles.helperText}>Signing you in...</Text>
            ) : (
              <Text style={styles.helperText}>
                By continuing, you’ll sign in with Apple and create your private account.
              </Text>
            )}
          </View>
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  hero: {
    marginBottom: 24,
  },

  eyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },

  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 36,
    marginBottom: 10,
  },

  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(16,22,36,0.55)",
    padding: 18,
  },

  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },

  cardText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },

  appleButton: {
    width: "100%",
    height: 50,
  },

  unavailableBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 14,
  },

  unavailableText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },

  helperText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});