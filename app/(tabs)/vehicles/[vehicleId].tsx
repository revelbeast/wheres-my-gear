import { BlurView } from "expo-blur";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams } from "expo-router";
import {
  Check,
  ChevronRight,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../../../components/ui/AppHeader";
import HapticPressable from "../../../components/ui/HapticPressable";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import { useThemedValues } from "../../../components/ui/Themed";
import {
  Compartment,
  Room,
  StorageSpace,
  createCompartment,
  deleteCompartment,
  getCompartments,
  getRoomsByStorageSpace,
  getStorageSpaceById,
  updateCompartment,
} from "../../../lib/gearService";
import { useInteractionLock } from "../../../lib/useInteractionLock";
import { colors } from "../../../theme/tokens";

function escapeCsvValue(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function buildStorageSpaceShareMessage(
  storageName: string,
  compartments: Compartment[]
) {
  const compartmentText =
    compartments.length > 0
      ? compartments
        .map((compartment, index) => `${index + 1}. ${compartment.name}`)
        .join("\n")
      : "- No compartments added yet";

  return [
    `Where's My Gear Storage Space`,
    ``,
    `Storage: ${storageName}`,
    `Compartments: ${compartments.length}`,
    ``,
    `Compartment List`,
    compartmentText,
  ].join("\n");
}

function buildStorageSpaceCsv(storageName: string, compartments: Compartment[]) {
  const rows = [
    ["Storage Space", "Compartment Number", "Compartment Name"],
    ...compartments.map((compartment, index) => [
      storageName,
      index + 1,
      compartment.name,
    ]),
  ];

  return rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");
}

function buildStorageSpaceHtml(storageName: string, compartments: Compartment[]) {
  const compartmentRows =
    compartments.length > 0
      ? compartments
        .map(
          (compartment, index) =>
            `<tr><td>${index + 1}</td><td>${compartment.name}</td></tr>`
        )
        .join("")
      : `<tr><td colspan="2">No compartments added yet</td></tr>`;

  return `
    <html>
      <body>
        <h1>Where's My Gear Storage Space</h1>
        <p><strong>Storage:</strong> ${storageName}</p>
        <p><strong>Compartments:</strong> ${compartments.length}</p>
        <h2>Compartment List</h2>
        <table border="1" cellspacing="0" cellpadding="6">
          <thead>
            <tr>
              <th>#</th>
              <th>Compartment</th>
            </tr>
          </thead>
          <tbody>
            ${compartmentRows}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

export default function VehicleDetailScreen() {
  const theme = useThemedValues();

  const params = useLocalSearchParams<{ vehicleId?: string | string[] }>();

  const vehicleId = useMemo(() => {
    const value = params.vehicleId;

    if (Array.isArray(value)) {
      return value[0] ?? "";
    }

    return value ?? "";
  }, [params.vehicleId]);

  const scrollRef = useRef<ScrollView | null>(null);
  const isScreenMountedRef = useRef(true);
  const loadVersionRef = useRef(0);
  const actionLockRef = useRef(false);
  const navigationTransitionLockedRef = useRef(false);
  const headerAddLockedRef = useRef(false);
  const navigationUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const headerAddUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const [storageSpace, setStorageSpace] = useState<StorageSpace | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [showCreateBox, setShowCreateBox] = useState(false);
  const [newCompartmentName, setNewCompartmentName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editingCompartmentId, setEditingCompartmentId] = useState<string | null>(
    null
  );
  const [editingCompartmentName, setEditingCompartmentName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingCompartmentId, setDeletingCompartmentId] = useState<
    string | null
  >(null);

  const headerTitle = storageSpace?.name
    ? `${storageSpace.name} Compartments`
    : "Compartments";

  useEffect(() => {
    isScreenMountedRef.current = true;

    return () => {
      isScreenMountedRef.current = false;
      loadVersionRef.current += 1;
      actionLockRef.current = false;
      navigationTransitionLockedRef.current = false;
      headerAddLockedRef.current = false;

      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
        navigationUnlockTimeoutRef.current = null;
      }

      if (headerAddUnlockTimeoutRef.current) {
        clearTimeout(headerAddUnlockTimeoutRef.current);
        headerAddUnlockTimeoutRef.current = null;
      }

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const loadVersion = loadVersionRef.current + 1;
    loadVersionRef.current = loadVersion;

    if (!vehicleId) {
      setStorageSpace(null);
      setRooms([]);
      setCompartments([]);
      return;
    }

    async function loadScreenData() {
      try {
        const [spaceData, roomData, compartmentData] = await Promise.all([
          getStorageSpaceById(String(vehicleId)),
          getRoomsByStorageSpace(String(vehicleId)),
          getCompartments(String(vehicleId)),
        ]);

        if (
          !isScreenMountedRef.current ||
          loadVersionRef.current !== loadVersion
        ) {
          return;
        }

        setStorageSpace(spaceData);
        setRooms(roomData);
        setCompartments(compartmentData);
      } catch (err) {
        if (
          !isScreenMountedRef.current ||
          loadVersionRef.current !== loadVersion
        ) {
          return;
        }

        console.error("Failed to load storage space details:", err);
        setStorageSpace(null);
        setRooms([]);
        setCompartments([]);
      }
    }

    void loadScreenData();

    return () => {
      loadVersionRef.current += 1;
    };
  }, [vehicleId]);

  async function runWithLock(action: () => Promise<void> | void) {
    if (
      actionLockRef.current ||
      interactionLocked ||
      !isScreenMountedRef.current
    ) {
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

  async function refreshCompartments() {
    if (!vehicleId || !isScreenMountedRef.current) return;

    const refreshVersion = loadVersionRef.current + 1;
    loadVersionRef.current = refreshVersion;

    try {
      const data = await getCompartments(String(vehicleId));

      if (
        !isScreenMountedRef.current ||
        loadVersionRef.current !== refreshVersion
      ) {
        return;
      }

      setCompartments(data);
    } catch (err) {
      if (
        !isScreenMountedRef.current ||
        loadVersionRef.current !== refreshVersion
      ) {
        return;
      }

      console.error("Failed to load compartments:", err);
      setCompartments([]);
    }
  }

  function isBusy() {
    return (
      isCreating ||
      savingEdit ||
      !!deletingCompartmentId ||
      interactionLocked ||
      actionLockRef.current ||
      navigationTransitionLockedRef.current ||
      headerAddLockedRef.current
    );
  }

  function scrollToBottom(delay = 120) {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    scrollTimeoutRef.current = setTimeout(() => {
      scrollTimeoutRef.current = null;

      if (!isScreenMountedRef.current) return;

      scrollRef.current?.scrollToEnd({ animated: true });
    }, delay);
  }

  function unlockHeaderAddAfterDelay() {
    if (headerAddUnlockTimeoutRef.current) {
      clearTimeout(headerAddUnlockTimeoutRef.current);
      headerAddUnlockTimeoutRef.current = null;
    }

    headerAddUnlockTimeoutRef.current = setTimeout(() => {
      headerAddUnlockTimeoutRef.current = null;

      if (!isScreenMountedRef.current) return;

      headerAddLockedRef.current = false;
    }, 700);
  }

  function toggleCreateBox() {
    if (isBusy()) return;

    if (headerAddLockedRef.current) {
      return;
    }

    headerAddLockedRef.current = true;

    Keyboard.dismiss();
    setEditingCompartmentId(null);
    setEditingCompartmentName("");

    setShowCreateBox((prev) => {
      const next = !prev;

      if (!next) {
        setNewCompartmentName("");
      } else {
        scrollToBottom(180);
      }

      return next;
    });

    unlockHeaderAddAfterDelay();
  }

  async function handleShareStorageSpace() {
    if (isBusy()) return;

    const storageName = storageSpace?.name?.trim() || "Storage Space";

    const message = buildStorageSpaceShareMessage(storageName, compartments);

    await runWithLock(async () => {
      try {
        await Share.share({
          title: storageName,
          message,
        });
      } catch (err) {
        if (!isScreenMountedRef.current) return;

        console.error("Failed to share storage space:", err);
        Alert.alert(
          "Storage not shared",
          "Something went wrong while sharing this storage space."
        );
      }
    });
  }

  async function handleExportStorageSpaceCsv() {
    if (isBusy()) return;

    const storageName = storageSpace?.name?.trim() || "Storage Space";
    const csv = buildStorageSpaceCsv(storageName, compartments);
    const fileName = `${storageName.replace(/[^a-z0-9]/gi, "_")}_storage_space.csv`;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

    await runWithLock(async () => {
      try {
        await FileSystem.writeAsStringAsync(fileUri, csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        await Share.share({
          title: `${storageName} Storage Space CSV`,
          message: csv,
          url: fileUri,
        });
      } catch (err) {
        if (!isScreenMountedRef.current) return;

        console.error("Failed to export storage space CSV:", err);
        Alert.alert(
          "Export failed",
          "Something went wrong while exporting this storage space."
        );
      }
    });
  }

  function handleStorageSpaceExportOptions() {
    if (isBusy()) return;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Share Storage Space",
          options: ["Share", "Export Excel/CSV", "Cancel"],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            handleShareStorageSpace();
          }

          if (buttonIndex === 1) {
            handleExportStorageSpaceCsv();
          }
        }
      );

      return;
    }

    Alert.alert("Share Storage Space", "Choose an option.", [
      {
        text: "Share",
        onPress: handleShareStorageSpace,
      },
      {
        text: "Export Excel/CSV",
        onPress: handleExportStorageSpaceCsv,
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  }

  async function handleCreateCompartment() {
    if (!vehicleId || isCreating || interactionLocked || actionLockRef.current) {
      return;
    }

    const trimmed = newCompartmentName.trim();
    if (!trimmed) return;

    await runWithLock(async () => {
      try {
        if (!isScreenMountedRef.current) return;

        setIsCreating(true);
        Keyboard.dismiss();

        const createdId = await Promise.race([
          createCompartment(trimmed, String(vehicleId)),
          new Promise<string>((resolve) =>
            setTimeout(() => resolve(`offline-timeout-compartment-${Date.now()}`), 1200)
          ),
        ]);

        if (!isScreenMountedRef.current) return;

        setNewCompartmentName("");
        setShowCreateBox(false);

        if (createdId.startsWith("offline-compartment-")) {
          setCompartments((current) => [
            {
              id: createdId,
              name: trimmed,
              vehicleId: String(vehicleId),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            ...current,
          ]);
        } else {
          await Promise.race([
            refreshCompartments(),
            new Promise<void>((resolve) => setTimeout(resolve, 1200)),
          ]);
        }
      } catch (err) {
        if (!isScreenMountedRef.current) return;

        console.error("Failed to create compartment:", err);
        Alert.alert("Error", "Failed to create compartment.");
      } finally {
        if (isScreenMountedRef.current) {
          setIsCreating(false);
        }
      }
    });
  }

  function startEditing(compartment: Compartment) {
    if (isBusy()) return;

    setShowCreateBox(false);
    setNewCompartmentName("");
    setEditingCompartmentId(compartment.id);
    setEditingCompartmentName(compartment.name);

    scrollToBottom(180);
  }

  function cancelEditing() {
    if (savingEdit || interactionLocked || actionLockRef.current) return;

    Keyboard.dismiss();
    setEditingCompartmentId(null);
    setEditingCompartmentName("");
  }

  async function saveEditing(compartmentId: string) {
    if (savingEdit || interactionLocked || actionLockRef.current) return;

    const trimmed = editingCompartmentName.trim();
    if (!trimmed) return;

    await runWithLock(async () => {
      try {
        if (!isScreenMountedRef.current) return;

        setSavingEdit(true);
        Keyboard.dismiss();

        await updateCompartment(compartmentId, { name: trimmed });

        if (!isScreenMountedRef.current) return;

        setEditingCompartmentId(null);
        setEditingCompartmentName("");
        await refreshCompartments();
      } catch (err) {
        if (!isScreenMountedRef.current) return;

        console.error("Failed to update compartment:", err);
        Alert.alert("Error", "Failed to update compartment name.");
      } finally {
        if (isScreenMountedRef.current) {
          setSavingEdit(false);
        }
      }
    });
  }

  function confirmDelete(compartment: Compartment) {
    if (isBusy()) return;

    Alert.alert(
      "Delete compartment?",
      `Delete "${compartment.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDelete(compartment),
        },
      ]
    );
  }

  async function handleDelete(compartment: Compartment) {
    if (
      deletingCompartmentId ||
      interactionLocked ||
      actionLockRef.current ||
      !isScreenMountedRef.current
    ) {
      return;
    }

    await runWithLock(async () => {
      try {
        if (!isScreenMountedRef.current) return;

        setDeletingCompartmentId(compartment.id);

        await deleteCompartment(compartment.id);
        await refreshCompartments();
      } catch (err) {
        if (!isScreenMountedRef.current) return;

        console.error("Failed to delete compartment:", err);
        Alert.alert("Error", "Failed to delete compartment.");
      } finally {
        if (isScreenMountedRef.current) {
          setDeletingCompartmentId(null);
        }
      }
    });
  }

  function renderRightActions(compartment: Compartment) {
    return (
      <HapticPressable
        style={[
          styles.swipeDeleteAction,
          isBusy() && styles.disabledInteraction,
        ]}
        onPress={() => confirmDelete(compartment)}
        disabled={isBusy()}
      >
        <Trash2 size={18} color="#fff" />
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </HapticPressable>
    );
  }

  function handleOpenCompartment(compartmentId: string) {
    if (!vehicleId || !compartmentId || !isScreenMountedRef.current) return;

    if (
      isCreating ||
      savingEdit ||
      !!deletingCompartmentId ||
      interactionLocked ||
      actionLockRef.current
    ) {
      return;
    }

    if (navigationTransitionLockedRef.current) {
      return;
    }

    navigationTransitionLockedRef.current = true;

    if (navigationUnlockTimeoutRef.current) {
      clearTimeout(navigationUnlockTimeoutRef.current);
      navigationUnlockTimeoutRef.current = null;
    }

    Keyboard.dismiss();

    router.push({
      pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
      params: {
        vehicleId: String(vehicleId),
        compartmentId: String(compartmentId),
      },
    });

    navigationUnlockTimeoutRef.current = setTimeout(() => {
      navigationUnlockTimeoutRef.current = null;

      if (!isScreenMountedRef.current) return;

      navigationTransitionLockedRef.current = false;
    }, 1500);
  }

  const headerRight = (
    <HapticPressable
      style={[styles.headerAddButton, isBusy() && styles.disabledInteraction]}
      onPress={toggleCreateBox}
      disabled={isBusy()}
      accessibilityRole="button"
      accessibilityLabel={
        showCreateBox ? "Close add compartment" : "Add compartment"
      }
    >
      <BlurView
        intensity={theme.isLight ? 18 : 35}
        tint="light"
        style={[
          styles.headerAddButtonInner,
          {
            backgroundColor: "#FFFFFF",
            borderColor: "rgba(255,255,255,0.14)",
          },
        ]}
      >
        {showCreateBox ? (
          <X size={20} color="#111827" />
        ) : (
          <Plus size={20} color="#111827" />
        )}
      </BlurView>
    </HapticPressable>
  );

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          style={styles.keyboardWrap}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
          >
            <AppHeader
              title={headerTitle}
              showBackButton
              backHref="/(tabs)/storage"
              rightContent={headerRight}
            />

            <BlurView
              intensity={theme.isLight ? 18 : 18}
              tint={theme.isLight ? "light" : "dark"}
              style={[
                styles.topActionCard,
                {
                  backgroundColor: theme.isLight
                    ? "#FFFFFF"
                    : "rgba(255,255,255,0.04)",
                  borderColor: theme.isLight
                    ? "rgba(0,0,0,0.10)"
                    : "rgba(255,255,255,0.12)",
                },
              ]}
            >
              <View style={styles.topActionTextWrap}>
                <Text
                  style={[
                    styles.topActionTitle,
                    {
                      color: theme.isLight ? "#000000" : "#FFFFFF",
                    },
                  ]}
                >
                  Add Compartment
                </Text>
                <Text
                  style={[
                    styles.topActionSubtitle,
                    {
                      color: theme.isLight
                        ? "#000000"
                        : "rgba(255,255,255,0.75)",
                    },
                  ]}
                >
                  Create a compartment inside this storage space for better
                  organization.
                </Text>
              </View>

              <HapticPressable
                style={[
                  styles.topActionButton,
                  isBusy() && styles.disabledInteraction,
                ]}
                onPress={toggleCreateBox}
                disabled={isBusy()}
              >
                <BlurView
                  intensity={18}
                  tint="dark"
                  style={styles.topActionButtonInner}
                >
                  {showCreateBox ? (
                    <Text style={styles.topActionButtonText}>Close</Text>
                  ) : (
                    <>
                      <Plus size={16} color="#fff" />
                      <Text style={styles.topActionButtonText}>Add</Text>
                    </>
                  )}
                </BlurView>
              </HapticPressable>
            </BlurView>

            <HapticPressable
              style={[
                styles.shareStorageButton,
                {
                  backgroundColor: theme.isLight
                    ? "#FFFFFF"
                    : "rgba(12,24,50,0.28)",
                  borderColor: theme.isLight
                    ? "rgba(0,0,0,0.10)"
                    : "rgba(255,255,255,0.08)",
                },
                isBusy() && styles.disabledInteraction,
              ]}
              onPress={handleStorageSpaceExportOptions}
              disabled={isBusy()}
            >
              <Share2 size={18} color={theme.isLight ? "#000000" : "#fff"} />
              <Text
                style={[
                  styles.shareStorageButtonText,
                  {
                    color: theme.isLight ? "#000000" : "#FFFFFF",
                  },
                ]}
              >
                Share Storage Space
              </Text>
            </HapticPressable>

            {showCreateBox && (
              <BlurView
                intensity={18}
                tint={theme.isLight ? "light" : "dark"}
                style={[
                  styles.createCard,
                  {
                    backgroundColor: theme.isLight
                      ? "#FFFFFF"
                      : "rgba(12,24,50,0.20)",
                    borderColor: theme.isLight
                      ? "rgba(0,0,0,0.10)"
                      : "rgba(255,255,255,0.08)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.createTitle,
                    {
                      color: theme.isLight ? "#000000" : colors.text,
                    },
                  ]}
                >
                  Create Compartment
                </Text>

                <View style={styles.createRow}>
                  <TextInput
                    value={newCompartmentName}
                    onChangeText={setNewCompartmentName}
                    placeholder="Enter compartment name"
                    placeholderTextColor={theme.isLight ? "rgba(0,0,0,0.45)" : colors.textMuted}
                    style={[
                      styles.createInput,
                      {
                        color: theme.isLight ? "#000000" : colors.text,
                        backgroundColor: theme.isLight
                          ? "rgba(255,255,255,0.82)"
                          : "rgba(7,20,44,0.55)",
                        borderColor: theme.isLight
                          ? "rgba(0,0,0,0.12)"
                          : "rgba(255,255,255,0.08)",
                      },
                    ]}
                    returnKeyType="done"
                    onFocus={() => scrollToBottom(180)}
                    onSubmitEditing={handleCreateCompartment}
                    editable={!isCreating && !interactionLocked}
                    autoFocus
                  />

                  <HapticPressable
                    style={[
                      styles.createButton,
                      (!newCompartmentName.trim() ||
                        isCreating ||
                        interactionLocked) &&
                      styles.createButtonDisabled,
                    ]}
                    onPress={handleCreateCompartment}
                    disabled={
                      !newCompartmentName.trim() ||
                      isCreating ||
                      interactionLocked
                    }
                  >
                    <Plus size={18} color="#fff" />
                  </HapticPressable>
                </View>
              </BlurView>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {rooms.length === 0 ? "No rooms yet" : `Rooms (${rooms.length})`}
              </Text>
            </View>

            {rooms.length === 0 ? (
              <BlurView
                intensity={18}
                tint={theme.isLight ? "light" : "dark"}
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: theme.isLight
                      ? "#FFFFFF"
                      : "rgba(255,255,255,0.04)",
                    borderColor: theme.isLight
                      ? "rgba(0,0,0,0.10)"
                      : "rgba(255,255,255,0.12)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.emptyTitle,
                    {
                      color: theme.isLight ? "#000000" : "#FFFFFF",
                    },
                  ]}
                >
                  No rooms found
                </Text>
                <Text
                  style={[
                    styles.emptyText,
                    {
                      color: theme.isLight
                        ? "#000000"
                        : "rgba(255,255,255,0.75)",
                    },
                  ]}
                >
                  Add rooms to organize this storage space into areas before assigning compartments.
                </Text>
              </BlurView>
            ) : (
              rooms.map((room) => (
                <BlurView
                  key={room.id}
                  intensity={18}
                  tint={theme.isLight ? "light" : "dark"}
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.isLight
                        ? "#FFFFFF"
                        : "rgba(12,24,50,0.20)",
                      borderColor: theme.isLight
                        ? "rgba(0,0,0,0.10)"
                        : "rgba(255,255,255,0.08)",
                    },
                  ]}
                >
                  <View style={styles.cardLeft}>
                    <Text
                      style={[
                        styles.cardTitle,
                        {
                          color: theme.isLight ? "#000000" : colors.text,
                        },
                      ]}
                    >
                      {room.name}
                    </Text>
                    {!!room.notes && (
                      <Text
                        style={[
                          styles.roomCardSubtitle,
                          {
                            color: theme.isLight
                              ? "rgba(0,0,0,0.58)"
                              : colors.textSecondary,
                          },
                        ]}
                      >
                        {room.notes}
                      </Text>
                    )}
                  </View>

                  <ChevronRight size={18} color={colors.textSecondary} />
                </BlurView>
              ))
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {compartments.length === 0
                  ? "No compartments yet"
                  : `Compartments (${compartments.length})`}
              </Text>
            </View>

            {compartments.length === 0 ? (
              <BlurView
                intensity={18}
                tint={theme.isLight ? "light" : "dark"}
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: theme.isLight
                      ? "#FFFFFF"
                      : "rgba(255,255,255,0.04)",
                    borderColor: theme.isLight
                      ? "rgba(0,0,0,0.10)"
                      : "rgba(255,255,255,0.12)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.emptyTitle,
                    {
                      color: theme.isLight ? "#000000" : "#FFFFFF",
                    },
                  ]}
                >
                  No compartments found
                </Text>
                <Text
                  style={[
                    styles.emptyText,
                    {
                      color: theme.isLight
                        ? "#000000"
                        : "rgba(255,255,255,0.75)",
                    },
                  ]}
                >
                  Add your first compartment for this storage space to start
                  organizing items.
                </Text>
              </BlurView>
            ) : (
              compartments.map((compartment) => {
                const isEditing = editingCompartmentId === compartment.id;
                const interactionDisabled =
                  isBusy() || deletingCompartmentId === compartment.id;

                return (
                  <Swipeable
                    key={compartment.id}
                    renderRightActions={() => renderRightActions(compartment)}
                    overshootRight={false}
                    enabled={!isEditing && !interactionDisabled}
                  >
                    <BlurView
                      intensity={18}
                      tint={theme.isLight ? "light" : "dark"}
                      style={[
                        styles.card,
                        {
                          backgroundColor: theme.isLight
                            ? "#FFFFFF"
                            : "rgba(12,24,50,0.20)",
                          borderColor: theme.isLight
                            ? "rgba(0,0,0,0.10)"
                            : "rgba(255,255,255,0.08)",
                        },
                      ]}
                    >
                      {isEditing ? (
                        <View style={styles.editWrap}>
                          <Text style={styles.editLabel}>
                            Edit compartment name
                          </Text>

                          <TextInput
                            value={editingCompartmentName}
                            onChangeText={setEditingCompartmentName}
                            placeholder="Compartment name"
                            placeholderTextColor={colors.textMuted}
                            style={styles.editInput}
                            autoFocus
                            returnKeyType="done"
                            onFocus={() => scrollToBottom(180)}
                            onSubmitEditing={() => saveEditing(compartment.id)}
                            editable={!savingEdit && !interactionLocked}
                            selectTextOnFocus
                          />

                          <View style={styles.editActions}>
                            <HapticPressable
                              style={[
                                styles.saveEditButton,
                                (!editingCompartmentName.trim() ||
                                  savingEdit ||
                                  interactionLocked) &&
                                styles.createButtonDisabled,
                              ]}
                              onPress={() => saveEditing(compartment.id)}
                              disabled={
                                !editingCompartmentName.trim() ||
                                savingEdit ||
                                interactionLocked
                              }
                            >
                              <Check size={16} color="#fff" />
                              <Text style={styles.saveEditText}>
                                {savingEdit ? "Saving..." : "Save"}
                              </Text>
                            </HapticPressable>

                            <HapticPressable
                              style={[
                                styles.cancelEditButton,
                                (savingEdit || interactionLocked) &&
                                styles.disabledInteraction,
                              ]}
                              onPress={cancelEditing}
                              disabled={savingEdit || interactionLocked}
                            >
                              <X size={16} color={colors.text} />
                              <Text style={styles.cancelEditText}>Cancel</Text>
                            </HapticPressable>
                          </View>
                        </View>
                      ) : (
                        <>
                          <HapticPressable
                            style={[
                              styles.cardLeft,
                              interactionDisabled && styles.disabledInteraction,
                            ]}
                            onPress={() =>
                              handleOpenCompartment(compartment.id)
                            }
                            disabled={interactionDisabled}
                          >
                            <Text
                              style={[
                                styles.cardTitle,
                                {
                                  color: theme.isLight ? "#000000" : colors.text,
                                },
                              ]}
                            >
                              {compartment.name}
                            </Text>
                          </HapticPressable>

                          <View style={styles.cardRight}>
                            <HapticPressable
                              style={[
                                styles.iconButton,
                                interactionDisabled &&
                                styles.disabledInteraction,
                              ]}
                              onPress={() => startEditing(compartment)}
                              disabled={interactionDisabled}
                            >
                              <Pencil
                                size={16}
                                color={
                                  theme.isLight
                                    ? "rgba(0,0,0,0.55)"
                                    : colors.textSecondary
                                }
                              />
                            </HapticPressable>

                            <HapticPressable
                              style={[
                                styles.iconButton,
                                interactionDisabled &&
                                styles.disabledInteraction,
                              ]}
                              onPress={() =>
                                handleOpenCompartment(compartment.id)
                              }
                              disabled={interactionDisabled}
                            >
                              <ChevronRight
                                size={18}
                                color={colors.textSecondary}
                              />
                            </HapticPressable>
                          </View>
                        </>
                      )}
                    </BlurView>
                  </Swipeable>
                );
              })
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

  keyboardWrap: {
    flex: 1,
  },

  content: {
    padding: 16,
    paddingBottom: 180,
  },

  headerAddButton: {
    borderRadius: 13,
    overflow: "hidden",
  },

  headerAddButtonInner: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  topActionCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(12,24,50,0.20)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  topActionTextWrap: {
    flex: 1,
  },

  topActionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },

  topActionSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },

  topActionButton: {
    borderRadius: 12,
    overflow: "hidden",
  },

  topActionButtonInner: {
    minWidth: 86,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(55,130,245,0.95)",
  },

  topActionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  shareStorageButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(12,24,50,0.28)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },

  shareStorageButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },

  createCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(12,24,50,0.20)",
  },

  createTitle: {
    color: colors.text,
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
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(7,20,44,0.55)",
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

  sectionHeader: {
    marginBottom: 10,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },

  emptyCard: {
    padding: 16,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(12,24,50,0.20)",
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
    lineHeight: 20,
  },

  card: {
    padding: 16,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(12,24,50,0.20)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  cardLeft: {
    flex: 1,
    paddingRight: 10,
  },

  cardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  cardTitle: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 16,
  },

  roomCardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },

  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  editWrap: {
    flex: 1,
    width: "100%",
  },

  editLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  editInput: {
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(7,20,44,0.72)",
    marginBottom: 12,
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
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "rgba(55,130,245,0.95)",
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
    paddingVertical: 11,
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
    backgroundColor: "rgba(180,40,40,0.95)",
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