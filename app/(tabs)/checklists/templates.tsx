import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { Pencil, Trash2 } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../../components/auth/AuthProvider";
import AppHeader from "../../../components/ui/AppHeader";
import HapticPressable from "../../../components/ui/HapticPressable";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import { useThemedValues } from "../../../components/ui/Themed";
import {
  deleteChecklistTemplate,
  getChecklistTemplateItems,
  getChecklistTemplates,
  updateChecklistTemplateName,
} from "../../../lib/checklistsService";
import { useInteractionLock } from "../../../lib/useInteractionLock";
import type { ChecklistTemplate } from "../../../types/checklists";

function FrostedCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  const theme = useThemedValues();

  return (
    <View
      style={[
        styles.cardShell,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
        style,
      ]}
    >
      <BlurView
        intensity={theme.isLight ? 22 : 35}
        tint={theme.isLight ? "light" : "dark"}
        style={styles.cardBlur}
      >
        {children}
      </BlurView>
    </View>
  );
}

export default function ManageTemplatesScreen() {
  const { user, initializing } = useAuth();
  const theme = useThemedValues();

  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const navigationTransitionLockedRef = useRef(false);
  const navigationUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  const [selectedTemplate, setSelectedTemplate] =
    useState<ChecklistTemplate | null>(null);

  useEffect(() => {
    return () => {
      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (initializing) return;

      if (!user) {
        setTemplates([]);
        setLoading(false);
        return;
      }

      loadTemplates();
    }, [initializing, user])
  );

  async function runWithLock(action: () => Promise<void> | void) {
    if (interactionLocked) return;

    lockInteraction();

    try {
      await action();
    } finally {
      unlockInteraction();
    }
  }

  function lockNavigationTransition() {
    if (navigationTransitionLockedRef.current) {
      return false;
    }

    navigationTransitionLockedRef.current = true;

    if (navigationUnlockTimeoutRef.current) {
      clearTimeout(navigationUnlockTimeoutRef.current);
    }

    navigationUnlockTimeoutRef.current = setTimeout(() => {
      navigationTransitionLockedRef.current = false;
      navigationUnlockTimeoutRef.current = null;
    }, 1500);

    return true;
  }

  function runNavigationAction(action: () => void) {
    if (interactionLocked || navigationTransitionLockedRef.current) {
      return;
    }

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    action();
  }

  async function loadTemplates() {
    if (!user) return;

    try {
      setLoading(true);
      const data = await getChecklistTemplates(user.uid);
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load templates:", err);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  async function handlePreviewTemplate(template: ChecklistTemplate) {
    if (!user || interactionLocked) return;

    await runWithLock(async () => {
      if (!user) return;

      try {
        const items = await getChecklistTemplateItems(user.uid, template.id);

        Alert.alert(
          template.name,
          items.map((i) => `• ${i.name}`).join("\n") || "No items"
        );
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to load template preview.");
      }
    });
  }

  function handleEditTemplateItems(template: ChecklistTemplate) {
    runNavigationAction(() => {
      router.push(`/checklists/template-items?templateId=${template.id}`);
    });
  }

  function handleOpenRename(template: ChecklistTemplate) {
    if (interactionLocked || savingRename) return;

    setSelectedTemplate(template);
    setRenameValue(template.name);
    setRenameVisible(true);
  }

  function handleCloseRename() {
    if (savingRename || interactionLocked) return;

    setRenameVisible(false);
    setSelectedTemplate(null);
    setRenameValue("");
  }

  async function handleSaveRename() {
    const trimmed = renameValue.trim();

    if (!selectedTemplate || !trimmed || !user || savingRename || interactionLocked) {
      return;
    }

    await runWithLock(async () => {
      if (!selectedTemplate || !user) return;

      try {
        setSavingRename(true);

        await updateChecklistTemplateName(user.uid, selectedTemplate.id, trimmed);

        setRenameVisible(false);
        setSelectedTemplate(null);
        setRenameValue("");

        await loadTemplates();
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to rename template.");
      } finally {
        setSavingRename(false);
      }
    });
  }

  function handleDeleteTemplate(template: ChecklistTemplate) {
    if (!user || interactionLocked || savingRename) return;

    Alert.alert("Delete Template", `Delete "${template.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void runWithLock(async () => {
            if (!user) return;

            try {
              await deleteChecklistTemplate(user.uid, template.id);
              await loadTemplates();
            } catch (err) {
              console.error(err);
              Alert.alert("Error", "Failed to delete template.");
            }
          });
        },
      },
    ]);
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppHeader title="Manage Templates" showBackButton />

          {loading ? (
            <Text style={[styles.loadingText, { color: theme.colors.text }]}>
              Loading...
            </Text>
          ) : templates.length === 0 ? (
            <FrostedCard>
              <Text style={[styles.emptyText, { color: theme.colors.text }]}>
                No templates yet
              </Text>
            </FrostedCard>
          ) : (
            templates.map((template) => (
              <FrostedCard key={template.id}>
                <View style={styles.templateRow}>
                  <HapticPressable
                    style={styles.templateMainPressable}
                    onPress={() => handleEditTemplateItems(template)}
                    disabled={interactionLocked}
                  >
                    <View style={styles.templateLeft}>
                      <Text
                        style={[
                          styles.templateTitle,
                          { color: theme.colors.text },
                        ]}
                      >
                        {template.name}
                      </Text>

                      <View style={styles.templateLinks}>
                        <HapticPressable
                          onPress={() => handlePreviewTemplate(template)}
                          hitSlop={10}
                          disabled={interactionLocked}
                        >
                          <Text
                            style={[
                              styles.previewText,
                              interactionLocked && styles.disabledButton,
                            ]}
                          >
                            Preview
                          </Text>
                        </HapticPressable>

                        <Text
                          style={[
                            styles.editHintText,
                            { color: theme.colors.textSecondary },
                          ]}
                        >
                          Tap card to edit items
                        </Text>
                      </View>
                    </View>
                  </HapticPressable>

                  <View style={styles.templateActions}>
                    <HapticPressable
                      onPress={() => handleOpenRename(template)}
                      disabled={interactionLocked || savingRename}
                      style={[
                        styles.iconButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                        (interactionLocked || savingRename) &&
                          styles.disabledButton,
                      ]}
                    >
                      <Pencil size={17} color={theme.colors.text} />
                    </HapticPressable>

                    <HapticPressable
                      onPress={() => handleDeleteTemplate(template)}
                      disabled={interactionLocked || savingRename}
                      style={[
                        styles.iconButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                        (interactionLocked || savingRename) &&
                          styles.disabledButton,
                      ]}
                    >
                      <Trash2 size={17} color={theme.colors.danger} />
                    </HapticPressable>
                  </View>
                </View>
              </FrostedCard>
            ))
          )}
        </ScrollView>

        {renameVisible && (
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: theme.colors.cardStrong,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Rename Template
              </Text>

              <TextInput
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder="Rename template"
                placeholderTextColor={theme.colors.textMuted}
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.inputSurface,
                    borderColor: theme.colors.border,
                  },
                ]}
                autoFocus
                returnKeyType="done"
                editable={!savingRename && !interactionLocked}
                onSubmitEditing={handleSaveRename}
              />

              <HapticPressable
                style={[
                  styles.saveButton,
                  !renameValue.trim() || savingRename || interactionLocked
                    ? styles.disabledButton
                    : {},
                ]}
                onPress={handleSaveRename}
                disabled={!renameValue.trim() || savingRename || interactionLocked}
              >
                <Text style={styles.saveButtonText}>
                  {savingRename ? "Saving..." : "Save"}
                </Text>
              </HapticPressable>

              <HapticPressable
                onPress={handleCloseRename}
                style={[
                  styles.cancelButton,
                  (savingRename || interactionLocked) && styles.disabledButton,
                ]}
                disabled={savingRename || interactionLocked}
              >
                <Text
                  style={[
                    styles.cancelButtonText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </HapticPressable>
            </View>
          </View>
        )}
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
    paddingBottom: 160,
  },

  cardShell: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },

  cardBlur: {
    padding: 14,
  },

  loadingText: {
    fontSize: 14,
    fontWeight: "600",
  },

  emptyText: {
    fontSize: 15,
    fontWeight: "700",
  },

  templateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  templateMainPressable: {
    flex: 1,
    paddingRight: 12,
  },

  templateLeft: {
    flex: 1,
  },

  templateTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },

  templateLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  previewText: {
    color: "#2f80ed",
    fontSize: 14,
    fontWeight: "700",
  },

  editHintText: {
    fontSize: 13,
    fontWeight: "600",
  },

  templateActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
  },

  modalCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },

  saveButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(55,130,245,0.95)",
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  cancelButton: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: "center",
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});