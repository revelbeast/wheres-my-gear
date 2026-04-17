import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ScreenBackground from "../components/ui/ScreenBackground";
import AppHeader from "../components/ui/AppHeader";
import { colors } from "../theme/tokens";
import {
  getNotificationSettings,
  saveNotificationSettings,
  NotificationSettings,
} from "../lib/settingsService";

type SettingRowProps = {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
}: SettingRowProps) {
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: "rgba(255,255,255,0.15)",
          true: "rgba(55, 130, 245, 0.85)",
        }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

export default function NotificationsScreen() {
  const [settings, setSettings] = useState<NotificationSettings>({
    checklistReminders: true,
    tripReminders: true,
    packingReminders: false,
  });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await getNotificationSettings();
      setSettings(data);
    } catch (err) {
      console.error("Failed to load notification settings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(
    key: keyof NotificationSettings,
    value: boolean
  ) {
    const next = {
      ...settings,
      [key]: value,
    };

    setSettings(next);
    setSavingKey(key);

    try {
      await saveNotificationSettings(next);
    } catch (err) {
      console.error("Failed to save notification settings:", err);
      setSettings(settings);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <AppHeader title="Notifications" showBackButton />

          {loading ? (
            <Text style={styles.helperText}>Loading settings...</Text>
          ) : (
            <>
              <ToggleRow
                title="Checklist reminders"
                subtitle="Get reminder settings for your checklists."
                value={settings.checklistReminders}
                onValueChange={(value) =>
                  handleToggle("checklistReminders", value)
                }
              />

              <ToggleRow
                title="Trip reminders"
                subtitle="Enable reminders before upcoming trips."
                value={settings.tripReminders}
                onValueChange={(value) =>
                  handleToggle("tripReminders", value)
                }
              />

              <ToggleRow
                title="Packing reminders"
                subtitle="Get packing reminder nudges before departure."
                value={settings.packingReminders}
                onValueChange={(value) =>
                  handleToggle("packingReminders", value)
                }
              />

              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>Status</Text>
                <Text style={styles.noteText}>
                  {savingKey
                    ? "Saving changes..."
                    : "Your notification settings are saved in Firestore."}
                </Text>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 16 },
  helperText: {
    color: colors.textSecondary,
    fontSize: 14,
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
  rowTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  rowSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  noteCard: {
    marginTop: 8,
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