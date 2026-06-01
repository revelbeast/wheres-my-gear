import NetInfo from "@react-native-community/netinfo";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { cacheStorageSpaces, enqueueOfflineOperation, getCachedStorageSpaces, getOfflineCompartments, getOfflineCompartmentById, getOfflineItems, getOfflineItemsByCompartment, getOfflineItemsByStatus, getOfflineStorageSpaces, removeOfflineOperation, updateOfflineCreatedItem } from "./offlineQueue";

export type ItemStatus = "packed" | "missing";
export type StorageSpaceCategory = "storage" | "office" | "vehicle";

export type StorageSpace = {
  id: string;
  name: string;
  category?: StorageSpaceCategory;
  subtype?: string;
  notes?: string;
  isArchived?: boolean;
  archivedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Room = {
  id: string;
  name: string;
  storageSpaceId: string;
  storageSpaceName?: string;
  notes?: string;
  photoUri?: string;
  isArchived?: boolean;
  archivedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Compartment = {
  id: string;
  name: string;
  vehicleId: string;
  roomId?: string;
  roomName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Item = {
  id: string;
  name: string;
  quantity: number;
  status: ItemStatus;
  compartmentId?: string;
  compartmentName?: string;
  vehicleId?: string;
  vehicleName?: string;
  notes?: string;
  source?: string;
  itemPhotoUri?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function getCurrentUserId() {
  const userId = auth.currentUser?.uid;

  if (!userId) {
    throw new Error("You are not signed in. Please close and reopen the app, then try again.");
  }

  return userId;
}

function inventoryCol() {
  return collection(db, "users", getCurrentUserId(), "inventoryItems");
}

function inventoryDoc(itemId: string) {
  return doc(db, "users", getCurrentUserId(), "inventoryItems", itemId);
}

function storageSpacesCol() {
  return collection(db, "users", getCurrentUserId(), "storageSpaces");
}

function storageSpaceDoc(storageId: string) {
  return doc(db, "users", getCurrentUserId(), "storageSpaces", storageId);
}

function roomsCol() {
  return collection(db, "users", getCurrentUserId(), "rooms");
}

function roomDoc(roomId: string) {
  return doc(db, "users", getCurrentUserId(), "rooms", roomId);
}

function compartmentsCol() {
  return collection(db, "users", getCurrentUserId(), "compartments");
}

function compartmentDoc(compartmentId: string) {
  return doc(db, "users", getCurrentUserId(), "compartments", compartmentId);
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
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

export async function getStorageSpaces(): Promise<StorageSpace[]> {
  const userId = getCurrentUserId();
  const offlineSpaces = (await getOfflineStorageSpaces(userId)) as StorageSpace[];

  let baseSpaces: StorageSpace[] = [];

  try {
    const snapshot = await withOfflineReadTimeout(getDocs(storageSpacesCol()));

    baseSpaces = snapshot.docs
      .map((d) => ({
        id: d.id,
        ...d.data(),
      }) as StorageSpace)
      .filter((space) => !space.isArchived);

    await cacheStorageSpaces(userId, baseSpaces);
  } catch (error) {
    console.warn("Unable to load remote storage spaces. Showing cached spaces.", error);
    baseSpaces = (await getCachedStorageSpaces(userId)) as StorageSpace[];
  }

  return [...offlineSpaces, ...baseSpaces];
}

export async function getStorageSpaceById(
  storageId: string
): Promise<StorageSpace | null> {
  const userId = getCurrentUserId();

  if (storageId.startsWith("offline-storage-")) {
    const offlineSpaces = (await getOfflineStorageSpaces(
      userId
    )) as StorageSpace[];

    return (
      offlineSpaces.find((space) => space.id === storageId) ?? null
    );
  }

  try {
    const snapshot = await withOfflineReadTimeout(
      getDoc(storageSpaceDoc(storageId))
    );

    if (!snapshot.exists()) return null;

    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as StorageSpace;
  } catch (error) {
    console.warn("Unable to load storage space while offline.", error);
    return null;
  }
}

export async function getRoomsByStorageSpace(
  storageSpaceId: string
): Promise<Room[]> {
  const trimmedStorageSpaceId = storageSpaceId.trim();

  if (!trimmedStorageSpaceId) {
    return [];
  }

  try {
    const q = query(
      roomsCol(),
      where("storageSpaceId", "==", trimmedStorageSpaceId)
    );
    const snapshot = await withOfflineReadTimeout(getDocs(q));

    return snapshot.docs
      .map((d) => ({
        id: d.id,
        ...d.data(),
      }) as Room)
      .filter((room) => !room.isArchived);
  } catch (error) {
    console.warn("Unable to load rooms for storage space.", error);
    return [];
  }
}

export async function getRoomById(roomId: string): Promise<Room | null> {
  const trimmedRoomId = roomId.trim();

  if (!trimmedRoomId) {
    return null;
  }

  try {
    const snapshot = await withOfflineReadTimeout(getDoc(roomDoc(trimmedRoomId)));

    if (!snapshot.exists()) return null;

    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as Room;
  } catch (error) {
    console.warn("Unable to load room.", error);
    return null;
  }
}

export async function createRoom(input: {
  name: string;
  storageSpaceId: string;
  storageSpaceName?: string;
  notes?: string;
  photoUri?: string;
}) {
  const trimmedName = input.name.trim();
  const trimmedStorageSpaceId = input.storageSpaceId.trim();

  if (!trimmedName) {
    throw new Error("Room name is required.");
  }

  if (!trimmedStorageSpaceId) {
    throw new Error("Storage space ID is required.");
  }

  const ref = await addDoc(roomsCol(), {
    name: trimmedName,
    storageSpaceId: trimmedStorageSpaceId,
    storageSpaceName: input.storageSpaceName?.trim() ?? "",
    notes: input.notes ?? "",
    photoUri: input.photoUri ?? "",
    isArchived: false,
    archivedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateRoom(
  roomId: string,
  updates: Partial<{
    name: string;
    storageSpaceId: string;
    storageSpaceName: string;
    notes: string;
    photoUri: string;
  }>
) {
  const trimmedRoomId = roomId.trim();

  if (!trimmedRoomId) {
    throw new Error("Room ID is required.");
  }

  const payload: Record<string, unknown> = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  if (typeof updates.name === "string") {
    const trimmed = updates.name.trim();
    if (!trimmed) {
      throw new Error("Room name is required.");
    }
    payload.name = trimmed;
  }

  if (typeof updates.storageSpaceId === "string") {
    const trimmedStorageSpaceId = updates.storageSpaceId.trim();
    if (!trimmedStorageSpaceId) {
      throw new Error("Storage space ID is required.");
    }
    payload.storageSpaceId = trimmedStorageSpaceId;
  }

  if (typeof updates.storageSpaceName === "string") {
    payload.storageSpaceName = updates.storageSpaceName.trim();
  }

  if (typeof updates.name === "string") {
    const relatedCompartmentsQuery = query(
      compartmentsCol(),
      where("roomId", "==", trimmedRoomId)
    );

    const relatedCompartmentsSnapshot = await getDocs(relatedCompartmentsQuery);
    const batch = writeBatch(db);

    batch.update(roomDoc(trimmedRoomId), payload);

    relatedCompartmentsSnapshot.docs.forEach((compartmentSnapshot) => {
      batch.update(compartmentSnapshot.ref, {
        roomName: payload.name,
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    return;
  }

  await updateDoc(roomDoc(trimmedRoomId), payload);
}

export async function archiveRoom(roomId: string) {
  const trimmedRoomId = roomId.trim();

  if (!trimmedRoomId) {
    throw new Error("Room ID is required.");
  }

  await updateDoc(roomDoc(trimmedRoomId), {
    isArchived: true,
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function restoreRoom(roomId: string) {
  const trimmedRoomId = roomId.trim();

  if (!trimmedRoomId) {
    throw new Error("Room ID is required.");
  }

  await updateDoc(roomDoc(trimmedRoomId), {
    isArchived: false,
    archivedAt: null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRoom(roomId: string) {
  const trimmedRoomId = roomId.trim();

  if (!trimmedRoomId) {
    throw new Error("Room ID is required.");
  }

  const relatedCompartmentsQuery = query(
    compartmentsCol(),
    where("roomId", "==", trimmedRoomId)
  );

  const relatedCompartmentsSnapshot = await getDocs(relatedCompartmentsQuery);
  const batch = writeBatch(db);

  relatedCompartmentsSnapshot.docs.forEach((compartmentSnapshot) => {
    batch.update(compartmentSnapshot.ref, {
      roomId: "",
      roomName: "",
      updatedAt: serverTimestamp(),
    });
  });

  batch.delete(roomDoc(trimmedRoomId));

  await batch.commit();
}

export async function createStorageSpace(input: {
  name: string;
  category?: StorageSpaceCategory;
  subtype?: string;
  notes?: string;
}) {
  const trimmedName = input.name.trim();
  const trimmedSubtype = input.subtype?.trim() ?? "";

  if (!trimmedName) {
    throw new Error("Storage space name is required.");
  }

  if (!trimmedSubtype) {
    throw new Error("Storage space subtype is required.");
  }

  const payload = {
    name: trimmedName,
    category: input.category ?? "vehicle",
    subtype: trimmedSubtype,
    notes: input.notes ?? "",
    isArchived: false,
    archivedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const networkState = await Promise.race([
    NetInfo.fetch(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 750)),
  ]);

  const isOnline =
    networkState !== null &&
    networkState.isConnected === true &&
    networkState.isInternetReachable === true;

  if (!isOnline) {
    const userId = getCurrentUserId();
    const offlineId = `offline-storage-${Date.now()}`;

    await enqueueOfflineOperation({
      id: offlineId,
      type: "createStorageSpace",
      userId,
      payload: {
        name: trimmedName,
        category: input.category ?? "vehicle",
        subtype: trimmedSubtype,
        notes: input.notes ?? "",
      },
      createdAt: new Date().toISOString(),
    });

    return offlineId;
  }

  const ref = await addDoc(storageSpacesCol(), payload);

  return ref.id;
}

export async function updateStorageSpace(
  storageId: string,
  updates: Partial<{
    name: string;
    category: StorageSpaceCategory;
    subtype: string;
    notes: string;
  }>
) {
  const payload: Record<string, unknown> = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  if (typeof updates.name === "string") {
    const trimmed = updates.name.trim();
    if (!trimmed) {
      throw new Error("Storage space name is required.");
    }
    payload.name = trimmed;
  }

  await updateDoc(storageSpaceDoc(storageId), payload);
}

export async function updateStorageSpaceNotes(
  storageId: string,
  notes: string
) {
  await updateDoc(storageSpaceDoc(storageId), {
    notes: notes ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function archiveStorageSpace(storageId: string) {
  const trimmedStorageId = storageId.trim();

  if (!trimmedStorageId) {
    throw new Error("Storage space ID is required.");
  }

  await updateDoc(storageSpaceDoc(trimmedStorageId), {
    isArchived: true,
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function restoreStorageSpace(storageId: string) {
  const trimmedStorageId = storageId.trim();

  if (!trimmedStorageId) {
    throw new Error("Storage space ID is required.");
  }

  await updateDoc(storageSpaceDoc(trimmedStorageId), {
    isArchived: false,
    archivedAt: null,
    updatedAt: serverTimestamp(),
  });
}

export async function getArchivedStorageSpaces(): Promise<StorageSpace[]> {
  const snapshot = await getDocs(storageSpacesCol());

  return snapshot.docs
    .map((d) => ({
      id: d.id,
      ...d.data(),
    }) as StorageSpace)
    .filter((space) => Boolean(space.isArchived));
}

export async function deleteStorageSpace(storageId: string) {
  const trimmedStorageId = storageId.trim();

  if (!trimmedStorageId) {
    throw new Error("Storage space ID is required.");
  }

  if (trimmedStorageId.startsWith("offline-storage-")) {
    await removeOfflineOperation(trimmedStorageId);
    return;
  }

  const relatedCompartmentsQuery = query(
    compartmentsCol(),
    where("vehicleId", "==", trimmedStorageId)
  );

  const relatedItemsByStorageQuery = query(
    inventoryCol(),
    where("vehicleId", "==", trimmedStorageId)
  );

  const [compartmentsSnapshot, itemsByStorageSnapshot] = await Promise.all([
    getDocs(relatedCompartmentsQuery),
    getDocs(relatedItemsByStorageQuery),
  ]);

  const relatedCompartmentIds = new Set(
    compartmentsSnapshot.docs.map((compartmentSnapshot) => compartmentSnapshot.id)
  );

  const itemRefsById = new Map<string, ReturnType<typeof doc>>();

  itemsByStorageSnapshot.docs.forEach((itemSnapshot) => {
    itemRefsById.set(itemSnapshot.id, itemSnapshot.ref as ReturnType<typeof doc>);
  });

  if (relatedCompartmentIds.size > 0) {
    const allItemsSnapshot = await getDocs(inventoryCol());

    allItemsSnapshot.docs.forEach((itemSnapshot) => {
      const item = itemSnapshot.data() as Item;
      const compartmentId = item.compartmentId ?? "";

      if (relatedCompartmentIds.has(compartmentId)) {
        itemRefsById.set(itemSnapshot.id, itemSnapshot.ref as ReturnType<typeof doc>);
      }
    });
  }

  const batch = writeBatch(db);

  itemRefsById.forEach((itemRef) => {
    batch.delete(itemRef);
  });

  compartmentsSnapshot.docs.forEach((compartmentSnapshot) => {
    batch.delete(compartmentSnapshot.ref);
  });

  batch.delete(storageSpaceDoc(trimmedStorageId));

  await batch.commit();
}

export async function createCompartment(
  name: string,
  vehicleId: string,
  room?: {
    roomId?: string;
    roomName?: string;
  }
) {
  const trimmedName = name.trim();
  const trimmedVehicleId = vehicleId.trim();
  const trimmedRoomId = room?.roomId?.trim() ?? "";
  const trimmedRoomName = room?.roomName?.trim() ?? "";

  if (!trimmedName) {
    throw new Error("Compartment name is required.");
  }

  if (!trimmedVehicleId) {
    throw new Error("Vehicle ID is required.");
  }

  const networkState = await Promise.race([
    NetInfo.fetch(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 750)),
  ]);

  const isOnline =
    networkState !== null &&
    networkState.isConnected === true &&
    networkState.isInternetReachable === true;

  if (!isOnline) {
    const userId = getCurrentUserId();
    const offlineId = `offline-compartment-${Date.now()}`;

    await enqueueOfflineOperation({
      id: offlineId,
      type: "createCompartment",
      userId,
      payload: {
        name: trimmedName,
        vehicleId: trimmedVehicleId,
        roomId: trimmedRoomId,
        roomName: trimmedRoomName,
      },
      createdAt: new Date().toISOString(),
    });

    return offlineId;
  }

  const ref = await addDoc(compartmentsCol(), {
    name: trimmedName,
    vehicleId: trimmedVehicleId,
    roomId: trimmedRoomId,
    roomName: trimmedRoomName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateCompartment(
  compartmentId: string,
  updates: Partial<{
    name: string;
    vehicleId: string;
    roomId: string;
    roomName: string;
  }>
) {
  const payload: Record<string, unknown> = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  if (typeof updates.name === "string") {
    const trimmed = updates.name.trim();
    if (!trimmed) {
      throw new Error("Compartment name is required.");
    }
    payload.name = trimmed;
  }

  if (typeof updates.vehicleId === "string") {
    const trimmedVehicleId = updates.vehicleId.trim();
    if (!trimmedVehicleId) {
      throw new Error("Vehicle ID is required.");
    }
    payload.vehicleId = trimmedVehicleId;
  }

  if (typeof updates.roomId === "string") {
    payload.roomId = updates.roomId.trim();
  }

  if (typeof updates.roomName === "string") {
    payload.roomName = updates.roomName.trim();
  }

  await updateDoc(compartmentDoc(compartmentId), payload);
}

export async function moveCompartment(input: {
  compartmentId: string;
  compartmentName: string;
  vehicleId: string;
  vehicleName: string;
  roomId?: string;
  roomName?: string;
}) {
  const trimmedCompartmentId = input.compartmentId.trim();
  const trimmedCompartmentName = input.compartmentName.trim();
  const trimmedVehicleId = input.vehicleId.trim();
  const trimmedVehicleName = input.vehicleName.trim();
  const trimmedRoomId = input.roomId?.trim() ?? "";
  const trimmedRoomName = input.roomName?.trim() ?? "";

  if (!trimmedCompartmentId) {
    throw new Error("Compartment ID is required.");
  }

  if (!trimmedCompartmentName) {
    throw new Error("Compartment name is required.");
  }

  if (!trimmedVehicleId) {
    throw new Error("Storage space ID is required.");
  }

  const relatedItemsQuery = query(
    inventoryCol(),
    where("compartmentId", "==", trimmedCompartmentId)
  );

  const relatedItemsSnapshot = await getDocs(relatedItemsQuery);
  const batch = writeBatch(db);

  batch.update(compartmentDoc(trimmedCompartmentId), {
    vehicleId: trimmedVehicleId,
    roomId: trimmedRoomId,
    roomName: trimmedRoomName,
    updatedAt: serverTimestamp(),
  });

  relatedItemsSnapshot.docs.forEach((itemSnapshot) => {
    batch.update(itemSnapshot.ref, {
      compartmentName: trimmedCompartmentName,
      vehicleId: trimmedVehicleId,
      vehicleName: trimmedVehicleName,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

export async function deleteCompartment(compartmentId: string) {
  const trimmedCompartmentId = compartmentId.trim();

  if (!trimmedCompartmentId) {
    throw new Error("Compartment ID is required.");
  }

  const relatedItemsQuery = query(
    inventoryCol(),
    where("compartmentId", "==", trimmedCompartmentId)
  );

  const relatedItemsSnapshot = await getDocs(relatedItemsQuery);
  const batch = writeBatch(db);

  relatedItemsSnapshot.docs.forEach((itemSnapshot) => {
    batch.delete(itemSnapshot.ref);
  });

  batch.delete(compartmentDoc(trimmedCompartmentId));

  await batch.commit();
}

export async function getAllCompartments(): Promise<Compartment[]> {
  const snapshot = await getDocs(compartmentsCol());

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Compartment[];
}

export async function getCompartmentsByVehicle(
  vehicleId: string
): Promise<Compartment[]> {
  const userId = getCurrentUserId();
  const offlineCompartments = (await getOfflineCompartments(
    userId,
    vehicleId
  )) as Compartment[];

  let remoteCompartments: Compartment[] = [];

  try {
    const q = query(compartmentsCol(), where("vehicleId", "==", vehicleId));
    const snapshot = await withOfflineReadTimeout(getDocs(q));

    remoteCompartments = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Compartment[];
  } catch (error) {
    console.warn("Unable to load remote compartments. Showing offline queue.", error);
  }

  return [...offlineCompartments, ...remoteCompartments];
}

export async function getCompartments(
  vehicleId: string
): Promise<Compartment[]> {
  return getCompartmentsByVehicle(vehicleId);
}

export async function getCompartmentById(
  compartmentId: string
): Promise<Compartment | null> {
  const userId = getCurrentUserId();

  if (compartmentId.startsWith("offline-compartment-")) {
    return (await getOfflineCompartmentById(
      userId,
      compartmentId
    )) as Compartment | null;
  }

  try {
    const snapshot = await withOfflineReadTimeout(getDoc(compartmentDoc(compartmentId)));

    if (!snapshot.exists()) return null;

    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as Compartment;
  } catch (error) {
    console.warn("Unable to load compartment while offline.", error);
    return null;
  }
}

export async function getAllItems(): Promise<Item[]> {
  const userId = getCurrentUserId();
  const offlineItems = (await getOfflineItems(userId)) as Item[];

  let remoteItems: Item[] = [];

  try {
    const snapshot = await withOfflineReadTimeout(getDocs(inventoryCol()));

    remoteItems = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Item[];
  } catch (error) {
    console.warn("Unable to load remote inventory items. Showing offline queue.", error);
  }

  return [...offlineItems, ...remoteItems];
}

export async function getItemsByCompartment(
  compartmentId: string
): Promise<Item[]> {
  const userId = getCurrentUserId();
  const offlineItems = (await getOfflineItemsByCompartment(
    userId,
    compartmentId
  )) as Item[];

  let remoteItems: Item[] = [];

  try {
    const q = query(inventoryCol(), where("compartmentId", "==", compartmentId));
    const snapshot = await withOfflineReadTimeout(getDocs(q));

    remoteItems = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Item[];
  } catch (error) {
    console.warn("Unable to load remote items. Showing offline queue.", error);
  }

  return [...offlineItems, ...remoteItems];
}

export async function getItemsByStatus(
  status: ItemStatus | string
): Promise<Item[]> {
  const normalizedStatus =
    String(status).toLowerCase().trim() === "packed" ? "packed" : "missing";

  const userId = getCurrentUserId();
  const offlineItems = (await getOfflineItemsByStatus(
    userId,
    normalizedStatus
  )) as Item[];

  let remoteItems: Item[] = [];

  try {
    const q = query(inventoryCol(), where("status", "==", normalizedStatus));
    const snapshot = await withOfflineReadTimeout(getDocs(q));

    remoteItems = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Item[];
  } catch (error) {
    console.warn("Unable to load remote items by status. Showing offline queue.", error);
  }

  return [...offlineItems, ...remoteItems];
}

export async function createItem(input: {
  name: string;
  quantity?: number;
  status?: ItemStatus;
  compartmentId?: string;
  compartmentName?: string;
  vehicleId?: string;
  vehicleName?: string;
  notes?: string;
  source?: string;
  itemPhotoUri?: string;
}) {
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("Item name is required.");

  const payload = {
    name: trimmed,
    quantity: Math.max(1, Number(input.quantity ?? 1)),
    status: input.status ?? "missing",
    compartmentId: input.compartmentId ?? "",
    compartmentName: input.compartmentName ?? "",
    vehicleId: input.vehicleId ?? "",
    vehicleName: input.vehicleName ?? "",
    notes: input.notes ?? "",
    source: input.source ?? "manual",
    itemPhotoUri: input.itemPhotoUri ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const networkState = await Promise.race([
    NetInfo.fetch(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 750)),
  ]);

  const isOnline =
    networkState !== null &&
    networkState.isConnected === true &&
    networkState.isInternetReachable === true;

  if (!isOnline) {
    const userId = getCurrentUserId();
    const offlineId = `offline-item-${Date.now()}`;

    await enqueueOfflineOperation({
      id: offlineId,
      type: "createItem",
      userId,
      payload,
      createdAt: new Date().toISOString(),
    });

    return offlineId;
  }

  const ref = await addDoc(inventoryCol(), payload);
  return ref.id;
}

export async function updateItem(
  id: string,
  updates: Partial<{
    name: string;
    quantity: number;
    status: ItemStatus;
    compartmentId: string;
    compartmentName: string;
    vehicleId: string;
    vehicleName: string;
    notes: string;
    source: string;
    itemPhotoUri: string;
  }>
) {
  const payload: Record<string, unknown> = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  if (typeof updates.name === "string") {
    const trimmed = updates.name.trim();
    if (!trimmed) throw new Error("Item name is required.");
    payload.name = trimmed;
  }

  if (typeof updates.quantity === "number") {
    payload.quantity = Math.max(1, Number(updates.quantity));
  }

  if (id.startsWith("offline-item-")) {
    await updateOfflineCreatedItem(id, updates);
    return;
  }

  await updateDoc(inventoryDoc(id), payload);
}

export async function updateItemPhoto(id: string, itemPhotoUri: string) {
  await updateItem(id, {
    itemPhotoUri: itemPhotoUri ?? "",
  });
}

export async function deleteItem(id: string) {
  await deleteDoc(inventoryDoc(id));
}

export async function createOrUpdateInventoryItemFromChecklist(
  item: {
    name: string;
    quantity: number;
  },
  compartment: {
    id: string;
    name: string;
    vehicleId: string;
  }
) {
  const allItems = await getAllItems();

  const existing = allItems.find(
    (existingItem) =>
      normalizeName(existingItem.name) === normalizeName(item.name) &&
      existingItem.compartmentId === compartment.id
  );

  if (existing) {
    await updateItem(existing.id, {
      quantity:
        Math.max(1, Number(existing.quantity ?? 1)) +
        Math.max(1, Number(item.quantity ?? 1)),
      status: existing.status ?? "missing",
      compartmentId: compartment.id,
      compartmentName: compartment.name,
      vehicleId: compartment.vehicleId,
      source: "checklist",
    });

    return existing.id;
  }

  return createItem({
    name: item.name,
    quantity: item.quantity ?? 1,
    status: "missing",
    compartmentId: compartment.id,
    compartmentName: compartment.name,
    vehicleId: compartment.vehicleId,
    source: "checklist",
  });
}

export async function removeOrDecrementInventoryItemFromChecklist(
  item: {
    name: string;
    quantity: number;
  },
  compartmentId: string
) {
  const allItems = await getAllItems();

  const existing = allItems.find(
    (existingItem) =>
      normalizeName(existingItem.name) === normalizeName(item.name) &&
      existingItem.compartmentId === compartmentId
  );

  if (!existing) return;

  const currentQuantity = Math.max(1, Number(existing.quantity ?? 1));
  const removalQuantity = Math.max(1, Number(item.quantity ?? 1));
  const nextQuantity = currentQuantity - removalQuantity;

  if (nextQuantity <= 0) {
    await deleteItem(existing.id);
    return;
  }

  await updateItem(existing.id, {
    quantity: nextQuantity,
  });
}

export async function syncInventoryItemStatusFromChecklist(
  item: {
    name: string;
    quantity: number;
    packed: boolean;
    compartmentId?: string;
    compartmentName?: string;
    vehicleId?: string;
  }
) {
  const allItems = await getAllItems();

  const matches = allItems.filter((existingItem) => {
    const sameName =
      normalizeName(existingItem.name) === normalizeName(item.name);

    const sameCompartmentId =
      !!item.compartmentId && existingItem.compartmentId === item.compartmentId;

    const sameCompartmentName =
      !!item.compartmentName &&
      existingItem.compartmentName === item.compartmentName;

    return sameName && (sameCompartmentId || sameCompartmentName);
  });

  if (matches.length > 0) {
    await Promise.all(
      matches.map((existing) =>
        updateItem(existing.id, {
          status: item.packed ? "packed" : "missing",
        })
      )
    );
    return;
  }

  if (!item.compartmentId) return;

  const compartment = await getCompartmentById(item.compartmentId);
  if (!compartment) return;

  await createItem({
    name: item.name,
    quantity: item.quantity ?? 1,
    status: item.packed ? "packed" : "missing",
    compartmentId: compartment.id,
    compartmentName: compartment.name,
    vehicleId: item.vehicleId ?? compartment.vehicleId,
    source: "checklist",
  });
}

export async function searchItemsForUser(
  userId: string,
  searchTerm: string
): Promise<
  Array<{
    id: string;
    name: string;
    compartmentId: string;
    compartmentName: string;
    vehicleId: string;
    vehicleName: string;
    missing?: boolean;
    packed?: boolean;
  }>
> {
  const snapshot = await getDocs(
    collection(db, "users", userId, "inventoryItems")
  );

  const term = searchTerm.trim().toLowerCase();
  if (!term) return [];

  const allItems = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Item[];

  const storageSnapshot = await getDocs(
    collection(db, "users", userId, "storageSpaces")
  );

  const storageSpaces = storageSnapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as StorageSpace[];

  const vehicleNameById = new Map(storageSpaces.map((s) => [s.id, s.name]));

  return allItems
    .filter((item) => normalizeName(item.name).includes(term))
    .map((item) => ({
      id: item.id,
      name: item.name,
      compartmentId: item.compartmentId ?? "",
      compartmentName: item.compartmentName ?? "",
      vehicleId: item.vehicleId ?? "",
      vehicleName:
        item.vehicleName ||
        vehicleNameById.get(item.vehicleId ?? "") ||
        "Unknown",
      missing: item.status === "missing",
      packed: item.status === "packed",
    }));
}

const gearService = {
  getStorageSpaces,
  getStorageSpaceById,
  getRoomsByStorageSpace,
  getRoomById,
  createStorageSpace,
  updateStorageSpace,
  updateStorageSpaceNotes,
  deleteStorageSpace,
  createCompartment,
  updateCompartment,
  deleteCompartment,
  getAllCompartments,
  getCompartmentsByVehicle,
  getCompartments,
  getCompartmentById,
  getAllItems,
  getItemsByCompartment,
  getItemsByStatus,
  createItem,
  updateItem,
  updateItemPhoto,
  deleteItem,
  createOrUpdateInventoryItemFromChecklist,
  removeOrDecrementInventoryItemFromChecklist,
  syncInventoryItemStatusFromChecklist,
  searchItemsForUser,
};

export default gearService;