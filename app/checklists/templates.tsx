import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { ChevronRight, FileText, Pencil, Trash2 } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../components/auth/AuthProvider";
import AppHeader from "../../components/ui/AppHeader";
import ScreenBackground from "../../components/ui/ScreenBackground";
import { useThemedValues } from "../../components/ui/Themed";
import {
  deleteChecklistTemplate,
  getChecklistTemplateItems,
  getChecklistTemplates,
  updateChecklistTemplateName,
} from "../../lib/checklistsService";
import type {
  ChecklistTemplate,
  ChecklistTemplateItem,
} from "../../types/checklists";

const LABEL_WHITE = "#FFFFFF";

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

  const [selectedTemplate, setSelectedTemplate] =
    useState<ChecklistTemplate | null>(null);
  const [previewItems, setPreviewItems] = useState<ChecklistTemplateItem[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (initializing) {
        return;
      }

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
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to view templates.");
      return;
    }

    try {
      setSelectedTemplate(template);
      setPreviewVisible(true);
      setPreviewLoading(true);
      const items = await getChecklistTemplateItems(user.uid, template.id);
      setPreviewItems(items);
    } catch (err) {
      console.error("Failed to load template items:", err);
      setPreviewItems([]);
      Alert.alert("Error", "Failed to load template preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleOpenRename(template: ChecklistTemplate) {
    setSelectedTemplate(template);
    setRenameValue(template.name);
    setRenameVisible(true);
  }

  async function handleSaveRename() {
    const trimmed = renameValue.trim();

    if (!selectedTemplate || !trimmed || !user) return;

    try {
      setSavingRename(true);
      await updateChecklistTemplateName(user.uid, selectedTemplate.id, trimmed);
      setRenameVisible(false);
      setSelectedTemplate(null);
      setRenameValue("");
      await loadTemplates();
    } catch (err) {
      console.error("Failed to rename template:", err);
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
            console.error("Failed to delete template:", err);
            Alert.alert("Error", "Failed to delete template.");
          }
        },
      },
    ]);
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader title="Manage Templates" showBackButton />

          <View style={styles.heroSection}>
            <Text style={styles.eyebrow}>Templates</Text>
            <Text style={styles.heroTitle}>
              Review and manage saved templates
            </Text>
            <Text style={styles.heroSubtitle}>
              Rename, preview, and delete checklist templates you want to reuse later.
            </Text>
          </View>

          <FrostedCard style={styles.helperCard}>
            <Pressable
              style={styles.helperRow}
              onPress={() => router.push("/checklists/create")}
            >
              <View
                style={[
                  styles.helperIconWrap,
                  {
                    backgroundColor: theme.colors.iconSurface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <FileText size={18} color={theme.colors.text} />
              </View>

              <View style={styles.helperTextWrap}>
                <Text style={[styles.helperTitle, { color: theme.colors.text }]}>
                  Create From Template
                </Text>
                <Text
                  style={[
                    styles.helperSubtitle,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Go back to the checklist creation screen to start from a saved template.
                </Text>
              </View>

              <ChevronRight size={18} color={theme.colors.textSecondary} />
            </Pressable>
          </FrostedCard>

          {loading ? (
            <FrostedCard>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                Loading templates...
              </Text>
            </FrostedCard>
          ) : templates.length === 0 ? (
            <FrostedCard>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                No templates yet
              </Text>
              <Text
                style={[styles.emptyText, { color: theme.colors.textSecondary }]}
              >
                Save a checklist as a template, then manage it here.
              </Text>
            </FrostedCard>
          ) : (
            templates.map((template) => (
              <FrostedCard key={template.id}>
                <View style={styles.templateTopRow}>
                  <View style={styles.templateTextWrap}>
                    <Text
                      style={[
                        styles.templateTitle,
                        { color: theme.colors.text },
                      ]}
                    >
                      {template.name}
                    </Text>
                    <Text
                      style={[
                        styles.templateMeta,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {template.itemCount}{" "}
                      {template.itemCount === 1 ? "item" : "items"}
                    </Text>
                  </View>

                  <View style={styles.actionButtons}>
                    <Pressable
                      style={[
                        styles.iconButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                      onPress={() => handleOpenRename(template)}
                    >
                      <Pencil size={16} color={theme.colors.textSecondary} />
                    </Pressable>

                    <Pressable
                      style={[
                        styles.iconButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                      onPress={() => handleDeleteTemplate(template)}
                    >
                      <Trash2 size={16} color={theme.colors.danger} />
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  style={styles.previewButton}
                  onPress={() => handlePreviewTemplate(template)}
                >
                  <Text style={styles.previewButtonText}>Preview Items</Text>
                </Pressable>
              </FrostedCard>
            ))
          )}
        </ScrollView>

        <Modal visible={renameVisible} transparent animationType="fade">
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
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: theme.colors.inputSurface,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                  },
                ]}
                placeholder="Template name"
                placeholderTextColor={theme.colors.textMuted}
              />

              <Pressable
                style={[
                  styles.primaryButton,
                  (savingRename || !renameValue.trim()) && styles.disabledButton,
                ]}
                onPress={handleSaveRename}
                disabled={savingRename || !renameValue.trim()}
              >
                <Text style={styles.primaryButtonText}>
                  {savingRename ? "Saving..." : "Save"}
                </Text>
              </Pressable>

              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  setRenameVisible(false);
                  setSelectedTemplate(null);
                  setRenameValue("");
                }}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={previewVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalCardLarge,
                {
                  backgroundColor: theme.isLight ? "#fff" : "#111",
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {selectedTemplate?.name ?? "Template Preview"}
              </Text>

              {previewLoading ? (
                <Text
                  style={[styles.emptyText, { color: theme.colors.textSecondary }]}
                >
                  Loading items...
                </Text>
              ) : previewItems.length === 0 ? (
                <Text
                  style={[styles.emptyText, { color: theme.colors.textSecondary }]}
                >
                  No items found in this template.
                </Text>
              ) : (
                <ScrollView
                  style={styles.previewList}
                  showsVerticalScrollIndicator={false}
                >
                  {previewItems.map((item) => (
                    <View key={item.id} style={styles.previewRow}>
                      <View
                        style={[
                          styles.previewBullet,
                          { backgroundColor: theme.colors.textSecondary },
                        ]}
                      />
                      <View style={styles.previewTextWrap}>
                        <Text
                          style={[
                            styles.previewItemTitle,
                            { color: theme.colors.text },
                          ]}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={[
                            styles.previewItemMeta,
                            { color: theme.colors.textSecondary },
                          ]}
                        >
                          Qty: {item.quantity}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}

              <Pressable
                style={styles.primaryButton}
                onPress={() => setPreviewVisible(false)}
              >
                <Text style={styles.primaryButtonText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
  },

  cardShell: {
    marginBottom: 12,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
  },

  cardBlur: {
    padding: 16,
  },

  heroSection: {
    marginBottom: 16,
  },

  eyebrow: {
    color: LABEL_WHITE,
    opacity: 0.82,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },

  heroTitle: {
    color: LABEL_WHITE,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 30,
    marginBottom: 8,
  },

  heroSubtitle: {
    color: LABEL_WHITE,
    opacity: 0.82,
    fontSize: 14,
    lineHeight: 20,
  },

  helperCard: {
    marginBottom: 16,
  },

  helperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  helperIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: 12,
  },

  helperTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  helperTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },

  helperSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },

  templateTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  templateTextWrap: {
    flex: 1,
    paddingRight: 12,
  },

  templateTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    lineHeight: 22,
  },

  templateMeta: {
    fontSize: 13,
  },

  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  previewButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(55,130,245,0.95)",
  },

  previewButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 20,
  },

  modalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },

  modalCardLarge: {
    maxHeight: "75%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },

  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12,
  },

  modalInput: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },

  primaryButton: {
    marginTop: 16,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(55,130,245,0.95)",
  },

  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  secondaryButton: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonText: {
    fontWeight: "600",
  },

  disabledButton: {
    opacity: 0.6,
  },

  previewList: {
    maxHeight: 320,
  },

  previewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
  },

  previewBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
    marginRight: 10,
  },

  previewTextWrap: {
    flex: 1,
  },

  previewItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },

  previewItemMeta: {
    fontSize: 12,
  },
});