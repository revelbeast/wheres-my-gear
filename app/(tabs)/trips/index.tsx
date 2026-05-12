import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  GestureResponderEvent,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../../components/auth/AuthProvider";
import HapticPressable from "../../../components/ui/HapticPressable";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import {
  ThemedCard,
  ThemedText,
  useThemedValues,
} from "../../../components/ui/Themed";
import { db } from "../../../firebaseConfig";
import { useInteractionLock } from "../../../lib/useInteractionLock";

type UpcomingTrip = {
  id: string;
  name: string;
  date: Date;
};

const LABEL_WHITE = "#FFFFFF";

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

function parseTripDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const parsed = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function getStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getTripCountdownText(date: Date) {
  const today = getStartOfDay(new Date());
  const tripDay = getStartOfDay(date);
  const diffMs = tripDay.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 0) return "Past trip";

  return `In ${diffDays} days`;
}

function formatTripDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TripsScreen() {
  const { user, initializing } = useAuth();
  const theme = useThemedValues();

  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const isMountedRef = useRef(true);
  const loadVersionRef = useRef(0);
  const actionLockRef = useRef(false);
  const navigationTransitionLockedRef = useRef(false);
  const navigationUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [upcomingTrips, setUpcomingTrips] = useState<UpcomingTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null);

  const isActionBusy =
    interactionLocked ||
    actionLockRef.current ||
    navigationTransitionLockedRef.current ||
    !!deletingTripId;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      loadVersionRef.current += 1;
      actionLockRef.current = false;
      navigationTransitionLockedRef.current = false;

      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
        navigationUnlockTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!initializing && !user && isMountedRef.current) {
      router.replace("/sign-in");
    }
  }, [initializing, user]);

  useFocusEffect(
    useCallback(() => {
      if (initializing || !user) return;

      const loadVersion = loadVersionRef.current + 1;
      loadVersionRef.current = loadVersion;

      void loadTrips(loadVersion);

      return () => {
        loadVersionRef.current += 1;
      };
    }, [initializing, user])
  );

  useEffect(() => {
    if (initializing) return;

    if (!user && isMountedRef.current) {
      loadVersionRef.current += 1;
      setUpcomingTrips([]);
      setIsLoading(false);
    }
  }, [initializing, user]);

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

  function lockNavigationTransition() {
    if (!isMountedRef.current || navigationTransitionLockedRef.current) {
      return false;
    }

    navigationTransitionLockedRef.current = true;

    if (navigationUnlockTimeoutRef.current) {
      clearTimeout(navigationUnlockTimeoutRef.current);
      navigationUnlockTimeoutRef.current = null;
    }

    navigationUnlockTimeoutRef.current = setTimeout(() => {
      navigationUnlockTimeoutRef.current = null;

      if (!isMountedRef.current) return;

      navigationTransitionLockedRef.current = false;
    }, 1500);

    return true;
  }

  function runNavigationAction(action: () => void) {
    if (isActionBusy || !isMountedRef.current) {
      return;
    }

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    action();
  }

  async function loadTrips(loadVersion = loadVersionRef.current) {
    if (!user) {
      if (!isMountedRef.current || loadVersionRef.current !== loadVersion) {
        return;
      }

      setUpcomingTrips([]);
      setIsLoading(false);
      return;
    }

    try {
      if (isMountedRef.current && loadVersionRef.current === loadVersion) {
        setIsLoading(true);
      }

      const activeUserId = user.uid;
      const tripsSnapshot = await getDocs(
        collection(db, "users", activeUserId, "trips")
      );
      const today = getStartOfDay(new Date());

      if (!isMountedRef.current || loadVersionRef.current !== loadVersion) {
        return;
      }

      const trips = tripsSnapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          const tripDate =
            parseTripDate(data.startDate) ??
            parseTripDate(data.tripDate) ??
            parseTripDate(data.date) ??
            parseTripDate(data.departureDate);

          if (!tripDate) return null;

          const tripName =
            typeof data.name === "string" && data.name.trim().length > 0
              ? data.name.trim()
              : typeof data.title === "string" && data.title.trim().length > 0
                ? data.title.trim()
                : "Upcoming Trip";

          return {
            id: docSnap.id,
            name: tripName,
            date: tripDate,
          };
        })
        .filter((trip): trip is UpcomingTrip => {
          if (!trip) return false;

          return getStartOfDay(trip.date).getTime() >= today.getTime();
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      setUpcomingTrips(trips);
    } catch (err) {
      if (!isMountedRef.current || loadVersionRef.current !== loadVersion) {
        return;
      }

      console.error("Failed to load trips:", err);
      setUpcomingTrips([]);
    } finally {
      if (isMountedRef.current && loadVersionRef.current === loadVersion) {
        setIsLoading(false);
      }
    }
  }

  function handleBack() {
    runNavigationAction(() => {
      router.replace("/");
    });
  }

  function handleCreateTrip() {
    runNavigationAction(() => {
      router.push("/trips/create");
    });
  }

  function handleEditTrip(tripId: string) {
    runNavigationAction(() => {
      router.push(`/trips/${tripId}`);
    });
  }

  function handleDeleteTrip(tripId: string, tripName: string) {
    if (!user || isActionBusy || !isMountedRef.current) return;

    const activeUserId = user.uid;

    Alert.alert(
      "Delete Trip",
      `Delete "${tripName}"? This cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void runWithLock(async () => {
              try {
                if (!isMountedRef.current) return;

                setDeletingTripId(tripId);

                await deleteDoc(doc(db, "users", activeUserId, "trips", tripId));

                if (!isMountedRef.current) return;

                setUpcomingTrips((currentTrips) =>
                  currentTrips.filter((trip) => trip.id !== tripId)
                );
              } catch (error) {
                if (!isMountedRef.current) return;

                console.error("Failed to delete trip:", error);
                Alert.alert(
                  "Trip not deleted",
                  "Something went wrong while deleting this trip."
                );
              } finally {
                if (isMountedRef.current) {
                  setDeletingTripId(null);
                }
              }
            });
          },
        },
      ]
    );
  }

  function renderRightActions(trip: UpcomingTrip) {
    const disabled = isActionBusy || deletingTripId === trip.id;

    return (
      <HapticPressable
        style={[styles.deleteSwipeButton, disabled && styles.disabledButton]}
        onPress={() => handleDeleteTrip(trip.id, trip.name)}
        disabled={disabled}
      >
        <Trash2 size={20} color={LABEL_WHITE} />
        <ThemedText style={styles.deleteSwipeText}>Delete</ThemedText>
      </HapticPressable>
    );
  }

  if (!initializing && !user) {
    return null;
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <HapticPressable
              style={[styles.backButton, isActionBusy && styles.disabledButton]}
              onPress={handleBack}
              disabled={isActionBusy}
            >
              <ChevronLeft size={22} color="#111827" />
            </HapticPressable>

            <View style={styles.headerTitleWrap}>
              <View style={styles.headerIconWrap}>
                <CalendarDays size={20} color={LABEL_WHITE} />
              </View>

              <ThemedText variant="header" style={styles.headerTitle}>
                Upcoming Trips
              </ThemedText>
            </View>

            <HapticPressable
              style={[styles.addButton, isActionBusy && styles.disabledButton]}
              onPress={handleCreateTrip}
              disabled={isActionBusy}
            >
              <Plus size={20} color="#111827" />
            </HapticPressable>
          </View>

          <ThemedText style={styles.headerSubtitle}>
            View upcoming trips, countdowns, and future packing reminders.
          </ThemedText>

          {initializing || isLoading ? (
            <ThemedCard style={styles.emptyCard}>
              <ThemedText variant="bodyStrong" style={styles.emptyTitle}>
                Loading trips
              </ThemedText>
              <ThemedText color="secondary" style={styles.emptyText}>
                Checking your saved trip plans.
              </ThemedText>
            </ThemedCard>
          ) : upcomingTrips.length === 0 ? (
            <ThemedCard style={styles.emptyCard}>
              <ThemedText variant="bodyStrong" style={styles.emptyTitle}>
                No upcoming trips
              </ThemedText>
              <ThemedText color="secondary" style={styles.emptyText}>
                Create a trip later to see countdowns and packing reminders here.
              </ThemedText>
            </ThemedCard>
          ) : (
            <View style={styles.tripList}>
              {upcomingTrips.map((trip) => {
                const tripDisabled = isActionBusy || deletingTripId === trip.id;

                return (
                  <Swipeable
                    key={trip.id}
                    renderRightActions={() => renderRightActions(trip)}
                    overshootRight={false}
                    enabled={!tripDisabled}
                  >
                    <HapticPressable
                      onPress={() => handleEditTrip(trip.id)}
                      disabled={tripDisabled}
                    >
                      <FrostedCard style={styles.tripCard}>
                        <View style={styles.tripRow}>
                          <View style={styles.tripLeft}>
                            <ThemedText
                              variant="bodyStrong"
                              style={styles.tripTitle}
                              numberOfLines={1}
                            >
                              {trip.name}
                            </ThemedText>

                            <ThemedText color="secondary" style={styles.tripDate}>
                              {formatTripDate(trip.date)}
                            </ThemedText>
                          </View>

                          <View style={styles.tripRight}>
                            <View
                              style={[
                                styles.countdownPill,
                                {
                                  backgroundColor: theme.isLight
                                    ? "rgba(255,255,255,0.88)"
                                    : "rgba(255,255,255,0.14)",
                                  borderColor: theme.isLight
                                    ? "rgba(0,0,0,0.10)"
                                    : "rgba(255,255,255,0.16)",
                                },
                              ]}
                            >
                              <ThemedText
                                style={[
                                  styles.countdownText,
                                  { color: theme.isLight ? "#000" : LABEL_WHITE },
                                ]}
                              >
                                {getTripCountdownText(trip.date)}
                              </ThemedText>
                            </View>

                            <HapticPressable
                              style={[
                                styles.editButton,
                                tripDisabled && styles.disabledButton,
                              ]}
                              onPress={(event: GestureResponderEvent) => {
                                event.stopPropagation();
                                handleEditTrip(trip.id);
                              }}
                              hitSlop={8}
                              disabled={tripDisabled}
                            >
                              <Pencil size={16} color={theme.isLight ? "#000" : LABEL_WHITE} />
                            </HapticPressable>

                            <ChevronRight size={18} color={theme.isLight ? "#000" : LABEL_WHITE} />
                          </View>
                        </View>
                      </FrostedCard>
                    </HapticPressable>
                  </Swipeable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 160,
  },

  frostedCard: {
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 1,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
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

  headerTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  headerTitle: {
    color: LABEL_WHITE,
    fontWeight: "700",
  },

  addButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  headerSubtitle: {
    color: LABEL_WHITE,
    opacity: 0.82,
    lineHeight: 20,
    marginBottom: 14,
  },

  emptyCard: {
    marginBottom: 14,
  },

  emptyTitle: {
    marginBottom: 4,
  },

  emptyText: {
    lineHeight: 19,
  },

  tripList: {
    gap: 10,
  },

  tripCard: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  tripLeft: {
    flex: 1,
  },

  tripRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  tripTitle: {
    marginBottom: 4,
  },

  tripDate: {
    lineHeight: 18,
  },

  countdownPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
  },

  countdownText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 12,
  },

  editButton: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  deleteSwipeButton: {
    width: 92,
    minHeight: 68,
    borderRadius: 14,
    marginLeft: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
  },

  deleteSwipeText: {
    color: LABEL_WHITE,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },

  disabledButton: {
    opacity: 0.55,
  },
});