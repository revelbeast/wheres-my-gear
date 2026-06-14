import NetInfo from "@react-native-community/netinfo";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebaseConfig";
import {
  cacheTrips,
  enqueueOfflineOperation,
  getCachedTrips,
  getOfflineDeletedTripIds,
  getOfflineTripById,
  getOfflineTrips,
  getOfflineTripUpdateOverrides,
} from "./offlineQueue";

export type Trip = {
  id: string;
  name: string;
  startDate: Date;
  reminderEnabled?: boolean;
  reminderDaysBefore?: number;
  notificationId?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function requireUserId(userId: string) {
  const trimmedUserId = userId?.trim();

  if (!trimmedUserId) {
    throw new Error("User is not authenticated.");
  }

  return trimmedUserId;
}

function requireTripId(tripId: string) {
  const trimmedTripId = tripId?.trim();

  if (!trimmedTripId) {
    throw new Error("Trip ID is required.");
  }

  return trimmedTripId;
}

function tripsCol(userId: string) {
  return collection(db, "users", requireUserId(userId), "trips");
}

function tripDoc(userId: string, tripId: string) {
  return doc(db, "users", requireUserId(userId), "trips", requireTripId(tripId));
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

function normalizeTrip(id: string, data: Record<string, any>): Trip | null {
  const startDate =
    parseTripDate(data.startDate) ??
    parseTripDate(data.tripDate) ??
    parseTripDate(data.date) ??
    parseTripDate(data.departureDate);

  if (!startDate) {
    return null;
  }

  const name =
    typeof data.name === "string" && data.name.trim().length > 0
      ? data.name.trim()
      : typeof data.title === "string" && data.title.trim().length > 0
        ? data.title.trim()
        : "Upcoming Trip";

  return {
    id,
    name,
    startDate,
    reminderEnabled: data.reminderEnabled === true,
    reminderDaysBefore:
      typeof data.reminderDaysBefore === "number" ? data.reminderDaysBefore : 1,
    notificationId:
      typeof data.notificationId === "string" ? data.notificationId : null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

async function isOnline() {
  const networkState = await Promise.race([
    NetInfo.fetch(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 750)),
  ]);

  return (
    networkState !== null &&
    networkState.isConnected === true &&
    networkState.isInternetReachable === true
  );
}

async function withOfflineReadTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 900
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Offline read timeout")), timeoutMs)
    ),
  ]);
}

export async function getTrips(userId: string): Promise<Trip[]> {
  const activeUserId = requireUserId(userId);
  const offlineTrips = (await getOfflineTrips(activeUserId))
    .map((trip: any) => normalizeTrip(trip.id, trip))
    .filter((trip): trip is Trip => Boolean(trip));

  const updateOverrides = await getOfflineTripUpdateOverrides(activeUserId);
  const deletedTripIds = await getOfflineDeletedTripIds(activeUserId);

  let baseTrips: Trip[] = [];

  try {
    const snapshot = await withOfflineReadTimeout(getDocs(tripsCol(activeUserId)));

    baseTrips = snapshot.docs
      .map((docSnap) => normalizeTrip(docSnap.id, docSnap.data()))
      .filter((trip): trip is Trip => Boolean(trip))
      .filter((trip) => !deletedTripIds.has(trip.id))
      .map((trip) => {
        const update = updateOverrides.get(trip.id);

        if (!update) {
          return trip;
        }

        return {
          ...trip,
          name: update.name,
          startDate: new Date(update.startDateIso),
          updatedAt: update.updatedAt,
        };
      });

    await cacheTrips(
      activeUserId,
      baseTrips.map((trip) => ({
        ...trip,
        startDate: trip.startDate.toISOString(),
      }))
    );
  } catch (error) {
    console.warn("Unable to load remote trips. Showing cached trips.", error);

    baseTrips = (await getCachedTrips(activeUserId))
      .map((trip: any) => normalizeTrip(trip.id, trip))
      .filter((trip): trip is Trip => Boolean(trip))
      .filter((trip) => !deletedTripIds.has(trip.id))
      .map((trip) => {
        const update = updateOverrides.get(trip.id);

        if (!update) {
          return trip;
        }

        return {
          ...trip,
          name: update.name,
          startDate: new Date(update.startDateIso),
          updatedAt: update.updatedAt,
        };
      });
  }

  return [...offlineTrips, ...baseTrips];
}

export async function getTripById(
  userId: string,
  tripId: string
): Promise<Trip | null> {
  const activeUserId = requireUserId(userId);
  const activeTripId = requireTripId(tripId);

  if (activeTripId.startsWith("offline-trip-")) {
    const offlineTrip = await getOfflineTripById(activeUserId, activeTripId);
    return offlineTrip ? normalizeTrip(offlineTrip.id, offlineTrip) : null;
  }

  const deletedTripIds = await getOfflineDeletedTripIds(activeUserId);

  if (deletedTripIds.has(activeTripId)) {
    return null;
  }

  const updateOverrides = await getOfflineTripUpdateOverrides(activeUserId);

  try {
    const snapshot = await withOfflineReadTimeout(
      getDoc(tripDoc(activeUserId, activeTripId))
    );

    if (!snapshot.exists()) {
      return null;
    }

    const trip = normalizeTrip(snapshot.id, snapshot.data());

    if (!trip) {
      return null;
    }

    const update = updateOverrides.get(activeTripId);

    if (!update) {
      return trip;
    }

    return {
      ...trip,
      name: update.name,
      startDate: new Date(update.startDateIso),
      updatedAt: update.updatedAt,
    };
  } catch (error) {
    console.warn("Unable to load trip while offline.", error);

    const cachedTrip = (await getCachedTrips(activeUserId)).find(
      (trip: any) => trip.id === activeTripId
    );

    if (!cachedTrip) {
      return null;
    }

    const trip = normalizeTrip(cachedTrip.id, cachedTrip);

    if (!trip) {
      return null;
    }

    const update = updateOverrides.get(activeTripId);

    if (!update) {
      return trip;
    }

    return {
      ...trip,
      name: update.name,
      startDate: new Date(update.startDateIso),
      updatedAt: update.updatedAt,
    };
  }
}

export async function createTrip(input: {
  userId: string;
  name: string;
  startDate: Date;
  reminderEnabled?: boolean;
  reminderDaysBefore?: number;
  notificationId?: string | null;
}) {
  const activeUserId = requireUserId(input.userId);
  const trimmedName = input.name.trim();

  if (!trimmedName) {
    throw new Error("Trip name is required.");
  }

  if (!(input.startDate instanceof Date) || Number.isNaN(input.startDate.getTime())) {
    throw new Error("Trip date is required.");
  }

  if (!(await isOnline())) {
    const offlineId = `offline-trip-${Date.now()}`;

    await enqueueOfflineOperation({
      id: offlineId,
      type: "createTrip",
      userId: activeUserId,
      payload: {
        name: trimmedName,
        startDateIso: input.startDate.toISOString(),
        reminderEnabled: input.reminderEnabled === true,
        reminderDaysBefore: input.reminderDaysBefore ?? 1,
        notificationId: input.notificationId ?? null,
      },
      createdAt: new Date().toISOString(),
    });

    return offlineId;
  }

  const ref = await addDoc(tripsCol(activeUserId), {
    name: trimmedName,
    startDate: input.startDate,
    reminderEnabled: input.reminderEnabled === true,
    reminderDaysBefore: input.reminderDaysBefore ?? 1,
    notificationId: input.notificationId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateTrip(input: {
  userId: string;
  tripId: string;
  name: string;
  startDate: Date;
  reminderEnabled?: boolean;
  reminderDaysBefore?: number;
  notificationId?: string | null;
}) {
  const activeUserId = requireUserId(input.userId);
  const activeTripId = requireTripId(input.tripId);
  const trimmedName = input.name.trim();

  if (!trimmedName) {
    throw new Error("Trip name is required.");
  }

  if (!(input.startDate instanceof Date) || Number.isNaN(input.startDate.getTime())) {
    throw new Error("Trip date is required.");
  }

  if (activeTripId.startsWith("offline-trip-")) {
    await enqueueOfflineOperation({
      id: `offline-trip-update-${Date.now()}`,
      type: "updateTrip",
      userId: activeUserId,
      payload: {
        tripId: activeTripId,
        name: trimmedName,
        startDateIso: input.startDate.toISOString(),
        reminderEnabled: input.reminderEnabled === true,
        reminderDaysBefore: input.reminderDaysBefore ?? 1,
        notificationId: input.notificationId ?? null,
      },
      createdAt: new Date().toISOString(),
    });

    return;
  }

  if (!(await isOnline())) {
    await enqueueOfflineOperation({
      id: `offline-trip-update-${Date.now()}`,
      type: "updateTrip",
      userId: activeUserId,
      payload: {
        tripId: activeTripId,
        name: trimmedName,
        startDateIso: input.startDate.toISOString(),
        reminderEnabled: input.reminderEnabled === true,
        reminderDaysBefore: input.reminderDaysBefore ?? 1,
        notificationId: input.notificationId ?? null,
      },
      createdAt: new Date().toISOString(),
    });

    return;
  }

  await updateDoc(tripDoc(activeUserId, activeTripId), {
    name: trimmedName,
    startDate: input.startDate,
    reminderEnabled: input.reminderEnabled === true,
    reminderDaysBefore: input.reminderDaysBefore ?? 1,
    notificationId: input.notificationId ?? null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTrip(input: { userId: string; tripId: string }) {
  const activeUserId = requireUserId(input.userId);
  const activeTripId = requireTripId(input.tripId);

  if (activeTripId.startsWith("offline-trip-")) {
    await enqueueOfflineOperation({
      id: `offline-trip-delete-${Date.now()}`,
      type: "deleteTrip",
      userId: activeUserId,
      payload: {
        tripId: activeTripId,
      },
      createdAt: new Date().toISOString(),
    });

    return;
  }

  if (!(await isOnline())) {
    await enqueueOfflineOperation({
      id: `offline-trip-delete-${Date.now()}`,
      type: "deleteTrip",
      userId: activeUserId,
      payload: {
        tripId: activeTripId,
      },
      createdAt: new Date().toISOString(),
    });

    return;
  }

  await deleteDoc(tripDoc(activeUserId, activeTripId));
}
