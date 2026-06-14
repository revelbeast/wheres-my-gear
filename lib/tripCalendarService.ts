import * as Calendar from "expo-calendar";

/**
 * Requests calendar permission safely
 */
export async function ensureCalendarPermission() {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

/**
 * Gets default calendar (first writable calendar)
 */
export async function getDefaultCalendarId() {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

  const defaultCalendar =
    calendars.find(c => c.allowsModifications) || calendars[0];

  return defaultCalendar?.id ?? null;
}

/**
 * Creates a trip calendar event
 */
export async function createTripCalendarEvent({
  title,
  startDate,
}: {
  title: string;
  startDate: Date;
}) {
  const hasPermission = await ensureCalendarPermission();
  if (!hasPermission) return null;

  const calendarId = await getDefaultCalendarId();
  if (!calendarId) return null;

  return await Calendar.createEventAsync(calendarId, {
    title,
    startDate,
    endDate: startDate,
    allDay: true,
    notes: "Where's My Gear trip event",
  });
}

/**
 * Updates an existing trip event
 */
export async function updateTripCalendarEvent({
  eventId,
  title,
  startDate,
}: {
  eventId: string;
  title: string;
  startDate: Date;
}) {
  if (!eventId) return;

  const calendarId = await getDefaultCalendarId();
  if (!calendarId) return;

  await Calendar.updateEventAsync(eventId, {
    title,
    startDate,
    endDate: startDate,
    allDay: true,
  });
}

/**
 * Deletes a trip event
 */
export async function deleteTripCalendarEvent(eventId?: string | null) {
  if (!eventId) return;

  try {
    await Calendar.deleteEventAsync(eventId);
  } catch (e) {
    console.warn("Failed to delete calendar event:", e);
  }
}
