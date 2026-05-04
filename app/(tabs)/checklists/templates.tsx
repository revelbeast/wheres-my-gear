import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { Pencil, Trash2 } from "lucide-react-native";
import React, { useCallback, useState } from "react";
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

import { useAuth } from "../../../components/auth/AuthProvider";
import AppHeader from "../../../components/ui/AppHeader";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import { useThemedValues } from "../../../components/ui/Themed";
import {
  deleteChecklistTemplate,
  getChecklistTemplateItems,
  getChecklistTemplates,
  updateChecklistTemplateName,
} from "../../../lib/checklistsService";
import type { ChecklistTemplate } from "../../../types/checklists";

function FrostedCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  const theme = useThemedValues();

  return (
    <View
      style={[
        styles.cardShell,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.isLight
            ? "rgba(255,255,255,0.68)"
            : "rgba(255,255,255,0.02)",
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

  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  const [selectedTemplate, setSelectedTemplate] =
    useState<ChecklistTemplate | null>(null);

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
  }

  function handleEditTemplateItems(template: ChecklistTemplate) {
    router.push(`/checklists/template-items?templateId=${template.id}`);
  }

  function handleOpenRename(template: ChecklistTemplate) {
    setSelectedTemplate(template);
    setRenameValue(template.name);
    setRenameVisible(true);
  }

  function handleCloseRename() {
    if (savingRename) return;

    setRenameVisible(false);
    setSelectedTemplate(null);
    setRenameValue("");
  }

  async function handleSaveRename() {
    const trimmed = renameValue.trim();

    if (!selectedTemplate || !trimmed || !user) {
      return;
    }

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
  }

  function handleDeleteTemplate(template: ChecklistTemplate) {
    if (!user) return;

    Alert.alert("Delete Template", `Delete "${template.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteChecklistTemplate(user.uid, template.id);
            await loadTemplates();
          } catch (err) {
            console.error(err);
            Alert.alert("Error", "Failed to delete template.");
          }
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
                  <Pressable
                    style={styles.templateMainPressable}
                    onPress={() => handleEditTemplateItems(template)}
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
                        <Pressable
                          onPress={() => handlePreviewTemplate(template)}
                          hitSlop={10}
                        >
                          <Text style={styles.previewText}>Preview</Text>
                        </Pressable>

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
                  </Pressable>

                  <View style={styles.templateActions}>
                    <Pressable
                      onPress={() => handleOpenRename(template)}
                      style={[
                        styles.iconButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Pencil size={17} color={theme.colors.text} />
                    </Pressable>

                    <Pressable
                      onPress={() => handleDeleteTemplate(template)}
                      style={[
                        styles.iconButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Trash2 size={17} color={theme.colors.danger} />
                    </Pressable>
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
                  backgroundColor: theme.isLight ? "#fff" : "#111",
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
                onSubmitEditing={handleSaveRename}
              />

              <Pressable
                style={[
                  styles.saveButton,
                  !renameValue.trim() || savingRename
                    ? styles.disabledButton
                    : {},
                ]}
                onPress={handleSaveRename}
                disabled={!renameValue.trim() || savingRename}
              >
                <Text style={styles.saveButtonText}>
                  {savingRename ? "Saving..." : "Save"}
                </Text>
              </Pressable>

              <Pressable onPress={handleCloseRename} style={styles.cancelButton}>
                <Text
                  style={[
                    styles.cancelButtonText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
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