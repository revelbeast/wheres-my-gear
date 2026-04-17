import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  UserCircle2,
  Settings,
  Lock,
  ChevronRight,
} from "lucide-react-native";

import ScreenBackground from "../../components/ui/ScreenBackground";
import { colors } from "../../theme/tokens";
import { getProfileSettings } from "../../lib/settingsService";

export default function ProfileTabScreen() {
  const [profilePhotoUri, setProfilePhotoUri] = useState("");
  const [displayName, setDisplayName] = useState("Profile");

  useFocusEffect(
    useCallback(() => {
      loadProfileSummary();
    }, [])
  );

  async function loadProfileSummary() {
    try {
      const profile = await getProfileSettings();
      setProfilePhotoUri(profile.profilePhotoUri ?? "");
      setDisplayName(profile.firstName || profile.username || "Profile");
    } catch (err) {
      console.error("Failed to load profile summary:", err);
      setProfilePhotoUri("");
      setDisplayName("Profile");
    }
  }

  function handleOpenProfileSettings() {
    router.push("/profile-settings");
  }

  function handleOpenSettings() {
    router.push("/settings");
  }

  function handleOpenPasswordManagement() {
    router.push("/password-management");
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.headerTitle}>Profile</Text>

          <Pressable style={styles.heroCard} onPress={handleOpenProfileSettings}>
            <View style={styles.heroLeft}>
              <View style={styles.heroIcon}>
                {profilePhotoUri ? (
                  <Image source={{ uri: profilePhotoUri }} style={styles.heroPhoto} />
                ) : (
                  <UserCircle2 size={38} color={colors.text} />
                )}
              </View>

              <View style={styles.heroTextWrap}>
                <Text style={styles.heroTitle}>{displayName}</Text>
                <Text style={styles.heroSubtitle}>
                  Update your name, email, phone, and profile settings
                </Text>
              </View>
            </View>

            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>

            <Pressable style={styles.rowCard} onPress={handleOpenSettings}>
              <View style={styles.rowLeft}>
                <View style={styles.iconWrap}>
                  <Settings size={18} color={colors.text} />
                </View>

                <View style={styles.textWrap}>
                  <Text style={styles.rowTitle}>Profile & Settings</Text>
                  <Text style={styles.rowSubtitle}>
                    Open all settings options
                  </Text>
                </View>
              </View>

              <ChevronRight size={18} color={colors.textSecondary} />
            </Pressable>

            <Pressable
              style={styles.rowCard}
              onPress={handleOpenPasswordManagement}
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconWrap}>
                  <Lock size={18} color={colors.text} />
                </View>

                <View style={styles.textWrap}>
                  <Text style={styles.rowTitle}>Password Management</Text>
                  <Text style={styles.rowSubtitle}>
                    Review and update account password settings
                  </Text>
                </View>
              </View>

              <ChevronRight size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>Profile tab</Text>
            <Text style={styles.noteText}>
              This bottom tab is the main entry point for profile and settings.
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
    paddingBottom: 120,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  heroCard: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 14,
    overflow: "hidden",
  },
  heroPhoto: {
    width: 64,
    height: 64,
    borderRadius: 18,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
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