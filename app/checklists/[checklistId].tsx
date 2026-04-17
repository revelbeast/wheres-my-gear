import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Trash2, Plus, Minus, Pencil, Check, X } from "lucide-react-native";
import { Swipeable } from "react-native-gesture-handler";

import ScreenBackground from "../../components/ui/ScreenBackground";
import AppHeader from "../../components/ui/AppHeader";
import { colors } from "../../theme/tokens";
import type { Checklist, ChecklistItem } from "../../types/checklists";
import {
  addChecklistItem,
  deleteChecklist,
  deleteChecklistItem,
  getChecklist,
  subscribeToChecklistItems,
  toggleChecklistItemPacked,
  updateChecklistItemName,
  updateChecklistItemQuantity,
} from "../../lib/checklistsService";

const DEMO_USER_ID = "demo-user-123";
const BOTTOM_BAR_HEIGHT = 96;

export default function ChecklistDetailScreen() {
  const { checklistId } = useLocalSearchParams<{ checklistId: string }>();
  const insets = useSafeAreaInsets();

  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [updatingQuantityId, setUpdatingQuantityId] = useState<string | null>(null);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [savingItemName, setSavingItemName] = useState(false);

  useEffect(() => {
    if (!checklistId) return;

    loadChecklist(checklistId);

    const unsubscribe = subscribeToChecklistItems(
      DEMO_USER_ID,
      checklistId,
      (data) => {
        setItems(data);
      }
    );

    return unsubscribe;
  }, [checklistId]);

  async function loadChecklist(id: string) {
    try {
      const data = await getChecklist(DEMO_USER_ID, id);
      setChecklist(data);
    } catch (err) {
      console.error("Failed to load checklist:", err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshChecklist() {
    if (!checklistId) return;

    try {
      const refreshed = await getChecklist(DEMO_USER_ID, checklistId);
      setChecklist(refreshed);
    } catch (err) {
      console.error("Failed to refresh checklist:", err);
    }
  }

  async function handleAddItem() {
    if (!checklistId) return;

    const trimmed = newItemName.trim();
    if (!trimmed) return;

    try {
      setAddingItem(true);
      await addChecklistItem(DEMO_USER_ID, checklistId, trimmed);
      setNewItemName("");
      await refreshChecklist();
    } catch (err) {
      console.error("Failed to add checklist item:", err);
    } finally {
      setAddingItem(false);
    }
  }

  async function handleToggleItem(item: ChecklistItem) {
    if (!checklistId || editingItemId === item.id) return;

    try {
      await toggleChecklistItemPacked(DEMO_USER_ID, checklistId, item);
      await refreshChecklist();
    } catch (err) {
      console.error("Failed to toggle checklist item:", err);
    }
  }

  async function handleChangeQuantity(item: ChecklistItem, delta: number) {
    if (!checklistId) return;

    const nextQuantity = Math.max(1, (item.quantity ?? 1) + delta);

    try {
      setUpdatingQuantityId(item.id);
      await updateChecklistItemQuantity(
        DEMO_USER_ID,
        checklistId,
        item.id,
        nextQuantity
      );
    } catch (err) {
      console.error("Failed to update quantity:", err);
    } finally {
      setUpdatingQuantityId(null);
    }
  }

  function startEditingItem(item: ChecklistItem) {
    setEditingItemId(item.id);
    setEditingItemName(item.name);
  }

  function cancelEditingItem() {
    setEditingItemId(null);
    setEditingItemName("");
  }

  async function saveEditingItem(item: ChecklistItem) {
    if (!checklistId) return;

    const trimmed = editingItemName.trim();
    if (!trimmed) return;

    try {
      setSavingItemName(true);
      await updateChecklistItemName(
        DEMO_USER_ID,
        checklistId,
        item.id,
        trimmed
      );
      setEditingItemId(null);
      setEditingItemName("");
    } catch (err) {
      console.error("Failed to update checklist item name:", err);
    } finally {
      setSavingItemName(false);
    }
  }

  function handleDeletePress() {
    if (!checklistId || !checklist) return;

    Alert.alert(
      "Delete checklist?",
      `Are you sure you want to delete "${checklist.name}"? This cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: confirmDelete,
        },
      ]
    );
  }

  async function confirmDelete() {
    if (!checklistId) return;

    try {
      setDeleting(true);
      await deleteChecklist(DEMO_USER_ID, checklistId);
      router.replace("/");
    } catch (err) {
      console.error("Failed to delete checklist:", err);
      setDeleting(false);
    }
  }

  function handleDeleteItem(item: ChecklistItem) {
    if (!checklistId) return;

    Alert.alert(
      "Delete item?",
      `Delete "${item.name}" from this checklist?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteChecklistItem(DEMO_USER_ID, checklistId, item.id);
              await refreshChecklist();
            } catch (err) {
              console.error("Failed to delete checklist item:", err);
            }
          },
        },
      ]
    );
  }

  function renderRightActions(item: ChecklistItem) {
    return (
      <Pressable
        style={styles.swipeDeleteAction}
        onPress={() => handleDeleteItem(item)}
      >
        <Trash2 size={18} color="#fff" />
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </Pressable>
    );
  }

  if (loading) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.container}>
            <AppHeader title="Checklist" showBackButton />
            <Text style={styles.loadingText}>Loading checklist...</Text>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  if (!checklist) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.container}>
            <AppHeader title="Checklist" showBackButton />
            <Text style={styles.notFoundTitle}>Checklist not found</Text>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.screen}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              {
                paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom + 40,
              },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <AppHeader title={checklist.name} showBackButton />

            <View style={styles.headerCard}>
              <Text style={styles.meta}>
                {checklist.packedCount} / {checklist.totalCount} packed
              </Text>
              <Text style={styles.subMeta}>
                {checklist.missingCount} missing
              </Text>
            </View>

            <View style={styles.addItemCard}>
              <Text style={styles.addItemTitle}>Add Item</Text>
              <View style={styles.addItemRow}>
                <TextInput
                  value={newItemName}
                  onChangeText={setNewItemName}
                  placeholder="Enter item name"
                  placeholderTextColor={colors.textMuted}
                  style={styles.addItemInput}
                  returnKeyType="done"
                  onSubmitEditing={handleAddItem}
                />
                <Pressable
                  style={[
                    styles.addItemButton,
                    (!newItemName.trim() || addingItem) &&
                      styles.addItemButtonDisabled,
                  ]}
                  onPress={handleAddItem}
                  disabled={!newItemName.trim() || addingItem}
                >
                  <Plus size={18} color="#fff" />
                </Pressable>
              </View>
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No checklist items</Text>
                <Text style={styles.emptyText}>
                  Add your first item above.
                </Text>
              </View>
            ) : (
              items.map((item) => {
                const isEditing = editingItemId === item.id;

                return (
                  <Swipeable
                    key={item.id}
                    renderRightActions={() => renderRightActions(item)}
                    overshootRight={false}
                    enabled={!isEditing}
                  >
                    <Pressable
                      style={[
                        styles.itemCard,
                        item.packed ? styles.itemCardPacked : null,
                      ]}
                      onPress={() => handleToggleItem(item)}
                    >
                      <View style={styles.itemLeft}>
                        {isEditing ? (
                          <>
                            <TextInput
                              value={editingItemName}
                              onChangeText={setEditingItemName}
                              placeholder="Item name"
                              placeholderTextColor={colors.textMuted}
                              style={styles.editNameInput}
                              autoFocus
                              returnKeyType="done"
                              onSubmitEditing={() => saveEditingItem(item)}
                            />
                            <View style={styles.editActions}>
                              <Pressable
                                style={[
                                  styles.editActionButton,
                                  (!editingItemName.trim() || savingItemName) &&
                                    styles.editActionButtonDisabled,
                                ]}
                                onPress={() => saveEditingItem(item)}
                                disabled={!editingItemName.trim() || savingItemName}
                              >
                                <Check size={16} color="#fff" />
                                <Text style={styles.editActionText}>Save</Text>
                              </Pressable>

                              <Pressable
                                style={styles.cancelActionButton}
                                onPress={cancelEditingItem}
                                disabled={savingItemName}
                              >
                                <X size={16} color={colors.text} />
                                <Text style={styles.cancelActionText}>Cancel</Text>
                              </Pressable>
                            </View>
                          </>
                        ) : (
                          <>
                            <View style={styles.nameRow}>
                              <Text style={styles.itemName}>{item.name}</Text>
                              <Pressable
                                style={styles.editIconButton}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  startEditingItem(item);
                                }}
                              >
                                <Pencil size={15} color={colors.textSecondary} />
                              </Pressable>
                            </View>
                            <Text style={styles.itemMeta}>
                              Recommended: {item.quantity}
                            </Text>
                          </>
                        )}
                      </View>

                      {!isEditing && (
                        <View style={styles.itemRight}>
                          <View style={styles.quantityControls}>
                            <Pressable
                              style={styles.quantityButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleChangeQuantity(item, -1);
                              }}
                              disabled={
                                updatingQuantityId === item.id || item.quantity <= 1
                              }
                            >
                              <Minus size={16} color={colors.text} />
                            </Pressable>

                            <View style={styles.quantityValueWrap}>
                              <Text style={styles.quantityValue}>
                                {item.quantity}
                              </Text>
                            </View>

                            <Pressable
                              style={styles.quantityButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleChangeQuantity(item, 1);
                              }}
                              disabled={updatingQuantityId === item.id}
                            >
                              <Plus size={16} color={colors.text} />
                            </Pressable>
                          </View>

                          <View
                            style={[
                              styles.statusPill,
                              item.packed
                                ? styles.statusPillPacked
                                : styles.statusPillMissing,
                            ]}
                          >
                            <Text style={styles.statusPillText}>
                              {item.packed ? "Packed" : "Missing"}
                            </Text>
                          </View>
                        </View>
                      )}
                    </Pressable>
                  </Swipeable>
                );
              })
            )}
          </ScrollView>

          <View
            style={[
              styles.bottomBar,
              {
                paddingBottom: Math.max(insets.bottom, 14),
              },
            ]}
          >
            <Pressable
              style={[
                styles.trashButton,
                deleting ? styles.trashButtonDisabled : null,
              ]}
              onPress={handleDeletePress}
              disabled={deleting}
            >
              <Trash2 size={20} color="#fff" />
              <Text style={styles.trashButtonText}>
                {deleting ? "Deleting..." : "Delete Checklist"}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  content: {
    padding: 16,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  notFoundTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  headerCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 15,
    marginBottom: 4,
  },
  subMeta: {
    color: colors.textMuted,
    fontSize: 14,
  },
  addItemCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  addItemTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  addItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addItemInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(7, 20, 44, 0.7)",
  },
  addItemButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(55, 130, 245, 0.95)",
  },
  addItemButtonDisabled: {
    opacity: 0.5,
  },
  emptyCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  itemCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemCardPacked: {
    borderColor: "rgba(90, 200, 140, 0.35)",
  },
  itemLeft: {
    flex: 1,
    paddingRight: 12,
  },
  itemRight: {
    alignItems: "flex-end",
    gap: 10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  itemName: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  editIconButton: {
    marginLeft: 8,
    padding: 6,
  },
  itemMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  editNameInput: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(7, 20, 44, 0.7)",
    marginBottom: 10,
  },
  editActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  editActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(55, 130, 245, 0.95)",
  },
  editActionButtonDisabled: {
    opacity: 0.5,
  },
  editActionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  cancelActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  cancelActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  quantityValueWrap: {
    minWidth: 34,
    alignItems: "center",
  },
  quantityValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  statusPill: {
    minWidth: 78,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  statusPillPacked: {
    backgroundColor: "rgba(50, 160, 95, 0.28)",
  },
  statusPillMissing: {
    backgroundColor: "rgba(180, 60, 60, 0.28)",
  },
  statusPillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  swipeDeleteAction: {
    width: 110,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: "rgba(180, 40, 40, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  swipeDeleteText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(7, 20, 44, 0.97)",
  },
  trashButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(180, 40, 40, 0.95)",
  },
  trashButtonDisabled: {
    opacity: 0.6,
  },
  trashButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});