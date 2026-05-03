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

export type ItemStatus = "packed" | "missing";
export type StorageSpaceCategory = "vehicle" | "storage";

export type StorageSpace = {
  id: string;
  name: string;
  category?: StorageSpaceCategory;
  subtype?: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Compartment = {
  id: string;
  name: string;
  vehicleId: string;
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

function compartmentsCol() {
  return collection(db, "users", getCurrentUserId(), "compartments");
}

function compartmentDoc(compartmentId: string) {
  return doc(db, "users", getCurrentUserId(), "compartments", compartmentId);
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

export async function getStorageSpaces(): Promise<StorageSpace[]> {
  const snapshot = await getDocs(storageSpacesCol());

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as StorageSpace[];
}

export async function getStorageSpaceById(
  storageId: string
): Promise<StorageSpace | null> {
  const snapshot = await getDoc(storageSpaceDoc(storageId));

  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as StorageSpace;
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(storageSpacesCol(), payload);
  const confirmationSnapshot = await getDoc(ref);

  if (!confirmationSnapshot.exists()) {
    throw new Error("Storage space was not confirmed in Firestore. Please try again.");
  }

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

export async function deleteStorageSpace(storageId: string) {
  const trimmedStorageId = storageId.trim();

  if (!trimmedStorageId) {
    throw new Error("Storage space ID is required.");
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

export async function createCompartment(name: string, vehicleId: string) {
  const trimmedName = name.trim();
  const trimmedVehicleId = vehicleId.trim();

  if (!trimmedName) {
    throw new Error("Compartment name is required.");
  }

  if (!trimmedVehicleId) {
    throw new Error("Vehicle ID is required.");
  }

  const ref = await addDoc(compartmentsCol(), {
    name: trimmedName,
    vehicleId: trimmedVehicleId,
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

  await updateDoc(compartmentDoc(compartmentId), payload);
}

export async function deleteCompartment(compartmentId: string) {
  await deleteDoc(compartmentDoc(compartmentId));
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
  const q = query(compartmentsCol(), where("vehicleId", "==", vehicleId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Compartment[];
}

export async function getCompartments(
  vehicleId: string
): Promise<Compartment[]> {
  return getCompartmentsByVehicle(vehicleId);
}

export async function getCompartmentById(
  compartmentId: string
): Promise<Compartment | null> {
  const snapshot = await getDoc(compartmentDoc(compartmentId));

  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as Compartment;
}

export async function getAllItems(): Promise<Item[]> {
  const snapshot = await getDocs(inventoryCol());

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Item[];
}

export async function getItemsByCompartment(
  compartmentId: string
): Promise<Item[]> {
  const q = query(inventoryCol(), where("compartmentId", "==", compartmentId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Item[];
}

export async function getItemsByStatus(
  status: ItemStatus | string
): Promise<Item[]> {
  const normalizedStatus =
    String(status).toLowerCase().trim() === "packed" ? "packed" : "missing";

  const q = query(inventoryCol(), where("status", "==", normalizedStatus));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Item[];
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