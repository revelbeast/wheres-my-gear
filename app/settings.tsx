import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  UserCircle2,
  Shield,
  ChevronRight,
} from "lucide-react-native";
import { router } from "expo-router";

import ScreenBackground from "../components/ui/ScreenBackground";
import AppHeader from "../components/ui/AppHeader";
import { colors } from "../theme/tokens";

type SettingRowProps = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function SettingRow({ icon, title, subtitle, onPress }: SettingRowProps) {
  return (
    <Pressable style={styles.rowCard} onPress={onPress}>
      <View style={styles.rowLeft}>
        <View style={styles.iconWrap}>{icon}</View>
        <View style={styles.textWrap}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <ChevronRight size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader title="Profile & Settings" showBackButton />

          <Pressable
            style={styles.profileCard}
            onPress={() => router.push("/profile")}
          >
            <View style={styles.profileIcon}>
              <UserCircle2 size={42} color={colors.text} />
            </View>

            <View style={styles.profileTextWrap}>
              <Text style={styles.profileTitle}>Profile</Text>
              <Text style={styles.profileSubtitle}>
                Account basics and appearance settings
              </Text>
            </View>

            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security</Text>

            <SettingRow
              icon={<Shield size={18} color={colors.text} />}
              title="Password Management"
              subtitle="Update password and account security settings"
              onPress={() => router.push("/password-management")}
            />
          </View>

          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>Simplified for now</Text>
            <Text style={styles.noteText}>
              Communication, privacy, professional details, and activity logs
              have been removed for now to keep settings focused and easier to manage.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
  },
  profileCard: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
  },
  profileIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 14,
  },
  profileTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  profileTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  profileSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  rowCard: {
    marginBottom: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 3,
  },
  rowSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  noteCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  noteTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  noteText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});