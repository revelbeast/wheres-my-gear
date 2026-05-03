import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import {
  Camera,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  Minus,
  Pencil,
  Plus,
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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../../../../components/ui/AppHeader";
import ScreenBackground from "../../../../components/ui/ScreenBackground";
import { useThemedValues } from "../../../../components/ui/Themed";
import {
  Compartment,
  Item,
  createItem,
  deleteItem,
  getCompartmentById,
  getItemsByCompartment,
  updateItem,
  updateItemPhoto,
} from "../../../../lib/gearService";
import { colors } from "../../../../theme/tokens";

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
        styles.frostedCard,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.isLight
            ? "rgba(255,255,255,0.68)"
            : "rgba(255,255,255,0.02)",
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

export default function CompartmentDetailScreen() {
  const params = useLocalSearchParams<{
    compartmentId: string | string[];
    vehicleId: string | string[];
  }>();

  const theme = useThemedValues();
  const scrollRef = useRef<ScrollView | null>(null);
  const itemCardYPositions = useRef<Record<string, number>>({});

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
  const [updatingQuantityId, setUpdatingQuantityId] = useState<string | null>(
    null
  );
  const [updatingPhotoId, setUpdatingPhotoId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [selectedPhotoItem, setSelectedPhotoItem] = useState<Item | null>(null);

  const selectedPhotoUri = selectedPhotoItem?.itemPhotoUri ?? "";

  useEffect(() => {
    if (!compartmentId) return;
    loadCompartment();
    loadItems();
  }, [compartmentId]);

  function scrollToCreateBox(delay = 140) {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }, delay);
  }

  function scrollToItemCard(itemId: string, delay = 180) {
    setTimeout(() => {
      const y = itemCardYPositions.current[itemId] ?? 0;

      scrollRef.current?.scrollTo({
        y: Math.max(y - 18, 0),
        animated: true,
      });
    }, delay);
  }

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
    if (!compartmentId || !vehicleId || saving) return;

    const trimmedName = itemName.trim();
    const parsedQty = Math.max(1, Number(quantity) || 1);

    if (!trimmedName) return;

    try {
      setSaving(true);

      await createItem({
        name: trimmedName,
        quantity: parsedQty,
        status: "packed",
        compartmentId: String(compartmentId),
        compartmentName: compartment?.name ?? "",
        vehicleId: String(vehicleId),
        notes: "",
        itemPhotoUri: "",
      });

      setItemName("");
      setQuantity("1");
      setShowCreateBox(false);
      await loadItems();
    } catch (err) {
      console.error("Failed to create item:", err);
      Alert.alert("Error", "Failed to create item.");
    } finally {
      setSaving(false);
    }
  }

  function startEditingItem(item: Item) {
    setEditingItemId(item.id);
    setEditingItemName(item.name);
    scrollToItemCard(item.id, 220);
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
      Alert.alert("Error", "Failed to update item.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleChangeQuantity(item: Item, delta: number) {
    const currentQuantity = getSafeQuantity(item.quantity);
    const nextQuantity = currentQuantity + delta;

    try {
      setUpdatingQuantityId(item.id);

      if (nextQuantity <= 0) {
        await deleteItem(item.id);
      } else {
        await updateItem(item.id, {
          quantity: nextQuantity,
        });
      }

      await loadItems();
    } catch (err) {
      console.error("Failed to update item quantity:", err);
      Alert.alert("Error", "Failed to update quantity.");
    } finally {
      setUpdatingQuantityId(null);
    }
  }

  async function handleTogglePacked(item: Item) {
    const nextStatus = isPackedItem(item) ? "missing" : "packed";

    try {
      setUpdatingStatusId(item.id);
      await updateItem(item.id, { status: nextStatus });
      await loadItems();
    } catch (err) {
      console.error("Failed to update item status:", err);
      Alert.alert("Error", "Failed to update packed status.");
    } finally {
      setUpdatingStatusId(null);
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
              Alert.alert("Error", "Failed to delete item.");
            }
          },
        },
      ]
    );
  }

  function handleOpenPhotoViewer(item: Item) {
    if (!item.itemPhotoUri) {
      handleItemPhotoAction(item);
      return;
    }

    setSelectedPhotoItem(item);
    setPhotoViewerVisible(true);
  }

  function handleClosePhotoViewer() {
    setPhotoViewerVisible(false);
    setSelectedPhotoItem(null);
  }

  function handleItemPhotoAction(item: Item) {
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

  async function handleTakeItemPhoto(item: Item) {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Camera access needed", "Please allow camera access first.");
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
        Alert.alert("Photo not captured", "No valid image was returned.");
        return;
      }

      await updateItemPhoto(item.id, asset.uri);
      setSelectedPhotoItem({ ...item, itemPhotoUri: asset.uri });
      await loadItems();
    } catch (err: any) {
      const message = String(err?.message ?? err ?? "");
      if (message.toLowerCase().includes("camera not available on simulator")) {
        Alert.alert(
          "Simulator Limitation",
          "Take Photo is not available on the iPhone Simulator. Use Choose Photo here, or test Take Photo on a real iPhone."
        );
      } else {
        console.error("Failed to take item photo:", err);
        Alert.alert("Error", "Failed to save item photo.");
      }
    } finally {
      setUpdatingPhotoId(null);
    }
  }

  async function handlePickItemPhoto(item: Item) {
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
        Alert.alert("Photo not selected", "No valid image was returned.");
        return;
      }

      await updateItemPhoto(item.id, asset.uri);
      setSelectedPhotoItem({ ...item, itemPhotoUri: asset.uri });
      await loadItems();
    } catch (err) {
      console.error("Failed to choose item photo:", err);
      Alert.alert("Error", "Failed to save item photo.");
    } finally {
      setUpdatingPhotoId(null);
    }
  }

  async function handleRemoveItemPhoto(item: Item) {
    try {
      setUpdatingPhotoId(item.id);
      await updateItemPhoto(item.id, "");
      handleClosePhotoViewer();
      await loadItems();
    } catch (err) {
      console.error("Failed to remove item photo:", err);
      Alert.alert("Error", "Failed to remove item photo.");
    } finally {
      setUpdatingPhotoId(null);
    }
  }

  function confirmRemovePhoto(item: Item) {
    Alert.alert("Delete photo?", `Remove the photo for "${item.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete Photo",
        style: "destructive",
        onPress: () => handleRemoveItemPhoto(item),
      },
    ]);
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
          borderColor: theme.colors.border,
          backgroundColor: theme.isLight
            ? "rgba(255,255,255,0.42)"
            : "rgba(255,255,255,0.04)",
        },
      ]}
    >
      <Pressable
        style={styles.headerActionButton}
        onPress={() => {
          setShowCreateBox((prev) => !prev);
          scrollToCreateBox(120);
        }}
      >
        {showCreateBox ? (
          <X size={18} color={theme.colors.text} />
        ) : (
          <Plus size={18} color={theme.colors.text} />
        )}
      </Pressable>
    </BlurView>
  );

  function renderItemCard(item: Item) {
    const isEditing = editingItemId === item.id;
    const neededQty = getSafeQuantity(item.quantity);
    const packed = isPackedItem(item);
    const packedQty = packed ? neededQty : 0;
    const stillToPackQty = packed ? 0 : neededQty;
    const isBusy =
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
              borderColor: packed
                ? theme.isLight
                  ? "rgba(34,197,94,0.24)"
                  : "rgba(120,255,190,0.10)"
                : theme.isLight
                  ? "rgba(255,255,255,0.34)"
                  : "rgba(255,255,255,0.12)",
              backgroundColor: packed
                ? theme.isLight
                  ? "rgba(255,255,255,0.50)"
                  : "rgba(255,255,255,0.02)"
                : theme.isLight
                  ? "rgba(255,255,255,0.62)"
                  : "rgba(255,255,255,0.04)",
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
                  style={[
                    styles.cancelEditButton,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.isLight
                        ? "rgba(15,23,42,0.06)"
                        : "rgba(255,255,255,0.06)",
                    },
                  ]}
                  onPress={cancelEditingItem}
                >
                  <X size={16} color={theme.colors.text} />
                  <Text
                    style={[styles.cancelEditText, { color: theme.colors.text }]}
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
                onPress={() => handleOpenPhotoViewer(item)}
                disabled={updatingPhotoId === item.id}
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
                        backgroundColor: theme.isLight
                          ? "rgba(15,23,42,0.08)"
                          : "rgba(255,255,255,0.06)",
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
                    <Pressable
                      style={[
                        styles.iconButton,
                        {
                          backgroundColor: theme.isLight
                            ? "rgba(15,23,42,0.08)"
                            : "rgba(255,255,255,0.06)",
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
                          backgroundColor: theme.isLight
                            ? "rgba(15,23,42,0.08)"
                            : "rgba(255,255,255,0.06)",
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
                          backgroundColor: theme.isLight
                            ? "rgba(15,23,42,0.08)"
                            : "rgba(255,255,255,0.06)",
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
                    <Pressable
                      style={[
                        styles.quantityButton,
                        {
                          backgroundColor: theme.isLight
                            ? "rgba(15,23,42,0.08)"
                            : "rgba(255,255,255,0.06)",
                          borderColor: theme.colors.border,
                        },
                      ]}
                      onPress={() => handleChangeQuantity(item, -1)}
                      disabled={isBusy}
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
                          backgroundColor: theme.isLight
                            ? "rgba(15,23,42,0.08)"
                            : "rgba(255,255,255,0.06)",
                          borderColor: theme.colors.border,
                        },
                      ]}
                      onPress={() => handleChangeQuantity(item, 1)}
                      disabled={isBusy}
                    >
                      <Plus size={16} color={theme.colors.text} />
                    </Pressable>
                  </View>

                  <Pressable
                    style={[
                      styles.packToggleButton,
                      packed ? styles.packToggleOn : styles.packToggleOff,
                      !packed && {
                        backgroundColor: theme.isLight
                          ? "rgba(15,23,42,0.08)"
                          : "rgba(255,255,255,0.06)",
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
                  </Pressable>
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

                  <Pressable
                    style={[
                      styles.createButton,
                      (!itemName.trim() || saving) &&
                        styles.createButtonDisabled,
                    ]}
                    onPress={handleCreateItem}
                    disabled={!itemName.trim() || saving}
                  >
                    <Plus size={18} color="#fff" />
                  </Pressable>
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
            <Pressable
              style={styles.photoViewerCloseButton}
              onPress={handleClosePhotoViewer}
            >
              <X size={24} color="#fff" />
            </Pressable>

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
                <Pressable
                  style={styles.photoViewerActionButton}
                  onPress={() => handleTakeItemPhoto(selectedPhotoItem)}
                  disabled={updatingPhotoId === selectedPhotoItem.id}
                >
                  <Camera size={18} color="#fff" />
                  <Text style={styles.photoViewerActionText}>Retake</Text>
                </Pressable>

                <Pressable
                  style={styles.photoViewerActionButton}
                  onPress={() => handlePickItemPhoto(selectedPhotoItem)}
                  disabled={updatingPhotoId === selectedPhotoItem.id}
                >
                  <ImageIcon size={18} color="#fff" />
                  <Text style={styles.photoViewerActionText}>Choose New</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.photoViewerActionButton,
                    styles.photoViewerDeleteButton,
                  ]}
                  onPress={() => confirmRemovePhoto(selectedPhotoItem)}
                  disabled={updatingPhotoId === selectedPhotoItem.id}
                >
                  <Trash2 size={18} color="#fff" />
                  <Text style={styles.photoViewerActionText}>Delete</Text>
                </Pressable>
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