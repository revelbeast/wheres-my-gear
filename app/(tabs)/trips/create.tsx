import { BlurView } from "expo-blur";
import { router } from "expo-router";
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Save,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
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
import { db } from "../../../firebaseConfig";
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

export default function CreateTripScreen() {
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
  const [isSaving, setIsSaving] = useState(false);

  const isMountedRef = useRef(true);
  const actionLockRef = useRef(false);
  const navigationLockedRef = useRef(false);

  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth),
    [calendarMonth]
  );

  const isActionBusy =
    isSaving || interactionLocked || actionLockRef.current || navigationLockedRef.current;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      actionLockRef.current = false;
      navigationLockedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!initializing && !user && isMountedRef.current) {
      router.replace("/sign-in");
    }
  }, [initializing, user]);

  function safeGoBack() {
    if (!isMountedRef.current || navigationLockedRef.current) return;

    navigationLockedRef.current = true;
    router.back();
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
    if (isActionBusy) return;

    void runWithLock(() => {
      if (tripName.trim().length === 0) {
        safeGoBack();
        return;
      }

      Alert.alert("Discard Trip?", "Go back without saving this trip?", [
        {
          text: "Keep Editing",
          style: "cancel",
        },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            safeGoBack();
          },
        },
      ]);
    });
  }

  function handlePreviousMonth() {
    if (isActionBusy) return;

    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
    );
  }

  function handleNextMonth() {
    if (isActionBusy) return;

    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
    );
  }

  function handleOpenCalendar() {
    if (isActionBusy) return;

    setCalendarMonth(new Date(tripDate.getFullYear(), tripDate.getMonth(), 1));
    setIsCalendarVisible(true);
  }

  function handleCloseCalendar() {
    if (isActionBusy) return;

    setIsCalendarVisible(false);
  }

  function handleSelectDate(date: Date) {
    if (isActionBusy) return;

    setTripDate(getNoonDate(date));
    setIsCalendarVisible(false);
  }

  async function handleSaveTrip() {
    if (!user || isActionBusy) {
      return;
    }

    const trimmedName = tripName.trim();

    if (!trimmedName) {
      Alert.alert("Trip name required", "Enter a name for this trip.");
      return;
    }

    const uid = user.uid;

    await runWithLock(async () => {
      try {
        if (!isMountedRef.current) return;

        setIsSaving(true);

        await addDoc(collection(db, "users", uid, "trips"), {
          name: trimmedName,
          startDate: Timestamp.fromDate(tripDate),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (isMountedRef.current) {
          safeGoBack();
        }
      } catch (error) {
        console.error("Failed to create trip:", error);

        if (isMountedRef.current) {
          Alert.alert(
            "Trip not saved",
            "Something went wrong while saving this trip."
          );
        }
      } finally {
        if (isMountedRef.current) {
          setIsSaving(false);
        }
      }
    });
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
                style={[styles.backButton, isActionBusy && styles.disabledButton]}
                onPress={handleBack}
                disabled={isActionBusy}
              >
                <ChevronLeft size={22} color={LABEL_WHITE} />
              </HapticPressable>

              <View style={styles.headerTitleWrap}>
                <View style={styles.headerIconWrap}>
                  <CalendarDays size={20} color={LABEL_WHITE} />
                </View>

                <ThemedText variant="header" style={styles.headerTitle}>
                  Create Trip
                </ThemedText>
              </View>

              <HapticPressable
                style={[
                  styles.cancelIconButton,
                  isActionBusy && styles.disabledButton,
                ]}
                onPress={handleBack}
                disabled={isActionBusy}
              >
                <X size={19} color={LABEL_WHITE} />
              </HapticPressable>
            </View>

            <ThemedText style={styles.headerSubtitle}>
              Add a trip so the dashboard can show countdowns and future packing
              reminders.
            </ThemedText>

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
                  editable={!isActionBusy}
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
                    isActionBusy && styles.disabledButton,
                  ]}
                  onPress={handleOpenCalendar}
                  disabled={isActionBusy}
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

            <ThemedButton
              style={[styles.saveButton, isActionBusy ? styles.disabledButton : {}]}
              onPress={handleSaveTrip}
              disabled={isActionBusy}
            >
              <View style={styles.saveButtonInner}>
                <Save size={18} color={LABEL_WHITE} />
                <ThemedText style={styles.saveButtonText}>
                  {isSaving ? "Saving Trip..." : "Save Trip"}
                </ThemedText>
              </View>
            </ThemedButton>

            <HapticPressable
              style={[styles.cancelButton, isActionBusy && styles.disabledButton]}
              onPress={handleBack}
              disabled={isActionBusy}
            >
              <X size={18} color={LABEL_WHITE} />
              <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
            </HapticPressable>

            <ThemedCard style={styles.helperCard}>
              <ThemedText variant="bodyStrong" style={styles.helperTitle}>
                What happens next?
              </ThemedText>
              <ThemedText color="secondary" style={styles.helperText}>
                After saving, your trip will appear on the dashboard and in the full
                Upcoming Trips list.
              </ThemedText>
            </ThemedCard>
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
                    isActionBusy && styles.disabledButton,
                  ]}
                  onPress={handlePreviousMonth}
                  disabled={isActionBusy}
                >
                  <ChevronLeft size={20} color={LABEL_WHITE} />
                </HapticPressable>

                <ThemedText variant="bodyStrong" style={styles.calendarTitle}>
                  {formatMonthYear(calendarMonth)}
                </ThemedText>

                <HapticPressable
                  style={[
                    styles.calendarNavButton,
                    isActionBusy && styles.disabledButton,
                  ]}
                  onPress={handleNextMonth}
                  disabled={isActionBusy}
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
                            isActionBusy && styles.disabledButton,
                          ]}
                          onPress={() => handleSelectDate(date)}
                          disabled={isActionBusy}
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
                  isActionBusy ? styles.disabledButton : {},
                ]}
                onPress={handleCloseCalendar}
                disabled={isActionBusy}
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

  cancelIconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
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
    color: LABEL_WHITE,
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

  saveButton: {
    marginBottom: 12,
  },

  saveButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  cancelButton: {
    minHeight: 48,
    borderRadius: 12,
    marginBottom: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  cancelButtonText: {
    color: LABEL_WHITE,
    fontWeight: "700",
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
    backgroundColor: "rgba(0,0,0,0.58)",
  },

  calendarCard: {
    padding: 14,
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