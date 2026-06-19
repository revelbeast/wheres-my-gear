import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Share2,
  Trash2,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../../components/auth/AuthProvider";
import HapticPressable from "../../../components/ui/HapticPressable";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import {
  ThemedButton,
  ThemedCard,
  ThemedText,
  useThemedValues,
} from "../../../components/ui/Themed";
import {
  cancelTripReminder,
  scheduleTripReminder,
} from "../../../lib/tripReminderService";
import {
  deleteTrip,
  getTripById,
  updateTrip,
} from "../../../lib/tripsService";
import { useInteractionLock } from "../../../lib/useInteractionLock";

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

function normalizeRouteParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
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

function getNoonDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
}

function formatTripDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: Array<Date | null> = [];

  for (let i = 0; i < startOffset; i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function getDaysUntilTrip(date: Date) {
  const today = getStartOfDay(new Date());
  const tripDay = getStartOfDay(date);
  const diffMs = tripDay.getTime() - today.getTime();

  return Math.ceil(diffMs / 86_400_000);
}

export default function EditTripScreen() {
  const params = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = useMemo(
    () => normalizeRouteParam(params.tripId),
    [params.tripId]
  );
  const { user, initializing } = useAuth();
  const theme = useThemedValues();
  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const [tripName, setTripName] = useState("");
  const [tripDate, setTripDate] = useState(getNoonDate(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(getStartOfDay(new Date()));
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(1);
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isMountedRef = useRef(true);
  const loadRequestIdRef = useRef(0);
  const actionLockRef = useRef(false);
  const navigationLockedRef = useRef(false);

  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth),
    [calendarMonth]
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      loadRequestIdRef.current += 1;
      actionLockRef.current = false;
      navigationLockedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!initializing && !user && isMountedRef.current) {
      router.replace("/sign-in");
    }
  }, [initializing, user]);

  useEffect(() => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (initializing || !user || !tripId) {
      if (!initializing && !tripId && isMountedRef.current) {
        setIsLoading(false);
      }

      return;
    }

    async function loadTrip() {
      if (!user || !tripId) {
        if (isMountedRef.current && loadRequestIdRef.current === requestId) {
          setIsLoading(false);
        }

        return;
      }

      try {
        if (isMountedRef.current && loadRequestIdRef.current === requestId) {
          setIsLoading(true);
        }

        const trip = await getTripById(user.uid, tripId);

        if (!isMountedRef.current || loadRequestIdRef.current !== requestId) {
          return;
        }

        if (!trip) {
          Alert.alert("Trip not found", "This trip could not be found.");

          safeGoBack();

          return;
        }

        const loadedName = trip.name;
        const loadedDate = trip.startDate ?? getNoonDate(new Date());

        if (!isMountedRef.current || loadRequestIdRef.current !== requestId) {
          return;
        }

        setTripName(loadedName);
        setTripDate(getNoonDate(loadedDate));
        setReminderEnabled(trip.reminderEnabled === true);
        setReminderDaysBefore(trip.reminderDaysBefore ?? 1);
        setNotificationId(trip.notificationId ?? null);
        setCalendarMonth(
          new Date(loadedDate.getFullYear(), loadedDate.getMonth(), 1)
        );
      } catch (error) {
        console.error("Failed to load trip:", error);

        if (isMountedRef.current && loadRequestIdRef.current === requestId) {
          Alert.alert(
            "Trip not loaded",
            "Something went wrong while loading this trip."
          );
        }
      } finally {
        if (isMountedRef.current && loadRequestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    }

    void loadTrip();

    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [initializing, user, tripId]);

  function isActionBusy() {
    return (
      isSaving ||
      isDeleting ||
      interactionLocked ||
      actionLockRef.current ||
      navigationLockedRef.current
    );
  }

  function safeGoBack() {
    if (!isMountedRef.current || navigationLockedRef.current) return;

    setIsSaving(false);
    setIsDeleting(false);
    actionLockRef.current = false;
    unlockInteraction();

    navigationLockedRef.current = true;
    router.replace("/trips");
  }

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

  function handleBack() {
    if (isActionBusy()) return;

    void runWithLock(() => {
      safeGoBack();
    });
  }

  function handlePreviousMonth() {
    if (isActionBusy()) return;

    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
    );
  }

  function handleNextMonth() {
    if (isActionBusy()) return;

    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
    );
  }

  function handleOpenCalendar() {
    if (isActionBusy()) return;

    setCalendarMonth(new Date(tripDate.getFullYear(), tripDate.getMonth(), 1));
    setIsCalendarVisible(true);
  }

  function handleCloseCalendar() {
    if (isActionBusy()) return;

    setIsCalendarVisible(false);
  }

  function handleSelectDate(date: Date) {
    if (isActionBusy()) return;

    setTripDate(getNoonDate(date));
    setIsCalendarVisible(false);
  }

  async function handleShareTrip() {
    if (isActionBusy()) return;

    actionLockRef.current = true;
    lockInteraction();

    const trimmedName = tripName.trim() || "Upcoming Trip";
    const daysUntilTrip = getDaysUntilTrip(tripDate);

    const countdownText =
      daysUntilTrip > 1
        ? `${daysUntilTrip} days away`
        : daysUntilTrip === 1
          ? "Tomorrow"
          : daysUntilTrip === 0
            ? "Today"
            : `${Math.abs(daysUntilTrip)} days ago`;

    const message = [
      `Where's My Gear Trip`,
      ``,
      `Trip: ${trimmedName}`,
      `Date: ${formatTripDate(tripDate)}`,
      `Countdown: ${countdownText}`,
    ].join("\n");

    actionLockRef.current = false;

    if (isMountedRef.current) {
      unlockInteraction();
    }

    try {
      await Share.share({
        title: trimmedName,
        message,
      });
    } catch (error) {
      console.error("Failed to share trip:", error);

      if (isMountedRef.current) {
        Alert.alert(
          "Trip not shared",
          "Something went wrong while sharing this trip."
        );
      }
    }
  }

  async function handleSaveTrip() {
    if (!user || !tripId || isActionBusy()) {
      return;
    }

    const trimmedName = tripName.trim();

    if (!trimmedName) {
      Alert.alert("Trip name required", "Enter a name for this trip.");
      return;
    }

    const uid = user.uid;
    const currentTripId = tripId;

    await runWithLock(async () => {
      try {
        if (!isMountedRef.current) return;

        setIsSaving(true);

        await cancelTripReminder(notificationId);

        let nextNotificationId: string | null = null;

        if (reminderEnabled) {
          nextNotificationId = await scheduleTripReminder({
            tripName: trimmedName,
            tripDate,
            daysBefore: reminderDaysBefore,
          });
        }

        await updateTrip({
          userId: uid,
          tripId: currentTripId,
          name: trimmedName,
          startDate: tripDate,
          reminderEnabled,
          reminderDaysBefore,
          notificationId: nextNotificationId,
        });

        setNotificationId(nextNotificationId);

        if (reminderEnabled && !nextNotificationId) {
          Alert.alert(
            "Reminder not scheduled",
            "The trip was saved, but the reminder could not be scheduled. Check notification permissions or choose a future reminder date."
          );
        }

        if (isMountedRef.current) {
          setIsSaving(false);
          actionLockRef.current = false;
          navigationLockedRef.current = false;
          unlockInteraction();

          setTimeout(() => {
            if (isMountedRef.current) {
              router.replace("/trips");
            }
          }, 50);
        }
      } catch (error) {
        console.error("Failed to update trip:", error);

        if (isMountedRef.current) {
          Alert.alert(
            "Trip not saved",
            "Something went wrong while updating this trip."
          );
        }
      } finally {
        if (isMountedRef.current) {
          setIsSaving(false);
        }
      }
    });
  }

  function handleDeleteTrip() {
    if (!user || !tripId || isActionBusy()) {
      return;
    }

    const uid = user.uid;
    const currentTripId = tripId;
    const currentTripName = tripName.trim() || "this trip";

    Alert.alert(
      "Delete Trip",
      `Delete "${currentTripName}"? This cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (isActionBusy()) return;

            await runWithLock(async () => {
              try {
                if (!isMountedRef.current) return;

                setIsDeleting(true);

                await cancelTripReminder(notificationId);

                await deleteTrip({ userId: uid, tripId: currentTripId });

                if (isMountedRef.current) {
                  safeGoBack();
                }
              } catch (error) {
                console.error("Failed to delete trip:", error);

                if (isMountedRef.current) {
                  Alert.alert(
                    "Trip not deleted",
                    "Something went wrong while deleting this trip."
                  );
                }
              } finally {
                if (isMountedRef.current) {
                  setIsDeleting(false);
                }
              }
            });
          },
        },
      ]
    );
  }

  if (!initializing && !user) {
    return null;
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerRow}>
              <HapticPressable
                style={[styles.backButton, isActionBusy() && styles.disabledButton]}
                onPress={handleBack}
                disabled={isActionBusy()}
              >
                <ChevronLeft size={22} color={LABEL_WHITE} />
              </HapticPressable>

              <View style={styles.headerTitleWrap}>
                <View style={styles.headerIconWrap}>
                  <CalendarDays size={20} color={LABEL_WHITE} />
                </View>

                <ThemedText variant="header" style={styles.headerTitle}>
                  Edit Trip
                </ThemedText>
              </View>

              <View style={styles.headerSpacer} />
            </View>

            <ThemedText style={styles.headerSubtitle}>
              Update this trip name or date for your upcoming trip countdowns.
            </ThemedText>

            {isLoading ? (
              <ThemedCard style={styles.helperCard}>
                <ThemedText variant="bodyStrong" style={styles.helperTitle}>
                  Loading trip
                </ThemedText>
                <ThemedText color="secondary" style={styles.helperText}>
                  Checking your saved trip details.
                </ThemedText>
              </ThemedCard>
            ) : (
              <>
                <FrostedCard style={styles.formCard}>
                  <View style={styles.inputGroup}>
                    <ThemedText variant="bodyStrong" style={styles.inputLabel}>
                      Trip Name
                    </ThemedText>

                    <TextInput
                      value={tripName}
                      onChangeText={setTripName}
                      placeholder="Example: Weekend Camping Trip"
                      placeholderTextColor={theme.colors.textMuted}
                      style={[
                        styles.input,
                        {
                          color: theme.colors.text,
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.card,
                        },
                      ]}
                      autoCapitalize="words"
                      autoCorrect
                      returnKeyType="done"
                      editable={!isActionBusy()}
                    />
                  </View>

                  <View style={styles.inputGroupLast}>
                    <ThemedText variant="bodyStrong" style={styles.inputLabel}>
                      Trip Date
                    </ThemedText>

                    <HapticPressable
                      style={[
                        styles.datePickerButton,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.card,
                        },
                        isActionBusy() && styles.disabledButton,
                      ]}
                      onPress={handleOpenCalendar}
                      disabled={isActionBusy()}
                    >
                      <View style={styles.datePickerLeft}>
                        <CalendarDays size={18} color={theme.colors.text} />
                        <ThemedText variant="bodyStrong">
                          {formatTripDate(tripDate)}
                        </ThemedText>
                      </View>

                      <ChevronRight size={18} color={theme.colors.textMuted} />
                    </HapticPressable>

                    <ThemedText color="secondary" style={styles.inputHint}>
                      Tap the date to choose from the calendar.
                    </ThemedText>
                  </View>
                </FrostedCard>

                <FrostedCard style={styles.formCard}>
                  <View style={styles.reminderHeaderRow}>
                    <View style={styles.reminderTextWrap}>
                      <ThemedText
                        variant="bodyStrong"
                        color="primary"
                        style={[
                          styles.inputLabel,
                          theme.isLight ? null : { color: "#FFFFFF" },
                        ]}
                      >
                        Trip Reminder
                      </ThemedText>
                      <ThemedText color="secondary" style={styles.inputHint}>
                        Get a packing reminder before this trip starts.
                      </ThemedText>
                    </View>

                    <HapticPressable
                      style={[
                        styles.reminderToggle,
                        reminderEnabled && styles.reminderToggleOn,
                        isActionBusy() && styles.disabledButton,
                      ]}
                      onPress={() => setReminderEnabled((current) => !current)}
                      disabled={isActionBusy()}
                    >
                      <ThemedText style={styles.reminderToggleText}>
                        {reminderEnabled ? "On" : "Off"}
                      </ThemedText>
                    </HapticPressable>
                  </View>

                  {reminderEnabled ? (
                    <View style={styles.reminderOptionsRow}>
                      {[1, 3, 7].map((days) => (
                        <HapticPressable
                          key={days}
                          style={[
                            styles.reminderOption,
                            reminderDaysBefore === days && styles.reminderOptionSelected,
                            isActionBusy() && styles.disabledButton,
                          ]}
                          onPress={() => setReminderDaysBefore(days)}
                          disabled={isActionBusy()}
                        >
                          <ThemedText
                            style={[
                              styles.reminderOptionText,
                              reminderDaysBefore === days && styles.reminderOptionTextSelected,
                            ]}
                          >
                            {days === 1 ? "1 day" : `${days} days`}
                          </ThemedText>
                        </HapticPressable>
                      ))}
                    </View>
                  ) : null}
                </FrostedCard>

                <HapticPressable
                  style={[
                    styles.shareButton,
                    isActionBusy() && styles.disabledButton,
                  ]}
                  onPress={handleShareTrip}
                  disabled={isActionBusy()}
                >
                  <FrostedCard style={styles.shareButtonCard}>
                    <Share2 size={18} color={theme.colors.text} />
                    <ThemedText
                      variant="bodyStrong"
                      style={[styles.shareButtonText, { color: theme.colors.text }]}
                    >
                      Share Trip
                    </ThemedText>
                  </FrostedCard>
                </HapticPressable>

                <ThemedButton
                  style={[
                    styles.saveButton,
                    isActionBusy() ? styles.disabledButton : {},
                  ]}
                  onPress={handleSaveTrip}
                  disabled={isActionBusy()}
                >
                  <ThemedText style={styles.saveButtonText}>
                    {isSaving ? "Saving Changes..." : "Save Changes"}
                  </ThemedText>
                </ThemedButton>

                <HapticPressable
                  style={[
                    styles.deleteButton,
                    isActionBusy() ? styles.disabledButton : {},
                  ]}
                  onPress={handleDeleteTrip}
                  disabled={isActionBusy()}
                >
                  <Trash2 size={18} color={LABEL_WHITE} />
                  <ThemedText style={styles.deleteButtonText}>
                    {isDeleting ? "Deleting Trip..." : "Delete Trip"}
                  </ThemedText>
                </HapticPressable>

                <ThemedCard style={styles.helperCard}>
                  <ThemedText variant="bodyStrong" style={styles.helperTitle}>
                    Trip details
                  </ThemedText>
                  <ThemedText color="secondary" style={styles.helperText}>
                    Changes save to your trip record and update the Upcoming Trips
                    list.
                  </ThemedText>
                </ThemedCard>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal
          visible={isCalendarVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCloseCalendar}
        >
          <View style={styles.modalOverlay}>
            <FrostedCard style={styles.calendarCard}>
              <View style={styles.calendarHeader}>
                <HapticPressable
                  style={[
                    styles.calendarNavButton,
                    isActionBusy() && styles.disabledButton,
                  ]}
                  onPress={handlePreviousMonth}
                  disabled={isActionBusy()}
                >
                  <ChevronLeft size={20} color={LABEL_WHITE} />
                </HapticPressable>

                <ThemedText variant="bodyStrong" style={styles.calendarTitle}>
                  {formatMonthYear(calendarMonth)}
                </ThemedText>

                <HapticPressable
                  style={[
                    styles.calendarNavButton,
                    isActionBusy() && styles.disabledButton,
                  ]}
                  onPress={handleNextMonth}
                  disabled={isActionBusy()}
                >
                  <ChevronRight size={20} color={LABEL_WHITE} />
                </HapticPressable>
              </View>

              <View style={styles.weekdayRow}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <ThemedText
                    key={day}
                    color="secondary"
                    style={styles.weekdayText}
                  >
                    {day}
                  </ThemedText>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {calendarDays.map((date, index) => {
                  const selected = date ? isSameDay(date, tripDate) : false;

                  return (
                    <View
                      key={`${date?.toISOString() ?? "blank"}-${index}`}
                      style={styles.dayCell}
                    >
                      {date ? (
                        <HapticPressable
                          style={[
                            styles.dayButton,
                            selected ? styles.selectedDayButton : null,
                            isActionBusy() && styles.disabledButton,
                          ]}
                          onPress={() => handleSelectDate(date)}
                          disabled={isActionBusy()}
                        >
                          <ThemedText
                            style={[
                              styles.dayText,
                              selected ? styles.selectedDayText : null,
                            ]}
                          >
                            {date.getDate()}
                          </ThemedText>
                        </HapticPressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <ThemedButton
                style={[
                  styles.cancelCalendarButton,
                  isActionBusy() ? styles.disabledButton : {},
                ]}
                onPress={handleCloseCalendar}
                disabled={isActionBusy()}
              >
                <ThemedText style={styles.saveButtonText}>Cancel</ThemedText>
              </ThemedButton>
            </FrostedCard>
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
    paddingBottom: 180,
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
    justifyContent: "flex-start",
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

  headerSpacer: {
    width: 42,
    height: 42,
  },

  disabledButton: {
    opacity: 0.55,
  },

  headerSubtitle: {
    color: LABEL_WHITE,
    opacity: 0.82,
    lineHeight: 20,
    marginBottom: 14,
  },

  formCard: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
  },

  inputGroup: {
    marginBottom: 16,
  },

  inputGroupLast: {
    marginBottom: 0,
  },

  inputLabel: {
    marginBottom: 8,
  },

  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
  },

  inputHint: {
    marginTop: 6,
    lineHeight: 18,
  },

  datePickerButton: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  datePickerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  shareButton: {
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
  },

  shareButtonCard: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  shareButtonText: {
    fontWeight: "700",
  },

  saveButton: {
    marginBottom: 12,
  },

  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  deleteButton: {
    minHeight: 48,
    borderRadius: 12,
    marginBottom: 14,
    backgroundColor: "#DC2626",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  deleteButtonText: {
    color: LABEL_WHITE,
    fontWeight: "700",
  },

  reminderHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  reminderTextWrap: {
    flex: 1,
  },

  reminderToggle: {
    minWidth: 64,
    minHeight: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
  },

  reminderToggleOn: {
    backgroundColor: "#16A34A",
    borderColor: "#16A34A",
  },

  reminderToggleText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  reminderOptionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },

  reminderOption: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
  },

  reminderOptionSelected: {
    backgroundColor: "#FFFFFF",
  },

  reminderOptionText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  reminderOptionTextSelected: {
    color: "#111827",
  },

  helperCard: {
    marginBottom: 14,
  },

  helperTitle: {
    marginBottom: 4,
  },

  helperText: {
    lineHeight: 19,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "rgba(0,0,0,0.72)",
  },

  calendarCard: {
    padding: 14,
    backgroundColor: "#24439A",
    borderColor: "rgba(147,197,253,0.45)",
  },

  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  calendarNavButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  calendarTitle: {
    color: LABEL_WHITE,
  },

  weekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },

  weekdayText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 12,
  },

  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  dayCell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },

  dayButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  selectedDayButton: {
    backgroundColor: "rgba(255,255,255,0.26)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.44)",
  },

  dayText: {
    fontWeight: "700",
  },

  selectedDayText: {
    color: LABEL_WHITE,
  },

  cancelCalendarButton: {
    marginTop: 14,
  },
});