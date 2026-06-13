import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { getAuth } from "firebase/auth";
import { uploadInventoryItemPhotoToCloud } from "../../../../../lib/cloudPhotoStorage";
import { savePhotoToLocalDocumentStorage } from "../../../../../lib/localPhotoStorage";
import { useLocalSearchParams } from "expo-router";
import {
  Camera,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  MoveRight,
  Minus,
  Pencil,
  Plus,
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

import AppHeader from "../../../../../components/ui/AppHeader";
import HapticPressable from "../../../../../components/ui/HapticPressable";
import ScreenBackground from "../../../../../components/ui/ScreenBackground";
import { useThemedValues } from "../../../../../components/ui/Themed";
import {
  Compartment,
  Item,
  createItem,
  deleteItem,
  getAllCompartments,
  getStorageSpaces,
  getRoomsByStorageSpace,
  getCompartmentById,
  getItemsByCompartment,
  moveCompartment,
  updateItem,
  updateItemPhoto,
} from "../../../../../lib/gearService";
import { useInteractionLock } from "../../../../../lib/useInteractionLock";
import { colors } from "../../../../../theme/tokens";

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
      intensity={theme.isLight ? 18 : 35}
      tint={theme.isLight ? "light" : "dark"}
      style={[
        styles.frostedCard,
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

function isPackedItem(item: Item) {
  return item.status === "packed";
}

function formatItemForShare(item: Item) {
  const quantity = getSafeQuantity(item.quantity);
  const status = isPackedItem(item) ? "Packed" : "To Pack";
  return `- ${item.name} (Qty: ${quantity}, ${status})`;
}

export default function CompartmentDetailScreen() {
  const params = useLocalSearchParams<{
    compartmentId?: string | string[];
    vehicleId?: string | string[];
  }>();

  const compartmentId = useMemo(() => {
    const value = params.compartmentId;

    if (Array.isArray(value)) {
      return value[0] ?? "";
    }

    return value ?? "";
  }, [params.compartmentId]);

  const vehicleId = useMemo(() => {
    const value = params.vehicleId;

    if (Array.isArray(value)) {
      return value[0] ?? "";
    }

    return value ?? "";
  }, [params.vehicleId]);

  const theme = useThemedValues();
  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock();

  const isMountedRef = useRef(true);
  const loadVersionRef = useRef(0);
  const actionLockRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const itemCardYPositions = useRef<Record<string, number>>({});
  const createBoxScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const itemCardScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [compartment, setCompartment] = useState<Compartment | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [showCreateBox, setShowCreateBox] = useState(false);
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [updatingQuantityId, setUpdatingQuantityId] = useState<string | null>(
    null
  );
  const [updatingPhotoId, setUpdatingPhotoId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [movingCompartment, setMovingCompartment] = useState(false);

  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [selectedPhotoItem, setSelectedPhotoItem] = useState<Item | null>(null);

  const selectedPhotoUri = selectedPhotoItem?.itemPhotoUri ?? "";

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      loadVersionRef.current += 1;
      actionLockRef.current = false;

      if (createBoxScrollTimeoutRef.current) {
        clearTimeout(createBoxScrollTimeoutRef.current);
        createBoxScrollTimeoutRef.current = null;
      }

      if (itemCardScrollTimeoutRef.current) {
        clearTimeout(itemCardScrollTimeoutRef.current);
        itemCardScrollTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const loadVersion = loadVersionRef.current + 1;
    loadVersionRef.current = loadVersion;

    if (!compartmentId) {
      setCompartment(null);
      setItems([]);
      return;
    }

    void loadCompartment(loadVersion);
    void loadItems(loadVersion);

    return () => {
      loadVersionRef.current += 1;
    };
  }, [compartmentId]);

  async function runWithLock(action: () => Promise<void> | void) {
    if (actionLockRef.current || interactionLocked || !isMountedRef.current) {
      return;
    }

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

  function scrollToCreateBox(delay = 140) {
    if (createBoxScrollTimeoutRef.current) {
      clearTimeout(createBoxScrollTimeoutRef.current);
      createBoxScrollTimeoutRef.current = null;
    }

    createBoxScrollTimeoutRef.current = setTimeout(() => {
      createBoxScrollTimeoutRef.current = null;

      if (!isMountedRef.current) return;

      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }, delay);
  }

  function scrollToItemCard(itemId: string, delay = 180) {
    if (itemCardScrollTimeoutRef.current) {
      clearTimeout(itemCardScrollTimeoutRef.current);
      itemCardScrollTimeoutRef.current = null;
    }

    itemCardScrollTimeoutRef.current = setTimeout(() => {
      itemCardScrollTimeoutRef.current = null;

      if (!isMountedRef.current) return;

      const y = itemCardYPositions.current[itemId] ?? 0;

      scrollRef.current?.scrollTo({
        y: Math.max(y - 18, 0),
        animated: true,
      });
    }, delay);
  }

  async function loadCompartment(loadVersion = loadVersionRef.current) {
    try {
      const data = await getCompartmentById(String(compartmentId));

      if (!isMountedRef.current || loadVersionRef.current !== loadVersion) {
        return;
      }

      setCompartment(data);
    } catch (err) {
      if (!isMountedRef.current || loadVersionRef.current !== loadVersion) {
        return;
      }

      console.error("Failed to load compartment:", err);
      setCompartment(null);
    }
  }

  async function loadItems(loadVersion = loadVersionRef.current) {
    try {
      const data = await getItemsByCompartment(String(compartmentId));

      if (!isMountedRef.current || loadVersionRef.current !== loadVersion) {
        return;
      }

      setItems(data);
    } catch (err) {
      if (!isMountedRef.current || loadVersionRef.current !== loadVersion) {
        return;
      }

      console.error("Failed to load compartment items:", err);
      setItems([]);
    }
  }

  async function refreshItems() {
    if (!isMountedRef.current) return;

    const loadVersion = loadVersionRef.current + 1;
    loadVersionRef.current = loadVersion;

    await loadItems(loadVersion);
  }

  function handleToggleCreateBox() {
    if (interactionLocked) return;

    void runWithLock(() => {
      if (!isMountedRef.current) return;

      setShowCreateBox((prev) => !prev);
      scrollToCreateBox(120);
    });
  }

  async function handleShareCompartment() {
    if (interactionLocked) return;

    await runWithLock(async () => {
      const compartmentName = compartment?.name?.trim() || "Compartment";
      const packedItems = sortedItems.filter((item) => isPackedItem(item));
      const toPackItems = sortedItems.filter((item) => !isPackedItem(item));

      const totalNeeded = sortedItems.reduce(
        (sum, item) => sum + getSafeQuantity(item.quantity),
        0
      );

      const totalPacked = packedItems.reduce(
        (sum, item) => sum + getSafeQuantity(item.quantity),
        0
      );

      const totalToPack = toPackItems.reduce(
        (sum, item) => sum + getSafeQuantity(item.quantity),
        0
      );

      const toPackText =
        toPackItems.length > 0
          ? toPackItems.map(formatItemForShare).join("\nn")
          : "- Nothing left to pack";

      const packedText =
        packedItems.length > 0
          ? packedItems.map(formatItemForShare).join("\n")
          : "- No packed items yet";

      const message = [
        `Where's My Gear Compartment`,
        ``,
        `Compartment: ${compartmentName}`,
        `Items: ${sortedItems.length}`,
        `Needed: ${totalNeeded}`,
        `Packed: ${totalPacked}`,
        `To Pack: ${totalToPack}`,
        ``,
        `To Pack`,
        toPackText,
        ``,
        `Packed`,
        packedText,
      ].join("\n");

      try {
        await Share.share({
          title: compartmentName,
          message,
        });
      } catch (err) {
        if (!isMountedRef.current) return;

        console.error("Failed to share compartment:", err);
        Alert.alert(
          "Compartment not shared",
          "Something went wrong while sharing this compartment."
        );
      }
    });
  }

  async function handleCreateItem() {
    if (!compartmentId || !vehicleId || saving || interactionLocked) return;

    const trimmedName = itemName.trim();
    const parsedQty = Math.max(1, Number(quantity) || 1);

    if (!trimmedName) return;

    await runWithLock(async () => {
      try {
        if (!isMountedRef.current) return;

        setSaving(true);

        await createItem({
          name: trimmedName,
          quantity: parsedQty,
          status: "missing",
          compartmentId: String(compartmentId),
          compartmentName: compartment?.name ?? "",
          vehicleId: String(vehicleId),
          notes: "",
          itemPhotoUri: "",
        });

        if (!isMountedRef.current) return;

        setItemName("");
        setQuantity("1");
        setShowCreateBox(false);

        await refreshItems();
      } catch (err) {
        if (!isMountedRef.current) return;

        console.error("Failed to create item:", err);
        Alert.alert("Error", "Failed to create item.");
      } finally {
        if (isMountedRef.current) {
          setSaving(false);
        }
      }
    });
  }

  function startEditingItem(item: Item) {
    if (interactionLocked) return;

    void runWithLock(() => {
      if (!isMountedRef.current) return;

      setEditingItemId(item.id);
      setEditingItemName(item.name);
      scrollToItemCard(item.id, 220);
    });
  }

  function cancelEditingItem() {
    if (interactionLocked) return;

    void runWithLock(() => {
      if (!isMountedRef.current) return;

      setEditingItemId(null);
      setEditingItemName("");
    });
  }

  async function saveEditingItem(item: Item) {
    const trimmed = editingItemName.trim();
    if (!trimmed || savingEdit || interactionLocked) return;

    await runWithLock(async () => {
      try {
        if (!isMountedRef.current) return;

        setSavingEdit(true);
        await updateItem(item.id, { name: trimmed });

        if (!isMountedRef.current) return;

        setEditingItemId(null);
        setEditingItemName("");

        await refreshItems();
      } catch (err) {
        if (!isMountedRef.current) return;

        console.error("Failed to update item:", err);
        Alert.alert("Error", "Failed to update item.");
      } finally {
        if (isMountedRef.current) {
          setSavingEdit(false);
        }
      }
    });
  }

  async function handleChangeQuantity(item: Item, delta: number) {
    if (interactionLocked || updatingQuantityId === item.id) return;

    await runWithLock(async () => {
      const currentQuantity = getSafeQuantity(item.quantity);
      const nextQuantity = currentQuantity + delta;

      try {
        if (!isMountedRef.current) return;

        setUpdatingQuantityId(item.id);

        if (nextQuantity <= 0) {
          await deleteItem(item.id);
        } else {
          await updateItem(item.id, {
            quantity: nextQuantity,
          });
        }

        await refreshItems();
      } catch (err) {
        if (!isMountedRef.current) return;

        console.error("Failed to update item quantity:", err);
        Alert.alert("Error", "Failed to update quantity.");
      } finally {
        if (isMountedRef.current) {
          setUpdatingQuantityId(null);
        }
      }
    });
  }

  async function handleTogglePacked(item: Item) {
    if (interactionLocked || updatingStatusId === item.id) return;

    await runWithLock(async () => {
      const nextStatus = isPackedItem(item) ? "missing" : "packed";

      try {
        if (!isMountedRef.current) return;

        setUpdatingStatusId(item.id);
        await updateItem(item.id, { status: nextStatus });

        await refreshItems();
      } catch (err) {
        if (!isMountedRef.current) return;

        console.error("Failed to update item status:", err);
        Alert.alert("Error", "Failed to update packed status.");
      } finally {
        if (isMountedRef.current) {
          setUpdatingStatusId(null);
        }
      }
    });
  }

  async function handleMoveItem(item: Item) {
    if (interactionLocked || movingItemId === item.id) return;

    await runWithLock(async () => {
      try {
        if (!isMountedRef.current) return;

        setMovingItemId(item.id);

        const [storageSpaces, allCompartments] = await Promise.all([
          getStorageSpaces(),
          getAllCompartments(),
        ]);

        if (!isMountedRef.current) return;

        const destinationOptions = storageSpaces
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
                            if (!isMountedRef.current) return;

                            setMovingItemId(item.id);

                            await updateItem(item.id, {
                              compartmentId: destination.id,
                              compartmentName: destination.name,
                              vehicleId: option.space.id,
                              vehicleName: option.space.name,
                            });

                            if (!isMountedRef.current) return;

                            await refreshItems();

                            Alert.alert(
                              "Item moved",
                              `"${item.name}" was moved to ${destination.name}.`
                            );
                          } catch (err) {
                            if (!isMountedRef.current) return;

                            console.error("Failed to move item:", err);
                            Alert.alert("Error", "Failed to move item.");
                          } finally {
                            if (isMountedRef.current) {
                              setMovingItemId(null);
                            }
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
      } catch (err) {
        if (!isMountedRef.current) return;

        console.error("Failed to prepare move item:", err);
        Alert.alert("Error", "Failed to load move options.");
      } finally {
        if (isMountedRef.current) {
          setMovingItemId(null);
        }
      }
    });
  }


  async function handleMoveCompartment() {
    if (
      !compartment ||
      interactionLocked ||
      movingCompartment
    ) {
      return;
    }

    await runWithLock(async () => {
      try {
        if (!isMountedRef.current) return;

        setMovingCompartment(true);

        const storageSpaces = await getStorageSpaces();

        const destinations = storageSpaces;

        if (destinations.length === 0) {
          Alert.alert(
            "No destinations available",
            "Create a storage space first."
          );
          return;
        }

        Alert.alert(
          "Move Compartment",
          `Choose a destination for "${compartment.name}".`,
          [
            ...destinations.map((space) => ({
              text: space.name,
              onPress: async () => {
                try {
                  const rooms = await getRoomsByStorageSpace(space.id);

                  Alert.alert(
                    space.name,
                    "Choose a room or leave unassigned.",
                    [
                      {
                        text: "Unassigned",
                        onPress: async () => {
                          if (
                            space.id === compartment.vehicleId &&
                            !compartment.roomId
                          ) {
                            Alert.alert(
                              "Already there",
                              `"${compartment.name}" is already unassigned in ${space.name}.`
                            );
                            return;
                          }

                          await moveCompartment({
                            compartmentId: compartment.id,
                            compartmentName: compartment.name,
                            vehicleId: space.id,
                            vehicleName: space.name,
                            roomId: "",
                            roomName: "",
                          });

                          await loadCompartment();
                          await refreshItems();
                          Alert.alert(
                            "Compartment moved",
                            `"${compartment.name}" moved to ${space.name}.`
                          );
                        },
                      },
                      ...rooms.map((room) => ({
                        text: room.name,
                        onPress: async () => {
                          if (
                            space.id === compartment.vehicleId &&
                            room.id === compartment.roomId
                          ) {
                            Alert.alert(
                              "Already there",
                              `"${compartment.name}" is already in ${room.name}.`
                            );
                            return;
                          }

                          await moveCompartment({
                            compartmentId: compartment.id,
                            compartmentName: compartment.name,
                            vehicleId: space.id,
                            vehicleName: space.name,
                            roomId: room.id,
                            roomName: room.name,
                          });

                          await loadCompartment();
                          await refreshItems();

                          Alert.alert(
                            "Compartment moved",
                            `"${compartment.name}" moved to ${room.name}.`
                          );
                        },
                      })),
                      {
                        text: "Cancel",
                        style: "cancel",
                      },
                    ]
                  );
                } catch (error) {
                  console.error(error);
                  Alert.alert(
                    "Error",
                    "Failed to load destination rooms."
                  );
                }
              },
            })),
            {
              text: "Cancel",
              style: "cancel",
            },
          ]
        );
      } catch (error) {
        console.error(error);
        Alert.alert(
          "Error",
          "Failed to load move destinations."
        );
      } finally {
        if (isMountedRef.current) {
          setMovingCompartment(false);
        }
      }
    });
  }

  function confirmDeleteItem(item: Item) {
    if (interactionLocked) return;

    void runWithLock(() => {
      Alert.alert(
        "Delete item?",
        `Delete "${item.name}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              if (interactionLocked) return;

              await runWithLock(async () => {
                try {
                  await deleteItem(item.id);
                  await refreshItems();
                } catch (err) {
                  if (!isMountedRef.current) return;

                  console.error("Failed to delete item:", err);
                  Alert.alert("Error", "Failed to delete item.");
                }
              });
            },
          },
        ]
      );
    });
  }

  function handleOpenPhotoViewer(item: Item) {
    if (interactionLocked) return;

    if (!item.itemPhotoUri) {
      handleItemPhotoAction(item);
      return;
    }

    void runWithLock(() => {
      if (!isMountedRef.current) return;

      setSelectedPhotoItem(item);
      setPhotoViewerVisible(true);
    });
  }

  function handleClosePhotoViewer() {
    setPhotoViewerVisible(false);
    setSelectedPhotoItem(null);
  }

  function handleItemPhotoAction(item: Item) {
    if (interactionLocked || updatingPhotoId === item.id) return;

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
    if (interactionLocked || updatingPhotoId === item.id) return;

    await runWithLock(async () => {
      try {
        const permission = await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          if (!isMountedRef.current) return;

          Alert.alert(
            "Camera access needed",
            "Please allow camera access first."
          );
          return;
        }

        if (!isMountedRef.current) return;

        setUpdatingPhotoId(item.id);

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.5,
        });

        if (result.canceled) return;

        const asset = result.assets?.[0];
        if (!asset?.uri) {
          if (!isMountedRef.current) return;

          Alert.alert("Photo not captured", "No valid image was returned.");
          return;
        }

        const localPhotoUri = await savePhotoToLocalDocumentStorage(
          asset.uri,
          `item-${item.id}`
        );

        await updateItemPhoto(item.id, localPhotoUri);

        if (!isMountedRef.current) return;

        setSelectedPhotoItem({ ...item, itemPhotoUri: localPhotoUri });

        const photoBackupUserId = getAuth().currentUser?.uid ?? "";

        if (photoBackupUserId) {
          void uploadInventoryItemPhotoToCloud({
            userId: photoBackupUserId,
            itemId: item.id,
            localUri: localPhotoUri,
          })
            .then((uploadedPhoto) =>
              updateItemPhoto(item.id, localPhotoUri, {
                itemPhotoStoragePath: uploadedPhoto.storagePath,
                itemPhotoDownloadUrl: uploadedPhoto.downloadUrl,
                photoBackedUp: true,
              })
            )
            .catch((uploadErr) => {
              console.error("Item photo cloud backup failed:", uploadErr);
              void updateItemPhoto(item.id, localPhotoUri, {
                photoBackedUp: false,
              });
            });
        }

        await refreshItems();
      } catch (err: any) {
        if (!isMountedRef.current) return;

        const message = String(err?.message ?? err ?? "");
        if (
          message.toLowerCase().includes("camera not available on simulator")
        ) {
          Alert.alert(
            "Simulator Limitation",
            "Take Photo is not available on the iPhone Simulator. Use Choose Photo here, or test Take Photo on a real iPhone."
          );
        } else {
          console.error("Failed to take item photo:", err);
          Alert.alert("Error", "Failed to save item photo.");
        }
      } finally {
        if (isMountedRef.current) {
          setUpdatingPhotoId(null);
        }
      }
    });
  }

  async function handlePickItemPhoto(item: Item) {
    if (interactionLocked || updatingPhotoId === item.id) return;

    await runWithLock(async () => {
      try {
        if (!isMountedRef.current) return;

        setUpdatingPhotoId(item.id);

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.5,
        });

        if (result.canceled) return;

        const asset = result.assets?.[0];
        if (!asset?.uri) {
          if (!isMountedRef.current) return;

          Alert.alert("Photo not selected", "No valid image was returned.");
          return;
        }

        const localPhotoUri = await savePhotoToLocalDocumentStorage(
          asset.uri,
          `item-${item.id}`
        );

        await updateItemPhoto(item.id, localPhotoUri);

        if (!isMountedRef.current) return;

        setSelectedPhotoItem({ ...item, itemPhotoUri: localPhotoUri });

        const photoBackupUserId = getAuth().currentUser?.uid ?? "";

        if (photoBackupUserId) {
          void uploadInventoryItemPhotoToCloud({
            userId: photoBackupUserId,
            itemId: item.id,
            localUri: localPhotoUri,
          })
            .then((uploadedPhoto) =>
              updateItemPhoto(item.id, localPhotoUri, {
                itemPhotoStoragePath: uploadedPhoto.storagePath,
                itemPhotoDownloadUrl: uploadedPhoto.downloadUrl,
                photoBackedUp: true,
              })
            )
            .catch((uploadErr) => {
              console.error("Item photo cloud backup failed:", uploadErr);
              void updateItemPhoto(item.id, localPhotoUri, {
                photoBackedUp: false,
              });
            });
        }

        await refreshItems();
      } catch (err) {
        if (!isMountedRef.current) return;

        console.error("Failed to choose item photo:", err);
        Alert.alert("Error", "Failed to save item photo.");
      } finally {
        if (isMountedRef.current) {
          setUpdatingPhotoId(null);
        }
      }
    });
  }

  async function handleRemoveItemPhoto(item: Item) {
    if (interactionLocked || updatingPhotoId === item.id) return;

    await runWithLock(async () => {
      try {
        if (!isMountedRef.current) return;

        setUpdatingPhotoId(item.id);
        await updateItemPhoto(item.id, "");

        if (!isMountedRef.current) return;

        handleClosePhotoViewer();

        await refreshItems();
      } catch (err) {
        if (!isMountedRef.current) return;

        console.error("Failed to remove item photo:", err);
        Alert.alert("Error", "Failed to remove item photo.");
      } finally {
        if (isMountedRef.current) {
          setUpdatingPhotoId(null);
        }
      }
    });
  }

  function confirmRemovePhoto(item: Item) {
    if (interactionLocked || updatingPhotoId === item.id) return;

    void runWithLock(() => {
      Alert.alert("Delete photo?", `Remove the photo for "${item.name}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Photo",
          style: "destructive",
          onPress: () => handleRemoveItemPhoto(item),
        },
      ]);
    });
  }

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aPacked = isPackedItem(a);
      const bPacked = isPackedItem(b);

      if (aPacked !== bPacked) {
        return aPacked ? 1 : -1;
      }

      return String(a.name ?? "")
        .toLowerCase()
        .localeCompare(String(b.name ?? "").toLowerCase());
    });
  }, [items]);

  const headerRight = (
    <BlurView
      intensity={theme.isLight ? 18 : 20}
      tint={theme.isLight ? "light" : "dark"}
      style={[
        styles.headerActionWrap,
        {
          borderColor: "rgba(255,255,255,0.14)",
          backgroundColor: "#FFFFFF",
        },
      ]}
    >
      <HapticPressable
        style={styles.headerActionButton}
        onPress={handleToggleCreateBox}
        disabled={interactionLocked}
      >
        {showCreateBox ? (
          <X size={18} color="#111827" />
        ) : (
          <Plus size={18} color="#111827" />
        )}
      </HapticPressable>
    </BlurView>
  );

  function renderItemCard(item: Item) {
    const isEditing = editingItemId === item.id;
    const neededQty = getSafeQuantity(item.quantity);
    const packed = isPackedItem(item);
    const packedQty = packed ? neededQty : 0;
    const stillToPackQty = packed ? 0 : neededQty;
    const isBusy =
      interactionLocked ||
      updatingQuantityId === item.id ||
      updatingPhotoId === item.id ||
      updatingStatusId === item.id;

    return (
      <View
        key={item.id}
        onLayout={(event) => {
          itemCardYPositions.current[item.id] = event.nativeEvent.layout.y;
        }}
      >
        <FrostedCard
          style={[
            packed ? styles.packedItemCard : styles.unpackedItemCard,
            {
              borderColor: packed ? theme.colors.success : theme.colors.border,
              backgroundColor: theme.colors.card,
            },
          ]}
        >
          {isEditing ? (
            <View style={styles.editWrap}>
              <TextInput
                value={editingItemName}
                onChangeText={setEditingItemName}
                placeholder="Item name"
                placeholderTextColor={theme.colors.textMuted}
                style={[
                  styles.editInput,
                  {
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.inputSurface,
                  },
                ]}
                autoFocus
                returnKeyType="done"
                enablesReturnKeyAutomatically
                blurOnSubmit
                onFocus={() => scrollToItemCard(item.id, 180)}
                onSubmitEditing={() => saveEditingItem(item)}
              />

              <View style={styles.editActions}>
                <HapticPressable
                  style={[
                    styles.saveEditButton,
                    (!editingItemName.trim() ||
                      savingEdit ||
                      interactionLocked) &&
                      styles.createButtonDisabled,
                  ]}
                  onPress={() => saveEditingItem(item)}
                  disabled={
                    !editingItemName.trim() || savingEdit || interactionLocked
                  }
                >
                  <Check size={16} color="#fff" />
                  <Text style={styles.saveEditText}>Save</Text>
                </HapticPressable>

                <HapticPressable
                  style={[
                    styles.cancelEditButton,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.iconSurface,
                    },
                    interactionLocked && styles.createButtonDisabled,
                  ]}
                  onPress={cancelEditingItem}
                  disabled={interactionLocked}
                >
                  <X size={16} color={theme.colors.text} />
                  <Text
                    style={[styles.cancelEditText, { color: theme.colors.text }]}
                  >
                    Cancel
                  </Text>
                </HapticPressable>
              </View>
            </View>
          ) : (
            <View style={styles.itemContentRow}>
              <HapticPressable
                style={styles.itemPhotoWrap}
                onPress={() => handleOpenPhotoViewer(item)}
                disabled={isBusy}
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
                          color: packed
                            ? theme.colors.textSecondary
                            : theme.colors.text,
                        },
                      ]}
                    >
                      {item.name}
                    </Text>
                    {packed && <Text style={styles.packedBadge}>Packed</Text>}
                  </View>

                  <View style={styles.itemActions}>
                    <HapticPressable
                      style={[
                        styles.iconButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                        isBusy && styles.createButtonDisabled,
                      ]}
                      onPress={() => handleMoveItem(item)}
                      disabled={isBusy || movingItemId === item.id}
                    >
                      <MoveRight size={16} color={theme.colors.textSecondary} />
                    </HapticPressable>

                    <HapticPressable
                      style={[
                        styles.iconButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                        interactionLocked && styles.createButtonDisabled,
                      ]}
                      onPress={() => startEditingItem(item)}
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
                        interactionLocked && styles.createButtonDisabled,
                      ]}
                      onPress={() => confirmDeleteItem(item)}
                      disabled={interactionLocked}
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
                        color: packed
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
                        color: packed
                          ? theme.colors.textMuted
                          : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    Packed: {packedQty}
                  </Text>
                  <Text
                    style={[
                      styles.metricText,
                      {
                        color: packed
                          ? theme.colors.textMuted
                          : theme.colors.danger,
                      },
                    ]}
                  >
                    Still To Pack: {stillToPackQty}
                  </Text>
                  <Text
                    style={[
                      styles.metricText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Storage:{" "}
                    {compartment?.name || item.compartmentName || "Not assigned"}
                  </Text>
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
                        isBusy && styles.createButtonDisabled,
                      ]}
                      onPress={() => handleChangeQuantity(item, -1)}
                      disabled={isBusy}
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
                        isBusy && styles.createButtonDisabled,
                      ]}
                      onPress={() => handleChangeQuantity(item, 1)}
                      disabled={isBusy}
                    >
                      <Plus size={16} color={theme.colors.text} />
                    </HapticPressable>
                  </View>

                  <HapticPressable
                    style={[
                      styles.packToggleButton,
                      packed ? styles.packToggleOn : styles.packToggleOff,
                      !packed && {
                        backgroundColor: theme.colors.iconSurface,
                        borderColor: theme.colors.border,
                      },
                      isBusy && styles.createButtonDisabled,
                    ]}
                    onPress={() => handleTogglePacked(item)}
                    disabled={isBusy}
                  >
                    <CheckCircle2
                      size={16}
                      color={packed ? "#fff" : theme.colors.text}
                    />
                    <Text
                      style={[
                        styles.packToggleText,
                        { color: theme.colors.text },
                        packed && styles.packToggleTextOn,
                      ]}
                    >
                      {packed ? "Packed" : "Mark Packed"}
                    </Text>
                  </HapticPressable>
                </View>
              </View>
            </View>
          )}
        </FrostedCard>
      </View>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          >
            <AppHeader
              title={compartment?.name || "Compartment"}
              showBackButton
              rightContent={headerRight}
            />

            <HapticPressable
              style={[
                styles.shareCompartmentButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                },
                interactionLocked && styles.createButtonDisabled,
              ]}
              onPress={handleShareCompartment}
              disabled={interactionLocked}
            >
              <Share2 size={18} color={theme.colors.text} />
              <Text
                style={[
                  styles.shareCompartmentButtonText,
                  { color: theme.colors.text },
                ]}
              >
                Share Compartment
              </Text>
            </HapticPressable>

            <HapticPressable
              style={[
                styles.shareCompartmentButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                },
                (interactionLocked || movingCompartment) &&
                  styles.createButtonDisabled,
              ]}
              onPress={handleMoveCompartment}
              disabled={interactionLocked || movingCompartment}
            >
              <MoveRight size={18} color={theme.colors.text} />
              <Text
                style={[
                  styles.shareCompartmentButtonText,
                  { color: theme.colors.text },
                ]}
              >
                Move Compartment
              </Text>
            </HapticPressable>

            {showCreateBox && (
              <FrostedCard style={styles.createCard}>
                <Text style={[styles.createTitle, { color: theme.colors.text }]}>
                  Add Item
                </Text>
                <Text
                  style={[
                    styles.createSubtitle,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Name the item before adding it to this compartment.
                </Text>

                <View style={styles.createRow}>
                  <TextInput
                    value={itemName}
                    onChangeText={setItemName}
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
                    returnKeyType="done"
                    autoFocus
                    enablesReturnKeyAutomatically
                    blurOnSubmit
                    onFocus={() => scrollToCreateBox(120)}
                    onSubmitEditing={handleCreateItem}
                  />

                  <TextInput
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholder="1"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[
                      styles.quantityInput,
                      {
                        color: theme.colors.text,
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.inputSurface,
                      },
                    ]}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    onFocus={() => scrollToCreateBox(120)}
                    onSubmitEditing={handleCreateItem}
                  />

                  <HapticPressable
                    style={[
                      styles.createButton,
                      (!itemName.trim() || saving || interactionLocked) &&
                        styles.createButtonDisabled,
                    ]}
                    onPress={handleCreateItem}
                    disabled={!itemName.trim() || saving || interactionLocked}
                  >
                    <Plus size={18} color="#fff" />
                  </HapticPressable>
                </View>
              </FrostedCard>
            )}

            {sortedItems.length === 0 ? (
              <FrostedCard style={styles.emptyCard}>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  No items found
                </Text>
                <Text
                  style={[
                    styles.emptyText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  This compartment does not have any items yet.
                </Text>
              </FrostedCard>
            ) : (
              sortedItems.map(renderItemCard)
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal
          visible={photoViewerVisible}
          transparent
          animationType="fade"
          onRequestClose={handleClosePhotoViewer}
        >
          <View style={styles.photoViewerOverlay}>
            <HapticPressable
              style={styles.photoViewerCloseButton}
              onPress={handleClosePhotoViewer}
            >
              <X size={24} color="#fff" />
            </HapticPressable>

            {selectedPhotoUri ? (
              <ScrollView
                style={styles.photoViewerScroll}
                contentContainerStyle={styles.photoViewerContent}
                maximumZoomScale={4}
                minimumZoomScale={1}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                centerContent
                bouncesZoom
              >
                <Image
                  source={{ uri: selectedPhotoUri }}
                  style={styles.photoViewerImage}
                  resizeMode="contain"
                />
              </ScrollView>
            ) : null}

            {selectedPhotoItem ? (
              <BlurView
                intensity={35}
                tint="dark"
                style={styles.photoViewerActions}
              >
                <HapticPressable
                  style={[
                    styles.photoViewerActionButton,
                    updatingPhotoId === selectedPhotoItem.id &&
                      styles.createButtonDisabled,
                  ]}
                  onPress={() => handleTakeItemPhoto(selectedPhotoItem)}
                  disabled={
                    interactionLocked ||
                    updatingPhotoId === selectedPhotoItem.id
                  }
                >
                  <Camera size={18} color="#fff" />
                  <Text style={styles.photoViewerActionText}>Retake</Text>
                </HapticPressable>

                <HapticPressable
                  style={[
                    styles.photoViewerActionButton,
                    updatingPhotoId === selectedPhotoItem.id &&
                      styles.createButtonDisabled,
                  ]}
                  onPress={() => handlePickItemPhoto(selectedPhotoItem)}
                  disabled={
                    interactionLocked ||
                    updatingPhotoId === selectedPhotoItem.id
                  }
                >
                  <ImageIcon size={18} color="#fff" />
                  <Text style={styles.photoViewerActionText}>Choose New</Text>
                </HapticPressable>

                <HapticPressable
                  style={[
                    styles.photoViewerActionButton,
                    styles.photoViewerDeleteButton,
                    updatingPhotoId === selectedPhotoItem.id &&
                      styles.createButtonDisabled,
                  ]}
                  onPress={() => confirmRemovePhoto(selectedPhotoItem)}
                  disabled={
                    interactionLocked ||
                    updatingPhotoId === selectedPhotoItem.id
                  }
                >
                  <Trash2 size={18} color="#fff" />
                  <Text style={styles.photoViewerActionText}>Delete</Text>
                </HapticPressable>
              </BlurView>
            ) : null}
          </View>
        </Modal>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },

  keyboardAvoidingView: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 260,
  },

  frostedCard: {
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
  },

  headerActionWrap: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
  },

  headerActionButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  shareCompartmentButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  shareCompartmentButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },

  createCard: {
    marginBottom: 16,
    padding: 16,
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

  quantityInput: {
    width: 64,
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 10,
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
    backgroundColor: "rgba(55,130,245,0.95)",
  },

  createButtonDisabled: {
    opacity: 0.5,
  },

  emptyCard: {
    padding: 16,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },

  unpackedItemCard: {
    marginBottom: 12,
    padding: 14,
  },

  packedItemCard: {
    marginBottom: 12,
    padding: 14,
    opacity: 0.9,
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
    color: colors.success,
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

  editWrap: {
    width: "100%",
  },

  editInput: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    fontSize: 15,
  },

  editActions: {
    flexDirection: "row",
    marginTop: 12,
    justifyContent: "space-between",
    gap: 10,
  },

  saveEditButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(55,130,245,0.95)",
    paddingVertical: 12,
    borderRadius: 12,
  },

  saveEditText: {
    color: "#fff",
    fontWeight: "700",
    marginLeft: 6,
  },

  cancelEditButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },

  cancelEditText: {
    fontWeight: "600",
    marginLeft: 6,
  },

  swipeDeleteAction: {
    width: 92,
    marginBottom: 12,
    marginLeft: 8,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(210,60,60,0.95)",
  },

  swipeDeleteText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },

  photoViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
  },

  photoViewerScroll: {
    flex: 1,
    width: "100%",
  },

  photoViewerContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 120,
  },

  photoViewerImage: {
    width: "100%",
    height: 620,
  },

  photoViewerCloseButton: {
    position: "absolute",
    top: 58,
    right: 20,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  photoViewerActions: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 34,
    zIndex: 20,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 10,
    flexDirection: "row",
    gap: 8,
  },

  photoViewerActionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(55,130,245,0.85)",
    flexDirection: "row",
    gap: 6,
  },

  photoViewerDeleteButton: {
    backgroundColor: "rgba(210,60,60,0.92)",
  },

  photoViewerActionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});