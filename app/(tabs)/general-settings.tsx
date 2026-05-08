import { Check, Moon, Sun } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

  const isMountedRef = useRef(true);
  const loadRequestVersionRef = useRef(0);
  const actionLockRef = useRef(false);

  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      loadRequestVersionRef.current += 1;
      actionLockRef.current = false;
    };
  }, []);

  const loadSettings = useCallback(async () => {
    const requestVersion = loadRequestVersionRef.current + 1;
    loadRequestVersionRef.current = requestVersion;

    if (!user) {
      if (
        !isMountedRef.current ||
        loadRequestVersionRef.current !== requestVersion
      ) {
        return;
      }

      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      if (isMountedRef.current) {
        setLoading(true);
      }

      const data = await getProfileSettings(user.uid);

      if (
        !isMountedRef.current ||
        loadRequestVersionRef.current !== requestVersion
      ) {
        return;
      }

      const nextTheme = data.theme ?? "dark";
      const nextHapticsEnabled = data.hapticsEnabled ?? true;

      setProfile(data);
      setTheme(nextTheme);
      setHapticsEnabled(nextHapticsEnabled);
      setGlobalHapticsEnabled(nextHapticsEnabled);
      publishAppThemeUpdate(user.uid, nextTheme, data.fontSize ?? "medium");
    } catch (err) {
      console.error("Failed to load general settings:", err);

      if (
        !isMountedRef.current ||
        loadRequestVersionRef.current !== requestVersion
      ) {
        return;
      }

      Alert.alert("Error", "Failed to load general settings.");
    } finally {
      if (
        isMountedRef.current &&
        loadRequestVersionRef.current === requestVersion
      ) {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSaveSettings() {
    if (!user || !profile || saving || loading || actionLockRef.current) return;

    actionLockRef.current = true;

    try {
      if (isMountedRef.current) {
        setSaving(true);
      }

      const nextProfile: AppProfile = {
        ...profile,
        theme,
        hapticsEnabled,
      };

      await saveProfileSettings(user.uid, nextProfile);

      if (!isMountedRef.current) {
        return;
      }

      setGlobalHapticsEnabled(hapticsEnabled);
      publishAppThemeUpdate(user.uid, theme, nextProfile.fontSize ?? "medium");
      setProfile(nextProfile);

      Alert.alert("Saved", "General settings have been updated.");
    } catch (err) {
      console.error("Failed to save general settings:", err);

      if (!isMountedRef.current) {
        return;
      }

      Alert.alert("Error", "Failed to save general settings.");
    } finally {
      actionLockRef.current = false;

      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  }

  function handleSelectTheme(option: AppTheme) {
    if (saving || loading || actionLockRef.current) return;

    setTheme(option);
  }

  function handleHapticsChange(value: boolean) {
    if (saving || loading || actionLockRef.current) return;

    setHapticsEnabled(value);
  }

  function renderThemeOption(option: AppTheme) {
    const isSelected = theme === option;
    const Icon = option === "dark" ? Moon : Sun;
    const label = option === "dark" ? "Dark" : "Light";
    const disabled = saving || loading || actionLockRef.current;

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
          disabled && styles.disabledInteraction,
        ]}
        onPress={() => handleSelectTheme(option)}
        disabled={disabled}
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
                    onValueChange={handleHapticsChange}
                    disabled={saving || loading || actionLockRef.current}
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

              <ThemedButton
                onPress={handleSaveSettings}
                disabled={saving || loading || actionLockRef.current}
              >
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
    backgroundColor: "transparent",
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

  disabledInteraction: {
    opacity: 0.55,
  },
});