import AsyncStorage from "@react-native-async-storage/async-storage";
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
import {
  hasActivePremiumEntitlement,
  restorePurchases,
} from "../../lib/revenuecat";
import { publishAppThemeUpdate } from "../../lib/themeUpdateBus";

const APP_LOCK_ENABLED_KEY = "wmg.appLock.enabled.v1";

export default function GeneralSettingsScreen() {
  const { user } = useAuth();
  const activeTheme = useThemedValues();

  const isMountedRef = useRef(true);
  const loadRequestVersionRef = useRef(0);
  const actionLockRef = useRef(false);

  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const restorePurchasesVersionRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      loadRequestVersionRef.current += 1;
      actionLockRef.current = false;
      restorePurchasesVersionRef.current += 1;
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
      const savedAppLockEnabled = await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY);

      setAppLockEnabled(savedAppLockEnabled === "true");

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
      await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, appLockEnabled ? "true" : "false");

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

  async function handleSelectTheme(option: AppTheme) {
    if (!user || !profile || loading) return;
    if (theme === option) return;

    const previousTheme = theme;
    const nextProfile: AppProfile = {
      ...profile,
      theme: option,
    };

    setTheme(option);
    setProfile(nextProfile);

    publishAppThemeUpdate(
      user.uid,
      option,
      nextProfile.fontSize ?? "medium"
    );

    try {
      await saveProfileSettings(user.uid, nextProfile);
    } catch (err) {
      console.error("Failed to save theme setting:", err);

      if (isMountedRef.current) {
        setTheme(previousTheme);
        setProfile(profile);

        publishAppThemeUpdate(
          user.uid,
          previousTheme,
          profile.fontSize ?? "medium"
        );

        Alert.alert("Error", "Failed to save theme setting.");
      }
    }
  }


  function handleHapticsChange(value: boolean) {
    if (saving || loading || actionLockRef.current) return;

    setHapticsEnabled(value);
  }

  function handleAppLockChange(value: boolean) {
    if (saving || loading || actionLockRef.current) return;

    setAppLockEnabled(value);
    
  }

  async function handleRestorePurchases() {
    if (isRestoringPurchases || saving || loading || actionLockRef.current) {
      return;
    }

    Alert.alert(
      "Restore Purchases?",
      "This will check your Apple ID for an active Premium subscription and restore access if one is found. No new purchase will be made.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore Purchases",
          onPress: async () => {
            const restoreVersion = restorePurchasesVersionRef.current + 1;
            restorePurchasesVersionRef.current = restoreVersion;

            try {
              if (isMountedRef.current) {
                setIsRestoringPurchases(true);
              }

              const customerInfo = await restorePurchases();
              const hasPremium = hasActivePremiumEntitlement(customerInfo);

              if (
                restorePurchasesVersionRef.current !== restoreVersion ||
                !isMountedRef.current
              ) {
                return;
              }

              if (hasPremium) {
                Alert.alert(
                  "Purchases Restored",
                  "Your Premium access has been restored."
                );
                return;
              }

              Alert.alert(
                "No Purchases Found",
                "No active Premium purchase was found for this Apple ID."
              );
            } catch (err) {
              if (
                restorePurchasesVersionRef.current !== restoreVersion ||
                !isMountedRef.current
              ) {
                return;
              }

              console.error("Failed to restore purchases:", err);
              Alert.alert(
                "Restore Failed",
                "Unable to restore purchases right now. Please try again."
              );
            } finally {
              if (
                restorePurchasesVersionRef.current === restoreVersion &&
                isMountedRef.current
              ) {
                setIsRestoringPurchases(false);
              }
            }
          },
        },
      ]
    );
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
                <View style={styles.settingRow}>
                  <View style={styles.settingTextBlock}>
                    <ThemedText variant="bodyStrong">Phone Theme</ThemedText>
                    <ThemedText color="secondary" style={styles.settingHelper}>
                      Switch between Light Mode and Dark Mode.
                    </ThemedText>
                  </View>

                  <Switch
                    value={theme === "light"}
                    onValueChange={(value) => handleSelectTheme(value ? "light" : "dark")}
                    disabled={saving || loading || actionLockRef.current}
                    trackColor={{
                      false: activeTheme.colors.inputSurface,
                      true: "rgba(55,130,245,0.45)",
                    }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor={activeTheme.colors.inputSurface}
                  />
                </View>
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
                    thumbColor="#FFFFFF"
                    ios_backgroundColor={activeTheme.colors.inputSurface}
                  />
                </View>
              </ThemedCard>

              <ThemedCard style={styles.feedbackCard}>
                <View style={styles.settingRow}>
                  <View style={styles.settingTextBlock}>
                    <ThemedText variant="bodyStrong">Face ID App Lock</ThemedText>
                    <ThemedText color="secondary" style={styles.settingHelper}>
                      Require Face ID when opening the app. If Face ID is unavailable, iOS will offer the device passcode.
                    </ThemedText>
                  </View>

                  <Switch
                    value={appLockEnabled}
                    onValueChange={handleAppLockChange}
                    disabled={saving || loading || actionLockRef.current}
                    trackColor={{
                      false: activeTheme.colors.inputSurface,
                      true: "rgba(55,130,245,0.45)",
                    }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor={activeTheme.colors.inputSurface}
                  />
                </View>

              </ThemedCard>

              <ThemedCard style={styles.restoreCard}>
                <View style={styles.settingRow}>
                  <View style={styles.settingTextBlock}>
                    <ThemedText variant="bodyStrong">
                      {isRestoringPurchases
                        ? "Restoring Purchases..."
                        : "Restore Purchases"}
                    </ThemedText>
                    <ThemedText color="secondary" style={styles.settingHelper}>
                      Recover a previous Premium purchase.
                    </ThemedText>
                  </View>

                  <HapticPressable
                    style={[
                      styles.restoreButton,
                      {
                        backgroundColor: activeTheme.colors.primary,
                      },
                      (isRestoringPurchases ||
                        saving ||
                        loading ||
                        actionLockRef.current) &&
                        styles.disabledInteraction,
                    ]}
                    onPress={handleRestorePurchases}
                    disabled={
                      isRestoringPurchases ||
                      saving ||
                      loading ||
                      actionLockRef.current
                    }
                  >
                    <ThemedText style={styles.restoreButtonText}>
                      Restore
                    </ThemedText>
                  </HapticPressable>
                </View>
              </ThemedCard>

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

  restoreCard: {
    marginTop: 16,
  },

  restoreButton: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  restoreButtonText: {
    color: "#fff",
    fontWeight: "700",
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