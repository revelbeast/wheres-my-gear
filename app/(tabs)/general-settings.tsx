import { Check, Moon, Sun } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../components/auth/AuthProvider";
import AppHeader from "../../components/ui/AppHeader";
import HapticPressable from "../../components/ui/HapticPressable";
import ScreenBackground from "../../components/ui/ScreenBackground";
import {
  ThemedButton,
  ThemedCard,
  ThemedText,
  useThemedValues,
} from "../../components/ui/Themed";
import { setHapticsEnabled as setGlobalHapticsEnabled } from "../../lib/haptics";
import {
  AppProfile,
  AppTheme,
  getProfileSettings,
  saveProfileSettings,
} from "../../lib/settingsService";
import { publishAppThemeUpdate } from "../../lib/themeUpdateBus";

export default function GeneralSettingsScreen() {
  const { user } = useAuth();
  const activeTheme = useThemedValues();

  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [user]);

  async function loadSettings() {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const data = await getProfileSettings(user.uid);
      const nextTheme = data.theme ?? "dark";
      const nextHapticsEnabled = data.hapticsEnabled ?? true;

      setProfile(data);
      setTheme(nextTheme);
      setHapticsEnabled(nextHapticsEnabled);
      setGlobalHapticsEnabled(nextHapticsEnabled);
      publishAppThemeUpdate(user.uid, nextTheme, data.fontSize ?? "medium");
    } catch (err) {
      console.error("Failed to load general settings:", err);
      Alert.alert("Error", "Failed to load general settings.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    if (!user || !profile) return;

    try {
      setSaving(true);

      const nextProfile: AppProfile = {
        ...profile,
        theme,
        hapticsEnabled,
      };

      await saveProfileSettings(user.uid, nextProfile);
      setGlobalHapticsEnabled(hapticsEnabled);
      publishAppThemeUpdate(user.uid, theme, nextProfile.fontSize ?? "medium");
      setProfile(nextProfile);

      Alert.alert("Saved", "General settings have been updated.");
    } catch (err) {
      console.error("Failed to save general settings:", err);
      Alert.alert("Error", "Failed to save general settings.");
    } finally {
      setSaving(false);
    }
  }

  function renderThemeOption(option: AppTheme) {
    const isSelected = theme === option;
    const Icon = option === "dark" ? Moon : Sun;
    const label = option === "dark" ? "Dark" : "Light";

    return (
      <HapticPressable
        style={[
          styles.themeOption,
          {
            backgroundColor: isSelected
              ? "rgba(55,130,245,0.18)"
              : activeTheme.colors.inputSurface,
            borderColor: isSelected
              ? activeTheme.colors.primary
              : activeTheme.colors.border,
          },
        ]}
        onPress={() => setTheme(option)}
      >
        <Icon size={20} color={activeTheme.colors.text} />
        <ThemedText variant="bodyStrong">{label}</ThemedText>
      </HapticPressable>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader
            title="General Settings"
            showBackButton
            backHref="/(tabs)/profile"
          />

          {loading ? (
            <ThemedText color="secondary">Loading settings...</ThemedText>
          ) : !user ? (
            <ThemedCard>
              <ThemedText variant="title" style={styles.emptyTitle}>
                Sign in required
              </ThemedText>
              <ThemedText color="secondary">
                Please sign in to edit general settings.
              </ThemedText>
            </ThemedCard>
          ) : (
            <>
              <ThemedCard style={styles.heroCard}>
                <ThemedText variant="title" style={styles.heroTitle}>
                  Display Preferences
                </ThemedText>
                <ThemedText color="secondary" style={styles.heroText}>
                  Adjust your app theme and feedback preferences. Settings are
                  saved to your profile.
                </ThemedText>
              </ThemedCard>

              <ThemedCard>
                <ThemedText variant="bodyStrong" style={styles.sectionTitle}>
                  Theme
                </ThemedText>

                <View style={styles.optionRow}>
                  {renderThemeOption("dark")}
                  {renderThemeOption("light")}
                </View>

                <ThemedText color="secondary" style={styles.helperText}>
                  Theme is saved to your profile and applied to screens using
                  the shared themed components.
                </ThemedText>
              </ThemedCard>

              <ThemedCard style={styles.feedbackCard}>
                <View style={styles.settingRow}>
                  <View style={styles.settingTextBlock}>
                    <ThemedText variant="bodyStrong">
                      Haptic Feedback
                    </ThemedText>
                    <ThemedText color="secondary" style={styles.settingHelper}>
                      Enable subtle vibration feedback for supported app
                      interactions.
                    </ThemedText>
                  </View>

                  <Switch
                    value={hapticsEnabled}
                    onValueChange={setHapticsEnabled}
                    trackColor={{
                      false: activeTheme.colors.inputSurface,
                      true: "rgba(55,130,245,0.45)",
                    }}
                    thumbColor={
                      hapticsEnabled
                        ? activeTheme.colors.primary
                        : activeTheme.colors.textMuted
                    }
                    ios_backgroundColor={activeTheme.colors.inputSurface}
                  />
                </View>
              </ThemedCard>

              <ThemedButton onPress={handleSaveSettings} disabled={saving}>
                <Check size={18} color="#fff" />
                <ThemedText style={styles.saveButtonText}>
                  {saving ? "Saving..." : "Save Settings"}
                </ThemedText>
              </ThemedButton>
            </>
          )}
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

  heroCard: {
    marginBottom: 16,
  },

  heroTitle: {
    marginBottom: 6,
  },

  heroText: {
    lineHeight: 20,
  },

  sectionTitle: {
    marginBottom: 12,
  },

  optionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  themeOption: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  feedbackCard: {
    marginTop: 16,
  },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },

  settingTextBlock: {
    flex: 1,
  },

  settingHelper: {
    marginTop: 4,
    lineHeight: 20,
  },

  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  emptyTitle: {
    marginBottom: 6,
  },

  helperText: {
    lineHeight: 20,
  },
});