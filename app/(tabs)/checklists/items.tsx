import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle2, ChevronRight, ListChecks } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../../components/auth/AuthProvider";
import AppHeader from "../../../components/ui/AppHeader";
import HapticPressable from "../../../components/ui/HapticPressable";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import { useThemedValues } from "../../../components/ui/Themed";
import { getAssignedChecklistItems } from "../../../lib/checklistsService";
import { useInteractionLock } from "../../../lib/useInteractionLock";

type ItemStatusFilter = "packed" | "to_pack";

type ChecklistItemSummary = {
  id: string;
  checklistId: string;
  checklistName?: string;
  name: string;
  quantity?: number;
  packed?: boolean;
  compartmentId?: string;
  compartmentName?: string;
  vehicleId?: string;
  notes?: string;
};

function FrostedCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  const theme = useThemedValues();

  return (
    <View
      style={[
        styles.cardShell,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
        style,
      ]}
    >
      <BlurView
        intensity={theme.isLight ? 22 : 35}
        tint={theme.isLight ? "light" : "dark"}
        style={styles.cardBlur}
      >
        {children}
      </BlurView>
    </View>
  );
}

function getItemQuantity(item: { quantity?: number }) {
  const qty = Number(item.quantity ?? 1);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

export default function ChecklistItemsSummaryScreen() {
  const { user, initializing } = useAuth();
  const params = useLocalSearchParams<{ status?: string }>();
  const theme = useThemedValues();

  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const navigationTransitionLockedRef = useRef(false);
  const navigationUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [items, setItems] = useState<ChecklistItemSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const statusFilter: ItemStatusFilter =
    String(params.status ?? "").toLowerCase().trim() === "packed"
      ? "packed"
      : "to_pack";

  useEffect(() => {
    return () => {
      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (initializing) {
      return;
    }

    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    loadItems();
  }, [initializing, user]);

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

  async function loadItems() {
    if (!user) return;

    if (interactionLocked) return;

    lockInteraction();

    try {
      setLoading(true);
      const results = await getAssignedChecklistItems(user.uid);
      setItems(results);
    } catch (err) {
      console.error("Failed to load checklist item summary:", err);
      setItems([]);
    } finally {
      setLoading(false);
      unlockInteraction();
    }
  }

  const filteredItems = useMemo(() => {
    const base = items.filter((item) =>
      statusFilter === "packed" ? !!item.packed : !item.packed
    );

    return base.sort((a, b) => {
      const checklistA = String(a.checklistName ?? "").toLowerCase();
      const checklistB = String(b.checklistName ?? "").toLowerCase();

      if (checklistA !== checklistB) {
        return checklistA.localeCompare(checklistB);
      }

      return String(a.name ?? "")
        .toLowerCase()
        .localeCompare(String(b.name ?? "").toLowerCase());
    });
  }, [items, statusFilter]);

  function handleOpenChecklist(checklistId: string) {
    runNavigationAction(() => {
      router.push({
        pathname: "/checklists/[checklistId]",
        params: { checklistId },
      });
    });
  }

  function getHeaderTitle() {
    return statusFilter === "packed"
      ? "Packed Checklist Items"
      : "Checklist Items To Pack";
  }

  function getHeaderSubtitle() {
    return statusFilter === "packed"
      ? "Items marked packed across your active checklists"
      : "Items still waiting to be packed across your active checklists";
  }

  function renderStatusIcon() {
    if (statusFilter === "packed") {
      return <CheckCircle2 size={18} color={theme.colors.text} />;
    }

    return <ListChecks size={18} color={theme.colors.text} />;
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader title={getHeaderTitle()} showBackButton />

          <View style={styles.heroSection}>
            <Text style={styles.heroSubtitle}>{getHeaderSubtitle()}</Text>
          </View>

          {loading ? (
            <FrostedCard>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                Loading items...
              </Text>
            </FrostedCard>
          ) : !user ? (
            <FrostedCard>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                Sign in required
              </Text>
              <Text
                style={[styles.emptyText, { color: theme.colors.textSecondary }]}
              >
                Please sign in to view checklist items.
              </Text>
            </FrostedCard>
          ) : filteredItems.length === 0 ? (
            <FrostedCard>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                {statusFilter === "packed"
                  ? "No packed checklist items"
                  : "No checklist items left to pack"}
              </Text>
              <Text
                style={[styles.emptyText, { color: theme.colors.textSecondary }]}
              >
                {statusFilter === "packed"
                  ? "Once you mark checklist items packed, they will appear here."
                  : "Everything currently assigned in your checklists is packed."}
              </Text>
            </FrostedCard>
          ) : (
            filteredItems.map((item) => (
              <FrostedCard key={`${item.checklistId}-${item.id}`}>
                <HapticPressable
                  style={[
                    styles.row,
                    (interactionLocked ||
                      navigationTransitionLockedRef.current) &&
                      styles.disabledButton,
                  ]}
                  onPress={() => handleOpenChecklist(item.checklistId)}
                  disabled={interactionLocked}
                >
                  <View style={styles.left}>
                    <View style={styles.titleRow}>
                      <View
                        style={[
                          styles.iconWrap,
                          {
                            backgroundColor: theme.colors.iconSurface,
                            borderColor: theme.colors.border,
                          },
                        ]}
                      >
                        {renderStatusIcon()}
                      </View>

                      <View style={styles.titleTextWrap}>
                        <Text
                          style={[styles.title, { color: theme.colors.text }]}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={[
                            styles.checklistName,
                            { color: theme.colors.text },
                          ]}
                        >
                          {item.checklistName || "Checklist"}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[styles.meta, { color: theme.colors.textSecondary }]}
                    >
                      Qty: {getItemQuantity(item)}
                    </Text>

                    <Text
                      style={[
                        styles.subMeta,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {statusFilter === "packed" ? "Packed" : "Still to pack"}
                    </Text>

                    <Text
                      style={[
                        styles.locationText,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      Storage:{" "}
                      {item.compartmentName
                        ? item.compartmentName
                        : "Not assigned"}
                    </Text>
                  </View>

                  <ChevronRight size={18} color={theme.colors.textSecondary} />
                </HapticPressable>
              </FrostedCard>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
  },

  heroSection: {
    marginBottom: 14,
  },

  heroSubtitle: {
    color: "#FFFFFF",
    opacity: 0.82,
    fontSize: 14,
    lineHeight: 20,
  },

  cardShell: {
    marginBottom: 12,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
  },

  cardBlur: {
    padding: 16,
  },

  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  left: {
    flex: 1,
    paddingRight: 10,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },

  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: 10,
  },

  titleTextWrap: {
    flex: 1,
  },

  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
    lineHeight: 21,
  },

  checklistName: {
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.9,
  },

  meta: {
    fontSize: 14,
    marginBottom: 2,
  },

  subMeta: {
    fontSize: 13,
    marginBottom: 2,
  },

  locationText: {
    fontSize: 13,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },

  disabledButton: {
    opacity: 0.55,
  },
});