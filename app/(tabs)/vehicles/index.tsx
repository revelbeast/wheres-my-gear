import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { ChevronRight, Plus, Trash2 } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import ScreenBackground from "../../../components/ui/ScreenBackground";
import {
  deleteStorageSpace,
  getStorageSpaces,
  StorageSpace,
} from "../../../lib/gearService";
import { useInteractionLock } from "../../../lib/useInteractionLock";
import { colors } from "../../../theme/tokens";

function FrostedCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <BlurView
      intensity={22}
      tint="light"
      style={[
        styles.card,
        {
          borderColor: "rgba(255,255,255,0.25)",
          backgroundColor: "rgba(255,255,255,0.65)",
        },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

export default function VehiclesScreen() {
  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const navigationTransitionLockedRef = useRef(false);
  const navigationUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [vehicles, setVehicles] = useState<StorageSpace[]>([]);

  useEffect(() => {
    return () => {
      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [])
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

  function lockNavigationTransition() {
    if (navigationTransitionLockedRef.current) {
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

  function runNavigationAction(action: () => void) {
    if (interactionLocked || navigationTransitionLockedRef.current) {
      return;
    }

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    action();
  }

  async function loadVehicles() {
    try {
      const data = await getStorageSpaces();
      setVehicles(data.filter((v) => v.category === "vehicle"));
    } catch (err) {
      console.error("Failed to load vehicles:", err);
    }
  }

  function handleOpenVehicle(vehicleId: string) {
    runNavigationAction(() => {
      router.push(`/vehicles/${vehicleId}`);
    });
  }

  function handleAddStorage() {
    runNavigationAction(() => {
      router.push("/(tabs)/storage/create");
    });
  }

  function handleDelete(vehicle: StorageSpace) {
    if (interactionLocked) return;

    Alert.alert("Delete Vehicle", `Delete "${vehicle.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void runWithLock(async () => {
            try {
              await deleteStorageSpace(vehicle.id);
              await loadVehicles();
            } catch (err) {
              console.error("Failed to delete vehicle:", err);
              Alert.alert(
                "Vehicle not deleted",
                "Something went wrong while deleting this vehicle."
              );
            }
          });
        },
      },
    ]);
  }

  function renderVehicle({ item }: { item: StorageSpace }) {
    return (
      <Swipeable
        renderRightActions={() => (
          <Pressable
            style={[
              styles.deleteAction,
              interactionLocked && styles.disabledButton,
            ]}
            onPress={() => handleDelete(item)}
            disabled={interactionLocked}
          >
            <Trash2 size={18} color="#fff" />
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        )}
      >
        <FrostedCard>
          <Pressable
            style={styles.row}
            onPress={() => handleOpenVehicle(item.id)}
            disabled={interactionLocked}
          >
            <View style={styles.left}>
              <Text style={styles.title}>{item.name}</Text>
            </View>

            <View style={styles.right}>
              <ChevronRight size={20} color="#000" />
            </View>
          </Pressable>
        </FrostedCard>
      </Swipeable>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          renderItem={renderVehicle}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <FrostedCard>
              <Text style={styles.empty}>No vehicles yet</Text>
            </FrostedCard>
          }
        />

        <Pressable
          style={[
            styles.addButton,
            (interactionLocked || navigationTransitionLockedRef.current) &&
              styles.disabledButton,
          ]}
          onPress={handleAddStorage}
          disabled={interactionLocked}
        >
          <Plus size={22} color="#fff" />
        </Pressable>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: 120,
  },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  left: {
    flex: 1,
  },

  right: {},

  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },

  empty: {
    fontSize: 14,
    textAlign: "center",
  },

  deleteAction: {
    width: 90,
    backgroundColor: colors.danger,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    marginBottom: 12,
  },

  deleteText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 4,
  },

  addButton: {
    position: "absolute",
    right: 20,
    bottom: 110,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  disabledButton: {
    opacity: 0.55,
  },
});