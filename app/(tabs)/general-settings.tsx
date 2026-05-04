import { Check, Moon, Sun } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../components/auth/AuthProvider";
import AppHeader from "../../components/ui/AppHeader";
import ScreenBackground from "../../components/ui/ScreenBackground";
import {
  ThemedButton,
  ThemedCard,
  ThemedText,
  useThemedValues,
} from "../../components/ui/Themed";
import {
  AppProfile,
  AppTheme,
  getProfileSettings,
  saveProfileSettings,
} from "../../lib/settingsService";

export default function GeneralSettingsScreen() {
  const { user } = useAuth();
  const activeTheme = useThemedValues();

  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [theme, setTheme] = useState<AppTheme>("dark");
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

      setProfile(data);
      setTheme(data.theme ?? "dark");
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
      };

      await saveProfileSettings(user.uid, nextProfile);
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
      <Pressable
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
      </Pressable>
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
                  Adjust your app theme. Theme preference is saved to your
                  profile.
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