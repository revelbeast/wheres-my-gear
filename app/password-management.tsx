import { BlurView } from "expo-blur";
import { KeyRound, Lock } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../components/ui/AppHeader";
import ScreenBackground from "../components/ui/ScreenBackground";
import { useThemedValues } from "../components/ui/Themed";

function FrostedCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  const theme = useThemedValues();

  return (
    <View
      style={[
        styles.cardShell,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
        style,
      ]}
    >
      <BlurView
        intensity={theme.isLight ? 22 : 35}
        tint={theme.isLight ? "light" : "dark"}
        style={styles.cardBlur}
      >
        {children}
      </BlurView>
    </View>
  );
}

export default function PasswordManagementScreen() {
  const theme = useThemedValues();

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <AppHeader title="Password Management" showBackButton />

          <FrostedCard style={styles.card}>
            <View style={styles.row}>
              <Lock size={18} color={theme.colors.text} />
              <Text style={[styles.title, { color: theme.colors.text }]}>
                Password Settings
              </Text>
            </View>

            <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
              This screen is ready for password reset and change-password
              actions.
            </Text>

            <Pressable style={styles.actionButton}>
              <KeyRound size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Change Password</Text>
            </Pressable>

            <Text style={[styles.note, { color: theme.colors.textMuted }]}>
              To make this fully functional, we need to connect it to your
              actual authentication flow.
            </Text>
          </FrostedCard>
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
    padding: 16,
  },

  cardShell: {
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
  },

  cardBlur: {
    padding: 16,
  },

  card: {
    marginTop: 10,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
  },

  text: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },

  actionButton: {
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(55, 130, 245, 0.95)",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },

  actionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  note: {
    fontSize: 13,
    lineHeight: 18,
  },
});