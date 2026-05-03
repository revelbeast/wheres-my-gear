import { useFocusEffect } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ChevronRight, Plus, Trash2 } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { SafeAreaView } from "react-native-safe-area-context";

import ScreenBackground from "../../../../components/ui/ScreenBackground";
import {
  ThemedText,
  useThemedValues,
} from "../../../../components/ui/Themed";
import {
  deleteCompartment,
  getCompartmentsByVehicle,
  getItemsByCompartment,
  getStorageSpaceById,
  type Compartment,
  type Item,
  type StorageSpace,
} from "../../../../lib/gearService";

type CompartmentRow = Compartment & {
  itemCount: number;
};

const LABEL_WHITE = "#FFFFFF";

function getItemQuantity(item: Item) {
  const quantity = Number(item.quantity ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function FrostedCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  const theme = useThemedValues();

  return (
    <View
      style={[
        styles.frostedCard,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.isLight
            ? "rgba(255,255,255,0.65)"
            : theme.colors.card,
        },
        style,
      ]}
    >
      <BlurView
        intensity={theme.isLight ? 22 : 35}
        tint={theme.isLight ? "light" : "dark"}
        style={styles.frostedBlur}
      >
        {children}
      </BlurView>
    </View>
  );
}

export default function CompartmentsScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const theme = useThemedValues();

  const [rows, setRows] = useState<CompartmentRow[]>([]);
  const [storageSpace, setStorageSpace] = useState<StorageSpace | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const hasVehicleId = useMemo(
    () => typeof vehicleId === "string" && vehicleId.trim().length > 0,
    [vehicleId]
  );

  const headerTitle = storageSpace?.name
    ? `${storageSpace.name} Compartments`
    : hasVehicleId
      ? "Loading..."
      : "Compartments";

  const loadCompartments = useCallback(async () => {
    if (!hasVehicleId || !vehicleId) {
      setRows([]);
      setStorageSpace(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [space, compartments] = await Promise.all([
        getStorageSpaceById(vehicleId),
        getCompartmentsByVehicle(vehicleId),
      ]);

      setStorageSpace(space);

      const enriched = await Promise.all(
        compartments.map(async (compartment) => {
          const items = await getItemsByCompartment(compartment.id);
          const itemCount = items.reduce(
            (total, item) => total + getItemQuantity(item),
            0
          );

          return {
            ...compartment,
            itemCount,
          };
        })
      );

      setRows(
        enriched.sort(
          (a, b) => b.itemCount - a.itemCount || a.name.localeCompare(b.name)
        )
      );
    } catch (error) {
      console.error("Failed to load compartments:", error);
      setRows([]);
      setStorageSpace(null);
    } finally {
      setLoading(false);
    }
  }, [hasVehicleId, vehicleId]);

  useFocusEffect(
    useCallback(() => {
      loadCompartments();
    }, [loadCompartments])
  );

  function handleOpenCompartment(compartmentId: string) {
    if (!vehicleId) return;

    router.push({
      pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
      params: {
        vehicleId,
        compartmentId,
      },
    });
  }

  function handleCreateCompartment() {
    if (!vehicleId) return;

    router.push({
      pathname: "/vehicles/[vehicleId]/compartments/create",
      params: {
        vehicleId,
      },
    });
  }

  function confirmDeleteCompartment(compartment: CompartmentRow) {
    Alert.alert(
      "Delete compartment",
      `Are you sure you want to delete "${compartment.name}"?`,
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
              setDeletingId(compartment.id);
              await deleteCompartment(compartment.id);
              await loadCompartments();
            } catch (error) {
              console.error("Failed to delete compartment:", error);
              Alert.alert("Unable to delete compartment", "Please try again.");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }

  function renderRightActions(compartment: CompartmentRow) {
    const disabled = deletingId === compartment.id;

    return (
      <Pressable
        style={[styles.deleteAction, disabled && styles.deleteActionDisabled]}
        onPress={() => confirmDeleteCompartment(compartment)}
        disabled={disabled}
      >
        <Trash2 size={18} color="#fff" />
        <ThemedText style={styles.deleteActionText}>
          {disabled ? "Deleting..." : "Delete"}
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.headerWrap}>
            <Pressable
              style={[
                styles.headerIconButton,
                {
                  backgroundColor: theme.isLight
                    ? "rgba(15,23,42,0.16)"
                    : "rgba(255,255,255,0.08)",
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => router.back()}
            >
              <ArrowLeft size={20} color={LABEL_WHITE} />
            </Pressable>

            <View style={styles.headerTitleWrap}>
              <ThemedText
                variant="title"
                style={[styles.headerTitle, styles.whiteLabel]}
                numberOfLines={1}
              >
                {headerTitle}
              </ThemedText>
            </View>

            {hasVehicleId ? (
              <Pressable
                style={[
                  styles.headerIconButton,
                  {
                    backgroundColor: theme.isLight
                      ? "rgba(15,23,42,0.16)"
                      : "rgba(255,255,255,0.08)",
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={handleCreateCompartment}
              >
                <Plus size={20} color={LABEL_WHITE} />
              </Pressable>
            ) : (
              <View style={styles.headerSpacer} />
            )}
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {!hasVehicleId ? (
              <FrostedCard style={styles.emptyCard}>
                <ThemedText variant="title" style={styles.emptyTitle}>
                  No storage space selected
                </ThemedText>
                <ThemedText color="secondary" style={styles.emptyText}>
                  Go back and choose a storage space first.
                </ThemedText>
              </FrostedCard>
            ) : loading ? (
              <FrostedCard style={styles.loadingCard}>
                <ActivityIndicator size="small" color={theme.colors.text} />
              </FrostedCard>
            ) : rows.length === 0 ? (
              <FrostedCard style={styles.emptyCard}>
                <ThemedText variant="title" style={styles.emptyTitle}>
                  No compartments yet
                </ThemedText>
                <ThemedText color="secondary" style={styles.emptyText}>
                  Tap + to create your first compartment.
                </ThemedText>
              </FrostedCard>
            ) : (
              rows.map((compartment) => (
                <Swipeable
                  key={compartment.id}
                  renderRightActions={() => renderRightActions(compartment)}
                  overshootRight={false}
                  rightThreshold={40}
                >
                  <FrostedCard style={styles.card}>
                    <Pressable
                      style={styles.row}
                      onPress={() => handleOpenCompartment(compartment.id)}
                    >
                      <View style={styles.left}>
                        <ThemedText variant="title" style={styles.title}>
                          {compartment.name}
                        </ThemedText>

                        <ThemedText color="secondary" style={styles.meta}>
                          {compartment.itemCount}{" "}
                          {compartment.itemCount === 1 ? "item" : "items"}
                        </ThemedText>
                      </View>

                      <ChevronRight
                        size={18}
                        color={theme.colors.textSecondary}
                      />
                    </Pressable>
                  </FrostedCard>
                </Swipeable>
              ))
            )}
          </ScrollView>
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
  },

  whiteLabel: {
    color: LABEL_WHITE,
  },

  headerWrap: {
    paddingHorizontal: 16,
    marginBottom: 12,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
  },

  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  headerTitle: {
    textAlign: "center",
    fontWeight: "800",
  },

  headerSpacer: {
    width: 42,
    height: 42,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 140,
  },

  frostedCard: {
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
  },

  frostedBlur: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  card: {
    marginBottom: 10,
  },

  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  left: {
    flex: 1,
    paddingRight: 10,
  },

  title: {
    marginBottom: 4,
    lineHeight: 21,
  },

  meta: {
    lineHeight: 18,
  },

  emptyCard: {
    marginTop: 4,
  },

  emptyTitle: {
    marginBottom: 6,
  },

  emptyText: {
    lineHeight: 20,
  },

  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 72,
  },

  deleteAction: {
    width: 104,
    marginBottom: 10,
    marginLeft: 8,
    borderRadius: 16,
    backgroundColor: "rgba(198,40,40,0.95)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  deleteActionDisabled: {
    opacity: 0.65,
  },

  deleteActionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});