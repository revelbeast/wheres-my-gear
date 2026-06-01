import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronRight, Plus } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
  Room,
  createCompartment,
  getCompartmentsByVehicle,
  getRoomById,
} from "../../../../../lib/gearService";
import { useInteractionLock } from "../../../../../lib/useInteractionLock";
import { colors } from "../../../../../theme/tokens";

export default function RoomDetailScreen() {
  const theme = useThemedValues();

  const params = useLocalSearchParams<{
    vehicleId?: string | string[];
    roomId?: string | string[];
  }>();

  const vehicleId = useMemo(() => {
    const value = params.vehicleId;
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  }, [params.vehicleId]);

  const roomId = useMemo(() => {
    const value = params.roomId;
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  }, [params.roomId]);

  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const isMountedRef = useRef(true);
  const loadVersionRef = useRef(0);
  const actionLockRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [showCreateBox, setShowCreateBox] = useState(false);
  const [newCompartmentName, setNewCompartmentName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const headerTitle = room?.name ? room.name : "Room";

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      loadVersionRef.current += 1;
      actionLockRef.current = false;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const loadVersion = loadVersionRef.current + 1;
    loadVersionRef.current = loadVersion;

    if (!vehicleId || !roomId) {
      setRoom(null);
      setCompartments([]);
      return;
    }

    void loadRoomData(loadVersion);

    return () => {
      loadVersionRef.current += 1;
    };
  }, [roomId, vehicleId]);

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

  async function loadRoomData(loadVersion = loadVersionRef.current) {
    try {
      const [roomData, allCompartments] = await Promise.all([
        getRoomById(String(roomId)),
        getCompartmentsByVehicle(String(vehicleId)),
      ]);

      if (!isMountedRef.current || loadVersionRef.current !== loadVersion) {
        return;
      }

      setRoom(roomData);
      setCompartments(
        allCompartments
          .filter((compartment) => compartment.roomId === String(roomId))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (error) {
      if (!isMountedRef.current || loadVersionRef.current !== loadVersion) {
        return;
      }

      console.error("Failed to load room details:", error);
      setRoom(null);
      setCompartments([]);
    }
  }

  function isBusy() {
    return isCreating || interactionLocked || actionLockRef.current;
  }

  function scrollToBottom(delay = 140) {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    scrollTimeoutRef.current = setTimeout(() => {
      scrollTimeoutRef.current = null;

      if (!isMountedRef.current) return;

      scrollRef.current?.scrollToEnd({ animated: true });
    }, delay);
  }

  function toggleCreateBox() {
    if (isBusy()) return;

    Keyboard.dismiss();

    setShowCreateBox((prev) => {
      const next = !prev;

      if (!next) {
        setNewCompartmentName("");
      } else {
        scrollToBottom(180);
      }

      return next;
    });
  }

  async function handleCreateCompartment() {
    if (!vehicleId || !roomId || isCreating || interactionLocked || actionLockRef.current) {
      return;
    }

    const trimmed = newCompartmentName.trim();
    if (!trimmed) return;

    await runWithLock(async () => {
      try {
        if (!isMountedRef.current) return;

        setIsCreating(true);
        Keyboard.dismiss();

        const createdId = await createCompartment(trimmed, String(vehicleId), {
          roomId: String(roomId),
          roomName: room?.name ?? "",
        });

        if (!isMountedRef.current) return;

        setCompartments((current) => [
          {
            id: createdId,
            name: trimmed,
            vehicleId: String(vehicleId),
            roomId: String(roomId),
            roomName: room?.name ?? "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...current,
        ]);

        setNewCompartmentName("");
        setShowCreateBox(false);
      } catch (error) {
        if (!isMountedRef.current) return;

        console.error("Failed to create room compartment:", error);
        Alert.alert("Error", "Failed to create compartment.");
      } finally {
        if (isMountedRef.current) {
          setIsCreating(false);
        }
      }
    });
  }

  function handleOpenCompartment(compartmentId: string) {
    if (!vehicleId || !compartmentId || isBusy()) return;

    router.push({
      pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
      params: {
        vehicleId: String(vehicleId),
        compartmentId,
      },
    });
  }

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
            <AppHeader title={headerTitle} showBackButton />

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
                  Create a compartment inside this room.
                </Text>
              </View>

              <HapticPressable
                style={[styles.topActionButton, isBusy() && styles.disabledInteraction]}
                onPress={toggleCreateBox}
                disabled={isBusy()}
              >
                <BlurView intensity={18} tint="dark" style={styles.topActionButtonInner}>
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
                  Add a compartment to this room to start organizing gear.
                </Text>
              </BlurView>
            ) : (
              compartments.map((compartment) => (
                <BlurView
                  key={compartment.id}
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
                  <HapticPressable
                    style={styles.cardLeft}
                    onPress={() => handleOpenCompartment(compartment.id)}
                    disabled={isBusy()}
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

                  <ChevronRight size={18} color={colors.textSecondary} />
                </BlurView>
              ))
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

  topActionCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
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

  createCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
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
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },

  createButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "rgba(55,130,245,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },

  createButtonDisabled: {
    opacity: 0.55,
  },

  sectionHeader: {
    marginTop: 4,
    marginBottom: 10,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },

  emptyCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },

  card: {
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardLeft: {
    flex: 1,
    paddingRight: 10,
  },

  cardTitle: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 16,
  },

  disabledInteraction: {
    opacity: 0.55,
  },
});
