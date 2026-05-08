import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  Minus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
  addChecklistTemplateItem,
  deleteChecklistTemplateItem,
  getChecklistTemplate,
  getChecklistTemplateItems,
  updateChecklistTemplateItemName,
  updateChecklistTemplateItemPacked,
  updateChecklistTemplateItemPhoto,
  updateChecklistTemplateItemQuantity,
} from "../../../lib/checklistsService";
import { useInteractionLock } from "../../../lib/useInteractionLock";
import { colors } from "../../../theme/tokens";
import type {
  ChecklistCategory,
  ChecklistTemplate,
  ChecklistTemplateItem,
} from "../../../types/checklists";

const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  trip: "Trip",
  camping: "Camping",
  hunting: "Hunting",
  fishing: "Fishing",
  boating: "Boating",
  clothing: "Clothing",
  electronics: "Electronics",
  medical: "Medical",
  tools: "Tools",
  food: "Food",
  custom: "Other",
};

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
          backgroundColor: theme.colors.card,
        },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

function getTemplateCategoryLabel(template: ChecklistTemplate | null) {
  if (!template) {
    return "Template";
  }

  if (template.category === "custom") {
    return template.customCategoryLabel?.trim() || "Other";
  }

  return CATEGORY_LABELS[template.category] ?? "Template";
}

export default function TemplateItemsScreen() {
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const { user, initializing } = useAuth();
  const theme = useThemedValues();

  const isScreenMountedRef = useRef(true);
  const templateLoadVersionRef = useRef(0);

  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [items, setItems] = useState<ChecklistTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [newItemName, setNewItemName] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [savingItemName, setSavingItemName] = useState(false);

  const [updatingQuantityId, setUpdatingQuantityId] = useState<string | null>(
    null
  );
  const [updatingPhotoId, setUpdatingPhotoId] = useState<string | null>(null);
  const [updatingPackedId, setUpdatingPackedId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const safeTemplateId = typeof templateId === "string" ? templateId : "";

  const templateCategoryLabel = getTemplateCategoryLabel(template);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aPacked = Boolean(a.packed);
      const bPacked = Boolean(b.packed);

      if (aPacked !== bPacked) {
        return aPacked ? 1 : -1;
      }

      return String(a.name ?? "")
        .toLowerCase()
        .localeCompare(String(b.name ?? "").toLowerCase());
    });
  }, [items]);

  useEffect(() => {
    isScreenMountedRef.current = true;

    return () => {
      isScreenMountedRef.current = false;
      templateLoadVersionRef.current += 1;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadVersion = templateLoadVersionRef.current + 1;
      templateLoadVersionRef.current = loadVersion;

      if (initializing) {
        return;
      }

      if (!user || !safeTemplateId) {
        setTemplate(null);
        setItems([]);
        setLoading(false);
        return;
      }

      void loadTemplateData(loadVersion);

      return () => {
        templateLoadVersionRef.current += 1;
      };
    }, [initializing, user, safeTemplateId])
  );

  async function runWithLock(action: () => Promise<void> | void) {
    if (interactionLocked) return;

    lockInteraction();

    try {
      await action();
    } finally {
      unlockInteraction();
    }
  }

  async function loadTemplateData(loadVersion?: number) {
    if (!user || !safeTemplateId) return;

    const activeLoadVersion = loadVersion ?? templateLoadVersionRef.current;

    try {
      setLoading(true);

      const [templateData, itemData] = await Promise.all([
        getChecklistTemplate(user.uid, safeTemplateId),
        getChecklistTemplateItems(user.uid, safeTemplateId),
      ]);

      if (
        templateLoadVersionRef.current !== activeLoadVersion ||
        !isScreenMountedRef.current
      ) {
        return;
      }

      setTemplate(templateData);
      setItems(itemData);
    } catch (err) {
      if (
        templateLoadVersionRef.current !== activeLoadVersion ||
        !isScreenMountedRef.current
      ) {
        return;
      }

      console.error("Failed to load template items:", err);
      setTemplate(null);
      setItems([]);
      Alert.alert("Error", "Failed to load template items.");
    } finally {
      if (
        templateLoadVersionRef.current === activeLoadVersion &&
        isScreenMountedRef.current
      ) {
        setLoading(false);
      }
    }
  }

  function updateLocalItem(
    itemId: string,
    updates: Partial<ChecklistTemplateItem>
  ) {
    if (!isScreenMountedRef.current) return;

    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === itemId ? { ...currentItem, ...updates } : currentItem
      )
    );
  }

  function isItemBusy(itemId?: string) {
    return (
      addingItem ||
      savingItemName ||
      interactionLocked ||
      (!!itemId &&
        (updatingQuantityId === itemId ||
          updatingPhotoId === itemId ||
          updatingPackedId === itemId ||
          deletingItemId === itemId))
    );
  }

  function handleItemPhotoAction(item: ChecklistTemplateItem) {
    if (isItemBusy(item.id)) return;

    Alert.alert("Item Photo", item.name, [
      {
        text: "Take Photo",
        onPress: () => handleTakeItemPhoto(item),
      },
      {
        text: "Choose Photo",
        onPress: () => handlePickItemPhoto(item),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  }

  async function handleTakeItemPhoto(item: ChecklistTemplateItem) {
    if (!user || !safeTemplateId || isItemBusy(item.id)) return;

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
          Alert.alert("Photo not captured", "No valid image was returned.");
          return;
        }

        updateLocalItem(item.id, { itemPhotoUri: asset.uri });

        await updateChecklistTemplateItemPhoto(
          user.uid,
          safeTemplateId,
          item.id,
          asset.uri
        );
      } catch (err: any) {
        const message = String(err?.message ?? err ?? "");

        if (
          message.toLowerCase().includes("camera not available on simulator")
        ) {
          Alert.alert(
            "Simulator Limitation",
            "Take Photo is not available on the iPhone Simulator. Use Choose Photo here, or test Take Photo on a real iPhone."
          );
        } else {
          console.error("Failed to take template item photo:", err);
          Alert.alert("Error", "Failed to save item photo.");
        }
      } finally {
        if (isScreenMountedRef.current) {
          setUpdatingPhotoId(null);
        }
      }
    });
  }

  async function handlePickItemPhoto(item: ChecklistTemplateItem) {
    if (!user || !safeTemplateId || isItemBusy(item.id)) return;

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
          Alert.alert("Photo not selected", "No valid image was returned.");
          return;
        }

        updateLocalItem(item.id, { itemPhotoUri: asset.uri });

        await updateChecklistTemplateItemPhoto(
          user.uid,
          safeTemplateId,
          item.id,
          asset.uri
        );
      } catch (err) {
        console.error("Failed to choose template item photo:", err);
        Alert.alert("Error", "Failed to save item photo.");
      } finally {
        if (isScreenMountedRef.current) {
          setUpdatingPhotoId(null);
        }
      }
    });
  }

  async function handleAddItem() {
    if (addingItem || interactionLocked) return;

    if (!user || !safeTemplateId) {
      Alert.alert("Sign in required", "Please sign in to edit this template.");
      return;
    }

    const trimmedName = newItemName.trim();

    if (!trimmedName) {
      Alert.alert("Item name required", "Please enter an item name.");
      return;
    }

    await runWithLock(async () => {
      try {
        setAddingItem(true);

        await addChecklistTemplateItem(user.uid, safeTemplateId, trimmedName);

        if (!isScreenMountedRef.current) return;

        setNewItemName("");
        await loadTemplateData(templateLoadVersionRef.current);
      } catch (err) {
        console.error("Failed to add template item:", err);
        Alert.alert("Error", "Failed to add item.");
      } finally {
        if (isScreenMountedRef.current) {
          setAddingItem(false);
        }
      }
    });
  }

  function handleStartEditItem(item: ChecklistTemplateItem) {
    if (isItemBusy(item.id)) return;

    setEditingItemId(item.id);
    setEditingItemName(item.name ?? "");
  }

  function handleCancelEditItem() {
    if (savingItemName || interactionLocked) return;

    setEditingItemId(null);
    setEditingItemName("");
  }

  async function handleSaveItemName(item: ChecklistTemplateItem) {
    if (!user || !safeTemplateId || savingItemName || interactionLocked) return;

    const trimmedName = editingItemName.trim();

    if (!trimmedName) {
      Alert.alert("Item name required", "Please enter an item name.");
      return;
    }

    await runWithLock(async () => {
      try {
        setSavingItemName(true);

        await updateChecklistTemplateItemName(
          user.uid,
          safeTemplateId,
          item.id,
          trimmedName
        );

        updateLocalItem(item.id, { name: trimmedName });
        setEditingItemId(null);
        setEditingItemName("");
      } catch (err) {
        console.error("Failed to rename template item:", err);
        Alert.alert("Error", "Failed to rename item.");
      } finally {
        if (isScreenMountedRef.current) {
          setSavingItemName(false);
        }
      }
    });
  }

  async function handleUpdateQuantity(
    item: ChecklistTemplateItem,
    nextQuantity: number
  ) {
    if (!user || !safeTemplateId || isItemBusy(item.id)) return;

    const safeQuantity = Math.max(1, nextQuantity);
    const previousQuantity = Math.max(1, Number(item.quantity ?? 1));

    if (safeQuantity === previousQuantity) {
      return;
    }

    await runWithLock(async () => {
      try {
        setUpdatingQuantityId(item.id);
        updateLocalItem(item.id, { quantity: safeQuantity });

        await updateChecklistTemplateItemQuantity(
          user.uid,
          safeTemplateId,
          item.id,
          safeQuantity
        );
      } catch (err) {
        console.error("Failed to update template item quantity:", err);
        updateLocalItem(item.id, { quantity: previousQuantity });
        Alert.alert("Error", "Failed to update item quantity.");
      } finally {
        if (isScreenMountedRef.current) {
          setUpdatingQuantityId(null);
        }
      }
    });
  }

  async function handleTogglePacked(item: ChecklistTemplateItem) {
    if (!user || !safeTemplateId || isItemBusy(item.id)) return;

    const previousPacked = Boolean(item.packed);
    const nextPacked = !previousPacked;

    await runWithLock(async () => {
      try {
        setUpdatingPackedId(item.id);
        updateLocalItem(item.id, { packed: nextPacked });

        await updateChecklistTemplateItemPacked(
          user.uid,
          safeTemplateId,
          item.id,
          nextPacked
        );
      } catch (err) {
        console.error("Failed to update template item packed status:", err);
        updateLocalItem(item.id, { packed: previousPacked });
        Alert.alert("Error", "Failed to update packed status.");
      } finally {
        if (isScreenMountedRef.current) {
          setUpdatingPackedId(null);
        }
      }
    });
  }

  function handleDeleteItem(item: ChecklistTemplateItem) {
    if (!user || !safeTemplateId || isItemBusy(item.id)) return;

    Alert.alert("Delete item?", `Delete "${item.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (isItemBusy(item.id)) return;

          await runWithLock(async () => {
            try {
              setDeletingItemId(item.id);

              await deleteChecklistTemplateItem(user.uid, safeTemplateId, item.id);

              if (!isScreenMountedRef.current) return;

              setItems((currentItems) =>
                currentItems.filter((currentItem) => currentItem.id !== item.id)
              );
            } catch (err) {
              console.error("Failed to delete template item:", err);
              Alert.alert("Error", "Failed to delete item.");
            } finally {
              if (isScreenMountedRef.current) {
                setDeletingItemId(null);
              }
            }
          });
        },
      },
    ]);
  }

  function renderItem(item: ChecklistTemplateItem) {
    const isEditing = editingItemId === item.id;
    const neededQty = Math.max(1, Number(item.quantity ?? 1));
    const packed = Boolean(item.packed);
    const packedQty = packed ? neededQty : 0;
    const stillToPackQty = packed ? 0 : neededQty;
    const isBusy = isItemBusy(item.id);

    return (
      <FrostedCard
        key={item.id}
        style={[
          packed ? styles.packedItemCard : styles.unpackedItemCard,
          {
            borderColor: packed
              ? "rgba(34,197,94,0.24)"
              : theme.colors.border,
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
              editable={!savingItemName && !interactionLocked}
              onSubmitEditing={() => handleSaveItemName(item)}
            />

            <View style={styles.editActions}>
              <HapticPressable
                style={[
                  styles.saveEditButton,
                  (!editingItemName.trim() || savingItemName) &&
                    styles.createButtonDisabled,
                ]}
                onPress={() => handleSaveItemName(item)}
                disabled={!editingItemName.trim() || savingItemName}
              >
                <Text style={styles.saveEditText}>
                  {savingItemName ? "Saving..." : "Save"}
                </Text>
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
                onPress={handleCancelEditItem}
                disabled={interactionLocked}
              >
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
              style={[styles.itemPhotoWrap, isBusy && styles.disabledInteraction]}
              onPress={() => handleItemPhotoAction(item)}
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
                      isBusy && styles.disabledInteraction,
                    ]}
                    onPress={() => handleItemPhotoAction(item)}
                    disabled={isBusy}
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
                      isBusy && styles.disabledInteraction,
                    ]}
                    onPress={() => handleStartEditItem(item)}
                    disabled={isBusy}
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
                      isBusy && styles.disabledInteraction,
                    ]}
                    onPress={() => handleDeleteItem(item)}
                    disabled={isBusy}
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
                  {templateCategoryLabel}
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
                    onPress={() => handleUpdateQuantity(item, neededQty - 1)}
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
                    onPress={() => handleUpdateQuantity(item, neededQty + 1)}
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
              <FrostedCard style={styles.emptyCard}>
                <Text style={[styles.meta, { color: theme.colors.text }]}>
                  Loading...
                </Text>
              </FrostedCard>
            ) : !user ? (
              <FrostedCard style={styles.emptyCard}>
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
              <FrostedCard style={styles.emptyCard}>
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
                    Add, rename, delete, adjust quantities, or set Packed / To
                    Pack defaults for this template.
                  </Text>
                </FrostedCard>

                <FrostedCard style={styles.createCard}>
                  <Text
                    style={[styles.createTitle, { color: theme.colors.text }]}
                  >
                    Add Item
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
                      editable={!addingItem && !interactionLocked}
                      returnKeyType="done"
                      onSubmitEditing={handleAddItem}
                    />

                    <HapticPressable
                      style={[
                        styles.createButton,
                        (!newItemName.trim() || addingItem || interactionLocked) &&
                          styles.createButtonDisabled,
                      ]}
                      onPress={handleAddItem}
                      disabled={
                        !newItemName.trim() || addingItem || interactionLocked
                      }
                    >
                      <Plus size={18} color="#fff" />
                    </HapticPressable>
                  </View>
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
                  <FrostedCard style={styles.emptyCard}>
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

  heroCard: {
    marginBottom: 16,
    padding: 16,
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

  createCard: {
    marginBottom: 16,
    padding: 16,
  },

  createTitle: {
    fontSize: 16,
    fontWeight: "700",
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
    backgroundColor: "rgba(55,130,245,0.95)",
  },

  createButtonDisabled: {
    opacity: 0.5,
  },

  disabledInteraction: {
    opacity: 0.6,
  },

  listTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  meta: {
    fontSize: 14,
    fontWeight: "600",
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(55,130,245,0.95)",
    paddingVertical: 12,
    borderRadius: 12,
  },

  saveEditText: {
    color: "#fff",
    fontWeight: "700",
  },

  cancelEditButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },

  cancelEditText: {
    fontWeight: "600",
  },
});