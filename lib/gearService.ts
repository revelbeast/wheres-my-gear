import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

const DEMO_USER_ID = "demo-user-123";

export type ItemStatus = "packed" | "missing";
export type StorageSpaceCategory = "vehicle" | "storage";

export type StorageSpace = {
  id: string;
  name: string;
  category: StorageSpaceCategory;
  subtype: string;
  createdAt?: unknown;
};

export type Vehicle = StorageSpace;

export type Compartment = {
  id: string;
  name: string;
  vehicleId: string;
  createdAt?: unknown;
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
  packed?: boolean;
  missing?: boolean;
  createdAt?: unknown;
};

export type SearchResultItem = {
  id: string;
  name: string;
  quantity: number;
  compartmentId: string;
  compartmentName: string;
  vehicleId: string;
  vehicleName: string;
  notes?: string;
  packed?: boolean;
  missing?: boolean;
};

function toNumber(value: unknown, fallback = 1) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeStatus(value: unknown, packed?: unknown): ItemStatus {
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    if (lower === "packed") return "packed";
    if (lower === "missing") return "missing";
  }

  if (typeof packed === "boolean") {
    return packed ? "packed" : "missing";
  }

  return "missing";
}

function normalizeCategory(value: unknown): StorageSpaceCategory {
  const lower = String(value ?? "").toLowerCase().trim();
  return lower === "storage" ? "storage" : "vehicle";
}

function sortByName<T extends { name?: string }>(items: T[]) {
  return [...items].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", undefined, {
      sensitivity: "base",
    })
  );
}

function mapStorageSpace(docSnap: any): StorageSpace {
  const data = docSnap.data() ?? {};
  return {
    id: docSnap.id,
    name: data.name ?? "",
    category: normalizeCategory(data.category),
    subtype: data.subtype ?? "",
    createdAt: data.createdAt,
  };
}

function mapCompartment(docSnap: any, fallbackVehicleId = ""): Compartment {
  const data = docSnap.data() ?? {};
  return {
    id: docSnap.id,
    name: data.name ?? "",
    vehicleId: data.vehicleId ?? fallbackVehicleId,
    createdAt: data.createdAt,
  };
}

function mapItem(
  docSnap: any,
  fallbackCompartmentId = "",
  fallbackVehicleId = ""
): Item {
  const data = docSnap.data() ?? {};
  const status = normalizeStatus(data.status, data.packed);

  return {
    id: docSnap.id,
    name: data.name ?? "",
    quantity: toNumber(data.quantity, 1),
    status,
    compartmentId: data.compartmentId ?? fallbackCompartmentId,
    vehicleId: data.vehicleId ?? fallbackVehicleId,
    notes: data.notes ?? "",
    packed: status === "packed",
    missing: status === "missing",
    createdAt: data.createdAt,
  };
}

async function getCollectionDocsIfAny(pathParts: string[]) {
  const snapshot = await getDocs(collection(db, ...pathParts));
  return snapshot.docs;
}

async function getStorageSpaceDocs() {
  const userStorageDocs = await getCollectionDocsIfAny([
    "users",
    DEMO_USER_ID,
    "storageSpaces",
  ]);
  if (userStorageDocs.length > 0) return userStorageDocs;

  const rootStorageDocs = await getCollectionDocsIfAny(["storageSpaces"]);
  if (rootStorageDocs.length > 0) return rootStorageDocs;

  const userVehicleDocs = await getCollectionDocsIfAny([
    "users",
    DEMO_USER_ID,
    "vehicles",
  ]);
  if (userVehicleDocs.length > 0) return userVehicleDocs;

  const rootVehicleDocs = await getCollectionDocsIfAny(["vehicles"]);
  return rootVehicleDocs;
}

async function getFlatCompartmentDocs() {
  const userDocs = await getCollectionDocsIfAny([
    "users",
    DEMO_USER_ID,
    "compartments",
  ]);
  if (userDocs.length > 0) return userDocs;

  const rootDocs = await getCollectionDocsIfAny(["compartments"]);
  return rootDocs;
}

async function getFlatItemDocs() {
  const userDocs = await getCollectionDocsIfAny(["users", DEMO_USER_ID, "items"]);
  if (userDocs.length > 0) return userDocs;

  const rootDocs = await getCollectionDocsIfAny(["items"]);
  return rootDocs;
}

export async function getStorageSpaces(): Promise<StorageSpace[]> {
  const docs = await getStorageSpaceDocs();
  return sortByName(docs.map(mapStorageSpace));
}

export async function getStorageSpaceById(
  storageId: string
): Promise<StorageSpace | null> {
  const userDoc = await getDoc(
    doc(db, "users", DEMO_USER_ID, "storageSpaces", storageId)
  );
  if (userDoc.exists()) return mapStorageSpace(userDoc);

  const rootStorageDoc = await getDoc(doc(db, "storageSpaces", storageId));
  if (rootStorageDoc.exists()) return mapStorageSpace(rootStorageDoc);

  const userVehicleDoc = await getDoc(
    doc(db, "users", DEMO_USER_ID, "vehicles", storageId)
  );
  if (userVehicleDoc.exists()) return mapStorageSpace(userVehicleDoc);

  const rootVehicleDoc = await getDoc(doc(db, "vehicles", storageId));
  if (rootVehicleDoc.exists()) return mapStorageSpace(rootVehicleDoc);

  return null;
}

export async function createStorageSpace(data: {
  name: string;
  category: string;
  subtype: string;
}) {
  const trimmedName = data.name.trim();
  const trimmedSubtype = data.subtype.trim();

  if (!trimmedName) throw new Error("Storage space name is required.");
  if (!trimmedSubtype) throw new Error("Storage space subtype is required.");

  const payload = {
    name: trimmedName,
    category: normalizeCategory(data.category),
    subtype: trimmedSubtype,
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(
    collection(db, "users", DEMO_USER_ID, "storageSpaces"),
    payload
  );

  return ref.id;
}

export async function updateStorageSpace(
  id: string,
  updates: Partial<{
    name: string;
    category: StorageSpaceCategory;
    subtype: string;
  }>
) {
  const payload: Record<string, unknown> = { ...updates };

  if (typeof updates.category === "string") {
    payload.category = normalizeCategory(updates.category);
  }

  const ref = doc(db, "users", DEMO_USER_ID, "storageSpaces", id);
  await updateDoc(ref, payload);
}

export async function deleteStorageSpace(id: string) {
  const ref = doc(db, "users", DEMO_USER_ID, "storageSpaces", id);
  await deleteDoc(ref);
}

export async function getVehicles(): Promise<Vehicle[]> {
  return getStorageSpaces();
}

export async function getCompartmentsByVehicle(
  vehicleId: string
): Promise<Compartment[]> {
  const results: Compartment[] = [];

  const flatDocs = await getFlatCompartmentDocs();
  const flatMatches = flatDocs
    .map((d) => mapCompartment(d))
    .filter((c) => c.vehicleId === vehicleId);

  results.push(...flatMatches);

  if (results.length === 0) {
    const nestedUserStorageDocs = await getCollectionDocsIfAny([
      "users",
      DEMO_USER_ID,
      "storageSpaces",
      vehicleId,
      "compartments",
    ]);

    if (nestedUserStorageDocs.length > 0) {
      results.push(
        ...nestedUserStorageDocs.map((d) => mapCompartment(d, vehicleId))
      );
    }
  }

  if (results.length === 0) {
    const nestedRootStorageDocs = await getCollectionDocsIfAny([
      "storageSpaces",
      vehicleId,
      "compartments",
    ]);

    if (nestedRootStorageDocs.length > 0) {
      results.push(
        ...nestedRootStorageDocs.map((d) => mapCompartment(d, vehicleId))
      );
    }
  }

  if (results.length === 0) {
    const nestedUserVehicleDocs = await getCollectionDocsIfAny([
      "users",
      DEMO_USER_ID,
      "vehicles",
      vehicleId,
      "compartments",
    ]);

    if (nestedUserVehicleDocs.length > 0) {
      results.push(
        ...nestedUserVehicleDocs.map((d) => mapCompartment(d, vehicleId))
      );
    }
  }

  if (results.length === 0) {
    const nestedRootVehicleDocs = await getCollectionDocsIfAny([
      "vehicles",
      vehicleId,
      "compartments",
    ]);

    if (nestedRootVehicleDocs.length > 0) {
      results.push(
        ...nestedRootVehicleDocs.map((d) => mapCompartment(d, vehicleId))
      );
    }
  }

  return sortByName(results);
}

export async function getCompartments(vehicleId: string): Promise<Compartment[]> {
  return getCompartmentsByVehicle(vehicleId);
}

export async function getCompartmentById(
  compartmentId: string
): Promise<Compartment | null> {
  const userDoc = await getDoc(
    doc(db, "users", DEMO_USER_ID, "compartments", compartmentId)
  );
  if (userDoc.exists()) return mapCompartment(userDoc);

  const rootDoc = await getDoc(doc(db, "compartments", compartmentId));
  if (rootDoc.exists()) return mapCompartment(rootDoc);

  return null;
}

export async function createCompartment(name: string, vehicleId: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Compartment name is required.");
  if (!vehicleId) throw new Error("vehicleId is required.");

  const ref = await addDoc(
    collection(db, "users", DEMO_USER_ID, "compartments"),
    {
      name: trimmed,
      vehicleId,
      createdAt: new Date().toISOString(),
    }
  );

  return ref.id;
}

export async function updateCompartment(
  id: string,
  updates: Partial<Compartment>
) {
  const ref = doc(db, "users", DEMO_USER_ID, "compartments", id);
  await updateDoc(ref, { ...updates });
}

export async function deleteCompartment(id: string) {
  const ref = doc(db, "users", DEMO_USER_ID, "compartments", id);
  await deleteDoc(ref);
}

async function getVehiclesMap() {
  const vehicles = await getVehicles();
  return new Map(vehicles.map((v) => [v.id, v]));
}

async function getAllCompartmentsResolved(): Promise<Compartment[]> {
  const vehicles = await getVehicles();
  const flatDocs = await getFlatCompartmentDocs();

  const flatCompartments = flatDocs.map((d) => mapCompartment(d));
  if (flatCompartments.length > 0) {
    return sortByName(flatCompartments);
  }

  const nested: Compartment[] = [];

  for (const vehicle of vehicles) {
    const userStorageNestedDocs = await getCollectionDocsIfAny([
      "users",
      DEMO_USER_ID,
      "storageSpaces",
      vehicle.id,
      "compartments",
    ]);

    nested.push(
      ...userStorageNestedDocs.map((d) => mapCompartment(d, vehicle.id))
    );

    const rootStorageNestedDocs = await getCollectionDocsIfAny([
      "storageSpaces",
      vehicle.id,
      "compartments",
    ]);

    nested.push(
      ...rootStorageNestedDocs.map((d) => mapCompartment(d, vehicle.id))
    );

    const userVehicleNestedDocs = await getCollectionDocsIfAny([
      "users",
      DEMO_USER_ID,
      "vehicles",
      vehicle.id,
      "compartments",
    ]);

    nested.push(
      ...userVehicleNestedDocs.map((d) => mapCompartment(d, vehicle.id))
    );

    const rootVehicleNestedDocs = await getCollectionDocsIfAny([
      "vehicles",
      vehicle.id,
      "compartments",
    ]);

    nested.push(
      ...rootVehicleNestedDocs.map((d) => mapCompartment(d, vehicle.id))
    );
  }

  return sortByName(nested);
}

async function getCompartmentsMap() {
  const compartments = await getAllCompartmentsResolved();
  return new Map(compartments.map((c) => [c.id, c]));
}

function enrichItem(
  item: Item,
  compartmentsMap: Map<string, Compartment>,
  vehiclesMap: Map<string, Vehicle>
): Item {
  const compartment = item.compartmentId
    ? compartmentsMap.get(item.compartmentId)
    : undefined;

  const resolvedVehicleId = item.vehicleId || compartment?.vehicleId || "";
  const vehicle = resolvedVehicleId ? vehiclesMap.get(resolvedVehicleId) : undefined;

  return {
    ...item,
    compartmentId: item.compartmentId ?? "",
    compartmentName: compartment?.name ?? "",
    vehicleId: resolvedVehicleId,
    vehicleName: vehicle?.name ?? "",
    packed: item.status === "packed",
    missing: item.status === "missing",
  };
}

export async function getAllItems(): Promise<Item[]> {
  const [vehiclesMap, compartmentsMap] = await Promise.all([
    getVehiclesMap(),
    getCompartmentsMap(),
  ]);

  const flatDocs = await getFlatItemDocs();
  let items: Item[] = flatDocs.map((d) => mapItem(d));

  if (items.length === 0) {
    const compartments = await getAllCompartmentsResolved();
    const nestedItems: Item[] = [];

    for (const compartment of compartments) {
      const userNestedDocs = await getCollectionDocsIfAny([
        "users",
        DEMO_USER_ID,
        "compartments",
        compartment.id,
        "items",
      ]);

      nestedItems.push(
        ...userNestedDocs.map((d) =>
          mapItem(d, compartment.id, compartment.vehicleId)
        )
      );

      const rootNestedDocs = await getCollectionDocsIfAny([
        "compartments",
        compartment.id,
        "items",
      ]);

      nestedItems.push(
        ...rootNestedDocs.map((d) =>
          mapItem(d, compartment.id, compartment.vehicleId)
        )
      );

      const userStorageVehicleNestedDocs = await getCollectionDocsIfAny([
        "users",
        DEMO_USER_ID,
        "storageSpaces",
        compartment.vehicleId,
        "compartments",
        compartment.id,
        "items",
      ]);

      nestedItems.push(
        ...userStorageVehicleNestedDocs.map((d) =>
          mapItem(d, compartment.id, compartment.vehicleId)
        )
      );

      const rootStorageVehicleNestedDocs = await getCollectionDocsIfAny([
        "storageSpaces",
        compartment.vehicleId,
        "compartments",
        compartment.id,
        "items",
      ]);

      nestedItems.push(
        ...rootStorageVehicleNestedDocs.map((d) =>
          mapItem(d, compartment.id, compartment.vehicleId)
        )
      );

      const userVehicleNestedDocs = await getCollectionDocsIfAny([
        "users",
        DEMO_USER_ID,
        "vehicles",
        compartment.vehicleId,
        "compartments",
        compartment.id,
        "items",
      ]);

      nestedItems.push(
        ...userVehicleNestedDocs.map((d) =>
          mapItem(d, compartment.id, compartment.vehicleId)
        )
      );

      const rootVehicleNestedDocs = await getCollectionDocsIfAny([
        "vehicles",
        compartment.vehicleId,
        "compartments",
        compartment.id,
        "items",
      ]);

      nestedItems.push(
        ...rootVehicleNestedDocs.map((d) =>
          mapItem(d, compartment.id, compartment.vehicleId)
        )
      );
    }

    items = nestedItems;
  }

  const enriched = items.map((item) =>
    enrichItem(item, compartmentsMap, vehiclesMap)
  );

  return sortByName(enriched);
}

export async function getItemsByCompartment(
  compartmentId: string
): Promise<Item[]> {
  const allItems = await getAllItems();
  return allItems.filter((item) => item.compartmentId === compartmentId);
}

export async function getItemById(itemId: string): Promise<Item | null> {
  const userDoc = await getDoc(doc(db, "users", DEMO_USER_ID, "items", itemId));
  if (userDoc.exists()) return mapItem(userDoc);

  const rootDoc = await getDoc(doc(db, "items", itemId));
  if (rootDoc.exists()) return mapItem(rootDoc);

  return null;
}

export async function getItemsByStatus(
  status: ItemStatus | string
): Promise<Item[]> {
  const normalized = String(status).toLowerCase().trim();
  const allItems = await getAllItems();

  return allItems.filter((item) => item.status === normalized);
}

export async function searchItems(searchText: string): Promise<Item[]> {
  const term = searchText.trim().toLowerCase();
  const allItems = await getAllItems();

  if (!term) {
    return sortByName(allItems);
  }

  return sortByName(
    allItems.filter((item) => {
      const name = item.name?.toLowerCase() ?? "";
      const notes = item.notes?.toLowerCase() ?? "";
      const compartmentName = item.compartmentName?.toLowerCase() ?? "";
      const vehicleName = item.vehicleName?.toLowerCase() ?? "";

      return (
        name.includes(term) ||
        notes.includes(term) ||
        compartmentName.includes(term) ||
        vehicleName.includes(term)
      );
    })
  );
}

export async function searchItemsForUser(
  _userId: string,
  searchText: string
): Promise<SearchResultItem[]> {
  const items = await searchItems(searchText);

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    compartmentId: item.compartmentId ?? "",
    compartmentName: item.compartmentName ?? "",
    vehicleId: item.vehicleId ?? "",
    vehicleName: item.vehicleName ?? "",
    notes: item.notes ?? "",
    packed: item.status === "packed",
    missing: item.status === "missing",
  }));
}

export async function createItem(input: {
  name: string;
  quantity?: number;
  status?: ItemStatus;
  compartmentId?: string;
  vehicleId?: string;
  notes?: string;
}) {
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("Item name is required.");

  const status = normalizeStatus(input.status);

  const ref = await addDoc(collection(db, "users", DEMO_USER_ID, "items"), {
    name: trimmed,
    quantity: toNumber(input.quantity, 1),
    status,
    packed: status === "packed",
    compartmentId: input.compartmentId ?? "",
    vehicleId: input.vehicleId ?? "",
    notes: input.notes ?? "",
    createdAt: new Date().toISOString(),
  });

  return ref.id;
}

export async function updateItem(
  id: string,
  updates: Partial<{
    name: string;
    quantity: number;
    status: ItemStatus;
    compartmentId: string;
    vehicleId: string;
    notes: string;
    packed: boolean;
  }>
) {
  const payload: Record<string, unknown> = {
    ...updates,
  };

  if (typeof updates.status === "string") {
    const normalizedStatus = normalizeStatus(updates.status);
    payload.status = normalizedStatus;
    payload.packed = normalizedStatus === "packed";
  }

  if (typeof updates.packed === "boolean" && !updates.status) {
    payload.status = updates.packed ? "packed" : "missing";
  }

  const ref = doc(db, "users", DEMO_USER_ID, "items", id);
  await updateDoc(ref, payload);
}

export async function deleteItem(id: string) {
  const ref = doc(db, "users", DEMO_USER_ID, "items", id);
  await deleteDoc(ref);
}

const gearService = {
  getStorageSpaces,
  getStorageSpaceById,
  createStorageSpace,
  updateStorageSpace,
  deleteStorageSpace,
  getVehicles,
  getCompartmentsByVehicle,
  getCompartments,
  getCompartmentById,
  createCompartment,
  updateCompartment,
  deleteCompartment,
  getAllItems,
  getItemsByCompartment,
  getItemById,
  getItemsByStatus,
  searchItems,
  searchItemsForUser,
  createItem,
  updateItem,
  deleteItem,
};

export default gearService;