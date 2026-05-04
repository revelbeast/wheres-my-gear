import { BlurView } from "expo-blur";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../../components/ui/AppHeader";
import ScreenBackground from "../../components/ui/ScreenBackground";
import {
  getStorageSpaceById,
  updateStorageSpaceNotes,
} from "../../lib/gearService";
import { colors } from "../../theme/tokens";
import { useThemedValues } from "../../components/ui/Themed";

function FrostedCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  const theme = useThemedValues();

  return (
    <BlurView
      intensity={theme.isLight ? 18 : 35}
      tint={theme.isLight ? "light" : "dark"}
      style={[
        styles.card,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

type SaveState = "idle" | "saving" | "saved" | "unsaved" | "error";

function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) return "Not saved yet";

  const diffMs = Date.now() - timestamp;
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSeconds < 5) return "Saved just now";
  if (diffSeconds < 60) return `Saved ${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `Saved ${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Saved ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `Saved ${diffDays}d ago`;
}

export default function NotesScreen() {
  const theme = useThemedValues();

  const { storageId, storageName } = useLocalSearchParams<{
    storageId?: string;
    storageName?: string;
  }>();

  const resolvedStorageId = useMemo(
    () => (typeof storageId === "string" ? storageId.trim() : ""),
    [storageId]
  );

  const resolvedStorageName = useMemo(
    () => (typeof storageName === "string" ? storageName.trim() : ""),
    [storageName]
  );

  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const lastSavedNotesRef = useRef("");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const title = resolvedStorageName
    ? `${resolvedStorageName} Notes`
    : "Notes";

  const helperText = resolvedStorageId
    ? "Add storage-specific notes here. Notes auto-save while you type."
    : "Select a storage space from the dashboard to open notes.";

  useEffect(() => {
    async function load() {
      if (!resolvedStorageId) {
        setLoading(false);
        return;
      }

      try {
        const data = await getStorageSpaceById(resolvedStorageId);
        const value = data?.notes ?? "";

        setNotes(value);
        lastSavedNotesRef.current = value;
        setSaveState("saved");
        setLastSavedAt(Date.now());
      } catch (err) {
        console.error(err);
        setSaveState("error");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [resolvedStorageId]);

  async function saveNotes(next: string, manual = false) {
    if (!resolvedStorageId) return;

    if (next === lastSavedNotesRef.current) return;

    try {
      setSaving(true);
      setSaveState("saving");

      await updateStorageSpaceNotes(resolvedStorageId, next);

      lastSavedNotesRef.current = next;
      setSaveState("saved");
      setLastSavedAt(Date.now());

      if (manual) Alert.alert("Saved", "Notes saved.");
    } catch {
      setSaveState("error");
      if (manual) Alert.alert("Error", "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function handleChange(value: string) {
    setNotes(value);

    if (value !== lastSavedNotesRef.current) {
      setSaveState("unsaved");
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveNotes(value);
    }, 900);
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppHeader title={title} showBackButton />

          <FrostedCard>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroText}>{helperText}</Text>
          </FrostedCard>

          <FrostedCard>
            <View style={styles.headerRow}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Notes
              </Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                {loading
                  ? "Loading..."
                  : saveState === "saving"
                  ? "Saving..."
                  : saveState === "unsaved"
                  ? "Unsaved changes"
                  : formatTimeAgo(lastSavedAt)}
              </Text>
            </View>

            <TextInput
              value={notes}
              onChangeText={handleChange}
              multiline
              editable={!loading && !!resolvedStorageId}
              placeholder="Write notes..."
              placeholderTextColor={theme.colors.textMuted}
              style={[
                styles.textArea,
                {
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.isLight
                    ? "rgba(0,0,0,0.04)"
                    : "rgba(255,255,255,0.06)",
                },
              ]}
            />

            <Pressable
              style={[
                styles.saveButton,
                saving && styles.saveButtonDisabled,
              ]}
              onPress={() => saveNotes(notes, true)}
              disabled={saving}
            >
              <Text style={styles.saveText}>
                {saving ? "Saving..." : "Save Notes"}
              </Text>
            </Pressable>
          </FrostedCard>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 120,
  },

  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },

  heroTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
    color: "#fff",
  },

  heroText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#aaa",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  label: {
    fontWeight: "600",
    fontSize: 14,
  },

  textArea: {
    minHeight: 180,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 14,
  },

  saveButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(55,130,245,0.95)",
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveText: {
    color: "#fff",
    fontWeight: "700",
  },
});