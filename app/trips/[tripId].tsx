import { BlurView } from "expo-blur";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { router, useLocalSearchParams } from "expo-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../components/auth/AuthProvider";
import ScreenBackground from "../../components/ui/ScreenBackground";
import {
  ThemedButton,
  ThemedCard,
  ThemedText,
  useThemedValues,
} from "../../components/ui/Themed";
import { db } from "../../firebaseConfig";

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

export default function EditTripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const { user, initializing } = useAuth();
  const theme = useThemedValues();

  const [tripName, setTripName] = useState("");
  const [tripDate, setTripDate] = useState(getNoonDate(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(getStartOfDay(new Date()));
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth),
    [calendarMonth]
  );

  useEffect(() => {
    if (!initializing && !user) {
      router.replace("/sign-in");
    }
  }, [initializing, user]);

  useEffect(() => {
    if (initializing || !user || !tripId) {
      if (!initializing && !tripId) {
        setIsLoading(false);
      }

      return;
    }

    loadTrip();
  }, [initializing, user, tripId]);

  async function loadTrip() {
    if (!user || !tripId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const tripSnap = await getDoc(doc(db, "users", user.uid, "trips", tripId));

      if (!tripSnap.exists()) {
        Alert.alert("Trip not found", "This trip could not be found.");
        router.back();
        return;
      }

      const data = tripSnap.data();

      const loadedName =
        typeof data.name === "string" && data.name.trim().length > 0
          ? data.name.trim()
          : typeof data.title === "string" && data.title.trim().length > 0
            ? data.title.trim()
            : "Upcoming Trip";

      const loadedDate =
        parseTripDate(data.startDate) ??
        parseTripDate(data.tripDate) ??
        parseTripDate(data.date) ??
        parseTripDate(data.departureDate) ??
        getNoonDate(new Date());

      setTripName(loadedName);
      setTripDate(getNoonDate(loadedDate));
      setCalendarMonth(new Date(loadedDate.getFullYear(), loadedDate.getMonth(), 1));
    } catch (error) {
      console.error("Failed to load trip:", error);
      Alert.alert("Trip not loaded", "Something went wrong while loading this trip.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleBack() {
    router.back();
  }

  function handlePreviousMonth() {
    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
    );
  }

  function handleNextMonth() {
    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
    );
  }

  function handleOpenCalendar() {
    setCalendarMonth(new Date(tripDate.getFullYear(), tripDate.getMonth(), 1));
    setIsCalendarVisible(true);
  }

  function handleSelectDate(date: Date) {
    setTripDate(getNoonDate(date));
    setIsCalendarVisible(false);
  }

  async function handleSaveTrip() {
    if (!user || !tripId || isSaving || isDeleting) {
      return;
    }

    const trimmedName = tripName.trim();

    if (!trimmedName) {
      Alert.alert("Trip name required", "Enter a name for this trip.");
      return;
    }

    try {
      setIsSaving(true);

      await updateDoc(doc(db, "users", user.uid, "trips", tripId), {
        name: trimmedName,
        startDate: Timestamp.fromDate(tripDate),
        updatedAt: serverTimestamp(),
      });

      router.back();
    } catch (error) {
      console.error("Failed to update trip:", error);
      Alert.alert("Trip not saved", "Something went wrong while updating this trip.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeleteTrip() {
    if (!user || !tripId || isDeleting) {
      return;
    }

    Alert.alert(
      "Delete Trip",
      `Delete "${tripName.trim() || "this trip"}"? This cannot be undone.`,
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
              setIsDeleting(true);
              await deleteDoc(doc(db, "users", user.uid, "trips", tripId));
              router.back();
            } catch (error) {
              console.error("Failed to delete trip:", error);
              Alert.alert(
                "Trip not deleted",
                "Something went wrong while deleting this trip."
              );
            } finally {
              setIsDeleting(false);
            }
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
              <Pressable style={styles.backButton} onPress={handleBack}>
                <ChevronLeft size={22} color={LABEL_WHITE} />
              </Pressable>

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
                    />
                  </View>

                  <View style={styles.inputGroupLast}>
                    <ThemedText variant="bodyStrong" style={styles.inputLabel}>
                      Trip Date
                    </ThemedText>

                    <Pressable
                      style={[
                        styles.datePickerButton,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.card,
                        },
                      ]}
                      onPress={handleOpenCalendar}
                    >
                      <View style={styles.datePickerLeft}>
                        <CalendarDays size={18} color={theme.colors.text} />
                        <ThemedText variant="bodyStrong">
                          {formatTripDate(tripDate)}
                        </ThemedText>
                      </View>

                      <ChevronRight size={18} color={theme.colors.textMuted} />
                    </Pressable>

                    <ThemedText color="secondary" style={styles.inputHint}>
                      Tap the date to choose from the calendar.
                    </ThemedText>
                  </View>
                </FrostedCard>

                <ThemedButton
                  style={[
                    styles.saveButton,
                    isSaving || isDeleting ? styles.disabledButton : {},
                  ]}
                  onPress={handleSaveTrip}
                  disabled={isSaving || isDeleting}
                >
                  <ThemedText style={styles.saveButtonText}>
                    {isSaving ? "Saving Changes..." : "Save Changes"}
                  </ThemedText>
                </ThemedButton>

                <Pressable
                  style={[
                    styles.deleteButton,
                    isSaving || isDeleting ? styles.disabledButton : {},
                  ]}
                  onPress={handleDeleteTrip}
                  disabled={isSaving || isDeleting}
                >
                  <Trash2 size={18} color={LABEL_WHITE} />
                  <ThemedText style={styles.deleteButtonText}>
                    {isDeleting ? "Deleting Trip..." : "Delete Trip"}
                  </ThemedText>
                </Pressable>

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
          onRequestClose={() => setIsCalendarVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <FrostedCard style={styles.calendarCard}>
              <View style={styles.calendarHeader}>
                <Pressable
                  style={styles.calendarNavButton}
                  onPress={handlePreviousMonth}
                >
                  <ChevronLeft size={20} color={LABEL_WHITE} />
                </Pressable>

                <ThemedText variant="bodyStrong" style={styles.calendarTitle}>
                  {formatMonthYear(calendarMonth)}
                </ThemedText>

                <Pressable
                  style={styles.calendarNavButton}
                  onPress={handleNextMonth}
                >
                  <ChevronRight size={20} color={LABEL_WHITE} />
                </Pressable>
              </View>

              <View style={styles.weekdayRow}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <ThemedText key={day} color="secondary" style={styles.weekdayText}>
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
                        <Pressable
                          style={[
                            styles.dayButton,
                            selected ? styles.selectedDayButton : null,
                          ]}
                          onPress={() => handleSelectDate(date)}
                        >
                          <ThemedText
                            style={[
                              styles.dayText,
                              selected ? styles.selectedDayText : null,
                            ]}
                          >
                            {date.getDate()}
                          </ThemedText>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <ThemedButton
                style={styles.cancelCalendarButton}
                onPress={() => setIsCalendarVisible(false)}
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