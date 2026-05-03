import { BlurView } from "expo-blur";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
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
    addChecklistTemplateItem,
    deleteChecklistTemplateItem,
    getChecklistTemplate,
    getChecklistTemplateItems,
    updateChecklistTemplateItemName,
    updateChecklistTemplateItemQuantity,
} from "../../lib/checklistsService";
import type {
    ChecklistTemplate,
    ChecklistTemplateItem,
} from "../../types/checklists";

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

export default function TemplateItemsScreen() {
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const { user, initializing } = useAuth();
  const theme = useThemedValues();

  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [items, setItems] = useState<ChecklistTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [newItemName, setNewItemName] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [savingItemName, setSavingItemName] = useState(false);

  const safeTemplateId = typeof templateId === "string" ? templateId : "";

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aOrder = Number(a.sortOrder ?? 0);
      const bOrder = Number(b.sortOrder ?? 0);

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });
  }, [items]);

  useFocusEffect(
    useCallback(() => {
      if (initializing) return;

      if (!user || !safeTemplateId) {
        setTemplate(null);
        setItems([]);
        setLoading(false);
        return;
      }

      loadTemplateData();
    }, [initializing, user, safeTemplateId])
  );

  async function loadTemplateData() {
    if (!user || !safeTemplateId) return;

    try {
      setLoading(true);

      const [templateData, itemData] = await Promise.all([
        getChecklistTemplate(user.uid, safeTemplateId),
        getChecklistTemplateItems(user.uid, safeTemplateId),
      ]);

      setTemplate(templateData);
      setItems(itemData);
    } catch (err) {
      console.error("Failed to load template items:", err);
      setTemplate(null);
      setItems([]);
      Alert.alert("Error", "Failed to load template items.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddItem() {
    if (!user || !safeTemplateId) {
      Alert.alert("Sign in required", "Please sign in to edit this template.");
      return;
    }

    const trimmedName = newItemName.trim();

    if (!trimmedName) {
      Alert.alert("Item name required", "Please enter an item name.");
      return;
    }

    try {
      setAddingItem(true);

      await addChecklistTemplateItem(user.uid, safeTemplateId, trimmedName);

      setNewItemName("");
      await loadTemplateData();
    } catch (err) {
      console.error("Failed to add template item:", err);
      Alert.alert("Error", "Failed to add item.");
    } finally {
      setAddingItem(false);
    }
  }

  function handleStartEditItem(item: ChecklistTemplateItem) {
    setEditingItemId(item.id);
    setEditingItemName(item.name ?? "");
  }

  function handleCancelEditItem() {
    if (savingItemName) return;

    setEditingItemId(null);
    setEditingItemName("");
  }

  async function handleSaveItemName(item: ChecklistTemplateItem) {
    if (!user || !safeTemplateId) return;

    const trimmedName = editingItemName.trim();

    if (!trimmedName) {
      Alert.alert("Item name required", "Please enter an item name.");
      return;
    }

    try {
      setSavingItemName(true);

      await updateChecklistTemplateItemName(
        user.uid,
        safeTemplateId,
        item.id,
        trimmedName
      );

      setEditingItemId(null);
      setEditingItemName("");
      await loadTemplateData();
    } catch (err) {
      console.error("Failed to rename template item:", err);
      Alert.alert("Error", "Failed to rename item.");
    } finally {
      setSavingItemName(false);
    }
  }

  async function handleUpdateQuantity(
    item: ChecklistTemplateItem,
    nextQuantity: number
  ) {
    if (!user || !safeTemplateId) return;

    try {
      await updateChecklistTemplateItemQuantity(
        user.uid,
        safeTemplateId,
        item.id,
        Math.max(1, nextQuantity)
      );

      await loadTemplateData();
    } catch (err) {
      console.error("Failed to update template item quantity:", err);
      Alert.alert("Error", "Failed to update item quantity.");
    }
  }

  function handleDeleteItem(item: ChecklistTemplateItem) {
    if (!user || !safeTemplateId) return;

    Alert.alert("Delete Item", `Delete "${item.name}" from this template?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteChecklistTemplateItem(user.uid, safeTemplateId, item.id);
            await loadTemplateData();
          } catch (err) {
            console.error("Failed to delete template item:", err);
            Alert.alert("Error", "Failed to delete item.");
          }
        },
      },
    ]);
  }

  function renderItem(item: ChecklistTemplateItem) {
    const isEditing = editingItemId === item.id;
    const quantity = Math.max(1, Number(item.quantity ?? 1));

    return (
      <FrostedCard key={item.id}>
        {isEditing ? (
          <View>
            <TextInput
              value={editingItemName}
              onChangeText={setEditingItemName}
              placeholder="Item name"
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
              onSubmitEditing={() => handleSaveItemName(item)}
            />

            <Pressable
              style={[
                styles.primaryButton,
                (!editingItemName.trim() || savingItemName) &&
                  styles.disabledButton,
              ]}
              onPress={() => handleSaveItemName(item)}
              disabled={!editingItemName.trim() || savingItemName}
            >
              <Text style={styles.primaryButtonText}>
                {savingItemName ? "Saving..." : "Save Item"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={handleCancelEditItem}
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
        ) : (
          <View style={styles.itemRow}>
            <View style={styles.itemMain}>
              <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
                {item.name}
              </Text>

              <Text
                style={[
                  styles.itemMeta,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Quantity: {quantity}
              </Text>
            </View>

            <View style={styles.quantityControls}>
              <Pressable
                style={[
                  styles.quantityButton,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.iconSurface,
                  },
                ]}
                onPress={() => handleUpdateQuantity(item, quantity - 1)}
              >
                <Minus size={16} color={theme.colors.text} />
              </Pressable>

              <Text style={[styles.quantityText, { color: theme.colors.text }]}>
                {quantity}
              </Text>

              <Pressable
                style={[
                  styles.quantityButton,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.iconSurface,
                  },
                ]}
                onPress={() => handleUpdateQuantity(item, quantity + 1)}
              >
                <Plus size={16} color={theme.colors.text} />
              </Pressable>
            </View>

            <View style={styles.itemActions}>
              <Pressable
                onPress={() => handleStartEditItem(item)}
                style={[
                  styles.iconButton,
                  {
                    backgroundColor: theme.colors.iconSurface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Pencil size={16} color={theme.colors.text} />
              </Pressable>

              <Pressable
                onPress={() => handleDeleteItem(item)}
                style={[
                  styles.iconButton,
                  {
                    backgroundColor: theme.colors.iconSurface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Trash2 size={16} color={theme.colors.danger} />
              </Pressable>
            </View>
          </View>
        )}
      </FrostedCard>
    );
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
            <AppHeader
              title={template?.name ? "Edit Template" : "Template Items"}
              showBackButton
            />

            {loading ? (
              <FrostedCard>
                <Text style={[styles.meta, { color: theme.colors.text }]}>
                  Loading...
                </Text>
              </FrostedCard>
            ) : !user ? (
              <FrostedCard>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  Sign in required
                </Text>
                <Text
                  style={[
                    styles.emptyText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Please sign in to edit template items.
                </Text>
              </FrostedCard>
            ) : !safeTemplateId || !template ? (
              <FrostedCard>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  Template not found
                </Text>
                <Text
                  style={[
                    styles.emptyText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  This template could not be loaded.
                </Text>
              </FrostedCard>
            ) : (
              <>
                <FrostedCard style={styles.heroCard}>
                  <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
                    {template.name}
                  </Text>
                  <Text
                    style={[
                      styles.heroText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Add, rename, delete, or adjust quantities for this template.
                    These items will appear when you use this template to create
                    a checklist.
                  </Text>
                </FrostedCard>

                <FrostedCard>
                  <Text
                    style={[styles.sectionTitle, { color: theme.colors.text }]}
                  >
                    Add Item
                  </Text>

                  <TextInput
                    value={newItemName}
                    onChangeText={setNewItemName}
                    placeholder="Enter item name"
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
                    onSubmitEditing={handleAddItem}
                  />

                  <Pressable
                    style={[
                      styles.primaryButton,
                      (!newItemName.trim() || addingItem) &&
                        styles.disabledButton,
                    ]}
                    onPress={handleAddItem}
                    disabled={!newItemName.trim() || addingItem}
                  >
                    <Text style={styles.primaryButtonText}>
                      {addingItem ? "Adding..." : "Add Item"}
                    </Text>
                  </Pressable>
                </FrostedCard>

                <Text
                  style={[
                    styles.listTitle,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {sortedItems.length === 1
                    ? "1 template item"
                    : `${sortedItems.length} template items`}
                </Text>

                {sortedItems.length === 0 ? (
                  <FrostedCard>
                    <Text
                      style={[styles.emptyTitle, { color: theme.colors.text }]}
                    >
                      No items yet
                    </Text>
                    <Text
                      style={[
                        styles.emptyText,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      Add your first item above.
                    </Text>
                  </FrostedCard>
                ) : (
                  sortedItems.map(renderItem)
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
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

  cardShell: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },

  cardBlur: {
    padding: 14,
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

  listTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  meta: {
    fontSize: 14,
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

  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },

  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(55,130,245,0.95)",
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.6,
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  secondaryButton: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: "center",
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  itemMain: {
    flex: 1,
  },

  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },

  itemMeta: {
    fontSize: 13,
  },

  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  quantityText: {
    minWidth: 18,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
  },

  itemActions: {
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
});