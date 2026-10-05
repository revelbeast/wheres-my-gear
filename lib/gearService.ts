import { suppressSiriGearItem, releaseSiriGearItem } from "./siriGearCache";
import NetInfo from "@react-native-community/netinfo";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  query,
  serverTimestamp,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db, storage } from "../firebaseConfig";
import { cleanupOldCloudPhotosInFolder, deleteCloudPhotoByStoragePath } from "./cloudPhotoStorage";
import { downloadPhotoToLocalDocumentStorage, localPhotoExists } from "./localPhotoStorage";
import { cacheCompartments, cacheInventoryItems, cacheRooms, cacheStorageSpaces, cancelOfflineCreatedItem, enqueueOfflineOperation, getCachedCompartments, getCachedInventoryItems, getCachedInventoryItemsByCompartment, getCachedInventoryItemsByStatus, getCachedRooms, getCachedStorageSpaces, getOfflineCompartments, getOfflineCompartmentById, getOfflineItems, getOfflineItemsByCompartment, getOfflineItemsByStatus, getOfflineStorageSpaces, getOfflineQueue, projectInventoryItems, removeOfflineOperation, updateOfflineCreatedItem } from "./offlineQueue";

export type ItemStatus = "packed" | "missing";
export type StorageSpaceCategory = "storage" | "office" | "vehicle";
let offlineItemSequence = 0;

async function applyInventoryProjection(userId: string, items: Item[], deleted = false) {
  const projected = typeof projectInventoryItems === "function"
    ? ((await projectInventoryItems(userId, items)) as Item[])
    : items;
  return projected.filter(item => (item.isDeleted === true) === deleted);
}

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

export type DeletedLocation = Partial<Record<
  "vehicleId" | "vehicleName" | "roomId" | "roomName" | "compartmentId" | "compartmentName",
  string
>>;

export type Item = {
  isDeleted?: boolean;
  deletedAt?: unknown;
  deletedLocation?: DeletedLocation | null;
  roomId?: string;
  roomName?: string;
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
  barcode?: string;
  barcodeType?: string;
  itemPhotoUri?: string;
  itemPhotoStoragePath?: string;
  itemPhotoDownloadUrl?: string;
  photoBackedUp?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};


async function recoverMissingLocalItemPhoto(item: Item): Promise<Item> {
  const localUri = item.itemPhotoUri?.trim() ?? "";
  const downloadUrl = item.itemPhotoDownloadUrl?.trim() ?? "";

  if (!downloadUrl) {
    return item;
  }

  if (localUri && (await localPhotoExists(localUri))) {
    return item;
  }

  try {
    const recoveredLocalUri = await downloadPhotoToLocalDocumentStorage(
      downloadUrl,
      `item-${item.id}`
    );

    if (!recoveredLocalUri) {
      return item;
    }

    try {
      await updateDoc(inventoryDoc(item.id), {
        itemPhotoUri: recoveredLocalUri,
        updatedAt: serverTimestamp(),
      });
    } catch (updateErr) {
      console.warn("Recovered item photo locally but could not update Firestore URI.", updateErr);
    }

    return {
      ...item,
      itemPhotoUri: recoveredLocalUri,
    };
  } catch (err) {
    console.warn("Unable to recover missing local item photo.", err);
    return item;
  }
}

async function recoverMissingLocalItemPhotos(items: Item[]): Promise<Item[]> {
  return Promise.all(items.map((item) => recoverMissingLocalItemPhoto(item)));
}

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

function compareNaturalNames(a: string, b: string) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function sortCompartmentsByName(compartments: Compartment[]) {
  return [...compartments].sort((a, b) =>
    compareNaturalNames(a.name ?? "", b.name ?? "")
  );
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

  const networkState = await NetInfo.fetch();
  if (networkState.isConnected !== true || networkState.isInternetReachable === false) {
    return [...offlineSpaces, ...(await getCachedStorageSpaces(userId) as StorageSpace[])];
  }

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
    console.warn("Unable to load storage space while offline. Checking cached spaces.", error);

    const cachedSpaces = (await getCachedStorageSpaces(userId)) as StorageSpace[];
    return cachedSpaces.find((space) => space.id === storageId) ?? null;
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

    const rooms = snapshot.docs
      .map((d) => ({
        id: d.id,
        ...d.data(),
      }) as Room)
      .filter((room) => !room.isArchived);

    await cacheRooms(getCurrentUserId(), trimmedStorageSpaceId, rooms);

    return rooms;
  } catch (error) {
    console.warn("Unable to load rooms for storage space. Showing cached rooms.", error);

    return (await getCachedRooms(
      getCurrentUserId(),
      trimmedStorageSpaceId
    )) as Room[];
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

export async function getArchivedRooms(): Promise<Room[]> {
  const snapshot = await getDocs(roomsCol());

  return snapshot.docs
    .map((d) => ({
      id: d.id,
      ...d.data(),
    }) as Room)
    .filter((room) => Boolean(room.isArchived));
}

export class ParentDeletionError extends Error {
  constructor(public code: "CONNECT_REQUIRED" | "SYNC_REQUIRED" | "DELETE_TOO_LARGE") {
    super(code === "CONNECT_REQUIRED" ? "Connect to delete this location."
      : code === "SYNC_REQUIRED" ? "Let pending inventory changes finish syncing before deleting this location."
      : "This location is too large to delete safely in one operation.");
    this.name = "ParentDeletionError";
  }
}

async function requireNoPendingInventory(userId: string) {
  const pending = await getOfflineQueue();
  // Updates can move an item across parents; refuse conservatively rather than guess ownership.
  if (pending.some(operation => operation.userId === userId &&
    ["createItem", "updateInventoryItem", "deleteInventoryItem"].includes(operation.type))) {
    throw new ParentDeletionError("SYNC_REQUIRED");
  }
}

async function deleteInventoryParent(kind: "storageSpaces" | "compartments", parentId: string) {
  const uid = getCurrentUserId();
  const network = await NetInfo.fetch();
  if (network.isConnected !== true || network.isInternetReachable !== true) throw new ParentDeletionError("CONNECT_REQUIRED");
  await requireNoPendingInventory(uid);
  const parentRef = doc(db, "users", uid, kind, parentId);
  const compartments = kind === "storageSpaces"
    ? (await getDocsFromServer(query(collection(db, "users", uid, "compartments"), where("vehicleId", "==", parentId)))).docs
    : [];
  const compartmentIds = new Set(compartments.map(compartment => compartment.id));
  // Server discovery is followed by transaction reads; query-time deletion state is never trusted.
  const inventory = await getDocsFromServer(kind === "storageSpaces"
    ? collection(db, "users", uid, "inventoryItems")
    : query(collection(db, "users", uid, "inventoryItems"), where("compartmentId", "==", parentId)));
  const candidates = inventory.docs.filter(snapshot => {
    const item = snapshot.data();
    return kind === "compartments" || item.vehicleId === parentId || compartmentIds.has(item.compartmentId);
  });
  if (candidates.length + compartments.length + 1 > 500) throw new ParentDeletionError("DELETE_TOO_LARGE");
  await runTransaction(db, async transaction => {
    if (auth.currentUser?.uid !== uid) throw new Error("Authentication changed. Please try again.");
    await transaction.get(parentRef);
    const currentCompartments = await Promise.all(compartments.map(compartment => transaction.get(compartment.ref)));
    const currentIds = new Set(currentCompartments.filter(snapshot => snapshot.exists() && snapshot.data().vehicleId === parentId).map(snapshot => snapshot.id));
    const currentItems = await Promise.all(candidates.map(item => transaction.get(item.ref)));
    await requireNoPendingInventory(uid);
    for (const snapshot of currentItems) {
      if (!snapshot.exists()) continue;
      const item = snapshot.data();
      const stillAssociated = kind === "storageSpaces"
        ? item.vehicleId === parentId || currentIds.has(item.compartmentId)
        : item.compartmentId === parentId;
      if (stillAssociated && item.isDeleted !== true) transaction.delete(snapshot.ref);
    }
    for (const snapshot of currentCompartments) {
      if (snapshot.exists() && currentIds.has(snapshot.id)) transaction.delete(snapshot.ref);
    }
    transaction.delete(parentRef);
  });
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

  await deleteInventoryParent("storageSpaces", trimmedStorageId);

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

export class CompartmentMoveError extends Error {
  constructor(public code: "CONNECT_REQUIRED" | "MOVE_TOO_LARGE") {
    super(code === "CONNECT_REQUIRED" ? "Connect to move this compartment."
      : "This compartment is too large to move safely in one operation.");
    this.name = "CompartmentMoveError";
  }
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

  const uid = getCurrentUserId();
  const network = await NetInfo.fetch();
  if (network.isConnected !== true || network.isInternetReachable !== true) {
    throw new CompartmentMoveError("CONNECT_REQUIRED");
  }
  await requireNoPendingInventory(uid);
  const ref = doc(db, "users", uid, "compartments", trimmedCompartmentId);
  const candidates = (await getDocsFromServer(query(
    collection(db, "users", uid, "inventoryItems"),
    where("compartmentId", "==", trimmedCompartmentId)
  ))).docs;
  if (candidates.length + 1 > 500) throw new CompartmentMoveError("MOVE_TOO_LARGE");

  await runTransaction(db, async transaction => {
    if (auth.currentUser?.uid !== uid) throw new Error("Authentication changed. Please try again.");
    const compartment = await transaction.get(ref);
    if (!compartment.exists()) throw new Error("Compartment no longer exists.");
    const items = await Promise.all(candidates.map(item => transaction.get(item.ref)));
    await requireNoPendingInventory(uid);
    transaction.update(ref, {
      vehicleId: trimmedVehicleId,
      roomId: trimmedRoomId,
      roomName: trimmedRoomName,
      updatedAt: serverTimestamp(),
    });
    for (const snapshot of items) {
      if (!snapshot.exists()) continue;
      const item = snapshot.data();
      if (item.isDeleted === true || item.compartmentId !== trimmedCompartmentId) continue;
      transaction.update(snapshot.ref, {
        compartmentName: trimmedCompartmentName,
        vehicleId: trimmedVehicleId,
        vehicleName: trimmedVehicleName,
        updatedAt: serverTimestamp(),
      });
    }
  });
}

export async function deleteCompartment(compartmentId: string) {
  const trimmedCompartmentId = compartmentId.trim();

  if (!trimmedCompartmentId) {
    throw new Error("Compartment ID is required.");
  }

  await deleteInventoryParent("compartments", trimmedCompartmentId);

}

export async function getAllCompartments(): Promise<Compartment[]> {
  const userId = getCurrentUserId();
  const networkState = await NetInfo.fetch();
  if (networkState.isConnected !== true || networkState.isInternetReachable === false) {
    const spaces = (await getCachedStorageSpaces(userId)) as StorageSpace[];
    const cached = (await Promise.all(spaces.map((space) => getCachedCompartments(userId, space.id)))).flat() as Compartment[];
    return sortCompartmentsByName(cached);
  }
  const snapshot = await getDocs(compartmentsCol());

  const compartments = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Compartment[];

  return sortCompartmentsByName(compartments);
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

    await cacheCompartments(userId, vehicleId, remoteCompartments);
  } catch (error) {
    console.warn("Unable to load remote compartments. Showing cached compartments.", error);

    const cachedCompartments = (await getCachedCompartments(
      userId,
      vehicleId
    )) as Compartment[];

    remoteCompartments = cachedCompartments;
  }

  return sortCompartmentsByName([...offlineCompartments, ...remoteCompartments]);
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
    console.warn("Unable to load compartment remotely. Checking offline cache.", error);

    const cachedCompartment = (await getOfflineCompartmentById(
      userId,
      compartmentId
    )) as Compartment | null;

    if (cachedCompartment) {
      return cachedCompartment;
    }

    return null;
  }
}

async function getProjectedInventory(deleted: boolean): Promise<Item[]> {
  const userId = getCurrentUserId();
  let remoteItems: Item[] = [];

  try {
    const snapshot = await withOfflineReadTimeout(getDocs(inventoryCol()));

    remoteItems = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Item[];

    await cacheInventoryItems(userId, remoteItems);
  } catch (error) {
    console.warn("Unable to load remote inventory items. Showing cached inventory.", error);
    remoteItems = (await getCachedInventoryItems(userId)) as Item[];
  }

  return applyInventoryProjection(userId, remoteItems, deleted);
}

export async function getDeletedItems(): Promise<Item[]> {
  return getProjectedInventory(true);
}

export async function getAllItems(options: { recoverPhotos?: boolean } = {}): Promise<Item[]> {
  const items = await getProjectedInventory(false);
  // Advisory review must not download or update existing inventory photos.
  return options.recoverPhotos === false ? items : recoverMissingLocalItemPhotos(items);
}

export async function getItemsByCompartment(
  compartmentId: string,
  options: { recoverPhotos?: boolean } = {}
): Promise<Item[]> {
  const userId = getCurrentUserId();
  let remoteItems: Item[] = [];

  try {
    const q = query(inventoryCol(), where("compartmentId", "==", compartmentId));
    const snapshot = await withOfflineReadTimeout(getDocs(q));

    remoteItems = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Item[];

    const cachedItems = (await getCachedInventoryItems(userId)) as Item[];
    const remainingCachedItems = cachedItems.filter(
      (item) => item.compartmentId !== compartmentId
    );

    await cacheInventoryItems(userId, [...remainingCachedItems, ...remoteItems]);
  } catch (error) {
    console.warn("Unable to load remote items. Showing cached inventory.", error);
    remoteItems = (await getCachedInventoryItemsByCompartment(
      userId,
      compartmentId
    )) as Item[];
  }

  const cachedAll = (await getCachedInventoryItems(userId)) as Item[];
  const byId = new Map([...cachedAll, ...remoteItems].map(item => [item.id, item]));
  const items = await applyInventoryProjection(userId, [...byId.values()] as Item[]);
  const compartmentItems = items.filter(item => item.compartmentId === compartmentId);
  return options.recoverPhotos === false ? compartmentItems : recoverMissingLocalItemPhotos(compartmentItems);
}

export async function getItemsByStatus(
  status: ItemStatus | string
): Promise<Item[]> {
  const normalizedStatus =
    String(status).toLowerCase().trim() === "packed" ? "packed" : "missing";

  const userId = getCurrentUserId();
  let remoteItems: Item[] = [];

  try {
    const q = query(inventoryCol(), where("status", "==", normalizedStatus));
    const snapshot = await withOfflineReadTimeout(getDocs(q));

    remoteItems = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Item[];
  } catch (error) {
    console.warn("Unable to load remote items by status. Showing cached inventory.", error);
    remoteItems = (await getCachedInventoryItemsByStatus(
      userId,
      normalizedStatus
    )) as Item[];
  }

  return recoverMissingLocalItemPhotos(
    (await applyInventoryProjection(userId, [...new Map([...(await getCachedInventoryItems(userId) as Item[]), ...remoteItems].map(item => [item.id, item])).values()] as Item[])).filter(item => item.status === normalizedStatus)
  );
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
  barcode?: string;
  barcodeType?: string;
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
    ...(input.barcode ? { barcode: input.barcode } : {}),
    ...(input.barcodeType ? { barcodeType: input.barcodeType } : {}),
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
    const offlineId = `offline-item-${Date.now()}-${offlineItemSequence++}`;

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
    isDeleted: boolean;
    deletedAt: string;
    deletedLocation: DeletedLocation;
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

  const photoFields = ["itemPhotoUri", "itemPhotoStoragePath", "itemPhotoDownloadUrl", "photoBackedUp"];
  const hasPhotoUpdate = Object.keys(updates).some((key) => photoFields.includes(key));
  if (!hasPhotoUpdate) {
    const networkState = await Promise.race([
      NetInfo.fetch(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 750)),
    ]);
    const isOnline = networkState?.isConnected === true && networkState?.isInternetReachable === true;
    if (!isOnline) {
      const userId = getCurrentUserId();
      await enqueueOfflineOperation({
        id: `offline-update-item-${id}-${Date.now()}`,
        type: "updateInventoryItem",
        userId,
        payload: { itemId: id, updates },
        createdAt: new Date().toISOString(),
      });
      const cachedItems = (await getCachedInventoryItems(userId)) as Item[];
      if (cachedItems.some((item) => item.id === id)) {
        await cacheInventoryItems(
          userId,
          cachedItems.map((item) => item.id === id ? { ...item, ...updates } : item)
        );
      }
      return;
    }
  }

  await updateDoc(inventoryDoc(id), payload);
}

export async function updateItemPhoto(
  id: string,
  itemPhotoUri: string,
  cloudPhoto?: {
    itemPhotoStoragePath?: string;
    itemPhotoDownloadUrl?: string;
    photoBackedUp?: boolean;
  }
) {
  let previousStoragePath = "";

  if (!id.startsWith("offline-item-")) {
    try {
      const existingSnap = await getDoc(inventoryDoc(id));
      const existingData = existingSnap.exists() ? existingSnap.data() : null;
      previousStoragePath =
        typeof existingData?.itemPhotoStoragePath === "string"
          ? existingData.itemPhotoStoragePath
          : "";
    } catch (err) {
      console.warn("Unable to read previous item photo before update.", err);
    }
  }

  const nextStoragePath = cloudPhoto?.itemPhotoStoragePath ?? "";

  await updateItem(id, {
    itemPhotoUri: itemPhotoUri ?? "",
    itemPhotoStoragePath: nextStoragePath,
    itemPhotoDownloadUrl: cloudPhoto?.itemPhotoDownloadUrl ?? "",
    photoBackedUp: cloudPhoto?.photoBackedUp ?? false,
  } as Partial<{
    itemPhotoUri: string;
    itemPhotoStoragePath: string;
    itemPhotoDownloadUrl: string;
    photoBackedUp: boolean;
  }>);

  if (previousStoragePath && previousStoragePath !== nextStoragePath) {
    await deleteCloudPhotoByStoragePath(previousStoragePath);
  }

  if (nextStoragePath) {
    const folderPath = nextStoragePath.split("/").slice(0, -1).join("/");
    await cleanupOldCloudPhotosInFolder({
      folderPath,
      keepStoragePath: nextStoragePath,
    });
  }
}

/** User removal only. Internal checklist removal continues to use deleteItem. */
export async function softDeleteItem(id: string) {
  const userId = getCurrentUserId();
  if (id.startsWith("offline-item-")) {
    await cancelOfflineCreatedItem(id);
    return;
  }
  // Read the projected location, including pending moves, without recovering photos.
  const existing = (await getAllItems({ recoverPhotos: false })).find(item => item.id === id);
  if (!existing) {
    await suppressSiriGearItem(userId, id);
    return;
  }
  const deletedLocation: DeletedLocation = {};
  for (const key of ["vehicleId", "vehicleName", "roomId", "roomName", "compartmentId", "compartmentName"] as const) {
    if (typeof existing[key] === "string") deletedLocation[key] = existing[key];
  }
  const deletion = { isDeleted: true, deletedAt: new Date().toISOString(), deletedLocation };
  await updateItem(id, deletion);
  await suppressSiriGearItem(userId, id);
  // Retain raw records so offline active and deleted views can both reconstruct state.
  const cached = (await getCachedInventoryItems(userId)) as Item[];
  await cacheInventoryItems(userId, cached.map(item => item.id === id
    ? { ...item, ...deletion } : item));
}

export type RestoreErrorCode = "UNAUTHENTICATED" | "INVALID_ITEM_ID" | "CONNECT_REQUIRED" | "SYNC_REQUIRED" | "ITEM_NOT_FOUND" | "NOT_DELETED" | "NEW_DESTINATION_REQUIRED";

export class RestoreItemError extends Error {
  constructor(public code: RestoreErrorCode) {
    super(code);
    this.name = "RestoreItemError";
  }
}

export type RestoreDestination = {
  vehicleId: string;
  compartmentId: string;
  roomId: string | null;
};

/** Online-only: transactions never fall back to the offline inventory queue. */
export async function restoreDeletedItem(itemId: string, destination?: RestoreDestination): Promise<{ cacheUpdated: boolean; siriCacheUpdated: boolean }> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new RestoreItemError("UNAUTHENTICATED");
  const validId = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0 && !value.includes("/");
  if (!validId(itemId) || itemId.startsWith("offline-item-")) throw new RestoreItemError("INVALID_ITEM_ID");
  const state = await NetInfo.fetch();
  if (state.isConnected !== true || state.isInternetReachable !== true) throw new RestoreItemError("CONNECT_REQUIRED");
  const pending = await getOfflineQueue();
  if (pending.some(op => op.userId === uid &&
    (op.type === "updateInventoryItem" || op.type === "deleteInventoryItem") && op.payload.itemId === itemId)) {
    throw new RestoreItemError("SYNC_REQUIRED");
  }
  const ref = doc(db, "users", uid, "inventoryItems", itemId);
  const restored = await runTransaction(db, async transaction => {
    if (auth.currentUser?.uid !== uid) throw new RestoreItemError("UNAUTHENTICATED");
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new RestoreItemError("ITEM_NOT_FOUND");
    const item = snapshot.data() as Item;
    if (item.isDeleted !== true) throw new RestoreItemError("NOT_DELETED");
    const location = destination ?? item.deletedLocation;
    const invalid = () => { throw new RestoreItemError("NEW_DESTINATION_REQUIRED"); };
    if (!location || !validId(location.vehicleId) || !validId(location.compartmentId)) return invalid();
    const storage = await transaction.get(doc(db, "users", uid, "storageSpaces", location.vehicleId));
    const compartment = await transaction.get(doc(db, "users", uid, "compartments", location.compartmentId));
    if (!storage.exists() || storage.data().isArchived || !compartment.exists()) return invalid();
    const compartmentData = compartment.data();
    if (compartmentData.vehicleId !== location.vehicleId || compartmentData.isArchived) return invalid();
    const originalRoomId = location.roomId;
    const currentRoomId = compartmentData.roomId;
    if (destination) {
      if (destination.roomId !== null && !validId(destination.roomId)) return invalid();
      if (destination.roomId !== (currentRoomId || null)) return invalid();
    } else if (originalRoomId && (!validId(originalRoomId) || originalRoomId !== currentRoomId)) return invalid();
    let currentRoomName = "";
    // A room name cannot supply an ID. Validate the current parent if no room ID was captured.
    if (currentRoomId) {
      if (!validId(currentRoomId)) return invalid();
      const room = await transaction.get(doc(db, "users", uid, "rooms", currentRoomId));
      if (!room.exists() || room.data().isArchived || room.data().storageSpaceId !== location.vehicleId) return invalid();
      currentRoomName = typeof room.data().name === "string" ? room.data().name : "";
    }
    const updates = {
      isDeleted: false, deletedAt: null, deletedLocation: null,
      vehicleId: location.vehicleId, compartmentId: location.compartmentId,
      ...(destination ? {
        vehicleName: typeof storage.data().name === "string" ? storage.data().name : "",
        compartmentName: typeof compartmentData.name === "string" ? compartmentData.name : "",
        roomId: currentRoomId || "",
        roomName: currentRoomName,
      } : {}),
      updatedAt: serverTimestamp(),
    };
    transaction.update(ref, updates);
    return { ...item, ...updates, id: itemId } as Item;
  });
  let siriUpdated = true;
  try {
    await releaseSiriGearItem(uid, itemId);
  } catch (error) {
    siriUpdated = false;
    console.warn("Inventory restored; Siri suppression release failed. A later retry is required.", error);
  }
  try {
    const cached = (await getCachedInventoryItems(uid)) as Item[];
    const reconciled = { ...restored, updatedAt: new Date().toISOString() };
    await cacheInventoryItems(uid, cached.some(item => item.id === itemId)
      ? cached.map(item => item.id === itemId ? reconciled : item)
      : [...cached, reconciled]);
    return { cacheUpdated: true, siriCacheUpdated: siriUpdated };
  } catch (error) {
    console.warn("Inventory restored on server; local cache refresh failed.", error);
    return { cacheUpdated: false, siriCacheUpdated: siriUpdated };
  }
}

export type PermanentDeleteErrorCode = "UNAUTHENTICATED" | "INVALID_ITEM_ID" | "CONNECT_REQUIRED" | "SYNC_REQUIRED" | "ITEM_NOT_FOUND" | "NOT_DELETED";

export class PermanentDeleteItemError extends Error {
  constructor(public code: PermanentDeleteErrorCode) {
    super(code);
    this.name = "PermanentDeleteItemError";
  }
}

// Comparison only: matching references never authorizes Storage or filesystem deletion.
function inventoryPhotoReferences(item: Item): Set<string> {
  const result = new Set<string>();
  const path = item.itemPhotoStoragePath;
  if (typeof path === "string" && path.trim()) {
    const bucket = storage?.app.options.storageBucket;
    if (!bucket || path.includes("://") || path.startsWith("/")) return result;
    result.add(`object:${bucket}/${path}`);
  }
  for (const value of [item.itemPhotoUri, item.itemPhotoDownloadUrl]) {
    if (value == null || value === "") continue;
    if (typeof value !== "string") return new Set();
    // Local copies cannot establish cloud ownership, but may accompany a cloud reference.
    if (/^(file:|content:)/.test(value)) continue;
    try {
      const url = new URL(value);
      const match = url.protocol === "https:" && url.hostname === "firebasestorage.googleapis.com"
        ? url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/) : null;
      if (!match) return new Set();
      result.add(`object:${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}`);
    } catch { return new Set(); }
  }
  // Conflicting fields are not a reliable canonical identity.
  return result.size === 1 ? result : new Set();
}

/** Trash-only, online-only deletion. Phase 4A intentionally never deletes photo files. */
export async function permanentlyDeleteDeletedItem(itemId: string): Promise<{
  itemDeleted: true;
  cacheUpdated: boolean;
  photoCleanup: "complete" | "retained_shared" | "retained_unverified";
}> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new PermanentDeleteItemError("UNAUTHENTICATED");
  if (typeof itemId !== "string" || !itemId.trim() || itemId !== itemId.trim() ||
    itemId.includes("/") || itemId === "." || itemId === ".." || itemId.startsWith("offline-")) {
    throw new PermanentDeleteItemError("INVALID_ITEM_ID");
  }
  const assertAccount = () => {
    if (auth.currentUser?.uid !== uid) throw new PermanentDeleteItemError("UNAUTHENTICATED");
  };
  const assertNoPending = async () => {
    const pending = await getOfflineQueue();
    if (pending.some(op => op.userId === uid && ["createItem", "updateInventoryItem", "deleteInventoryItem"].includes(op.type))) {
      throw new PermanentDeleteItemError("SYNC_REQUIRED");
    }
  };
  const network = await NetInfo.fetch();
  if (network.isConnected !== true || network.isInternetReachable !== true) throw new PermanentDeleteItemError("CONNECT_REQUIRED");
  await assertNoPending();
  assertAccount();
  // Raw server records include both active and Trash items, with no recovery or cache fallback.
  const inventory = await getDocsFromServer(collection(db, "users", uid, "inventoryItems"));
  const target = doc(db, "users", uid, "inventoryItems", itemId);
  const deleted = await runTransaction(db, async transaction => {
    assertAccount();
    const snapshot = await transaction.get(target);
    if (!snapshot.exists()) throw new PermanentDeleteItemError("ITEM_NOT_FOUND");
    const item = snapshot.data() as Item;
    if (item.isDeleted !== true) throw new PermanentDeleteItemError("NOT_DELETED");
    await assertNoPending();
    assertAccount();
    transaction.delete(target);
    return item;
  });
  const references = inventoryPhotoReferences(deleted);
  const shared = inventory.docs.some(snapshot => snapshot.id !== itemId &&
    [...inventoryPhotoReferences(snapshot.data() as Item)].some(value => references.has(value)));
  const hasPhoto = [deleted.itemPhotoUri, deleted.itemPhotoStoragePath, deleted.itemPhotoDownloadUrl]
    .some(value => value != null && value !== "");
  const photoCleanup = shared ? "retained_shared" : hasPhoto ? "retained_unverified" : "complete";
  try {
    const cached = (await getCachedInventoryItems(uid)) as Item[];
    await cacheInventoryItems(uid, cached.filter(item => item.id !== itemId));
    return { itemDeleted: true, cacheUpdated: true, photoCleanup };
  } catch (error) {
    console.warn("Inventory permanently deleted on server; local cache refresh failed.", error);
    return { itemDeleted: true, cacheUpdated: false, photoCleanup };
  }
}

/** Sequential orchestration; every target still passes the Phase 4A transaction. */
export async function emptyDeletedItems(): Promise<{
  deletedCount: number;
  remainingItems: Item[] | null;
  failureCode: string | null;
  cacheUpdated: boolean;
}> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new PermanentDeleteItemError("UNAUTHENTICATED");
  const assertAccount = () => {
    if (auth.currentUser?.uid !== uid) throw new PermanentDeleteItemError("UNAUTHENTICATED");
  };
  const network = await NetInfo.fetch();
  if (network.isConnected !== true || network.isInternetReachable !== true) throw new PermanentDeleteItemError("CONNECT_REQUIRED");
  const pending = await getOfflineQueue();
  if (pending.some(op => op.userId === uid && ["createItem", "updateInventoryItem", "deleteInventoryItem"].includes(op.type))) {
    throw new PermanentDeleteItemError("SYNC_REQUIRED");
  }
  const readTrash = async () => {
    assertAccount();
    const snapshot = await getDocsFromServer(collection(db, "users", uid, "inventoryItems"));
    assertAccount();
    return snapshot.docs.filter(item => item.data().isDeleted === true)
      .map(item => ({ ...item.data(), id: item.id } as Item));
  };
  const targets = await readTrash();
  let deletedCount = 0;
  let cacheUpdated = true;
  let failureCode: string | null = null;
  for (const item of targets) {
    try {
      assertAccount();
      const result = await permanentlyDeleteDeletedItem(item.id);
      deletedCount += 1;
      cacheUpdated = cacheUpdated && result.cacheUpdated;
    } catch (error) {
      failureCode = (error as { code?: string })?.code ?? "DELETE_FAILED";
      break;
    }
  }
  // Never substitute cached data for verification of the destructive operation.
  let remainingItems: Item[] | null = null;
  try {
    remainingItems = await readTrash();
  } catch {
    failureCode = failureCode ?? "VERIFY_FAILED";
  }
  return { deletedCount, remainingItems, failureCode, cacheUpdated };
}

export async function deleteItem(id: string) {
  if (id.startsWith("offline-item-")) {
    await cancelOfflineCreatedItem(id);
    return;
  }
  const networkState = await Promise.race([
    NetInfo.fetch(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 750)),
  ]);
  if (!(networkState?.isConnected === true && networkState?.isInternetReachable === true)) {
    await enqueueOfflineOperation({
      id: `offline-delete-item-${id}-${Date.now()}`,
      type: "deleteInventoryItem",
      userId: getCurrentUserId(),
      payload: { itemId: id },
      createdAt: new Date().toISOString(),
    });
    return;
  }
  await deleteDoc(inventoryDoc(id));
}

export async function createOrUpdateInventoryItemFromChecklist(
  item: {
    name: string;
    quantity: number;
    inventoryItemId?: string | null;
  },
  compartment: {
    id: string;
    name: string;
    vehicleId: string;
  }
) {
  if (item.inventoryItemId) {
    const allItems = await getAllItems({ recoverPhotos: false });
    const existing = allItems.find((candidate) => candidate.id === item.inventoryItemId);
    if (!existing) return null;

    await updateItem(existing.id, {
      quantity:
        Math.max(1, Number(existing.quantity ?? 1)) +
        Math.max(1, Number(item.quantity ?? 1)),
    });
    return existing.id;
  }

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
    inventoryItemId?: string | null;
  },
  compartmentId: string
) {
  const allItems = await getAllItems();

  const existing = item.inventoryItemId
    ? allItems.find((candidate) => candidate.id === item.inventoryItemId)
    : allItems.find(
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
    roomId?: string;
    roomName?: string;
    vehicleId?: string;
    inventoryItemId?: string | null;
  }
) {
  const allItems = await getAllItems();
  if (item.inventoryItemId) {
    const stableItem = findChecklistInventoryItemById(allItems, item.inventoryItemId);
    if (!stableItem) return;
    await updateItem(stableItem.id, {
      status: item.packed ? "packed" : "missing",
    });
    return;
  }

  const matches = findChecklistInventoryMatches(allItems, item);

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

export function findChecklistInventoryItemById(allItems: Item[], inventoryItemId: string) {
  return allItems.find((candidate) => candidate.id === inventoryItemId);
}

export function findChecklistInventoryMatches(
  allItems: Item[],
  checklistItem: { name: string; compartmentId?: string; compartmentName?: string }
) {
  const normalizedName = normalizeName(checklistItem.name);
  return allItems.filter((existingItem) => {
    if (normalizeName(existingItem.name) !== normalizedName) return false;
    if (checklistItem.compartmentId) {
      return existingItem.compartmentId === checklistItem.compartmentId;
    }
    return Boolean(checklistItem.compartmentName) &&
      existingItem.compartmentName === checklistItem.compartmentName;
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

  return (await applyInventoryProjection(userId, allItems))
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
  softDeleteItem,
  restoreDeletedItem,
  getDeletedItems,
  createOrUpdateInventoryItemFromChecklist,
  removeOrDecrementInventoryItemFromChecklist,
  syncInventoryItemStatusFromChecklist,
  searchItemsForUser,
};

export default gearService;
