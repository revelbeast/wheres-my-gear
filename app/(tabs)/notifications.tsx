import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../../components/ui/AppHeader";
import ScreenBackground from "../../components/ui/ScreenBackground";
import {
  getNotificationSettings,
  NotificationSettings,
  saveNotificationSettings,
} from "../../lib/settingsService";
import { colors } from "../../theme/tokens";

type SettingKey = keyof NotificationSettings;

type SettingRowProps = {
  title: string;
  subtitle: string;
  value: boolean;
  disabled: boolean;
  onValueChange: (value: boolean) => void;
};

function ToggleRow({
  title,
  subtitle,
  value,
  disabled,
  onValueChange,
}: SettingRowProps) {
  return (
    <View style={[styles.rowCard, disabled && styles.disabledInteraction]}>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
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
  const isMountedRef = useRef(true);
  const loadRequestVersionRef = useRef(0);
  const actionLockRef = useRef(false);

  const [settings, setSettings] = useState<NotificationSettings>({
    checklistReminders: true,
    tripReminders: true,
    packingReminders: false,
  });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<SettingKey | null>(null);

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

    try {
      const data = await getNotificationSettings();

      if (
        !isMountedRef.current ||
        loadRequestVersionRef.current !== requestVersion
      ) {
        return;
      }

      setSettings(data);
    } catch (err) {
      console.error("Failed to load notification settings:", err);
    } finally {
      if (
        isMountedRef.current &&
        loadRequestVersionRef.current === requestVersion
      ) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleToggle(key: SettingKey, value: boolean) {
    if (loading || savingKey || actionLockRef.current) return;

    actionLockRef.current = true;

    const previousSettings = settings;

    const next = {
      ...settings,
      [key]: value,
    };

    if (isMountedRef.current) {
      setSettings(next);
      setSavingKey(key);
    }

    try {
      await saveNotificationSettings(next);
    } catch (err) {
      console.error("Failed to save notification settings:", err);

      if (!isMountedRef.current) {
        return;
      }

      setSettings(previousSettings);
    } finally {
      actionLockRef.current = false;

      if (isMountedRef.current) {
        setSavingKey(null);
      }
    }
  }

  const settingsDisabled = loading || !!savingKey || actionLockRef.current;

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
                disabled={settingsDisabled}
                onValueChange={(value) =>
                  handleToggle("checklistReminders", value)
                }
              />

              <ToggleRow
                title="Trip reminders"
                subtitle="Enable reminders before upcoming trips."
                value={settings.tripReminders}
                disabled={settingsDisabled}
                onValueChange={(value) => handleToggle("tripReminders", value)}
              />

              <ToggleRow
                title="Packing reminders"
                subtitle="Get packing reminder nudges before departure."
                value={settings.packingReminders}
                disabled={settingsDisabled}
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
  safe: {
    flex: 1,
  },

  container: {
    flex: 1,
    padding: 16,
  },

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

  disabledInteraction: {
    opacity: 0.65,
  },
});