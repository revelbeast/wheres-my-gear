import { BlurView } from "expo-blur";
import { router } from "expo-router";
import {
  Backpack,
  ChevronRight,
  Cross,
  Fish,
  MonitorSmartphone,
  Package,
  Shirt,
  Tent,
  UtensilsCrossed,
  Wrench,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
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
  createChecklist,
  createChecklistFromTemplate,
  deleteChecklistTemplate,
  getChecklistTemplateItems,
  getChecklistTemplates,
  updateChecklistTemplateName,
} from "../../lib/checklistsService";
import type { ChecklistCategory } from "../../types/checklists";

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
      intensity={theme.isLight ? 22 : 35}
      tint={theme.isLight ? "light" : "dark"}
      style={[
        styles.card,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.isLight
            ? "rgba(255,255,255,0.68)"
            : "rgba(255,255,255,0.03)",
        },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

function getIcon(category: string, color: string) {
  switch (category) {
    case "trip":
      return <Backpack size={22} color={color} />;
    case "camping":
      return <Tent size={22} color={color} />;
    case "hunting":
      return <Package size={22} color={color} />;
    case "fishing":
      return <Fish size={22} color={color} />;
    case "clothing":
      return <Shirt size={22} color={color} />;
    case "electronics":
      return <MonitorSmartphone size={22} color={color} />;
    case "medical":
      return <Cross size={22} color={color} />;
    case "tools":
      return <Wrench size={22} color={color} />;
    case "food":
      return <UtensilsCrossed size={22} color={color} />;
    case "custom":
      return <Package size={22} color={color} />;
    default:
      return <Backpack size={22} color={color} />;
  }
}

const CATEGORY_OPTIONS: {
  key: ChecklistCategory;
  label: string;
}[] = [
  { key: "trip", label: "Trip" },
  { key: "camping", label: "Camping" },
  { key: "hunting", label: "Hunting" },
  { key: "fishing", label: "Fishing" },
  { key: "clothing", label: "Clothing" },
  { key: "electronics", label: "Electronics" },
  { key: "medical", label: "Medical" },
  { key: "tools", label: "Tools" },
  { key: "food", label: "Food" },
  { key: "custom", label: "Other" },
];

export default function CreateChecklistScreen() {
  const { user, initializing } = useAuth();
  const theme = useThemedValues();

  const [templates, setTemplates] = useState<any[]>([]);
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);
  const [manageTemplate, setManageTemplate] = useState<any | null>(null);
  const [templateItems, setTemplateItems] = useState<any[]>([]);
  const [loadingPreviewItems, setLoadingPreviewItems] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [creatingChecklist, setCreatingChecklist] = useState(false);

  const [newChecklistName, setNewChecklistName] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<ChecklistCategory>("trip");
  const [customCategoryLabel, setCustomCategoryLabel] = useState("");
  const [creatingNewChecklist, setCreatingNewChecklist] = useState(false);

  useEffect(() => {
    if (initializing) {
      return;
    }

    if (!user) {
      setTemplates([]);
      return;
    }

    loadTemplates();
  }, [initializing, user]);

  async function loadTemplates() {
    if (!user) return;

    try {
      const data = await getChecklistTemplates(user.uid);
      setTemplates(data);
    } catch (error) {
      console.error("Failed to load templates:", error);
      setTemplates([]);
    }
  }

  async function openPreview(template: any) {
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to view templates.");
      return;
    }

    try {
      setPreviewTemplate(template);
      setTemplateItems([]);
      setLoadingPreviewItems(true);

      const items = await getChecklistTemplateItems(user.uid, template.id);
      setTemplateItems(items);
    } catch (error) {
      console.error("Failed to load template preview:", error);
      Alert.alert("Error", "Failed to load template preview.");
    } finally {
      setLoadingPreviewItems(false);
    }
  }

  function openTemplateActions(template: any) {
    if (!user) return;

    Alert.alert("Template Options", template.name, [
      {
        text: "Rename",
        onPress: () => {
          setManageTemplate(template);
          setRenameValue(template.name ?? "");
          setRenameModalVisible(true);
        },
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteChecklistTemplate(user.uid, template.id);
            await loadTemplates();

            if (previewTemplate?.id === template.id) {
              setPreviewTemplate(null);
              setTemplateItems([]);
            }
          } catch (error) {
            console.error("Failed to delete template:", error);
            Alert.alert("Error", "Failed to delete template.");
          }
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  }

  async function handleRename() {
    if (!manageTemplate || !user) return;

    const trimmed = renameValue.trim();
    if (!trimmed) {
      Alert.alert("Missing name", "Please enter a template name.");
      return;
    }

    try {
      setSavingRename(true);
      await updateChecklistTemplateName(user.uid, manageTemplate.id, trimmed);
      setRenameModalVisible(false);
      setManageTemplate(null);
      setRenameValue("");
      await loadTemplates();

      if (previewTemplate?.id === manageTemplate.id) {
        setPreviewTemplate({
          ...previewTemplate,
          name: trimmed,
        });
      }
    } catch (error) {
      console.error("Failed to rename template:", error);
      Alert.alert("Error", "Failed to rename template.");
    } finally {
      setSavingRename(false);
    }
  }

  async function handleCreateChecklist() {
    if (!previewTemplate || !user) return;

    try {
      setCreatingChecklist(true);
      const checklistId = await createChecklistFromTemplate(
        user.uid,
        previewTemplate
      );

      setPreviewTemplate(null);
      setTemplateItems([]);
      router.replace(`/checklists/${checklistId}`);
    } catch (error) {
      console.error("Failed to create checklist:", error);
      Alert.alert("Error", "Failed to create checklist.");
    } finally {
      setCreatingChecklist(false);
    }
  }

  async function handleCreateNewChecklist() {
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to create a checklist.");
      return;
    }

    const trimmedName = newChecklistName.trim();
    const trimmedCustomCategory = customCategoryLabel.trim();

    if (!trimmedName) {
      Alert.alert("Missing name", "Please enter a checklist name.");
      return;
    }

    if (selectedCategory === "custom" && !trimmedCustomCategory) {
      Alert.alert("Missing category", "Please enter a custom category.");
      return;
    }

    try {
      setCreatingNewChecklist(true);

      const checklistId = await createChecklist(user.uid, {
        name: trimmedName,
        category: selectedCategory,
        customCategoryLabel:
          selectedCategory === "custom" ? trimmedCustomCategory : null,
        templateId: null,
        vehicleId: null,
        tripId: null,
      } as any);

      setNewChecklistName("");
      setSelectedCategory("trip");
      setCustomCategoryLabel("");
      router.replace(`/checklists/${checklistId}`);
    } catch (error) {
      console.error("Failed to create new checklist:", error);
      Alert.alert("Error", "Failed to create new checklist.");
    } finally {
      setCreatingNewChecklist(false);
    }
  }

  function closePreview() {
    setPreviewTemplate(null);
    setTemplateItems([]);
    setLoadingPreviewItems(false);
  }

  function closeRenameModal() {
    if (savingRename) return;
    setRenameModalVisible(false);
    setManageTemplate(null);
    setRenameValue("");
  }

  function renderTemplate(template: any) {
    const templateCategoryLabel =
      template.category === "custom"
        ? template.customCategoryLabel || "Other"
        : CATEGORY_OPTIONS.find((option) => option.key === template.category)
            ?.label || template.category;

    return (
      <FrostedCard key={template.id}>
        <Pressable
          style={styles.row}
          onPress={() => openPreview(template)}
          onLongPress={() => openTemplateActions(template)}
        >
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: theme.colors.iconSurface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {getIcon(template.category, theme.colors.text)}
          </View>

          <View style={styles.textWrap}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {template.name}
            </Text>
            <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
              {templateCategoryLabel}. Tap to preview. Long press to manage.
            </Text>
          </View>

          <ChevronRight size={18} color={theme.colors.textSecondary} />
        </Pressable>
      </FrostedCard>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppHeader title="Create Checklist" showBackButton />

          <FrostedCard style={styles.heroCard}>
            <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
              Create New Checklist
            </Text>
            <Text style={[styles.heroText, { color: theme.colors.textSecondary }]}>
              Start a checklist from scratch, or use one of your templates below.
            </Text>
          </FrostedCard>

          {initializing ? (
            <FrostedCard>
              <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
                Loading account...
              </Text>
            </FrostedCard>
          ) : !user ? (
            <FrostedCard>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                Sign in required
              </Text>
              <Text
                style={[styles.emptyText, { color: theme.colors.textSecondary }]}
              >
                Please sign in to create or manage checklists.
              </Text>
            </FrostedCard>
          ) : (
            <>
              <FrostedCard>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  Checklist Name
                </Text>
                <TextInput
                  value={newChecklistName}
                  onChangeText={setNewChecklistName}
                  placeholder="Enter checklist name"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[
                    styles.input,
                    {
                      color: theme.colors.text,
                      backgroundColor: theme.colors.inputSurface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                />

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  Category
                </Text>

                <View style={styles.categoryGrid}>
                  {CATEGORY_OPTIONS.map((option) => {
                    const selected = selectedCategory === option.key;

                    return (
                      <Pressable
                        key={option.key}
                        style={[
                          styles.categoryButton,
                          {
                            backgroundColor: theme.colors.iconSurface,
                            borderColor: theme.colors.border,
                          },
                          selected && styles.categoryButtonSelected,
                        ]}
                        onPress={() => setSelectedCategory(option.key)}
                      >
                        <View style={styles.categoryIconWrap}>
                          {getIcon(option.key, selected ? "#fff" : theme.colors.text)}
                        </View>
                        <Text
                          style={[
                            styles.categoryButtonText,
                            { color: theme.colors.text },
                            selected && styles.categoryButtonTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {selectedCategory === "custom" ? (
                  <View style={styles.customCategoryWrap}>
                    <Text
                      style={[styles.sectionTitle, { color: theme.colors.text }]}
                    >
                      Custom Category
                    </Text>
                    <TextInput
                      value={customCategoryLabel}
                      onChangeText={setCustomCategoryLabel}
                      placeholder="Enter custom category"
                      placeholderTextColor={theme.colors.textMuted}
                      style={[
                        styles.input,
                        {
                          color: theme.colors.text,
                          backgroundColor: theme.colors.inputSurface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    />
                  </View>
                ) : null}

                <Pressable
                  style={[
                    styles.primaryButton,
                    creatingNewChecklist && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleCreateNewChecklist}
                  disabled={creatingNewChecklist}
                >
                  <Text style={styles.primaryButtonText}>
                    {creatingNewChecklist ? "Creating..." : "Create New Checklist"}
                  </Text>
                </Pressable>
              </FrostedCard>

              <FrostedCard style={styles.heroCard}>
                <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
                  My Templates
                </Text>
                <Text
                  style={[styles.heroText, { color: theme.colors.textSecondary }]}
                >
                  Tap a template to preview it. Long press to rename or delete it.
                </Text>
              </FrostedCard>

              {templates.length === 0 ? (
                <FrostedCard>
                  <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                    No templates yet
                  </Text>
                  <Text
                    style={[
                      styles.emptyText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Save any checklist as a template, then it will appear here.
                  </Text>
                </FrostedCard>
              ) : (
                templates.map(renderTemplate)
              )}
            </>
          )}
        </ScrollView>

        <Modal
          visible={!!previewTemplate}
          animationType="slide"
          onRequestClose={closePreview}
        >
          <ScreenBackground>
            <SafeAreaView style={styles.safe}>
              <ScrollView contentContainerStyle={styles.content}>
                <AppHeader
                  title={previewTemplate?.name || "Template Preview"}
                  showBackButton
                />

                <FrostedCard style={styles.heroCard}>
                  <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
                    {previewTemplate?.name}
                  </Text>
                  <Text
                    style={[
                      styles.heroText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Review the template items below, then create a checklist when ready.
                  </Text>
                </FrostedCard>

                {loadingPreviewItems ? (
                  <FrostedCard>
                    <Text
                      style={[styles.meta, { color: theme.colors.textSecondary }]}
                    >
                      Loading items...
                    </Text>
                  </FrostedCard>
                ) : templateItems.length === 0 ? (
                  <FrostedCard>
                    <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                      No items found
                    </Text>
                    <Text
                      style={[
                        styles.emptyText,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      This template does not have any items yet.
                    </Text>
                  </FrostedCard>
                ) : (
                  templateItems.map((item, index) => (
                    <FrostedCard key={`${item.id ?? item.name}-${index}`}>
                      <Text style={[styles.itemText, { color: theme.colors.text }]}>
                        {item.name}
                      </Text>
                    </FrostedCard>
                  ))
                )}

                <Pressable
                  style={[
                    styles.primaryButton,
                    creatingChecklist && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleCreateChecklist}
                  disabled={creatingChecklist}
                >
                  <Text style={styles.primaryButtonText}>
                    {creatingChecklist ? "Creating..." : "Create Checklist"}
                  </Text>
                </Pressable>

                <Pressable style={styles.secondaryButton} onPress={closePreview}>
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Cancel
                  </Text>
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </ScreenBackground>
        </Modal>

        <Modal
          visible={renameModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeRenameModal}
        >
          <View style={styles.modalOverlay}>
            <BlurView
              intensity={theme.isLight ? 22 : 35}
              tint={theme.isLight ? "light" : "dark"}
              style={[
                styles.modalCard,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.isLight
                    ? "rgba(255,255,255,0.94)"
                    : "rgba(255,255,255,0.04)",
                },
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Rename Template
              </Text>

              <TextInput
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder="Enter template name"
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
              />

              <Pressable
                style={[
                  styles.primaryButton,
                  savingRename && styles.primaryButtonDisabled,
                ]}
                onPress={handleRename}
                disabled={savingRename}
              >
                <Text style={styles.primaryButtonText}>
                  {savingRename ? "Saving..." : "Save"}
                </Text>
              </Pressable>

              <Pressable style={styles.secondaryButton} onPress={closeRenameModal}>
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
            </BlurView>
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
    padding: 16,
    paddingBottom: 120,
  },

  card: {
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    overflow: "hidden",
  },

  heroCard: {
    marginBottom: 14,
  },

  heroTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },

  heroText: {
    fontSize: 14,
    lineHeight: 20,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: 12,
  },

  textWrap: {
    flex: 1,
  },

  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },

  meta: {
    fontSize: 13,
  },

  itemText: {
    fontSize: 15,
    fontWeight: "600",
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },

  emptyText: {
    fontSize: 13,
    lineHeight: 18,
  },

  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  categoryButton: {
    width: "48%",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  categoryButtonSelected: {
    borderColor: "rgba(55,130,245,0.95)",
    backgroundColor: "rgba(55,130,245,0.95)",
  },

  categoryIconWrap: {
    marginBottom: 8,
  },

  categoryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },

  categoryButtonTextSelected: {
    color: "#ffffff",
  },

  customCategoryWrap: {
    marginTop: 14,
  },

  primaryButton: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(55,130,245,0.95)",
    alignItems: "center",
  },

  primaryButtonDisabled: {
    opacity: 0.6,
  },

  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  secondaryButton: {
    marginTop: 10,
    alignItems: "center",
    paddingVertical: 10,
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  modalCard: {
    borderRadius: 18,
    padding: 18,
    overflow: "hidden",
    borderWidth: 1,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },

  input: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
});