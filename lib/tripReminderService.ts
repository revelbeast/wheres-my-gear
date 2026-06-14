import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type TripReminderInput = {
  tripName: string;
  tripDate: Date;
  daysBefore: number;
};

function getReminderDate(tripDate: Date, daysBefore: number) {
  const reminderDate = new Date(
    tripDate.getFullYear(),
    tripDate.getMonth(),
    tripDate.getDate() - daysBefore,
    9,
    0,
    0
  );

  return reminderDate;
}

export async function cancelTripReminder(notificationId?: string | null) {
  if (!notificationId) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.warn("Unable to cancel trip reminder:", error);
  }
}

export async function scheduleTripReminder(input: TripReminderInput) {
  const reminderDate = getReminderDate(input.tripDate, input.daysBefore);

  if (reminderDate.getTime() <= Date.now()) {
    return null;
  }

  const permission = await Notifications.requestPermissionsAsync();

  if (!permission.granted) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Upcoming Trip Reminder",
      body: `${input.tripName} starts in ${input.daysBefore} day${input.daysBefore === 1 ? "" : "s"}. Open Where's My Gear and finish packing.`,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    },
  });
}
