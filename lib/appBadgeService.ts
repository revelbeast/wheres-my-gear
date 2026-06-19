import * as Notifications from "expo-notifications";

import { getTrips } from "./tripsService";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function updateTripPackingBadge(userId?: string | null) {
  if (!userId) {
    await Notifications.setBadgeCountAsync(0);
    return;
  }

  try {
    const trips = await getTrips(userId);
    const today = startOfToday();

    const upcomingTripCount = trips.filter((trip) => {
      const tripDate = new Date(trip.startDate);
      return tripDate.getTime() >= today.getTime();
    }).length;

    await Notifications.setBadgeCountAsync(upcomingTripCount);
  } catch (error) {
    console.warn("Unable to update trip badge:", error);
  }
}

export async function clearAppBadge() {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.warn("Unable to clear app badge:", error);
  }
}
