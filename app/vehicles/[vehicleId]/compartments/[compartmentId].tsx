import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import {
  Plus,
  X,
  Trash2,
  Pencil,
  Check,
  Minus,
} from "lucide-react-native";
import { Swipeable } from "react-native-gesture-handler";

import ScreenBackground from "../../../../components/ui/ScreenBackground";
import AppHeader from "../../../../components/ui/AppHeader";
import { colors } from "../../../../theme/tokens";
import {
  Compartment,
  Item,
  createItem,
  deleteItem,
  getCompartmentById,
  getItemsByCompartment,
  updateItem,
} from "../../../../lib/gearService";

export default function CompartmentDetailScreen() {
  const params = useLocalSearchParams<{
    compartmentId: string | string[];
    vehicleId: string | string[];
  }>();

  const compartmentId = Array.isArray(params.compartmentId)
    ? params.compartmentId[0]
    : params.compartmentId;

  const vehicleId = Array.isArray(params.vehicleId)
    ? params.vehicleId[0]
    : params.vehicleId;

  const [compartment, setCompartment] = useState<Compartment | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [showCreateBox, setShowCreateBox] = useState(false);
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [updatingQuantityId, setUpdatingQuantityId] = useState<string | null>(null);

  useEffect(() => {
    if (!compartmentId) return;
    loadCompartment();
    loadItems();
  }, [compartmentId]);

  async function loadCompartment() {
    try {
      const data = await getCompartmentById(String(compartmentId));
      setCompartment(data);
    } catch (err) {
      console.error("Failed to load compartment:", err);
      setCompartment(null);
    }
  }

  async function loadItems() {
    try {
      const data = await getItemsByCompartment(String(compartmentId));
      setItems(data);
    } catch (err) {
      console.error("Failed to load compartment items:", err);
      setItems([]);
    }
  }

  async function handleCreateItem() {
    if (!compartmentId || !vehicleId) return;

    const trimmedName = itemName.trim();
    const parsedQty = Math.max(1, Number(quantity) || 1);

    if (!trimmedName) return;

    try {
      setSaving(true);

      await createItem({
        name: trimmedName,
        quantity: parsedQty,
        status: "missing",
        compartmentId: String(compartmentId),
        vehicleId: String(vehicleId),
        notes: "",
      });

      setItemName("");
      setQuantity("1");
      setShowCreateBox(false);
      await loadItems();
    } catch (err) {
      console.error("Failed to create item:", err);
    } finally {
      setSaving(false);
    }
  }

  function startEditingItem(item: Item) {
    setEditingItemId(item.id);
    setEditingItemName(item.name);
  }

  function cancelEditingItem() {
    setEditingItemId(null);
    setEditingItemName("");
  }

  async function saveEditingItem(item: Item) {
    const trimmed = editingItemName.trim();
    if (!trimmed) return;

    try {
      setSavingEdit(true);
      await updateItem(item.id, { name: trimmed });
      setEditingItemId(null);
      setEditingItemName("");
      await loadItems();
    } catch (err) {
      console.error("Failed to update item:", err);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleChangeQuantity(item: Item, delta: number) {
    const nextQuantity = Math.max(1, (item.quantity ?? 1) + delta);

    try {
      setUpdatingQuantityId(item.id);
      await updateItem(item.id, { quantity: nextQuantity });
      await loadItems();
    } catch (err) {
      console.error("Failed to update item quantity:", err);
    } finally {
      setUpdatingQuantityId(null);
    }
  }

  function confirmDeleteItem(item: Item) {
    Alert.alert(
      "Delete item?",
      `Delete "${item.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteItem(item.id);
              await loadItems();
            } catch (err) {
              console.error("Failed to delete item:", err);
            }
          },
        },
      ]
    );
  }

  function renderRightActions(item: Item) {
    return (
      <Pressable
        style={styles.swipeDeleteAction}
        onPress={() => confirmDeleteItem(item)}
      >
        <Trash2 size={18} color="#fff" />
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </Pressable>
    );
  }

  const headerRight = (
    <Pressable
      style={styles.headerActionButton}
      onPress={() => setShowCreateBox((prev) => !prev)}
    >
      {showCreateBox ? (
        <X size={18} color={colors.text} />
      ) : (
        <Plus size={18} color={colors.text} />
      )}
    </Pressable>
  );

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <AppHeader
            title={compartment?.name || "Compartment"}
            showBackButton
            rightContent={headerRight}
          />

          {showCreateBox && (
            <View style={styles.createCard}>
              <Text style={styles.createTitle}>Add Item</Text>

              <Text style={styles.label}>Item Name</Text>
              <TextInput
                value={itemName}
                onChangeText={setItemName}
                placeholder="Enter item name"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                returnKeyType="done"
              />

              <Text style={styles.label}>Quantity</Text>
              <TextInput
                value={quantity}
                onChangeText={setQuantity}
                placeholder="1"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                keyboardType="number-pad"
              />

              <Pressable
                style={[
                  styles.createButton,
                  (!itemName.trim() || saving) && styles.createButtonDisabled,
                ]}
                onPress={handleCreateItem}
                disabled={!itemName.trim() || saving}
              >
                <Text style={styles.createButtonText}>
                  {saving ? "Adding..." : "Add Item"}
                </Text>
              </Pressable>
            </View>
          )}

          {items.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptyText}>
                This compartment does not have any items yet.
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
                  <View style={styles.card}>
                    {isEditing ? (
                      <View style={styles.editWrap}>
                        <TextInput
                          value={editingItemName}
                          onChangeText={setEditingItemName}
                          placeholder="Item name"
                          placeholderTextColor={colors.textMuted}
                          style={styles.editInput}
                          autoFocus
                          returnKeyType="done"
                          onSubmitEditing={() => saveEditingItem(item)}
                        />
                        <View style={styles.editActions}>
                          <Pressable
                            style={[
                              styles.saveEditButton,
                              (!editingItemName.trim() || savingEdit) &&
                                styles.createButtonDisabled,
                            ]}
                            onPress={() => saveEditingItem(item)}
                            disabled={!editingItemName.trim() || savingEdit}
                          >
                            <Check size={16} color="#fff" />
                            <Text style={styles.saveEditText}>Save</Text>
                          </Pressable>

                          <Pressable
                            style={styles.cancelEditButton}
                            onPress={cancelEditingItem}
                          >
                            <X size={16} color={colors.text} />
                            <Text style={styles.cancelEditText}>Cancel</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <>
                        <View style={styles.cardLeft}>
                          <View style={styles.nameRow}>
                            <Text style={styles.cardTitle}>{item.name}</Text>
                            <Pressable
                              style={styles.iconButton}
                              onPress={() => startEditingItem(item)}
                            >
                              <Pencil size={16} color={colors.textSecondary} />
                            </Pressable>
                          </View>

                          <View style={styles.metaRow}>
                            <Text style={styles.cardMeta}>
                              Qty: {item.quantity} •{" "}
                              {item.status === "packed" ? "Packed" : "Missing"}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.quantityControls}>
                          <Pressable
                            style={styles.quantityButton}
                            onPress={() => handleChangeQuantity(item, -1)}
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
                            onPress={() => handleChangeQuantity(item, 1)}
                            disabled={updatingQuantityId === item.id}
                          >
                            <Plus size={16} color={colors.text} />
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                </Swipeable>
              );
            })
          )}
        </ScrollView>
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
    paddingBottom: 140,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  createCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  createTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: "rgba(7,20,44,0.7)",
    borderRadius: 12,
    padding: 12,
    color: colors.text,
  },
  createButton: {
    marginTop: 16,
    backgroundColor: "rgba(55,130,245,0.95)",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "700",
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
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: "rgba(12,24,50,0.9)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLeft: {
    flex: 1,
    paddingRight: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    flex: 1,
    color: colors.text,
    fontWeight: "600",
    fontSize: 16,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginLeft: 8,
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
  editWrap: {
    flex: 1,
  },
  editInput: {
    color: colors.text,
    fontSize: 15,
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
  saveEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(55, 130, 245, 0.95)",
  },
  saveEditText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  cancelEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  cancelEditText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  swipeDeleteAction: {
    width: 110,
    marginBottom: 10,
    borderRadius: 16,
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
});