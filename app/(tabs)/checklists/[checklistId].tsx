import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import {
  Camera,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  Minus,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  createOrUpdateInventoryItemFromChecklist,
  getCompartmentsByVehicle,
  getStorageSpaces,
  removeOrDecrementInventoryItemFromChecklist,
  syncInventoryItemStatusFromChecklist,
  type Compartment,
  type StorageSpace,
} from "../../../lib/gearService";
import {
  addChecklistItem,
  deleteChecklist,
  deleteChecklistItem,
  getChecklist,
  saveChecklistAsTemplate,
  subscribeToChecklistItems,
  toggleChecklistItemPacked,
  updateChecklistItemCompartment,
  updateChecklistItemName,
  updateChecklistItemPhoto,
  updateChecklistItemQuantity,
  updateChecklistName,
} from "../../../lib/checklistsService";
import type { ChecklistCategory } from "../../../types/checklists";

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

function getSafeQuantity(value?: number) {
  const qty = Number(value ?? 1);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function getCategoryLabel(
  category?: ChecklistCategory,
  customCategoryLabel?: string
) {
  if (!category) return "Checklist";

  if (category === "custom") {
    return customCategoryLabel?.trim() || "Other";
  }

  switch (category) {
    case "trip":
      return "Trip";
    case "camping":
      return "Camping";
    case "hunting":
      return "Hunting";
    case "fishing":
      return "Fishing";
    case "clothing":
      return "Clothing";
    case "electronics":
      return "Electronics";
    case "medical":
      return "Medical";
    case "tools":
      return "Tools";
    case "food":
      return "Food";
    default:
      return "Checklist";
  }
}

export default function ChecklistDetailScreen() {
  const { user, initializing } = useAuth();
  const { checklistId } = useLocalSearchParams<{ checklistId: string }>();
  const theme = useThemedValues();

  const [checklist, setChecklist] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [renameModal, setRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [savingItemEdit, setSavingItemEdit] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  const [showCreateBox, setShowCreateBox] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [savingNewItem, setSavingNewItem] = useState(false);

  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assigningItem, setAssigningItem] = useState<any | null>(null);
  const [storageSpaces, setStorageSpaces] = useState<StorageSpace[]>([]);
  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedCompartmentId, setSelectedCompartmentId] = useState("");
  const [loadingCompartments, setLoadingCompartments] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);

  const [filter, setFilter] = useState<"all" | "unpacked" | "packed">("all");

  useEffect(() => {
    if (initializing) {
      return;
    }

    if (!user || !checklistId) {
      setChecklist(null);
      setItems([]);
      return;
    }

    loadChecklist();

    const unsubscribe = subscribeToChecklistItems(
      user.uid,
      checklistId,
      setItems
    );

    return unsubscribe;
  }, [initializing, user, checklistId]);

  async function loadChecklist() {
    if (!user || !checklistId) return;

    try {
      const data = await getChecklist(user.uid, checklistId);
      setChecklist(data);
    } catch (err) {
      console.error("Failed to load checklist:", err);
      setChecklist(null);
    }
  }

  function handleOpenRenameChecklist() {
    if (!checklist) return;

    setRenameValue(checklist.name);
    setRenameModal(true);
  }

  function confirmDeleteChecklist() {
    if (!checklist || !user) return;

    Alert.alert(
      "Delete checklist?",
      `Delete "${checklist.name}"? This cannot be undone.`,
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
              await deleteChecklist(user.uid, checklistId);
              router.replace("/checklists");
            } catch (err) {
              console.error(err);
              Alert.alert("Error", "Failed to delete checklist.");
            }
          },
        },
      ]
    );
  }

  async function handleRenameChecklist() {
    const trimmed = renameValue.trim();
    if (!trimmed || !user) return;

    try {
      setSavingRename(true);
      await updateChecklistName(user.uid, checklistId, trimmed);
      setRenameModal(false);
      await loadChecklist();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to rename checklist.");
    } finally {
      setSavingRename(false);
    }
  }

  async function handleSaveTemplate() {
    if (!user) return;

    try {
      await saveChecklistAsTemplate(user.uid, checklistId);
      Alert.alert("Saved", "Checklist saved as template.");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to save checklist as template.");
    }
  }

  function handleAddItem() {
    setShowCreateBox((prev) => !prev);
    if (showCreateBox) {
      setNewItemName("");
    }
  }

  async function handleCreateItem() {
    const trimmed = newItemName.trim();
    if (!trimmed || !user) return;

    try {
      setSavingNewItem(true);
      await addChecklistItem(user.uid, checklistId, trimmed);
      setNewItemName("");
      setShowCreateBox(false);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to add checklist item.");
    } finally {
      setSavingNewItem(false);
    }
  }

  function startEditingItem(item: any) {
    setEditingItemId(item.id);
    setEditingItemName(item.name ?? "");
  }

  function cancelEditingItem() {
    setEditingItemId(null);
    setEditingItemName("");
  }

  async function handleSaveItemEdit(itemId: string) {
    const trimmed = editingItemName.trim();
    if (!trimmed || !user) return;

    try {
      setSavingItemEdit(true);
      await updateChecklistItemName(user.uid, checklistId, itemId, trimmed);
      setEditingItemId(null);
      setEditingItemName("");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to update checklist item.");
    } finally {
      setSavingItemEdit(false);
    }
  }

  async function handleChangeNeededQuantity(item: any, delta: number) {
    if (!user) return;

    const currentQuantity = getSafeQuantity(item.quantity);
    const nextQuantity = Math.max(1, currentQuantity + delta);
    const quantityDelta = nextQuantity - currentQuantity;

    try {
      setUpdatingItemId(item.id);
      await updateChecklistItemQuantity(
        user.uid,
        checklistId,
        item.id,
        nextQuantity
      );

      if (item.compartmentId && quantityDelta !== 0) {
        if (quantityDelta > 0) {
          await createOrUpdateInventoryItemFromChecklist(
            {
              name: item.name,
              quantity: quantityDelta,
            },
            {
              id: item.compartmentId,
              name: item.compartmentName ?? "",
              vehicleId: item.vehicleId ?? "",
            }
          );
        } else {
          await removeOrDecrementInventoryItemFromChecklist(
            {
              name: item.name,
              quantity: Math.abs(quantityDelta),
            },
            item.compartmentId
          );
        }

        await syncInventoryItemStatusFromChecklist({
          name: item.name,
          quantity: nextQuantity,
          packed: !!item.packed,
          compartmentId: item.compartmentId,
          compartmentName: item.compartmentName ?? "",
          vehicleId: item.vehicleId ?? "",
        });
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to update quantity.");
    } finally {
      setUpdatingItemId(null);
    }
  }

  async function handleTogglePacked(item: any) {
    if (!user) return;

    try {
      setUpdatingItemId(item.id);
      await toggleChecklistItemPacked(user.uid, checklistId, item);

      if (item.compartmentId) {
        await syncInventoryItemStatusFromChecklist({
          name: item.name,
          quantity: getSafeQuantity(item.quantity),
          packed: !item.packed,
          compartmentId: item.compartmentId,
          compartmentName: item.compartmentName ?? "",
          vehicleId: item.vehicleId ?? "",
        });
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to update packed status.");
    } finally {
      setUpdatingItemId(null);
    }
  }

  async function handleItemPhotoAction(item: any) {
    Alert.alert("Item Photo", item.name, [
      {
        text: "Take Photo",
        onPress: () => handleTakeItemPhoto(item),
      },
      {
        text: "Choose Photo",
        onPress: () => handlePickItemPhoto(item),
      },
      ...(item.itemPhotoUri
        ? [
            {
              text: "Remove Photo",
              style: "destructive" as const,
              onPress: () => handleRemoveItemPhoto(item),
            },
          ]
        : []),
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  }

  async function handleTakeItemPhoto(item: any) {
    if (!user) return;

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Camera access needed", "Please allow camera access first.");
        return;
      }

      setUpdatingItemId(item.id);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Photo not captured", "No valid image was returned.");
        return;
      }

      await updateChecklistItemPhoto(
        user.uid,
        checklistId,
        item.id,
        asset.uri
      );
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to save item photo.");
    } finally {
      setUpdatingItemId(null);
    }
  }

  async function handlePickItemPhoto(item: any) {
    if (!user) return;

    try {
      setUpdatingItemId(item.id);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Photo not selected", "No valid image was returned.");
        return;
      }

      await updateChecklistItemPhoto(
        user.uid,
        checklistId,
        item.id,
        asset.uri
      );
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to save item photo.");
    } finally {
      setUpdatingItemId(null);
    }
  }

  async function handleRemoveItemPhoto(item: any) {
    if (!user) return;

    try {
      setUpdatingItemId(item.id);
      await updateChecklistItemPhoto(user.uid, checklistId, item.id, "");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to remove item photo.");
    } finally {
      setUpdatingItemId(null);
    }
  }

  async function openAssignStorage(item: any) {
    try {
      setAssigningItem(item);
      setSelectedVehicleId(item.vehicleId ?? "");
      setSelectedCompartmentId(item.compartmentId ?? "");
      setCompartments([]);
      setAssignModalVisible(true);

      const spaces = await getStorageSpaces();
      setStorageSpaces(spaces);

      const initialVehicleId = item.vehicleId ?? "";
      if (initialVehicleId) {
        await loadCompartmentsForVehicle(initialVehicleId);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to load storage spaces.");
    }
  }

  function closeAssignStorage() {
    if (savingAssignment) return;

    setAssignModalVisible(false);
    setAssigningItem(null);
    setStorageSpaces([]);
    setCompartments([]);
    setSelectedVehicleId("");
    setSelectedCompartmentId("");
    setLoadingCompartments(false);
  }

  async function loadCompartmentsForVehicle(vehicleId: string) {
    if (!vehicleId) {
      setCompartments([]);
      setSelectedCompartmentId("");
      return;
    }

    try {
      setLoadingCompartments(true);
      const results = await getCompartmentsByVehicle(vehicleId);
      setCompartments(results);

      const currentSelectedStillValid = results.some(
        (compartment) => compartment.id === selectedCompartmentId
      );

      if (!currentSelectedStillValid) {
        setSelectedCompartmentId("");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to load compartments.");
      setCompartments([]);
      setSelectedCompartmentId("");
    } finally {
      setLoadingCompartments(false);
    }
  }

  async function handleSelectVehicle(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
    setSelectedCompartmentId("");
    await loadCompartmentsForVehicle(vehicleId);
  }

  async function handleSaveAssignment() {
    if (!assigningItem || !user) return;

    if (!selectedVehicleId) {
      Alert.alert("Select storage", "Please choose a storage space first.");
      return;
    }

    if (!selectedCompartmentId) {
      Alert.alert("Select compartment", "Please choose a compartment.");
      return;
    }

    const selectedCompartment = compartments.find(
      (compartment) => compartment.id === selectedCompartmentId
    );

    if (!selectedCompartment) {
      Alert.alert("Invalid compartment", "Please select a valid compartment.");
      return;
    }

    const previousCompartmentId = assigningItem.compartmentId ?? "";
    const isReassignment =
      !!previousCompartmentId &&
      previousCompartmentId !== selectedCompartment.id;
    const isNewAssignment = !previousCompartmentId;
    const isSameAssignment = previousCompartmentId === selectedCompartment.id;

    try {
      setSavingAssignment(true);

      if (isReassignment) {
        await removeOrDecrementInventoryItemFromChecklist(
          {
            name: assigningItem.name,
            quantity: getSafeQuantity(assigningItem.quantity),
          },
          previousCompartmentId
        );
      }

      await updateChecklistItemCompartment(
        user.uid,
        checklistId,
        assigningItem.id,
        selectedCompartment.id,
        selectedCompartment.name,
        selectedVehicleId
      );

      if (isNewAssignment || isReassignment) {
        await createOrUpdateInventoryItemFromChecklist(
          {
            name: assigningItem.name,
            quantity: getSafeQuantity(assigningItem.quantity),
          },
          {
            id: selectedCompartment.id,
            name: selectedCompartment.name,
            vehicleId: selectedVehicleId,
          }
        );
      }

      if (!isSameAssignment || isNewAssignment) {
        await syncInventoryItemStatusFromChecklist({
          name: assigningItem.name,
          quantity: getSafeQuantity(assigningItem.quantity),
          packed: !!assigningItem.packed,
          compartmentId: selectedCompartment.id,
          compartmentName: selectedCompartment.name,
          vehicleId: selectedVehicleId,
        });
      }

      closeAssignStorage();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to assign storage.");
    } finally {
      setSavingAssignment(false);
    }
  }

  function confirmDeleteItem(item: any) {
    if (!user) return;

    Alert.alert("Delete item?", `Delete "${item.name}" from this checklist?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            if (item.compartmentId) {
              await removeOrDecrementInventoryItemFromChecklist(
                {
                  name: item.name,
                  quantity: getSafeQuantity(item.quantity),
                },
                item.compartmentId
              );
            }

            await deleteChecklistItem(user.uid, checklistId, item.id);
          } catch (err) {
            console.error(err);
            Alert.alert("Error", "Failed to delete checklist item.");
          }
        },
      },
    ]);
  }

  const checklistTotals = useMemo(() => {
    const needed = items.reduce(
      (sum, item) => sum + getSafeQuantity(item.quantity),
      0
    );
    const toPack = items.reduce((sum, item) => {
      const qty = getSafeQuantity(item.quantity);
      return item.packed ? sum : sum + qty;
    }, 0);

    return { needed, toPack };
  }, [items]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aPacked = !!a.packed;
      const bPacked = !!b.packed;

      if (aPacked !== bPacked) {
        return aPacked ? 1 : -1;
      }

      const aName = String(a.name ?? "").toLowerCase();
      const bName = String(b.name ?? "").toLowerCase();

      return aName.localeCompare(bName);
    });
  }, [items]);

  const unpackedItems = useMemo(() => {
    const base = sortedItems.filter((item) => !item.packed);
    if (filter === "packed") return [];
    return base;
  }, [sortedItems, filter]);

  const packedItems = useMemo(() => {
    const base = sortedItems.filter((item) => !!item.packed);
    if (filter === "unpacked") return [];
    return base;
  }, [sortedItems, filter]);

  const headerRight = (
    <Pressable
      style={[
        styles.headerActionButton,
        {
          backgroundColor: theme.isLight
            ? "rgba(255,255,255,0.35)"
            : "rgba(12,24,50,0.9)",
          borderColor: theme.colors.border,
        },
      ]}
      onPress={handleAddItem}
    >
      {showCreateBox ? (
        <X size={18} color="#fff" />
      ) : (
        <Plus size={18} color="#fff" />
      )}
    </Pressable>
  );

  function renderChecklistItem(item: any) {
    const isEditing = editingItemId === item.id;
    const neededQty = getSafeQuantity(item.quantity);
    const toPackQty = item.packed ? 0 : neededQty;
    const isPacked = !!item.packed;

    return (
      <FrostedCard
        key={item.id}
        style={[
          isPacked ? styles.packedItemCard : styles.unpackedItemCard,
          {
            borderColor: isPacked
              ? theme.isLight
                ? "rgba(34,197,94,0.24)"
                : "rgba(120,255,190,0.10)"
              : theme.isLight
                ? "rgba(255,255,255,0.34)"
                : "rgba(255,255,255,0.12)",
            backgroundColor: theme.isLight
              ? "rgba(255,255,255,0.64)"
              : isPacked
                ? "rgba(255,255,255,0.02)"
                : "rgba(255,255,255,0.04)",
          },
        ]}
      >
        {isEditing ? (
          <View>
            <TextInput
              value={editingItemName}
              onChangeText={setEditingItemName}
              placeholder="Item name"
              placeholderTextColor={theme.colors.textMuted}
              style={[
                styles.editInput,
                {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.inputSurface,
                  borderColor: theme.colors.border,
                },
              ]}
              autoFocus
            />

            <View style={styles.editActions}>
              <Pressable
                style={[
                  styles.saveItemButton,
                  (!editingItemName.trim() || savingItemEdit) &&
                    styles.disabledButton,
                ]}
                onPress={() => handleSaveItemEdit(item.id)}
                disabled={!editingItemName.trim() || savingItemEdit}
              >
                <Check size={16} color="#fff" />
                <Text style={styles.saveItemButtonText}>
                  {savingItemEdit ? "Saving..." : "Save"}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.cancelItemButton,
                  {
                    backgroundColor: theme.colors.iconSurface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={cancelEditingItem}
              >
                <X size={16} color={theme.colors.text} />
                <Text
                  style={[
                    styles.cancelItemButtonText,
                    { color: theme.colors.text },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.itemContentRow}>
            <Pressable
              style={styles.itemPhotoWrap}
              onPress={() => handleItemPhotoAction(item)}
              disabled={updatingItemId === item.id}
            >
              {item.itemPhotoUri ? (
                <Image
                  source={{ uri: item.itemPhotoUri }}
                  style={styles.itemPhoto}
                />
              ) : (
                <View
                  style={[
                    styles.itemPhotoPlaceholder,
                    {
                      backgroundColor: theme.colors.iconSurface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Camera size={18} color={theme.colors.textSecondary} />
                  <Text
                    style={[
                      styles.itemPhotoPlaceholderText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Photo
                  </Text>
                </View>
              )}
            </Pressable>

            <View style={styles.itemMainContent}>
              <View style={styles.itemTopRow}>
                <View style={styles.itemTitleWrap}>
                  <Text
                    style={[
                      styles.itemText,
                      {
                        color: isPacked
                          ? theme.colors.textSecondary
                          : theme.colors.text,
                      },
                    ]}
                  >
                    {item.name}
                  </Text>
                  {isPacked && <Text style={styles.packedBadge}>Packed</Text>}
                </View>

                <View style={styles.itemActions}>
                  <Pressable
                    style={[
                      styles.iconButton,
                      {
                        backgroundColor: theme.colors.iconSurface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                    onPress={() => handleItemPhotoAction(item)}
                  >
                    <ImageIcon size={16} color={theme.colors.textSecondary} />
                  </Pressable>

                  <Pressable
                    style={[
                      styles.iconButton,
                      {
                        backgroundColor: theme.colors.iconSurface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                    onPress={() => startEditingItem(item)}
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
                    onPress={() => confirmDeleteItem(item)}
                  >
                    <Trash2 size={16} color={theme.colors.danger} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.metricsWrap}>
                <Text
                  style={[
                    styles.metricText,
                    {
                      color: isPacked
                        ? theme.colors.textMuted
                        : theme.colors.textSecondary,
                    },
                  ]}
                >
                  Needed: {neededQty}
                </Text>
                <Text
                  style={[
                    styles.metricText,
                    {
                      color: isPacked
                        ? theme.colors.textMuted
                        : theme.colors.textSecondary,
                    },
                  ]}
                >
                  Packed: {isPacked ? neededQty : 0}
                </Text>
                <Text
                  style={[
                    styles.metricText,
                    {
                      color: isPacked
                        ? theme.colors.textMuted
                        : theme.colors.danger,
                    },
                  ]}
                >
                  To Pack: {toPackQty}
                </Text>
                <Text
                  style={[
                    styles.metricText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Storage:{" "}
                  {item.compartmentName ? item.compartmentName : "Not assigned"}
                </Text>
              </View>

              <View style={styles.secondaryActionsRow}>
                <Pressable
                  style={[
                    styles.assignButton,
                    {
                      backgroundColor: theme.colors.iconSurface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => openAssignStorage(item)}
                >
                  <Text
                    style={[
                      styles.assignButtonText,
                      { color: theme.colors.text },
                    ]}
                  >
                    {item.compartmentName
                      ? "Change Storage"
                      : "Assign Storage"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.controlsRow}>
                <View style={styles.quantityControls}>
                  <Pressable
                    style={[
                      styles.quantityButton,
                      {
                        backgroundColor: theme.colors.iconSurface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                    onPress={() => handleChangeNeededQuantity(item, -1)}
                    disabled={updatingItemId === item.id}
                  >
                    <Minus size={16} color={theme.colors.text} />
                  </Pressable>

                  <View style={styles.quantityValueWrap}>
                    <Text
                      style={[
                        styles.quantityValue,
                        { color: theme.colors.text },
                      ]}
                    >
                      {neededQty}
                    </Text>
                  </View>

                  <Pressable
                    style={[
                      styles.quantityButton,
                      {
                        backgroundColor: theme.colors.iconSurface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                    onPress={() => handleChangeNeededQuantity(item, 1)}
                    disabled={updatingItemId === item.id}
                  >
                    <Plus size={16} color={theme.colors.text} />
                  </Pressable>
                </View>

                <Pressable
                  style={[
                    styles.packToggleButton,
                    isPacked ? styles.packToggleOn : styles.packToggleOff,
                    !isPacked && {
                      backgroundColor: theme.colors.iconSurface,
                      borderColor: theme.colors.border,
                    },
                    updatingItemId === item.id && styles.disabledButton,
                  ]}
                  onPress={() => handleTogglePacked(item)}
                  disabled={updatingItemId === item.id}
                >
                  <CheckCircle2
                    size={16}
                    color={isPacked ? "#fff" : theme.colors.text}
                  />
                  <Text
                    style={[
                      styles.packToggleText,
                      { color: theme.colors.text },
                      isPacked && styles.packToggleTextOn,
                    ]}
                  >
                    {isPacked ? "Packed" : "Mark Packed"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </FrostedCard>
    );
  }

  if (initializing) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.loadingWrap}>
            <Text style={[styles.loading, { color: theme.colors.text }]}>
              Loading...
            </Text>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  if (!user) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.loadingWrap}>
            <Text style={[styles.loading, { color: theme.colors.text }]}>
              Sign in required.
            </Text>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  if (!checklistId) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.loadingWrap}>
            <Text style={[styles.loading, { color: theme.colors.text }]}>
              Checklist not found.
            </Text>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  if (!checklist) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.loadingWrap}>
            <Text style={[styles.loading, { color: theme.colors.text }]}>
              Loading...
            </Text>
          </View>
        </SafeAreaView>
      </ScreenBackground>
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
              title={checklist.name}
              showBackButton
              rightContent={headerRight}
            />

            <FrostedCard style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryBlock}>
                  <Text
                    style={[styles.summaryValue, { color: theme.colors.text }]}
                  >
                    {checklistTotals.needed}
                  </Text>
                  <Text
                    style={[
                      styles.summaryLabel,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Needed
                  </Text>
                </View>

                <View
                  style={[
                    styles.summaryDivider,
                    { backgroundColor: theme.colors.border },
                  ]}
                />

                <View style={styles.summaryBlock}>
                  <Text
                    style={[styles.summaryValue, { color: theme.colors.text }]}
                  >
                    {checklistTotals.toPack}
                  </Text>
                  <Text
                    style={[
                      styles.summaryLabel,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    To Pack
                  </Text>
                </View>
              </View>
            </FrostedCard>

            <FrostedCard style={styles.categoryCard}>
              <Text
                style={[
                  styles.categoryLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Category
              </Text>
              <Text style={[styles.categoryValue, { color: theme.colors.text }]}>
                {getCategoryLabel(
                  checklist.category,
                  checklist.customCategoryLabel
                )}
              </Text>
            </FrostedCard>

            <View style={styles.filterRow}>
              {[
                { key: "all", label: "All" },
                { key: "unpacked", label: "To Pack" },
                { key: "packed", label: "Packed" },
              ].map((option) => {
                const isActive = filter === option.key;

                return (
                  <Pressable
                    key={option.key}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: theme.colors.iconSurface,
                        borderColor: theme.colors.border,
                      },
                      isActive && styles.filterChipActive,
                    ]}
                    onPress={() =>
                      setFilter(option.key as "all" | "unpacked" | "packed")
                    }
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: theme.colors.text },
                        isActive && styles.filterChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {showCreateBox && (
              <View
                style={[
                  styles.createCard,
                  {
                    backgroundColor: theme.isLight
                      ? "rgba(255,255,255,0.68)"
                      : "rgba(12,24,50,0.9)",
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.createTitle, { color: theme.colors.text }]}>
                  Add Item
                </Text>
                <Text
                  style={[
                    styles.createSubtitle,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Name the item before adding it to the checklist.
                </Text>

                <View style={styles.createRow}>
                  <TextInput
                    value={newItemName}
                    onChangeText={setNewItemName}
                    placeholder="Enter item name"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[
                      styles.createInput,
                      {
                        color: theme.colors.text,
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.inputSurface,
                      },
                    ]}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleCreateItem}
                  />

                  <Pressable
                    style={[
                      styles.createButton,
                      (!newItemName.trim() || savingNewItem) &&
                        styles.createButtonDisabled,
                    ]}
                    onPress={handleCreateItem}
                    disabled={!newItemName.trim() || savingNewItem}
                  >
                    <Plus size={18} color="#fff" />
                  </Pressable>
                </View>
              </View>
            )}

            <FrostedCard style={styles.actionCard}>
              <View style={styles.row}>
                <Pressable
                  style={styles.saveTemplatePressable}
                  onPress={handleSaveTemplate}
                >
                  <View
                    style={[
                      styles.rowIconWrap,
                      {
                        backgroundColor: theme.colors.iconSurface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Save size={18} color={theme.colors.text} />
                  </View>
                  <Text style={[styles.rowText, { color: theme.colors.text }]}>
                    Save as Template
                  </Text>
                </Pressable>

                <View style={styles.checklistActionButtons}>
                  <Pressable
                    style={[
                      styles.iconButton,
                      {
                        backgroundColor: theme.colors.iconSurface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                    onPress={handleOpenRenameChecklist}
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
                    onPress={confirmDeleteChecklist}
                  >
                    <Trash2 size={16} color={theme.colors.danger} />
                  </Pressable>
                </View>
              </View>
            </FrostedCard>

            {sortedItems.length === 0 ? (
              <FrostedCard style={styles.emptyCard}>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  No items yet
                </Text>
                <Text
                  style={[
                    styles.emptyText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Tap the + button to add your first checklist item.
                </Text>
              </FrostedCard>
            ) : (
              <>
                <View style={styles.itemsSectionHeader}>
                  <Text style={styles.itemsSectionEyebrow}>Active items</Text>
                  <Text style={styles.itemsSectionTitle}>
                    To Pack ({unpackedItems.length})
                  </Text>
                </View>

                {unpackedItems.length === 0 ? (
                  <FrostedCard style={styles.emptyMiniCard}>
                    <Text
                      style={[
                        styles.emptyMiniText,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {filter === "packed"
                        ? "To Pack items are hidden by the current filter."
                        : "Everything in this checklist is currently packed."}
                    </Text>
                  </FrostedCard>
                ) : (
                  unpackedItems.map(renderChecklistItem)
                )}

                <View style={styles.itemsSectionHeader}>
                  <Text style={styles.itemsSectionEyebrow}>Completed</Text>
                  <Text style={styles.itemsSectionTitle}>
                    Packed ({packedItems.length})
                  </Text>
                </View>

                {packedItems.length === 0 ? (
                  <FrostedCard style={styles.emptyMiniCard}>
                    <Text
                      style={[
                        styles.emptyMiniText,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {filter === "unpacked"
                        ? "Packed items are hidden by the current filter."
                        : "Packed items will appear here once you mark them complete."}
                    </Text>
                  </FrostedCard>
                ) : (
                  packedItems.map(renderChecklistItem)
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal visible={renameModal} transparent animationType="fade">
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
                Rename Checklist
              </Text>

              <TextInput
                value={renameValue}
                onChangeText={setRenameValue}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.inputSurface,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                  },
                ]}
                placeholder="Checklist name"
                placeholderTextColor={theme.colors.textMuted}
              />

              <Pressable
                style={[styles.addButton, savingRename && styles.disabledButton]}
                onPress={handleRenameChecklist}
                disabled={savingRename}
              >
                <Text style={styles.addText}>
                  {savingRename ? "Saving..." : "Save"}
                </Text>
              </Pressable>

              <Pressable onPress={() => setRenameModal(false)}>
                <Text
                  style={[
                    styles.cancelText,
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
          visible={assignModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeAssignStorage}
        >
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
                Assign Storage
              </Text>

              <Text
                style={[
                  styles.assignSectionLabel,
                  { color: theme.colors.text },
                ]}
              >
                Storage Space
              </Text>
              <View style={styles.optionList}>
                {storageSpaces.length === 0 ? (
                  <Text
                    style={[
                      styles.helperText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    No storage spaces found.
                  </Text>
                ) : (
                  storageSpaces.map((space) => {
                    const selected = selectedVehicleId === space.id;

                    return (
                      <Pressable
                        key={space.id}
                        style={[
                          styles.optionButton,
                          {
                            backgroundColor: theme.colors.iconSurface,
                            borderColor: theme.colors.border,
                          },
                          selected && styles.optionButtonSelected,
                        ]}
                        onPress={() => handleSelectVehicle(space.id)}
                      >
                        <Text
                          style={[
                            styles.optionButtonText,
                            { color: theme.colors.text },
                            selected && styles.optionButtonTextSelected,
                          ]}
                        >
                          {space.name}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>

              <Text
                style={[
                  styles.assignSectionLabel,
                  { color: theme.colors.text },
                ]}
              >
                Compartment
              </Text>
              <View style={styles.optionList}>
                {!selectedVehicleId ? (
                  <Text
                    style={[
                      styles.helperText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Select a storage space first.
                  </Text>
                ) : loadingCompartments ? (
                  <Text
                    style={[
                      styles.helperText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Loading compartments...
                  </Text>
                ) : compartments.length === 0 ? (
                  <Text
                    style={[
                      styles.helperText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    No compartments found for this storage space.
                  </Text>
                ) : (
                  compartments.map((compartment) => {
                    const selected = selectedCompartmentId === compartment.id;

                    return (
                      <Pressable
                        key={compartment.id}
                        style={[
                          styles.optionButton,
                          {
                            backgroundColor: theme.colors.iconSurface,
                            borderColor: theme.colors.border,
                          },
                          selected && styles.optionButtonSelected,
                        ]}
                        onPress={() => setSelectedCompartmentId(compartment.id)}
                      >
                        <Text
                          style={[
                            styles.optionButtonText,
                            { color: theme.colors.text },
                            selected && styles.optionButtonTextSelected,
                          ]}
                        >
                          {compartment.name}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>

              <Pressable
                style={[
                  styles.addButton,
                  savingAssignment && styles.disabledButton,
                ]}
                onPress={handleSaveAssignment}
                disabled={savingAssignment}
              >
                <Text style={styles.addText}>
                  {savingAssignment ? "Saving..." : "Save Assignment"}
                </Text>
              </Pressable>

              <Pressable onPress={closeAssignStorage}>
                <Text
                  style={[
                    styles.cancelText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
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
    flexGrow: 1,
    padding: 16,
    paddingBottom: 180,
  },

  loadingWrap: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
  },

  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  createCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },

  createTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },

  createSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },

  createRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  createInput: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },

  createButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(55, 130, 245, 0.95)",
  },

  createButtonDisabled: {
    opacity: 0.5,
  },

  card: {
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    overflow: "hidden",
  },

  actionCard: {
    paddingVertical: 12,
  },

  unpackedItemCard: {},

  packedItemCard: {},

  summaryCard: {
    paddingVertical: 18,
  },

  categoryCard: {
    marginBottom: 16,
    paddingVertical: 14,
  },

  categoryLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  categoryValue: {
    fontSize: 16,
    fontWeight: "700",
  },

  filterRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },

  filterChipActive: {
    backgroundColor: "rgba(55,130,245,0.95)",
    borderColor: "rgba(55,130,245,0.95)",
  },

  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
  },

  filterChipTextActive: {
    color: "#fff",
  },

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  summaryBlock: {
    flex: 1,
    alignItems: "center",
  },

  summaryDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 10,
  },

  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },

  summaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  rowText: {
    fontSize: 16,
    fontWeight: "700",
  },

  saveTemplatePressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  checklistActionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  emptyCard: {
    marginBottom: 12,
    padding: 16,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 22,
  },

  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },

  itemsSectionHeader: {
    marginTop: 4,
    marginBottom: 10,
  },

  itemsSectionEyebrow: {
    color: "#FFFFFF",
    opacity: 0.82,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },

  itemsSectionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },

  emptyMiniCard: {
    marginBottom: 12,
    paddingVertical: 12,
  },

  emptyMiniText: {
    fontSize: 13,
    lineHeight: 18,
  },

  itemContentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  itemPhotoWrap: {
    width: 82,
    marginRight: 14,
  },

  itemPhoto: {
    width: 82,
    height: 82,
    borderRadius: 14,
  },

  itemPhotoPlaceholder: {
    width: 82,
    height: 82,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    paddingHorizontal: 6,
  },

  itemPhotoPlaceholderText: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },

  itemMainContent: {
    flex: 1,
  },

  itemTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  itemTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },

  itemText: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },

  packedBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(120,255,190,0.12)",
    color: "#22C55E",
    fontSize: 11,
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

  metricsWrap: {
    marginBottom: 12,
    gap: 5,
  },

  metricText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },

  secondaryActionsRow: {
    marginBottom: 12,
  },

  assignButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },

  assignButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
  },

  quantityButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  quantityValueWrap: {
    minWidth: 36,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },

  quantityValue: {
    fontSize: 16,
    fontWeight: "700",
  },

  packToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },

  packToggleOn: {
    backgroundColor: "rgba(55,130,245,0.95)",
    borderColor: "rgba(55,130,245,0.95)",
  },

  packToggleOff: {},

  packToggleText: {
    fontWeight: "700",
    marginLeft: 6,
  },

  packToggleTextOn: {
    color: "#fff",
  },

  editInput: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    fontSize: 15,
  },

  editActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 10,
  },

  saveItemButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(55,130,245,0.95)",
    paddingVertical: 12,
    borderRadius: 12,
  },

  saveItemButtonText: {
    color: "#fff",
    fontWeight: "700",
    marginLeft: 6,
  },

  cancelItemButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },

  cancelItemButtonText: {
    fontWeight: "600",
    marginLeft: 6,
  },

  addButton: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(55,130,245,0.95)",
  },

  disabledButton: {
    opacity: 0.6,
  },

  addText: {
    color: "#fff",
    fontWeight: "700",
  },

  loading: {
    padding: 20,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },

  modalCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },

  modalTitle: {
    marginBottom: 10,
    fontSize: 16,
    fontWeight: "700",
  },

  input: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },

  cancelText: {
    textAlign: "center",
    marginTop: 10,
  },

  assignSectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 8,
  },

  optionList: {
    gap: 8,
  },

  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },

  optionButtonSelected: {
    backgroundColor: "rgba(55,130,245,0.22)",
    borderColor: "rgba(55,130,245,0.95)",
  },

  optionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },

  optionButtonTextSelected: {
    color: "#fff",
  },

  helperText: {
    fontSize: 13,
    lineHeight: 18,
  },
});