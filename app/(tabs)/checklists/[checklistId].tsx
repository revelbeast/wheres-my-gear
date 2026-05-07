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
  Share2,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../../components/auth/AuthProvider";
import AppHeader from "../../../components/ui/AppHeader";
import HapticPressable from "../../../components/ui/HapticPressable";
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
import { triggerSuccessHaptic } from "../../../lib/haptics";
import { useInteractionLock } from "../../../lib/useInteractionLock";
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
          backgroundColor: theme.colors.card,
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

function formatChecklistItemForShare(item: any) {
  const quantity = getSafeQuantity(item.quantity);
  const storage = item.compartmentName
    ? `, Storage: ${item.compartmentName}`
    : "";
  return `- ${item.name} (Qty: ${quantity}${storage})`;
}

export default function ChecklistDetailScreen() {
  const { user, initializing } = useAuth();
  const params = useLocalSearchParams<{ checklistId?: string | string[] }>();

  const checklistId = useMemo(() => {
    const value = params.checklistId;

    if (Array.isArray(value)) {
      return value[0] ?? "";
    }

    return value ?? "";
  }, [params.checklistId]);

  const theme = useThemedValues();
  const isScreenMountedRef = useRef(true);
  const userId = user?.uid ?? "";
  const checklistLoadVersionRef = useRef(0);
  const checklistItemsSubscriptionVersionRef = useRef(0);
  const actionLockRef = useRef(false);
  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

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
    isScreenMountedRef.current = true;

    return () => {
      isScreenMountedRef.current = false;
      checklistLoadVersionRef.current += 1;
      checklistItemsSubscriptionVersionRef.current += 1;
      actionLockRef.current = false;
    };
  }, []);

  useEffect(() => {
    const loadVersion = checklistLoadVersionRef.current + 1;
    const subscriptionVersion =
      checklistItemsSubscriptionVersionRef.current + 1;

    checklistLoadVersionRef.current = loadVersion;
    checklistItemsSubscriptionVersionRef.current = subscriptionVersion;

    if (initializing) {
      return;
    }

    if (!userId || !checklistId) {
      setChecklist(null);
      setItems([]);
      return;
    }

    async function loadActiveChecklist() {
      try {
        const data = await getChecklist(userId, checklistId);

        if (
          checklistLoadVersionRef.current !== loadVersion ||
          !isScreenMountedRef.current
        ) {
          return;
        }

        setChecklist(data);
      } catch (err) {
        if (
          checklistLoadVersionRef.current !== loadVersion ||
          !isScreenMountedRef.current
        ) {
          return;
        }

        console.error("Failed to load checklist:", err);
        setChecklist(null);
      }
    }

    loadActiveChecklist();

    const unsubscribe = subscribeToChecklistItems(
      userId,
      checklistId,
      (nextItems) => {
        if (
          checklistItemsSubscriptionVersionRef.current !==
          subscriptionVersion ||
          !isScreenMountedRef.current
        ) {
          return;
        }

        setItems(nextItems);
      }
    );

    return () => {
      checklistLoadVersionRef.current += 1;
      checklistItemsSubscriptionVersionRef.current += 1;
      unsubscribe();
    };
  }, [initializing, userId, checklistId]);

  async function runWithLock(action: () => Promise<void> | void) {
    if (interactionLocked || actionLockRef.current || !isScreenMountedRef.current) {
      return;
    }

    actionLockRef.current = true;
    lockInteraction();

    try {
      await action();
    } finally {
      actionLockRef.current = false;

      if (isScreenMountedRef.current) {
        unlockInteraction();
      }
    }
  }

  async function refreshChecklist() {
    if (!user || !checklistId) return;

    try {
      const data = await getChecklist(user.uid, checklistId);

      if (!isScreenMountedRef.current) {
        return;
      }

      setChecklist(data);
    } catch (err) {
      if (!isScreenMountedRef.current) {
        return;
      }

      console.error("Failed to load checklist:", err);
      setChecklist(null);
    }
  }

  function isBusyWithItemActions(itemId?: string) {
    return (
      savingNewItem ||
      savingItemEdit ||
      savingAssignment ||
      interactionLocked ||
      actionLockRef.current ||
      (!!itemId && updatingItemId === itemId)
    );
  }

  function handleOpenRenameChecklist() {
    if (!checklist || savingRename || interactionLocked) return;

    setRenameValue(checklist.name);
    setRenameModal(true);
  }

  function confirmDeleteChecklist() {
    if (!checklist || !user || interactionLocked) return;

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
            await runWithLock(async () => {
              try {
                await deleteChecklist(user.uid, checklistId);
                router.replace("/checklists");
              } catch (err) {
                console.error(err);
                Alert.alert("Error", "Failed to delete checklist.");
              }
            });
          },
        },
      ]
    );
  }

  async function handleRenameChecklist() {
    const trimmed = renameValue.trim();
    if (!trimmed || !user || savingRename || interactionLocked) return;

    setSavingRename(true);

    await runWithLock(async () => {
      try {
        await updateChecklistName(user.uid, checklistId, trimmed);
        void triggerSuccessHaptic();
        setRenameModal(false);
        await refreshChecklist();
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to rename checklist.");
      } finally {
        if (isScreenMountedRef.current) {
          setSavingRename(false);
        }
      }
    });
  }

  async function handleSaveTemplate() {
    if (!user || interactionLocked) return;

    await runWithLock(async () => {
      try {
        await saveChecklistAsTemplate(user.uid, checklistId);
        void triggerSuccessHaptic();
        Alert.alert("Saved", "Checklist saved as template.");
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to save checklist as template.");
      }
    });
  }

  async function handleShareChecklist() {
    if (!checklist || interactionLocked) return;

    const packedItems = sortedItems.filter((item) => !!item.packed);
    const toPackItems = sortedItems.filter((item) => !item.packed);

    const categoryLabel = getCategoryLabel(
      checklist.category,
      checklist.customCategoryLabel
    );

    const toPackText =
      toPackItems.length > 0
        ? toPackItems.map(formatChecklistItemForShare).join("\n")
        : "- Nothing left to pack";

    const packedText =
      packedItems.length > 0
        ? packedItems.map(formatChecklistItemForShare).join("\n")
        : "- No packed items yet";

    const message = [
      `Where's My Gear Checklist`,
      ``,
      `Checklist: ${checklist.name}`,
      `Category: ${categoryLabel}`,
      `Needed: ${checklistTotals.needed}`,
      `To Pack: ${checklistTotals.toPack}`,
      ``,
      `To Pack`,
      toPackText,
      ``,
      `Packed`,
      packedText,
    ].join("\n");

    await runWithLock(async () => {
      try {
        await Share.share({
          title: checklist.name,
          message,
        });
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to share checklist.");
      }
    });
  }

  function handleAddItem() {
    if (isBusyWithItemActions()) return;

    setShowCreateBox((prev) => {
      if (prev) {
        setNewItemName("");
      }

      return !prev;
    });
  }

  async function handleCreateItem() {
    const trimmed = newItemName.trim();
    if (!trimmed || !user || savingNewItem || interactionLocked) return;

    setSavingNewItem(true);

    await runWithLock(async () => {
      try {
        await addChecklistItem(user.uid, checklistId, trimmed);
        void triggerSuccessHaptic();
        setNewItemName("");
        setShowCreateBox(false);
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to add checklist item.");
      } finally {
        if (isScreenMountedRef.current) {
          setSavingNewItem(false);
        }
      }
    });
  }

  function startEditingItem(item: any) {
    if (isBusyWithItemActions(item.id)) return;

    setEditingItemId(item.id);
    setEditingItemName(item.name ?? "");
  }

  function cancelEditingItem() {
    if (savingItemEdit) return;

    setEditingItemId(null);
    setEditingItemName("");
  }

  async function handleSaveItemEdit(itemId: string) {
    const trimmed = editingItemName.trim();
    if (!trimmed || !user || savingItemEdit || interactionLocked) return;

    setSavingItemEdit(true);

    await runWithLock(async () => {
      try {
        await updateChecklistItemName(user.uid, checklistId, itemId, trimmed);
        void triggerSuccessHaptic();
        setEditingItemId(null);
        setEditingItemName("");
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to update checklist item.");
      } finally {
        if (isScreenMountedRef.current) {
          setSavingItemEdit(false);
        }
      }
    });
  }

  async function handleChangeNeededQuantity(item: any, delta: number) {
    if (!user || isBusyWithItemActions(item.id)) return;

    const currentQuantity = getSafeQuantity(item.quantity);
    const nextQuantity = Math.max(1, currentQuantity + delta);
    const quantityDelta = nextQuantity - currentQuantity;

    if (quantityDelta === 0) return;

    setUpdatingItemId(item.id);

    await runWithLock(async () => {
      try {
        await updateChecklistItemQuantity(
          user.uid,
          checklistId,
          item.id,
          nextQuantity
        );

        if (item.compartmentId) {
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
        if (isScreenMountedRef.current) {
          setUpdatingItemId(null);
        }
      }
    });
  }

  async function handleTogglePacked(item: any) {
    if (!user || isBusyWithItemActions(item.id)) return;

    setUpdatingItemId(item.id);

    await runWithLock(async () => {
      try {
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
        if (isScreenMountedRef.current) {
          setUpdatingItemId(null);
        }
      }
    });
  }

  async function handleItemPhotoAction(item: any) {
    if (isBusyWithItemActions(item.id)) return;

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
    if (!user || isBusyWithItemActions(item.id)) return;

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Camera access needed", "Please allow camera access first.");
        return;
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to request camera permission.");
      return;
    }

    setUpdatingItemId(item.id);

    await runWithLock(async () => {
      try {
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

        void triggerSuccessHaptic();
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to save item photo.");
      } finally {
        if (isScreenMountedRef.current) {
          setUpdatingItemId(null);
        }
      }
    });
  }

  async function handlePickItemPhoto(item: any) {
    if (!user || isBusyWithItemActions(item.id)) return;

    setUpdatingItemId(item.id);

    await runWithLock(async () => {
      try {
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

        void triggerSuccessHaptic();
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to save item photo.");
      } finally {
        if (isScreenMountedRef.current) {
          setUpdatingItemId(null);
        }
      }
    });
  }

  async function handleRemoveItemPhoto(item: any) {
    if (!user || isBusyWithItemActions(item.id)) return;

    setUpdatingItemId(item.id);

    await runWithLock(async () => {
      try {
        await updateChecklistItemPhoto(user.uid, checklistId, item.id, "");
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to remove item photo.");
      } finally {
        if (isScreenMountedRef.current) {
          setUpdatingItemId(null);
        }
      }
    });
  }

  async function openAssignStorage(item: any) {
    if (isBusyWithItemActions(item.id)) return;

    await runWithLock(async () => {
      try {
        setAssigningItem(item);
        setSelectedVehicleId(item.vehicleId ?? "");
        setSelectedCompartmentId(item.compartmentId ?? "");
        setCompartments([]);
        setAssignModalVisible(true);

        const spaces = await getStorageSpaces();

        if (!isScreenMountedRef.current) {
          return;
        }

        setStorageSpaces(spaces);

        const initialVehicleId = item.vehicleId ?? "";
        if (initialVehicleId) {
          await loadCompartmentsForVehicle(initialVehicleId);
        }
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to load storage spaces.");
      }
    });
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

      if (!isScreenMountedRef.current) {
        return;
      }

      setCompartments(results);

      const currentSelectedStillValid = results.some(
        (compartment) => compartment.id === selectedCompartmentId
      );

      if (!currentSelectedStillValid) {
        setSelectedCompartmentId("");
      }
    } catch (err) {
      if (!isScreenMountedRef.current) {
        return;
      }

      console.error(err);
      Alert.alert("Error", "Failed to load compartments.");
      setCompartments([]);
      setSelectedCompartmentId("");
    } finally {
      if (isScreenMountedRef.current) {
        setLoadingCompartments(false);
      }
    }
  }

  async function handleSelectVehicle(vehicleId: string) {
    if (savingAssignment || loadingCompartments) return;

    setSelectedVehicleId(vehicleId);
    setSelectedCompartmentId("");
    await loadCompartmentsForVehicle(vehicleId);
  }

  function handleSelectCompartment(compartmentId: string) {
    if (savingAssignment) return;

    setSelectedCompartmentId(compartmentId);
  }

  async function handleSaveAssignment() {
    if (!assigningItem || !user || savingAssignment || interactionLocked) {
      return;
    }

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

    setSavingAssignment(true);

    await runWithLock(async () => {
      try {
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

        void triggerSuccessHaptic();
        closeAssignStorage();
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to assign storage.");
      } finally {
        if (isScreenMountedRef.current) {
          setSavingAssignment(false);
        }
      }
    });
  }

  function confirmDeleteItem(item: any) {
    if (!user || isBusyWithItemActions(item.id)) return;

    Alert.alert("Delete item?", `Delete "${item.name}" from this checklist?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (isBusyWithItemActions(item.id)) return;

          setUpdatingItemId(item.id);

          await runWithLock(async () => {
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
            } finally {
              if (isScreenMountedRef.current) {
                setUpdatingItemId(null);
              }
            }
          });
        },
      },
    ]);
  }

  function handleFilterChange(nextFilter: "all" | "unpacked" | "packed") {
    if (interactionLocked) return;

    setFilter(nextFilter);
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
    <HapticPressable
      style={[
        styles.headerActionButton,
        {
          backgroundColor: theme.colors.iconSurface,
          borderColor: theme.colors.border,
        },
        isBusyWithItemActions() && styles.disabledButton,
      ]}
      onPress={handleAddItem}
      disabled={isBusyWithItemActions()}
      accessibilityRole="button"
      accessibilityLabel={showCreateBox ? "Close add item" : "Add checklist item"}
    >
      {showCreateBox ? (
        <X size={18} color="#fff" />
      ) : (
        <Plus size={18} color="#fff" />
      )}
    </HapticPressable>
  );

  function renderChecklistItem(item: any) {
    const isEditing = editingItemId === item.id;
    const neededQty = getSafeQuantity(item.quantity);
    const toPackQty = item.packed ? 0 : neededQty;
    const isPacked = !!item.packed;
    const interactionDisabled = isBusyWithItemActions(item.id);

    return (
      <FrostedCard
        key={item.id}
        style={[
          isPacked ? styles.packedItemCard : styles.unpackedItemCard,
          {
            borderColor: isPacked
              ? "rgba(34,197,94,0.95)"
              : theme.colors.border,
            backgroundColor: theme.colors.card,
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
              editable={!savingItemEdit}
            />

            <View style={styles.editActions}>
              <HapticPressable
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
              </HapticPressable>

              <HapticPressable
                style={[
                  styles.cancelItemButton,
                  {
                    backgroundColor: theme.colors.iconSurface,
                    borderColor: theme.colors.border,
                  },
                  savingItemEdit && styles.disabledButton,
                ]}
                onPress={cancelEditingItem}
                disabled={savingItemEdit}
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
              </HapticPressable>
            </View>
          </View>
        ) : (
          <View style={styles.itemContentRow}>
            <HapticPressable
              style={[
                styles.itemPhotoWrap,
                interactionDisabled && styles.disabledInteraction,
              ]}
              onPress={() => handleItemPhotoAction(item)}
              disabled={interactionDisabled}
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
            </HapticPressable>

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
                  <HapticPressable
                    style={[
                      styles.iconButton,
                      {
                        backgroundColor: theme.colors.iconSurface,
                        borderColor: theme.colors.border,
                      },
                      interactionDisabled && styles.disabledInteraction,
                    ]}
                    onPress={() => handleItemPhotoAction(item)}
                    disabled={interactionDisabled}
                  >
                    <ImageIcon size={16} color={theme.colors.textSecondary} />
                  </HapticPressable>

                  <HapticPressable
                    style={[
                      styles.iconButton,
                      {
                        backgroundColor: theme.colors.iconSurface,
                        borderColor: theme.colors.border,
                      },
                      interactionDisabled && styles.disabledInteraction,
                    ]}
                    onPress={() => startEditingItem(item)}
                    disabled={interactionDisabled}
                  >
                    <Pencil size={16} color={theme.colors.textSecondary} />
                  </HapticPressable>

                  <HapticPressable
                    style={[
                      styles.iconButton,
                      {
                        backgroundColor: theme.colors.iconSurface,
                        borderColor: theme.colors.border,
                      },
                      interactionDisabled && styles.disabledInteraction,
                    ]}
                    onPress={() => confirmDeleteItem(item)}
                    disabled={interactionDisabled}
                  >
                    <Trash2 size={16} color={theme.colors.danger} />
                  </HapticPressable>
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
                <HapticPressable
                  style={[
                    styles.assignButton,
                    {
                      backgroundColor: theme.colors.iconSurface,
                      borderColor: theme.colors.border,
                    },
                    interactionDisabled && styles.disabledInteraction,
                  ]}
                  onPress={() => openAssignStorage(item)}
                  disabled={interactionDisabled}
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
                </HapticPressable>
              </View>

              <View style={styles.controlsRow}>
                <View style={styles.quantityControls}>
                  <HapticPressable
                    style={[
                      styles.quantityButton,
                      {
                        backgroundColor: theme.colors.iconSurface,
                        borderColor: theme.colors.border,
                      },
                      interactionDisabled && styles.disabledInteraction,
                    ]}
                    onPress={() => handleChangeNeededQuantity(item, -1)}
                    disabled={interactionDisabled}
                  >
                    <Minus size={16} color={theme.colors.text} />
                  </HapticPressable>

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

                  <HapticPressable
                    style={[
                      styles.quantityButton,
                      {
                        backgroundColor: theme.colors.iconSurface,
                        borderColor: theme.colors.border,
                      },
                      interactionDisabled && styles.disabledInteraction,
                    ]}
                    onPress={() => handleChangeNeededQuantity(item, 1)}
                    disabled={interactionDisabled}
                  >
                    <Plus size={16} color={theme.colors.text} />
                  </HapticPressable>
                </View>

                <HapticPressable
                  style={[
                    styles.packToggleButton,
                    isPacked ? styles.packToggleOn : styles.packToggleOff,
                    !isPacked && {
                      backgroundColor: theme.colors.iconSurface,
                      borderColor: theme.colors.border,
                    },
                    interactionDisabled && styles.disabledButton,
                  ]}
                  onPress={() => handleTogglePacked(item)}
                  disabled={interactionDisabled}
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
                </HapticPressable>
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
                  <HapticPressable
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
                      handleFilterChange(
                        option.key as "all" | "unpacked" | "packed"
                      )
                    }
                    disabled={interactionLocked}
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
                  </HapticPressable>
                );
              })}
            </View>

            {showCreateBox && (
              <View
                style={[
                  styles.createCard,
                  {
                    backgroundColor: theme.colors.card,
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
                    editable={!savingNewItem}
                  />

                  <HapticPressable
                    style={[
                      styles.createButton,
                      (!newItemName.trim() || savingNewItem) &&
                      styles.createButtonDisabled,
                    ]}
                    onPress={handleCreateItem}
                    disabled={!newItemName.trim() || savingNewItem}
                  >
                    <Plus size={18} color="#fff" />
                  </HapticPressable>
                </View>
              </View>
            )}

            <FrostedCard style={styles.actionCard}>
              <View style={styles.actionStack}>
                <HapticPressable
                  style={[
                    styles.shareChecklistButton,
                    {
                      backgroundColor: theme.colors.iconSurface,
                      borderColor: theme.colors.border,
                    },
                    interactionLocked && styles.disabledButton,
                  ]}
                  onPress={handleShareChecklist}
                  disabled={interactionLocked}
                >
                  <Share2 size={18} color={theme.colors.text} />
                  <Text
                    style={[
                      styles.shareChecklistButtonText,
                      { color: theme.colors.text },
                    ]}
                  >
                    Share Checklist
                  </Text>
                </HapticPressable>

                <View style={styles.row}>
                  <HapticPressable
                    style={[
                      styles.saveTemplatePressable,
                      interactionLocked && styles.disabledInteraction,
                    ]}
                    onPress={handleSaveTemplate}
                    disabled={interactionLocked}
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
                  </HapticPressable>

                  <View style={styles.checklistActionButtons}>
                    <HapticPressable
                      style={[
                        styles.iconButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                        interactionLocked && styles.disabledInteraction,
                      ]}
                      onPress={handleOpenRenameChecklist}
                      disabled={interactionLocked}
                    >
                      <Pencil size={16} color={theme.colors.textSecondary} />
                    </HapticPressable>

                    <HapticPressable
                      style={[
                        styles.iconButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                        interactionLocked && styles.disabledInteraction,
                      ]}
                      onPress={confirmDeleteChecklist}
                      disabled={interactionLocked}
                    >
                      <Trash2 size={16} color={theme.colors.danger} />
                    </HapticPressable>
                  </View>
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
                  backgroundColor: theme.colors.cardStrong,
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
                editable={!savingRename}
              />

              <HapticPressable
                style={[styles.addButton, savingRename && styles.disabledButton]}
                onPress={handleRenameChecklist}
                disabled={savingRename}
              >
                <Text style={styles.addText}>
                  {savingRename ? "Saving..." : "Save"}
                </Text>
              </HapticPressable>

              <HapticPressable
                onPress={() => setRenameModal(false)}
                disabled={savingRename}
              >
                <Text
                  style={[
                    styles.cancelText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </HapticPressable>
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
                  backgroundColor: theme.colors.cardStrong,
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
                      <HapticPressable
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
                        disabled={savingAssignment || loadingCompartments}
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
                      </HapticPressable>
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
                      <HapticPressable
                        key={compartment.id}
                        style={[
                          styles.optionButton,
                          {
                            backgroundColor: theme.colors.iconSurface,
                            borderColor: theme.colors.border,
                          },
                          selected && styles.optionButtonSelected,
                        ]}
                        onPress={() => handleSelectCompartment(compartment.id)}
                        disabled={savingAssignment}
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
                      </HapticPressable>
                    );
                  })
                )}
              </View>

              <HapticPressable
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
              </HapticPressable>

              <HapticPressable
                onPress={closeAssignStorage}
                disabled={savingAssignment}
              >
                <Text
                  style={[
                    styles.cancelText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </HapticPressable>
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

  disabledInteraction: {
    opacity: 0.6,
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

  actionStack: {
    gap: 12,
  },

  shareChecklistButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  shareChecklistButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },

  unpackedItemCard: {},

  packedItemCard: {
    borderWidth: 1.5,
  },

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