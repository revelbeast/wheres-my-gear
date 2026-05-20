import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Minus,
  MoveRight,
  Pencil,
  Plus,
  Archive,
  Trash2
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import HapticPressable from "../../../components/ui/HapticPressable";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import { useThemedValues } from "../../../components/ui/Themed";
import {
  createItem,
  deleteCompartment,
  deleteItem,
  archiveStorageSpace,
  deleteStorageSpace,
  getAllCompartments,
  getCompartmentsByVehicle,
  getItemsByCompartment,
  getStorageSpaces,
  updateCompartment,
  updateItem,
  updateItemPhoto,
  type Compartment,
  type Item,
  type StorageSpace
} from "../../../lib/gearService";
import { useDeviceLayout } from "../../../lib/useDeviceLayout";
import { useInteractionLock } from "../../../lib/useInteractionLock";
import { colors } from "../../../theme/tokens";

function getSafeQuantity(value?: number) {
  const qty = Number(value ?? 1);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function isPackedItem(item: Item) {
  return item.status === "packed";
}

export default function StorageManagementScreen() {
  const theme = useThemedValues();
  const { isTablet, isLandscape } = useDeviceLayout();
  const isTabletLandscape = isTablet && isLandscape;

  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const isMountedRef = useRef(true);
  const loadRequestVersionRef = useRef(0);
  const actionLockRef = useRef(false);
  const navigationTransitionLockedRef = useRef(false);
  const navigationUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [storageSpaces, setStorageSpaces] = useState<StorageSpace[]>([]);
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [selectedCompartmentId, setSelectedCompartmentId] = useState<string | null>(null);
  const [compartmentItems, setCompartmentItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [savingItemEdit, setSavingItemEdit] = useState(false);
  const [updatingQuantityId, setUpdatingQuantityId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [updatingPhotoId, setUpdatingPhotoId] = useState<string | null>(null);
  const [showCompartmentDropdown, setShowCompartmentDropdown] = useState(false);
  const [deletingStorageId, setDeletingStorageId] = useState<string | null>(null);
  const [archivingStorageId, setArchivingStorageId] = useState<string | null>(null);
  const [deletingCompartmentId, setDeletingCompartmentId] = useState<string | null>(null);
  const [editingCompartment, setEditingCompartment] = useState<Compartment | null>(null);
  const [editingCompartmentName, setEditingCompartmentName] = useState("");
  const [savingCompartmentEdit, setSavingCompartmentEdit] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      loadRequestVersionRef.current += 1;
      actionLockRef.current = false;
      navigationTransitionLockedRef.current = false;

      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
        navigationUnlockTimeoutRef.current = null;
      }
    };
  }, []);

  const sortedStorageSpaces = useMemo(() => {
    return [...storageSpaces].sort((a, b) => {
      const aName = String(a.name ?? "").trim().toLowerCase();
      const bName = String(b.name ?? "").trim().toLowerCase();

      return aName.localeCompare(bName);
    });
  }, [storageSpaces]);

  const loadStorageSpaces = useCallback(async () => {
    const requestVersion = loadRequestVersionRef.current + 1;
    loadRequestVersionRef.current = requestVersion;

    try {
      const spaces = await getStorageSpaces();

      if (
        !isMountedRef.current ||
        loadRequestVersionRef.current !== requestVersion
      ) {
        return;
      }

      setStorageSpaces(spaces);

      const sortedSpaces = [...spaces].sort((a, b) =>
        String(a.name ?? "").localeCompare(String(b.name ?? ""))
      );

      const nextSelectedStorageId =
        selectedStorageId && sortedSpaces.some((space) => space.id === selectedStorageId)
          ? selectedStorageId
          : sortedSpaces[0]?.id ?? null;

      setSelectedStorageId(nextSelectedStorageId);

      if (nextSelectedStorageId) {
        const nextCompartments = await getCompartmentsByVehicle(nextSelectedStorageId);

        if (
          !isMountedRef.current ||
          loadRequestVersionRef.current !== requestVersion
        ) {
          return;
        }

        setCompartments(nextCompartments);

        const nextSelectedCompartmentId =
          selectedCompartmentId &&
            nextCompartments.some((compartment) => compartment.id === selectedCompartmentId)
            ? selectedCompartmentId
            : nextCompartments[0]?.id ?? null;

        setSelectedCompartmentId(nextSelectedCompartmentId);

        if (nextSelectedCompartmentId) {
          const nextItems = await getItemsByCompartment(nextSelectedCompartmentId);

          if (
            !isMountedRef.current ||
            loadRequestVersionRef.current !== requestVersion
          ) {
            return;
          }

          setCompartmentItems(nextItems);
        } else {
          setCompartmentItems([]);
        }
      } else {
        setCompartments([]);
        setSelectedCompartmentId(null);
        setCompartmentItems([]);
      }
    } catch (error) {
      console.error("Failed to load storage spaces:", error);

      if (
        !isMountedRef.current ||
        loadRequestVersionRef.current !== requestVersion
      ) {
        return;
      }

      setStorageSpaces([]);
    }
  }, [selectedStorageId, selectedCompartmentId]);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;

      // IMPORTANT: reset interaction state when returning to screen
      navigationTransitionLockedRef.current = false;
      actionLockRef.current = false;

      loadStorageSpaces();

      return () => {
        loadRequestVersionRef.current += 1;

        // safety reset on blur
        navigationTransitionLockedRef.current = false;
        actionLockRef.current = false;
      };
    }, [loadStorageSpaces])
  );

  async function runWithLock(action: () => Promise<void> | void) {
    if (interactionLocked || actionLockRef.current) return;

    actionLockRef.current = true;
    lockInteraction();

    try {
      await action();
    } finally {
      actionLockRef.current = false;

      if (isMountedRef.current) {
        unlockInteraction();
      }
    }
  }

  function isBusy() {
    return (
      interactionLocked ||
      actionLockRef.current ||
      !!deletingStorageId ||
      navigationTransitionLockedRef.current
    );
  }

  function lockNavigationTransition() {
    if (navigationTransitionLockedRef.current || !isMountedRef.current) {
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

  function handleBack() {
    if (isBusy()) return;

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    router.replace("/inventory");
  }

  function handleCreateStorage() {
    if (isBusy()) return;

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    router.push({
      pathname: "/(tabs)/storage/create",
    });
  }

  function handleCreateCompartment() {
    if (!isTabletLandscape || !selectedStorageId || isBusy()) return;

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    router.push({
      pathname: "/(tabs)/vehicles/[vehicleId]/compartments/create",
      params: {
        vehicleId: selectedStorageId,
        returnTo: "/(tabs)/storage",
      },
    });
  }

  async function handleCreateItem() {
    if (!selectedStorageId || !selectedCompartmentId || isBusy()) return;

    const selectedStorage = storageSpaces.find(
      (space) => space.id === selectedStorageId
    );
    const selectedCompartment = compartments.find(
      (compartment) => compartment.id === selectedCompartmentId
    );

    if (!selectedStorage || !selectedCompartment) {
      Alert.alert(
        "Select a compartment",
        "Choose a storage space and compartment before adding an item."
      );
      return;
    }

    await runWithLock(async () => {
      try {
        const newItemId = await createItem({
          name: "New Item",
          quantity: 1,
          status: "missing",
          compartmentId: selectedCompartment.id,
          compartmentName: selectedCompartment.name,
          vehicleId: selectedStorage.id,
          vehicleName: selectedStorage.name,
          source: "manual",
        });

        if (!isMountedRef.current) return;

        const nextItems = await getItemsByCompartment(selectedCompartment.id);

        if (!isMountedRef.current) return;

        const reorderedItems = [
          ...nextItems.filter((item) => item.id === newItemId),
          ...nextItems.filter((item) => item.id !== newItemId),
        ];

        setCompartmentItems(reorderedItems);
        setSelectedItemId(newItemId);
        setEditingItemId(newItemId);
        setEditingItemName("New Item");
      } catch (error) {
        console.error("Failed to create item:", error);

        if (!isMountedRef.current) return;

        Alert.alert("Error", "Failed to create item.");
      }
    });
  }

  function handleOpenCompartments(space: StorageSpace) {
    if (!space.id || isBusy()) return;

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    router.push({
      pathname: "/vehicles/[vehicleId]",
      params: {
        vehicleId: String(space.id),
      },
    });
  }

  function handleSelectStorage(space: StorageSpace) {
    if (!space.id || isBusy()) return;

    if (isTabletLandscape) {
      setSelectedStorageId(String(space.id));
      return;
    }

    handleOpenCompartments(space);
  }

  async function handleSelectCompartment(compartmentId: string) {
    if (isBusy()) return;

    setSelectedCompartmentId(compartmentId);
    setShowCompartmentDropdown(false);

    try {
      const nextItems = await getItemsByCompartment(compartmentId);

      if (!isMountedRef.current) return;

      setCompartmentItems(nextItems);
    } catch (error) {
      console.error("Failed to load compartment items:", error);

      if (!isMountedRef.current) return;

      setCompartmentItems([]);
    }
  }

  function handleEditCompartment(compartment: Compartment) {
    if (!compartment.id || isBusy()) return;

    setEditingCompartment(compartment);
    setEditingCompartmentName(compartment.name ?? "");
  }

  function cancelEditingCompartment() {
    setEditingCompartment(null);
    setEditingCompartmentName("");
    setSavingCompartmentEdit(false);
  }

  async function saveEditingCompartment() {
    const nextName = editingCompartmentName.trim();

    if (
      !editingCompartment?.id ||
      !nextName ||
      savingCompartmentEdit ||
      isBusy()
    ) {
      return;
    }

    try {
      setSavingCompartmentEdit(true);

      await updateCompartment(editingCompartment.id, {
        name: nextName,
      });

      if (!isMountedRef.current) return;

      setCompartments((currentCompartments) =>
        currentCompartments.map((currentCompartment) =>
          currentCompartment.id === editingCompartment.id
            ? { ...currentCompartment, name: nextName }
            : currentCompartment
        )
      );

      cancelEditingCompartment();
    } catch (error) {
      console.error("Failed to edit compartment:", error);

      if (!isMountedRef.current) return;

      Alert.alert("Edit Failed", "Unable to update this compartment.");
    } finally {
      if (isMountedRef.current) {
        setSavingCompartmentEdit(false);
      }
    }
  }

  function handleConfirmDeleteCompartment(compartment: Compartment) {
    if (!compartment.id || isBusy()) return;

    Alert.alert(
      "Delete Compartment?",
      `This will permanently delete "${compartment.name}" and all inventory items stored inside it. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDeleteCompartment(compartment),
        },
      ]
    );
  }

  async function handleDeleteCompartment(compartment: Compartment) {
    if (!compartment.id || isBusy()) return;

    const compartmentId = String(compartment.id);

    if (isMountedRef.current) {
      setDeletingCompartmentId(compartmentId);
    }

    await runWithLock(async () => {
      try {
        await deleteCompartment(compartmentId);

        if (!isMountedRef.current) {
          return;
        }

        setCompartments((currentCompartments) =>
          currentCompartments.filter(
            (currentCompartment) => currentCompartment.id !== compartmentId
          )
        );

        if (selectedCompartmentId === compartmentId) {
          setSelectedCompartmentId(null);
          setCompartmentItems([]);
        }
      } catch (error) {
        console.error("Failed to delete compartment:", error);

        if (!isMountedRef.current) {
          return;
        }

        Alert.alert(
          "Delete Failed",
          "Unable to delete this compartment. Please try again."
        );
      } finally {
        if (isMountedRef.current) {
          setDeletingCompartmentId(null);
        }
      }
    });
  }

  function startEditingItem(item: Item) {
    if (isBusy()) return;

    setSelectedItemId(item.id);
    setEditingItemId(item.id);
    setEditingItemName(String(item.name ?? ""));
  }

  function cancelEditingItem() {
    setEditingItemId(null);
    setEditingItemName("");
    setSavingItemEdit(false);
  }

  async function saveEditingItem(item: Item) {
    const nextName = editingItemName.trim();

    if (!item.id || !nextName || savingItemEdit) return;

    try {
      setSavingItemEdit(true);
      await updateItem(item.id, { name: nextName });

      if (!isMountedRef.current) return;

      setCompartmentItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? { ...currentItem, name: nextName }
            : currentItem
        )
      );

      cancelEditingItem();
    } catch (error) {
      console.error("Failed to edit item:", error);

      if (!isMountedRef.current) return;

      Alert.alert("Edit Failed", "Unable to update this item. Please try again.");
    } finally {
      if (isMountedRef.current) {
        setSavingItemEdit(false);
      }
    }
  }

  async function handleChangeQuantity(item: Item, delta: number) {
    if (updatingQuantityId === item.id || isBusy()) return;

    const currentQuantity = getSafeQuantity(item.quantity);
    const nextQuantity = currentQuantity + delta;

    await runWithLock(async () => {
      try {
        setUpdatingQuantityId(item.id);

        if (nextQuantity <= 0) {
          await deleteItem(item.id);
          setCompartmentItems((currentItems) =>
            currentItems.filter((currentItem) => currentItem.id !== item.id)
          );

          if (selectedItemId === item.id) {
            setSelectedItemId(null);
          }

          return;
        }

        await updateItem(item.id, { quantity: nextQuantity });

        if (!isMountedRef.current) return;

        setCompartmentItems((currentItems) =>
          currentItems.map((currentItem) =>
            currentItem.id === item.id
              ? { ...currentItem, quantity: nextQuantity }
              : currentItem
          )
        );
      } catch (error) {
        console.error("Failed to update item quantity:", error);

        if (!isMountedRef.current) return;

        Alert.alert("Update Failed", "Unable to update item quantity.");
      } finally {
        if (isMountedRef.current) {
          setUpdatingQuantityId(null);
        }
      }
    });
  }

  async function handleTogglePacked(item: Item) {
    if (updatingStatusId === item.id || isBusy()) return;

    const nextStatus = isPackedItem(item) ? "missing" : "packed";

    await runWithLock(async () => {
      try {
        setUpdatingStatusId(item.id);
        await updateItem(item.id, { status: nextStatus });

        if (!isMountedRef.current) return;

        setCompartmentItems((currentItems) =>
          currentItems.map((currentItem) =>
            currentItem.id === item.id
              ? { ...currentItem, status: nextStatus }
              : currentItem
          )
        );
      } catch (error) {
        console.error("Failed to update item status:", error);

        if (!isMountedRef.current) return;

        Alert.alert("Update Failed", "Unable to update packed status.");
      } finally {
        if (isMountedRef.current) {
          setUpdatingStatusId(null);
        }
      }
    });
  }

  function confirmDeleteItem(item: Item) {
    if (isBusy()) return;

    Alert.alert(
      "Delete item?",
      `Delete "${item.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await runWithLock(async () => {
              try {
                await deleteItem(item.id);

                if (!isMountedRef.current) return;

                setCompartmentItems((currentItems) =>
                  currentItems.filter((currentItem) => currentItem.id !== item.id)
                );

                if (selectedItemId === item.id) {
                  setSelectedItemId(null);
                }
              } catch (error) {
                console.error("Failed to delete item:", error);

                if (!isMountedRef.current) return;

                Alert.alert("Delete Failed", "Unable to delete this item.");
              }
            });
          },
        },
      ]
    );
  }

  async function handleMoveItem(item: Item) {
    if (isBusy()) return;

    setSelectedItemId(item.id);

    await runWithLock(async () => {
      try {
        const [spaces, allCompartments] = await Promise.all([
          getStorageSpaces(),
          getAllCompartments(),
        ]);

        if (!isMountedRef.current) return;

        const destinationOptions = spaces
          .map((space) => {
            const spaceCompartments = allCompartments.filter(
              (candidate) => candidate.vehicleId === space.id
            );

            return {
              space,
              compartments: spaceCompartments,
            };
          })
          .filter((option) => option.compartments.length > 0);

        if (destinationOptions.length === 0) {
          Alert.alert(
            "No compartments available",
            "Create another compartment before moving this item."
          );
          return;
        }

        Alert.alert(
          "Move item",
          `Choose where to move "${item.name}".`,
          [
            ...destinationOptions.map((option) => ({
              text: option.space.name,
              onPress: () => {
                Alert.alert(
                  option.space.name,
                  "Choose a destination compartment.",
                  [
                    ...option.compartments.map((destination) => ({
                      text: destination.name,
                      onPress: async () => {
                        if (
                          destination.id === item.compartmentId &&
                          option.space.id === item.vehicleId
                        ) {
                          Alert.alert(
                            "Already there",
                            `"${item.name}" is already in that compartment.`
                          );
                          return;
                        }

                        await runWithLock(async () => {
                          try {
                            await updateItem(item.id, {
                              compartmentId: destination.id,
                              compartmentName: destination.name,
                              vehicleId: option.space.id,
                              vehicleName: option.space.name,
                            });

                            if (!isMountedRef.current) return;

                            await loadStorageSpaces();

                            Alert.alert(
                              "Item moved",
                              `"${item.name}" was moved to ${destination.name}.`
                            );
                          } catch (error) {
                            console.error("Failed to move item:", error);

                            if (!isMountedRef.current) return;

                            Alert.alert("Error", "Failed to move item.");
                          }
                        });
                      },
                    })),
                    { text: "Cancel", style: "cancel" },
                  ]
                );
              },
            })),
            { text: "Cancel", style: "cancel" },
          ]
        );
      } catch (error) {
        console.error("Failed to prepare move item:", error);

        if (!isMountedRef.current) return;

        Alert.alert("Error", "Failed to load move options.");
      }
    });
  }

  function handleItemPhotoAction(item: Item) {
    if (isBusy() || updatingPhotoId === item.id) return;

    void runWithLock(() => {
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
    });
  }

  async function handleTakeItemPhoto(item: Item) {
    if (isBusy() || updatingPhotoId === item.id) return;

    await runWithLock(async () => {
      try {
        const permission = await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            "Camera access needed",
            "Please allow camera access first."
          );
          return;
        }

        setUpdatingPhotoId(item.id);

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
        });

        if (result.canceled) return;

        const asset = result.assets?.[0];

        if (!asset?.uri) {
          Alert.alert(
            "Photo not captured",
            "No valid image was returned."
          );
          return;
        }

        await updateItemPhoto(item.id, asset.uri);
        await loadStorageSpaces();
      } catch (error) {
        console.error("Failed to take item photo:", error);
        Alert.alert("Error", "Failed to save item photo.");
      } finally {
        if (isMountedRef.current) {
          setUpdatingPhotoId(null);
        }
      }
    });
  }

  async function handlePickItemPhoto(item: Item) {
    if (isBusy() || updatingPhotoId === item.id) return;

    await runWithLock(async () => {
      try {
        setUpdatingPhotoId(item.id);

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
        });

        if (result.canceled) return;

        const asset = result.assets?.[0];

        if (!asset?.uri) {
          Alert.alert(
            "Photo not selected",
            "No valid image was returned."
          );
          return;
        }

        await updateItemPhoto(item.id, asset.uri);
        await loadStorageSpaces();
      } catch (error) {
        console.error("Failed to choose item photo:", error);
        Alert.alert("Error", "Failed to save item photo.");
      } finally {
        if (isMountedRef.current) {
          setUpdatingPhotoId(null);
        }
      }
    });
  }

  async function handleRemoveItemPhoto(item: Item) {
    if (isBusy() || updatingPhotoId === item.id) return;

    await runWithLock(async () => {
      try {
        setUpdatingPhotoId(item.id);

        await updateItemPhoto(item.id, "");
        await loadStorageSpaces();
      } catch (error) {
        console.error("Failed to remove item photo:", error);
        Alert.alert("Error", "Failed to remove item photo.");
      } finally {
        if (isMountedRef.current) {
          setUpdatingPhotoId(null);
        }
      }
    });
  }

  function handleEditStorage(space: StorageSpace) {
    if (!space.id || isBusy()) return;

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    router.push({
      pathname: "/(tabs)/storage/edit",
      params: { id: String(space.id) },
    });
  }

  function handleConfirmDeleteStorage(space: StorageSpace) {
    if (!space.id || isBusy()) return;

    Alert.alert(
      "Delete Storage Space?",
      `This will permanently delete "${space.name}", its compartments, and all inventory items stored inside it. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDeleteStorage(space),
        },
      ]
    );
  }


  function handleConfirmArchiveStorage(space: StorageSpace) {
    if (!space.id || isBusy()) return;

    Alert.alert(
      "Archive Storage Space?",
      `Archive "${space.name}"? It will be removed from active storage and can be restored later from Archive.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          onPress: () => handleArchiveStorage(space),
        },
      ]
    );
  }

  async function handleArchiveStorage(space: StorageSpace) {
    if (!space.id || isBusy()) return;

    const storageId = String(space.id);

    if (isMountedRef.current) {
      setArchivingStorageId(storageId);
    }

    await runWithLock(async () => {
      try {
        await archiveStorageSpace(storageId);

        if (!isMountedRef.current) return;

        await loadStorageSpaces();
      } catch (error) {
        console.error("Failed to archive storage space:", error);

        if (!isMountedRef.current) return;

        Alert.alert(
          "Archive Failed",
          "Unable to archive this storage space. Please try again."
        );
      } finally {
        if (isMountedRef.current) {
          setArchivingStorageId(null);
        }
      }
    });
  }

  async function handleDeleteStorage(space: StorageSpace) {
    if (!space.id || isBusy()) return;

    const storageId = String(space.id);

    if (isMountedRef.current) {
      setDeletingStorageId(storageId);
    }

    await runWithLock(async () => {
      try {
        await deleteStorageSpace(storageId);

        if (!isMountedRef.current) {
          return;
        }

        await loadStorageSpaces();
      } catch (error) {
        console.error("Failed to delete storage space:", error);

        if (!isMountedRef.current) {
          return;
        }

        Alert.alert(
          "Delete Failed",
          "Unable to delete this storage space. Please try again."
        );
      } finally {
        if (isMountedRef.current) {
          setDeletingStorageId(null);
        }
      }
    });
  }

  function renderRightActions(space: StorageSpace) {
    const isDeleting = deletingStorageId === space.id;
    const isArchiving = archivingStorageId === space.id;
    const disabled = isDeleting || isArchiving || isBusy();

    return (
      <View style={styles.rightActions}>
        <HapticPressable
          style={[styles.archiveAction, disabled && styles.disabledInteraction]}
          onPress={() => handleConfirmArchiveStorage(space)}
          disabled={disabled}
        >
          <Archive size={20} color={colors.text} />
          <Text style={styles.deleteActionText}>
            {isArchiving ? "Archiving" : "Archive"}
          </Text>
        </HapticPressable>

        <HapticPressable
          style={[styles.deleteAction, disabled && styles.disabledInteraction]}
          onPress={() => handleConfirmDeleteStorage(space)}
          disabled={disabled}
        >
          <Trash2 size={20} color={colors.text} />
          <Text style={styles.deleteActionText}>
            {isDeleting ? "Deleting" : "Delete"}
          </Text>
        </HapticPressable>
      </View>
    );
  }

  function renderStorageCard(space: StorageSpace) {
    const isDeleting = deletingStorageId === space.id;
    const isSelected = isTabletLandscape && selectedStorageId === space.id;
    const interactionDisabled = isDeleting || isBusy();

    return (
      <Swipeable
        overshootRight={false}
        renderRightActions={() => renderRightActions(space)}
        enabled={!interactionDisabled}
      >
        <BlurView
          intensity={theme.isLight ? 0 : 18}
          tint={theme.isLight ? "light" : "dark"}
          style={[
            styles.storageCard,
            {
              backgroundColor: theme.isLight
                ? "#FFFFFF"
                : "rgba(15,23,42,0.20)",
              borderColor: isSelected
                ? "rgba(59,130,246,0.95)"
                : theme.isLight
                  ? "rgba(15,23,42,0.10)"
                  : "rgba(255,255,255,0.12)",
            },
          ]}
        >
          <HapticPressable
            style={[
              styles.storageCardMainPressable,
              interactionDisabled && styles.disabledInteraction,
            ]}
            onPress={() => handleSelectStorage(space)}
            disabled={interactionDisabled}
          >
            <View style={styles.storageCardLeft}>
              <Text
                style={[
                  styles.storageTitle,
                  {
                    color: theme.isLight ? "#000000" : colors.text,
                  },
                ]}
              >
                {space.name}
              </Text>

              <Text
                style={[
                  styles.storageMeta,
                  {
                    color: theme.isLight ? "#000000" : colors.textSecondary,
                  },
                ]}
              >
                {space.category === "vehicle" ? "Vehicle" : "Storage"}
                {space.subtype ? ` • ${space.subtype}` : ""}
              </Text>
            </View>

            <View style={styles.storageCardRight}>
              <HapticPressable
                style={[
                  styles.iconButton,
                  interactionDisabled && styles.disabledInteraction,
                ]}
                onPress={() => handleEditStorage(space)}
                hitSlop={8}
                disabled={interactionDisabled}
              >
                <Pencil
                  size={16}
                  color={theme.isLight ? "#000000" : colors.textSecondary}
                />
              </HapticPressable>

              <HapticPressable
                style={[
                  styles.iconButton,
                  interactionDisabled && styles.disabledInteraction,
                ]}
                onPress={() => handleConfirmDeleteStorage(space)}
                hitSlop={8}
                disabled={interactionDisabled}
              >
                <Trash2
                  size={16}
                  color={theme.isLight ? "#DC2626" : "#F87171"}
                />
              </HapticPressable>

              <View style={styles.chevronWrap}>
                <MoveRight
                  size={18}
                  color={theme.isLight ? "#000000" : colors.textSecondary}
                />
              </View>
            </View>
          </HapticPressable>
        </BlurView>
      </Swipeable >
    );
  }

  return (
    <ScreenBackground>
      <Modal
        visible={Boolean(editingCompartment)}
        transparent
        animationType="fade"
        onRequestClose={cancelEditingCompartment}
      >
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={theme.isLight ? 24 : 38}
            tint={theme.isLight ? "light" : "dark"}
            style={[
              styles.editModalCard,
              {
                backgroundColor: theme.isLight
                  ? "rgba(255,255,255,0.96)"
                  : "rgba(15,23,42,0.92)",
                borderColor: theme.isLight
                  ? "rgba(15,23,42,0.12)"
                  : "rgba(255,255,255,0.14)",
              },
            ]}
          >
            <Text
              style={[
                styles.editModalTitle,
                { color: theme.isLight ? "#111827" : colors.text },
              ]}
            >
              Edit Compartment
            </Text>

            <Text
              style={[
                styles.editModalLabel,
                { color: theme.isLight ? "#374151" : colors.textSecondary },
              ]}
            >
              Compartment name
            </Text>

            <TextInput
              value={editingCompartmentName}
              onChangeText={setEditingCompartmentName}
              placeholder="Compartment name"
              placeholderTextColor={
                theme.isLight ? "rgba(17,24,39,0.45)" : "rgba(255,255,255,0.45)"
              }
              autoFocus
              style={[
                styles.editModalInput,
                {
                  color: theme.isLight ? "#111827" : colors.text,
                  borderColor: theme.isLight
                    ? "rgba(15,23,42,0.14)"
                    : "rgba(255,255,255,0.16)",
                  backgroundColor: theme.isLight
                    ? "rgba(255,255,255,0.92)"
                    : "rgba(255,255,255,0.08)",
                },
              ]}
            />

            <View style={styles.editModalActions}>
              <HapticPressable
                onPress={cancelEditingCompartment}
                disabled={savingCompartmentEdit}
                style={[
                  styles.editModalSecondaryButton,
                  savingCompartmentEdit && styles.disabledInteraction,
                ]}
              >
                <Text style={styles.editModalSecondaryText}>Cancel</Text>
              </HapticPressable>

              <HapticPressable
                onPress={saveEditingCompartment}
                disabled={
                  savingCompartmentEdit || editingCompartmentName.trim().length === 0
                }
                style={[
                  styles.editModalPrimaryButton,
                  (savingCompartmentEdit ||
                    editingCompartmentName.trim().length === 0) &&
                    styles.disabledInteraction,
                ]}
              >
                <Text style={styles.editModalPrimaryText}>
                  {savingCompartmentEdit ? "Saving..." : "Save"}
                </Text>
              </HapticPressable>
            </View>
          </BlurView>
        </View>
      </Modal>

      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <HapticPressable
              onPress={handleBack}
              style={[styles.backButton, isBusy() && styles.disabledInteraction]}
              disabled={isBusy()}
            >
              <ChevronLeft size={24} color="#111827" />
            </HapticPressable>

            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Manage Storage Spaces</Text>
            </View>

            <HapticPressable
              onPress={handleCreateStorage}
              style={[styles.addButton, isBusy() && styles.disabledInteraction]}
              disabled={isBusy()}
            >
              <BlurView intensity={20} tint="dark" style={styles.addButtonInner}>
                <Plus size={18} color="#111827" />
              </BlurView>
            </HapticPressable>
          </View>

          <Text style={styles.headerSubtitle}>
            Tap a storage space to view compartments. Use the pencil to edit, or swipe left to delete.
          </Text>

          {isTabletLandscape ? (
            <View style={styles.splitLayout}>
              <View style={styles.splitColumn}>
                <FlatList
                  data={sortedStorageSpaces}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => renderStorageCard(item)}
                  ListEmptyComponent={
                    <BlurView intensity={18} tint="dark" style={styles.emptyCard}>
                      <Text style={styles.emptyTitle}>
                        Start by adding a storage space
                      </Text>
                      <Text style={styles.emptyText}>
                        Add a storage space to begin organizing your gear.
                      </Text>
                    </BlurView>
                  }
                />
              </View>

              <View style={styles.splitColumn}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <Text style={styles.panelTitle}>Compartments</Text>

                  <HapticPressable
                    onPress={handleCreateCompartment}
                    disabled={!selectedStorageId || isBusy()}
                    style={[
                      styles.addButton,
                      (!selectedStorageId || isBusy()) &&
                      styles.disabledInteraction,
                    ]}
                  >
                    <BlurView
                      intensity={20}
                      tint="dark"
                      style={styles.addButtonInner}
                    >
                      <Plus size={18} color="#111827" />
                    </BlurView>
                  </HapticPressable>
                </View>

                {compartments.length === 0 ? (
                  <BlurView intensity={18} tint="dark" style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No compartments yet</Text>
                    <Text style={styles.emptyText}>
                      Tap + to create your first compartment.
                    </Text>
                  </BlurView>
                ) : (
                  <View>
                    <HapticPressable
                      onPress={() =>
                        setShowCompartmentDropdown((currentValue) => !currentValue)
                      }
                      style={{ width: "100%" }}
                    >
                      <BlurView
                        intensity={theme.isLight ? 0 : 18}
                        tint={theme.isLight ? "light" : "dark"}
                        style={[
                          styles.compartmentCard,
                          {
                            backgroundColor: theme.isLight
                              ? "#FFFFFF"
                              : "rgba(15,23,42,0.20)",
                            borderColor: "#3B82F6",
                          },
                        ]}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text
                              style={[
                                styles.storageTitle,
                                {
                                  color: theme.isLight ? "#000000" : colors.text,
                                },
                              ]}
                            >
                              {selectedCompartmentId
                                ? `Currently viewing: ${
                                    compartments.find(
                                      (compartment) =>
                                        compartment.id === selectedCompartmentId
                                    )?.name ?? "Selected compartment"
                                  }`
                                : "Select compartment"}
                            </Text>

                            <Text style={styles.storageMeta}>
                              Tap to choose a compartment
                            </Text>
                          </View>

                          <ChevronDown
                            size={20}
                            color={theme.isLight ? "#000000" : colors.text}
                          />
                        </View>
                      </BlurView>
                    </HapticPressable>

                    {showCompartmentDropdown ? (
                      <FlatList
                        data={compartments}
                        keyExtractor={(item) => item.id}
                        showsVerticalScrollIndicator={true}
                        style={{ maxHeight: 220 }}
                        renderItem={({ item }) => (
                          <HapticPressable
                            onPress={() => handleSelectCompartment(item.id)}
                            style={{ width: "100%" }}
                          >
                            <BlurView
                              intensity={theme.isLight ? 0 : 18}
                              tint={theme.isLight ? "light" : "dark"}
                              style={[
                                styles.compartmentCard,
                                {
                                  backgroundColor:
                                    selectedCompartmentId === item.id
                                      ? theme.isLight
                                        ? "#E5F0FF"
                                        : "rgba(59,130,246,0.15)"
                                      : theme.isLight
                                        ? "#FFFFFF"
                                        : "rgba(15,23,42,0.20)",
                                  borderColor:
                                    selectedCompartmentId === item.id
                                      ? "#3B82F6"
                                      : theme.isLight
                                        ? "rgba(15,23,42,0.10)"
                                        : "rgba(255,255,255,0.12)",
                                },
                              ]}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 10,
                                }}
                              >
                                <Text
                                  style={[
                                    styles.storageTitle,
                                    {
                                      flex: 1,
                                      color:
                                        selectedCompartmentId === item.id
                                          ? "#3B82F6"
                                          : theme.isLight
                                            ? "#000000"
                                            : colors.text,
                                    },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {item.name}
                                </Text>

                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 8,
                                  }}
                                >
                                  <HapticPressable
                                    onPress={(event) => {
                                      event.stopPropagation();
                                      handleEditCompartment(item);
                                    }}
                                    disabled={isBusy()}
                                    style={styles.iconActionButton}
                                  >
                                    <Pencil
                                      size={17}
                                      color={theme.isLight ? "#111827" : colors.text}
                                    />
                                  </HapticPressable>

                                  <HapticPressable
                                    onPress={(event) => {
                                      event.stopPropagation();
                                      handleConfirmDeleteCompartment(item);
                                    }}
                                    disabled={
                                      deletingCompartmentId === item.id || isBusy()
                                    }
                                    style={[
                                      styles.iconActionButton,
                                      (deletingCompartmentId === item.id ||
                                        isBusy()) &&
                                        styles.disabledInteraction,
                                    ]}
                                  >
                                    <Trash2
                                      size={17}
                                      color={theme.isLight ? "#DC2626" : "#FCA5A5"}
                                    />
                                  </HapticPressable>
                                </View>
                              </View>
                            </BlurView>
                          </HapticPressable>
                        )}
                      />
                    ) : null}
                  </View>
                )}

                {selectedCompartmentId ? (
                  <View style={{ marginTop: 16 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <Text style={styles.panelTitle}>Items</Text>

                      <HapticPressable
                        onPress={handleCreateItem}
                        disabled={!selectedCompartmentId || isBusy()}
                        style={[
                          styles.addButton,
                          (!selectedCompartmentId || isBusy()) &&
                          styles.disabledInteraction,
                        ]}
                      >
                        <BlurView
                          intensity={20}
                          tint="dark"
                          style={styles.addButtonInner}
                        >
                          <Plus size={18} color="#111827" />
                        </BlurView>
                      </HapticPressable>
                    </View>

                    {compartmentItems.length === 0 ? (
                      <Text style={styles.storageMeta}>
                        No items in this compartment
                      </Text>
                    ) : (
                      <FlatList
                        data={compartmentItems}
                        keyExtractor={(item) => item.id}
                        scrollEnabled
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                        style={{ maxHeight: "100%" }}
                        contentContainerStyle={{ paddingBottom: 24 }}
                        renderItem={({ item }) => {
                          const isSelectedItem = selectedItemId === item.id;

                          return (
                            <HapticPressable
                              onPress={() => setSelectedItemId(item.id)}
                              style={{ width: "100%" }}
                              disabled={isBusy()}
                            >
                              <BlurView
                                intensity={theme.isLight ? 0 : 18}
                                tint={theme.isLight ? "light" : "dark"}
                                style={[
                                  styles.compartmentCard,
                                  {
                                    backgroundColor: isSelectedItem
                                      ? theme.isLight
                                        ? "#E5F0FF"
                                        : "rgba(59,130,246,0.15)"
                                      : theme.isLight
                                        ? "#FFFFFF"
                                        : "rgba(15,23,42,0.20)",
                                    borderColor: isPackedItem(item)
                                      ? theme.colors.success
                                      : isSelectedItem
                                        ? "#3B82F6"
                                        : theme.isLight
                                          ? "rgba(15,23,42,0.10)"
                                          : "rgba(255,255,255,0.12)",
                                  },
                                ]}
                              >
                                {editingItemId === item.id ? (
                                  <View>
                                    <TextInput
                                      value={editingItemName}
                                      onChangeText={setEditingItemName}
                                      placeholder="Item name"
                                      placeholderTextColor={
                                        theme.isLight
                                          ? "rgba(0,0,0,0.45)"
                                          : colors.textSecondary
                                      }
                                      style={{
                                        borderWidth: 1,
                                        borderRadius: 12,
                                        paddingHorizontal: 12,
                                        paddingVertical: 10,
                                        color: theme.isLight
                                          ? "#000000"
                                          : colors.text,
                                        borderColor: theme.isLight
                                          ? "rgba(15,23,42,0.12)"
                                          : "rgba(255,255,255,0.12)",
                                        backgroundColor: theme.isLight
                                          ? "#FFFFFF"
                                          : "rgba(255,255,255,0.04)",
                                      }}
                                    />

                                    <View
                                      style={{
                                        flexDirection: "row",
                                        gap: 8,
                                        marginTop: 10,
                                      }}
                                    >
                                      <HapticPressable
                                        onPress={() => saveEditingItem(item)}
                                        disabled={savingItemEdit}
                                        style={{
                                          backgroundColor: "#2563EB",
                                          borderRadius: 10,
                                          paddingHorizontal: 14,
                                          paddingVertical: 10,
                                        }}
                                      >
                                        <Text style={{ color: "#FFFFFF" }}>
                                          Save
                                        </Text>
                                      </HapticPressable>

                                      <HapticPressable
                                        onPress={cancelEditingItem}
                                        style={{
                                          borderRadius: 10,
                                          paddingHorizontal: 14,
                                          paddingVertical: 10,
                                          borderWidth: 1,
                                          borderColor: theme.isLight
                                            ? "rgba(15,23,42,0.12)"
                                            : "rgba(255,255,255,0.12)",
                                        }}
                                      >
                                        <Text
                                          style={{
                                            color: theme.isLight
                                              ? "#000000"
                                              : colors.text,
                                          }}
                                        >
                                          Cancel
                                        </Text>
                                      </HapticPressable>
                                    </View>
                                  </View>
                                ) : (
                                  <View>
                                    <View
                                      style={{
                                        flexDirection: "row",
                                        justifyContent: "space-between",
                                        alignItems: "stretch",
                                        gap: 16,
                                      }}
                                    >
                                      <View>
                                        <HapticPressable
                                          onPress={() => handleItemPhotoAction(item)}
                                        >
                                          {item.itemPhotoUri ? (
                                            <Image
                                              source={{ uri: item.itemPhotoUri }}
                                              style={styles.itemPhotoPlaceholder}
                                              resizeMode="cover"
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
                                              <Camera
                                                size={18}
                                                color={theme.colors.textSecondary}
                                              />
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
                                      </View>

                                      <View style={{
                                        flex: 1,
                                        justifyContent: "space-between",
                                      }}>
                                        <View
                                          style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 8,
                                            marginBottom: 2,
                                          }}
                                        >
                                          <Text style={styles.storageTitle}>
                                            {item.name}
                                          </Text>

                                        </View>

                                        {isPackedItem(item) ? (
                                          <View style={[styles.packedPill, { marginBottom: 6 }]}>
                                            <Text style={styles.packedPillText}>Packed</Text>
                                          </View>
                                        ) : null}

                                        <Text
                                          style={[
                                            styles.storageMeta,
                                            { marginBottom: 4 },
                                          ]}
                                        >
                                          Needed: {getSafeQuantity(item.quantity)}
                                        </Text>

                                        <Text
                                          style={[
                                            styles.storageMeta,
                                            { marginBottom: 4 },
                                          ]}
                                        >
                                          Packed:{" "}
                                          {isPackedItem(item)
                                            ? getSafeQuantity(item.quantity)
                                            : 0}
                                        </Text>

                                        <Text
                                          style={[
                                            styles.storageMeta,
                                            {
                                              color: isPackedItem(item)
                                                ? colors.textSecondary
                                                : "#DC2626",
                                              marginBottom: 4,
                                            },
                                          ]}
                                        >
                                          Still To Pack:{" "}
                                          {isPackedItem(item)
                                            ? 0
                                            : getSafeQuantity(item.quantity)}
                                        </Text>

                                        <Text
                                          style={[
                                            styles.storageMeta,
                                            {
                                              color: theme.colors.text,
                                              marginBottom: 4,
                                            },
                                          ]}
                                        >
                                          Storage:{" "}
                                          {item.compartmentName ?? "Unknown"}
                                        </Text>

                                        <View
                                          style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 8,
                                            marginTop: 14,
                                          }}
                                        >
                                          <HapticPressable
                                            onPress={() =>
                                              handleChangeQuantity(item, -1)
                                            }
                                            style={styles.iconButton}
                                          >
                                            <Minus
                                              size={16}
                                              color={
                                                theme.isLight
                                                  ? "#000000"
                                                  : colors.text
                                              }
                                            />
                                          </HapticPressable>

                                          <View
                                            style={{
                                              minWidth: 34,
                                              height: 34,
                                              alignItems: "center",
                                              justifyContent: "center",
                                            }}
                                          >
                                            <Text
                                              style={{
                                                color: theme.isLight
                                                  ? "#000000"
                                                  : colors.text,
                                                fontWeight: "700",
                                              }}
                                            >
                                              {getSafeQuantity(item.quantity)}
                                            </Text>
                                          </View>

                                          <HapticPressable
                                            onPress={() =>
                                              handleChangeQuantity(item, 1)
                                            }
                                            style={styles.iconButton}
                                          >
                                            <Plus
                                              size={16}
                                              color={
                                                theme.isLight
                                                  ? "#000000"
                                                  : colors.text
                                              }
                                            />
                                          </HapticPressable>
                                        </View>
                                      </View>

                                      <View
                                        style={{
                                          flex: 1,
                                          justifyContent: "space-between",
                                          alignItems: "flex-end",
                                          minWidth: 180,
                                        }}
                                      >
                                        <View style={styles.itemActions}>
                                          <HapticPressable
                                            onPress={() => handleMoveItem(item)}
                                            style={styles.iconButton}
                                          >
                                            <MoveRight
                                              size={16}
                                              color={
                                                theme.isLight
                                                  ? "#000000"
                                                  : colors.text
                                              }
                                            />
                                          </HapticPressable>

                                          <HapticPressable
                                            onPress={() =>
                                              startEditingItem(item)
                                            }
                                            style={styles.iconButton}
                                          >
                                            <Pencil
                                              size={16}
                                              color={
                                                theme.isLight
                                                  ? "#000000"
                                                  : colors.text
                                              }
                                            />
                                          </HapticPressable>

                                          <HapticPressable
                                            onPress={() =>
                                              confirmDeleteItem(item)
                                            }
                                            style={styles.iconButton}
                                          >
                                            <Trash2
                                              size={16}
                                              color="#DC2626"
                                            />
                                          </HapticPressable>
                                        </View>

                                        <HapticPressable
                                          onPress={() => handleTogglePacked(item)}
                                          style={[
                                            styles.packToggleButton,
                                            isPackedItem(item)
                                              ? styles.packToggleOn
                                              : styles.packToggleOff,
                                            !isPackedItem(item) && {
                                              backgroundColor: theme.isLight
                                                ? "rgba(15,23,42,0.05)"
                                                : "rgba(255,255,255,0.08)",
                                              borderColor: theme.isLight
                                                ? "rgba(15,23,42,0.12)"
                                                : "rgba(255,255,255,0.12)",
                                            },
                                          ]}
                                        >
                                          <CheckCircle2
                                            size={16}
                                            color={
                                              isPackedItem(item)
                                                ? "#FFFFFF"
                                                : theme.isLight
                                                  ? "#000000"
                                                  : colors.text
                                            }
                                          />
                                          <Text
                                            style={[
                                              styles.packToggleText,
                                              {
                                                color: theme.isLight
                                                  ? "#000000"
                                                  : colors.text,
                                              },
                                              isPackedItem(item) &&
                                              styles.packToggleTextOn,
                                            ]}
                                          >
                                            {isPackedItem(item)
                                              ? "Packed"
                                              : "Mark Packed"}
                                          </Text>
                                        </HapticPressable>
                                      </View>
                                    </View>
                                  </View>
                                )}
                              </BlurView>
                            </HapticPressable>
                          );
                        }}
                      />
                    )}
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <FlatList
              data={sortedStorageSpaces}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => renderStorageCard(item)}
              ListEmptyComponent={
                <BlurView intensity={18} tint="dark" style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No storage spaces found</Text>
                  <Text style={styles.emptyText}>
                    Tap the plus button to add your first storage space.
                  </Text>
                </BlurView>
              }
            />
          )}
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },

  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 10,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  headerTextWrap: {
    flex: 1,
    alignItems: "flex-start",
    paddingHorizontal: 8,
  },

  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "left",
  },

  addButton: {
    borderRadius: 13,
    overflow: "hidden",
  },

  addButtonInner: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "#FFFFFF",
  },

  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 14,
  },

  splitLayout: {
    flex: 1,
    flexDirection: "row",
    gap: 16,
  },

  splitColumn: {
    flex: 1,
    minWidth: 0,
  },

  panelTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },

  compartmentCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },

  listContent: {
    paddingBottom: 140,
  },

  storageCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.10)",
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },

  storageCardMainPressable: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  storageCardLeft: {
    flex: 1,
  },

  storageTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },

  storageMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },

  storageCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  chevronWrap: {
    width: 24,
    alignItems: "flex-end",
  },

  rightActions: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginLeft: 8,
  },

  archiveAction: {
    width: 92,
    minHeight: 58,
    marginBottom: 8,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
  },

  deleteAction: {
    width: 92,
    minHeight: 58,
    marginBottom: 8,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
  },

  deleteActionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },

  emptyCard: {
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },

  itemPhotoPlaceholder: {
    width: 82,
    height: 82,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    paddingHorizontal: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
  },

  itemPhotoPlaceholderText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },

  itemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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

  packedPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(22,163,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(22,163,74,0.25)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  packedPillText: {
    color: "#16A34A",
    fontSize: 12,
    fontWeight: "700",
  },

  iconActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  editModalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    overflow: "hidden",
  },

  editModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 14,
  },

  editModalLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },

  editModalInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "600",
  },

  editModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
  },

  editModalSecondaryButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  editModalSecondaryText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "800",
  },

  editModalPrimaryButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  editModalPrimaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  disabledInteraction: {
    opacity: 0.6,
  },
});