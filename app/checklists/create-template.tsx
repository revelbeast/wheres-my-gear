import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { ChevronDown, Plus, Trash2 } from "lucide-react-native";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../components/auth/AuthProvider";
import AppHeader from "../../components/ui/AppHeader";
import ScreenBackground from "../../components/ui/ScreenBackground";
import {
  ThemedButton,
  ThemedText,
  useThemedValues,
} from "../../components/ui/Themed";
import { createChecklistTemplateWithItems } from "../../lib/checklistsService";
import type { ChecklistCategory } from "../../types/checklists";

const CATEGORY_OPTIONS: {
  key: ChecklistCategory;
  label: string;
}[] = [
  { key: "trip", label: "Trip" },
  { key: "camping", label: "Camping" },
  { key: "hunting", label: "Hunting" },
  { key: "fishing", label: "Fishing" },
  { key: "boating", label: "Boating" },
  { key: "clothing", label: "Clothing" },
  { key: "electronics", label: "Electronics" },
  { key: "medical", label: "Medical" },
  { key: "tools", label: "Tools" },
  { key: "food", label: "Food" },
  { key: "custom", label: "Other" },
];

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

export default function CreateTemplateScreen() {
  const { user } = useAuth();
  const theme = useThemedValues();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ChecklistCategory>("trip");
  const [customCategory, setCustomCategory] = useState("");
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [items, setItems] = useState<{ id: string; name: string }[]>([
    { id: "1", name: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const selectedCategoryLabel =
    CATEGORY_OPTIONS.find((option) => option.key === category)?.label ??
    "Select Category";

  function addItem() {
    setItems((prev) => [...prev, { id: Date.now().toString(), name: "" }]);
  }

  function updateItem(id: string, value: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name: value } : item))
    );
  }

  function removeItem(id: string) {
    setItems((prev) => {
      if (prev.length === 1) {
        return [{ id: "1", name: "" }];
      }

      return prev.filter((item) => item.id !== id);
    });
  }

  function handleSelectCategory(nextCategory: ChecklistCategory) {
    setCategory(nextCategory);
    setCategoryModalVisible(false);

    if (nextCategory !== "custom") {
      setCustomCategory("");
    }
  }

  async function handleSave() {
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to create a template.");
      return;
    }

    const trimmedName = name.trim();
    const trimmedCustomCategory = customCategory.trim();
    const validItems = items
      .map((item) => ({ name: item.name.trim() }))
      .filter((item) => item.name.length > 0);

    if (!trimmedName) {
      Alert.alert("Required name", "Please enter a template name.");
      return;
    }

    if (category === "custom" && !trimmedCustomCategory) {
      Alert.alert("Required category", "Please enter a custom category.");
      return;
    }

    if (validItems.length === 0) {
      Alert.alert("Required item", "Please add at least one template item.");
      return;
    }

    try {
      setSaving(true);

      await createChecklistTemplateWithItems(user.uid, {
        name: trimmedName,
        category,
        customCategoryLabel:
          category === "custom" ? trimmedCustomCategory : "",
        items: validItems,
      });

      router.back();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to create template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          >
            <AppHeader title="Create Template" showBackButton />

            <FrostedCard style={styles.heroCard}>
              <ThemedText variant="title" style={styles.heroTitle}>
                Build a reusable template
              </ThemedText>
              <ThemedText color="secondary" style={styles.heroText}>
                Add a template name, choose a category, and list the standard
                items users can start from later.
              </ThemedText>
            </FrostedCard>

            <FrostedCard>
              <ThemedText style={styles.sectionEyebrow}>
                Template Details
              </ThemedText>

              <ThemedText variant="title" style={styles.sectionTitle}>
                Template Name
              </ThemedText>

              <TextInput
                value={name}
                onChangeText={setName}
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
                returnKeyType="done"
              />

              <ThemedText variant="title" style={styles.sectionTitle}>
                Category
              </ThemedText>

              <Pressable
                style={[
                  styles.dropdownButton,
                  {
                    backgroundColor: theme.colors.inputSurface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => setCategoryModalVisible(true)}
              >
                <ThemedText style={styles.dropdownButtonText}>
                  {selectedCategoryLabel}
                </ThemedText>
                <ChevronDown size={18} color={theme.colors.textSecondary} />
              </Pressable>

              {category === "custom" ? (
                <View style={styles.customCategoryWrap}>
                  <ThemedText variant="title" style={styles.sectionTitle}>
                    Custom Category
                  </ThemedText>

                  <TextInput
                    value={customCategory}
                    onChangeText={setCustomCategory}
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
                    returnKeyType="done"
                  />
                </View>
              ) : null}
            </FrostedCard>

            <FrostedCard>
              <View style={styles.itemsHeaderRow}>
                <View style={styles.itemsHeaderTextWrap}>
                  <ThemedText style={styles.sectionEyebrow}>
                    Template Items
                  </ThemedText>
                  <ThemedText variant="title" style={styles.sectionTitle}>
                    Items
                  </ThemedText>
                </View>

                <Pressable
                  style={[
                    styles.addIconButton,
                    {
                      backgroundColor: theme.colors.iconSurface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={addItem}
                >
                  <Plus size={18} color={theme.colors.text} />
                </Pressable>
              </View>

              {items.map((item, index) => (
                <View key={item.id} style={styles.itemRow}>
                  <TextInput
                    value={item.name}
                    onChangeText={(text) => updateItem(item.id, text)}
                    placeholder={`Item ${index + 1}`}
                    placeholderTextColor={theme.colors.textMuted}
                    style={[
                      styles.input,
                      styles.itemInput,
                      {
                        color: theme.colors.text,
                        backgroundColor: theme.colors.inputSurface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                    returnKeyType="done"
                  />

                  <Pressable
                    style={[
                      styles.deleteButton,
                      {
                        backgroundColor: theme.colors.iconSurface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                    onPress={() => removeItem(item.id)}
                  >
                    <Trash2 size={17} color={theme.colors.danger} />
                  </Pressable>
                </View>
              ))}

              <Pressable
                style={[
                  styles.addItemButton,
                  {
                    backgroundColor: theme.colors.iconSurface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={addItem}
              >
                <Plus size={18} color={theme.colors.text} />
                <ThemedText style={styles.addItemButtonText}>
                  Add Item
                </ThemedText>
              </Pressable>
            </FrostedCard>

            <ThemedButton
              style={[
                styles.primaryButton,
                saving ? styles.primaryButtonDisabled : {},
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              <ThemedText style={styles.primaryButtonText}>
                {saving ? "Creating..." : "Create Template"}
              </ThemedText>
            </ThemedButton>
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal
          visible={categoryModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCategoryModalVisible(false)}
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
              <ThemedText variant="title" style={styles.modalTitle}>
                Select Category
              </ThemedText>

              {CATEGORY_OPTIONS.map((option) => {
                const selected = category === option.key;

                return (
                  <Pressable
                    key={option.key}
                    style={[
                      styles.modalOption,
                      {
                        backgroundColor: theme.colors.iconSurface,
                        borderColor: theme.colors.border,
                      },
                      selected ? styles.modalOptionSelected : {},
                    ]}
                    onPress={() => handleSelectCategory(option.key)}
                  >
                    <ThemedText
                      style={[
                        styles.modalOptionText,
                        selected ? styles.modalOptionTextSelected : {},
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}

              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setCategoryModalVisible(false)}
              >
                <ThemedText color="secondary" style={styles.modalCancelText}>
                  Cancel
                </ThemedText>
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

  keyboardAvoidingView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 180,
  },

  card: {
    marginBottom: 14,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    overflow: "hidden",
  },

  heroCard: {
    paddingVertical: 18,
  },

  heroTitle: {
    marginBottom: 6,
    lineHeight: 24,
  },

  heroText: {
    fontSize: 14,
    lineHeight: 20,
  },

  sectionEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
    opacity: 0.82,
  },

  sectionTitle: {
    marginBottom: 10,
    lineHeight: 22,
  },

  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
  },

  dropdownButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dropdownButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },

  customCategoryWrap: {
    marginTop: 4,
  },

  itemsHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  itemsHeaderTextWrap: {
    flex: 1,
    paddingRight: 12,
  },

  addIconButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },

  itemInput: {
    flex: 1,
    marginBottom: 0,
  },

  deleteButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  addItemButton: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
  },

  addItemButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },

  primaryButton: {
    marginTop: 6,
    paddingVertical: 15,
    borderRadius: 14,
  },

  primaryButtonDisabled: {
    opacity: 0.6,
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
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
    marginBottom: 12,
  },

  modalOption: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
  },

  modalOptionSelected: {
    borderColor: "rgba(55,130,245,0.95)",
    backgroundColor: "rgba(55,130,245,0.95)",
  },

  modalOptionText: {
    fontSize: 15,
    fontWeight: "700",
  },

  modalOptionTextSelected: {
    color: "#fff",
  },

  modalCancelButton: {
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 4,
  },

  modalCancelText: {
    fontSize: 14,
    fontWeight: "700",
  },
});