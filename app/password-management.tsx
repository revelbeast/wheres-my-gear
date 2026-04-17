import React from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Lock, KeyRound } from "lucide-react-native";

import ScreenBackground from "../components/ui/ScreenBackground";
import AppHeader from "../components/ui/AppHeader";
import { colors } from "../theme/tokens";

export default function PasswordManagementScreen() {
  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <AppHeader title="Password Management" showBackButton />

          <View style={styles.card}>
            <View style={styles.row}>
              <Lock size={18} color={colors.text} />
              <Text style={styles.title}>Password Settings</Text>
            </View>

            <Text style={styles.text}>
              This screen is ready for password reset and change-password actions.
            </Text>

            <Pressable style={styles.actionButton}>
              <KeyRound size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Change Password</Text>
            </Pressable>

            <Text style={styles.note}>
              To make this fully functional, we need to connect it to your actual
              authentication flow.
            </Text>
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
    padding: 16,
  },
  card: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  text: {
    color: colors.textSecondary,
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
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});