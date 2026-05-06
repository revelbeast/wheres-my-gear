import { BlurView } from "expo-blur";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { router, useFocusEffect } from "expo-router";
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

  const navigationTransitionLockedRef = useRef(false);
  const navigationUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [upcomingTrips, setUpcomingTrips] = useState<UpcomingTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    return () => {
      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!initializing && !user) {
      router.replace("/sign-in");
    }
  }, [initializing, user]);

  useFocusEffect(
    useCallback(() => {
      if (initializing || !user) return;

      loadTrips();
    }, [initializing, user])
  );

  useEffect(() => {
    if (initializing) return;

    if (!user) {
      setUpcomingTrips([]);
      setIsLoading(false);
    }
  }, [initializing, user]);

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

  async function loadTrips() {
    if (!user) {
      setUpcomingTrips([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const tripsSnapshot = await getDocs(
        collection(db, "users", user.uid, "trips")
      );
      const today = getStartOfDay(new Date());

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
      console.error("Failed to load trips:", err);
      setUpcomingTrips([]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleBack() {
    runNavigationAction(() => {
      router.back();
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
    if (!user || interactionLocked) return;

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
              if (!user) return;

              try {
                await deleteDoc(doc(db, "users", user.uid, "trips", tripId));
                setUpcomingTrips((currentTrips) =>
                  currentTrips.filter((trip) => trip.id !== tripId)
                );
              } catch (error) {
                console.error("Failed to delete trip:", error);
                Alert.alert(
                  "Trip not deleted",
                  "Something went wrong while deleting this trip."
                );
              }
            });
          },
        },
      ]
    );
  }

  function renderRightActions(trip: UpcomingTrip) {
    return (
      <HapticPressable
        style={[
          styles.deleteSwipeButton,
          interactionLocked && styles.disabledButton,
        ]}
        onPress={() => handleDeleteTrip(trip.id, trip.name)}
        disabled={interactionLocked}
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
              style={[
                styles.backButton,
                (interactionLocked || navigationTransitionLockedRef.current) &&
                  styles.disabledButton,
              ]}
              onPress={handleBack}
              disabled={interactionLocked}
            >
              <ChevronLeft size={22} color={LABEL_WHITE} />
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
              style={[
                styles.addButton,
                (interactionLocked || navigationTransitionLockedRef.current) &&
                  styles.disabledButton,
              ]}
              onPress={handleCreateTrip}
              disabled={interactionLocked}
            >
              <Plus size={20} color={LABEL_WHITE} />
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
              {upcomingTrips.map((trip) => (
                <Swipeable
                  key={trip.id}
                  renderRightActions={() => renderRightActions(trip)}
                  overshootRight={false}
                >
                  <HapticPressable
                    onPress={() => handleEditTrip(trip.id)}
                    disabled={interactionLocked}
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
                                borderColor: theme.colors.border,
                              },
                            ]}
                          >
                            <ThemedText style={styles.countdownText}>
                              {getTripCountdownText(trip.date)}
                            </ThemedText>
                          </View>

                          <HapticPressable
                            style={[
                              styles.editButton,
                              (interactionLocked ||
                                navigationTransitionLockedRef.current) &&
                                styles.disabledButton,
                            ]}
                            onPress={(event: GestureResponderEvent) => {
                              event.stopPropagation();
                              handleEditTrip(trip.id);
                            }}
                            hitSlop={8}
                            disabled={interactionLocked}
                          >
                            <Pencil size={16} color={LABEL_WHITE} />
                          </HapticPressable>

                          <ChevronRight size={18} color={LABEL_WHITE} />
                        </View>
                      </View>
                    </FrostedCard>
                  </HapticPressable>
                </Swipeable>
              ))}
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
    backgroundColor: "rgba(255,255,255,0.10)",
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
    backgroundColor: "rgba(255,255,255,0.10)",
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
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
  },

  countdownText: {
    color: LABEL_WHITE,
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