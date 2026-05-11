import { BlurView } from "expo-blur";
import { ChevronDown } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../../components/ui/AppHeader";
import HapticPressable from "../../components/ui/HapticPressable";
import ScreenBackground from "../../components/ui/ScreenBackground";
import { useThemedValues } from "../../components/ui/Themed";
import {
  getStorageSpaceById,
  updateStorageSpaceNotes,
} from "../../lib/gearService";

const NOTES_KEYBOARD_ACCESSORY_ID = "notes-keyboard-accessory";

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

function getFirstParamValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default function NotesScreen() {
  const theme = useThemedValues();

  const params = useLocalSearchParams<{
    storageId?: string | string[];
    storageName?: string | string[];
  }>();

  const resolvedStorageId = useMemo(
    () => getFirstParamValue(params.storageId).trim(),
    [params.storageId],
  );

  const resolvedStorageName = useMemo(
    () => getFirstParamValue(params.storageName).trim(),
    [params.storageName],
  );

  const isScreenMountedRef = useRef(true);
  const notesLoadVersionRef = useRef(0);
  const notesSaveVersionRef = useRef(0);
  const lastSavedNotesRef = useRef("");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const title = resolvedStorageName ? `${resolvedStorageName} Notes` : "Notes";

  const helperText = resolvedStorageId
    ? "Add storage-specific notes here. Notes auto-save while you type."
    : "Select a storage space from the dashboard to open notes.";

  useEffect(() => {
    isScreenMountedRef.current = true;

    return () => {
      isScreenMountedRef.current = false;
      notesLoadVersionRef.current += 1;
      notesSaveVersionRef.current += 1;

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const loadVersion = notesLoadVersionRef.current + 1;
    notesLoadVersionRef.current = loadVersion;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    async function load() {
      if (!resolvedStorageId) {
        if (
          notesLoadVersionRef.current !== loadVersion ||
          !isScreenMountedRef.current
        ) {
          return;
        }

        setNotes("");
        lastSavedNotesRef.current = "";
        setSaveState("idle");
        setLastSavedAt(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const data = await getStorageSpaceById(resolvedStorageId);
        const value = data?.notes ?? "";

        if (
          notesLoadVersionRef.current !== loadVersion ||
          !isScreenMountedRef.current
        ) {
          return;
        }

        setNotes(value);
        lastSavedNotesRef.current = value;
        setSaveState("saved");
        setLastSavedAt(Date.now());
      } catch (err) {
        if (
          notesLoadVersionRef.current !== loadVersion ||
          !isScreenMountedRef.current
        ) {
          return;
        }

        console.error(err);
        setSaveState("error");
      } finally {
        if (
          notesLoadVersionRef.current === loadVersion &&
          isScreenMountedRef.current
        ) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      notesLoadVersionRef.current += 1;

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [resolvedStorageId]);

  async function saveNotes(next: string, manual = false) {
    if (!resolvedStorageId) return;

    if (next === lastSavedNotesRef.current) return;

    const saveVersion = notesSaveVersionRef.current + 1;
    notesSaveVersionRef.current = saveVersion;

    try {
      setSaving(true);
      setSaveState("saving");

      await updateStorageSpaceNotes(resolvedStorageId, next);

      if (
        notesSaveVersionRef.current !== saveVersion ||
        !isScreenMountedRef.current
      ) {
        return;
      }

      lastSavedNotesRef.current = next;
      setSaveState("saved");
      setLastSavedAt(Date.now());

      if (manual) Alert.alert("Saved", "Notes saved.");
    } catch {
      if (
        notesSaveVersionRef.current !== saveVersion ||
        !isScreenMountedRef.current
      ) {
        return;
      }

      setSaveState("error");
      if (manual) Alert.alert("Error", "Failed to save.");
    } finally {
      if (
        notesSaveVersionRef.current === saveVersion &&
        isScreenMountedRef.current
      ) {
        setSaving(false);
      }
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
      void saveNotes(value);
    }, 900);
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
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
                <Text
                  style={{ color: theme.colors.textSecondary, fontSize: 12 }}
                >
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
                inputAccessoryViewID={
                  Platform.OS === "ios"
                    ? NOTES_KEYBOARD_ACCESSORY_ID
                    : undefined
                }
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

              <HapticPressable
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={() => saveNotes(notes, true)}
                disabled={saving}
              >
                <Text style={styles.saveText}>
                  {saving ? "Saving..." : "Save Notes"}
                </Text>
              </HapticPressable>
            </FrostedCard>

            {Platform.OS === "ios" && (
              <InputAccessoryView nativeID={NOTES_KEYBOARD_ACCESSORY_ID}>
                <View style={styles.keyboardAccessory}>
                  <HapticPressable
                    onPress={Keyboard.dismiss}
                    style={styles.keyboardDismissButton}
                  >
                    <ChevronDown size={22} color="#FFFFFF" />
                  </HapticPressable>
                </View>
              </InputAccessoryView>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  keyboardAvoidingView: {
    flex: 1,
  },

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

  keyboardAccessory: {
    minHeight: 44,
    backgroundColor: "rgba(20,20,24,0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  keyboardDismissButton: {
    width: 40,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
