import AsyncStorage from "@react-native-async-storage/async-storage";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";

const OFFLINE_QUEUE_KEY = "wmg.offlineQueue.v1";

export type OfflineQueueOperation =
  | {
      id: string;
      type: "createStorageSpace";
      userId: string;
      payload: {
        name: string;
        category: "storage" | "office" | "vehicle";
        subtype: string;
        notes: string;
      };
      createdAt: string;
    }
  | {
      id: string;
      type: "createCompartment";
      userId: string;
      payload: {
        name: string;
        vehicleId: string;
      };
      createdAt: string;
    }
  | {
      id: string;
      type: "createItem";
      userId: string;
      payload: {
        name: string;
        quantity: number;
        status: "packed" | "missing";
        compartmentId: string;
        compartmentName: string;
        vehicleId: string;
        vehicleName: string;
        notes: string;
        source: string;
        itemPhotoUri: string;
      };
      createdAt: string;
    };

async function readQueue(): Promise<OfflineQueueOperation[]> {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: OfflineQueueOperation[]) {
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueOfflineOperation(
  operation: OfflineQueueOperation
) {
  const queue = await readQueue();
  queue.push(operation);
  await writeQueue(queue);
}

export async function getOfflineQueueCount() {
  const queue = await readQueue();
  return queue.length;
}

export async function removeOfflineOperation(operationId: string) {
  const queue = await readQueue();
  await writeQueue(queue.filter((operation) => operation.id !== operationId));
}


export async function getOfflineStorageSpaces(userId: string) {
  const queue = await readQueue();

  return queue.flatMap((operation) => {
    if (
      operation.type !== "createStorageSpace" ||
      operation.userId !== userId
    ) {
      return [];
    }

    return [
      {
        id: operation.id,
        name: operation.payload.name,
        category: operation.payload.category,
        subtype: operation.payload.subtype,
        notes: operation.payload.notes,
        isArchived: false,
        archivedAt: null,
        createdAt: operation.createdAt,
        updatedAt: operation.createdAt,
      },
    ];
  });
}


export async function getOfflineQueue() {
  return readQueue();
}


export async function flushOfflineQueue() {
  const queue = await readQueue();

  const storageIdMap = new Map<string, string>();
  const compartmentIdMap = new Map<string, string>();
  const compartmentNameMap = new Map<string, string>();

  for (const operation of queue) {
    if (operation.type === "createStorageSpace") {
      const ref = await addDoc(collection(db, "users", operation.userId, "storageSpaces"), {
        name: operation.payload.name,
        category: operation.payload.category,
        subtype: operation.payload.subtype,
        notes: operation.payload.notes,
        isArchived: false,
        archivedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      storageIdMap.set(operation.id, ref.id);
      await removeOfflineOperation(operation.id);
      continue;
    }

    if (operation.type === "createCompartment") {
      const resolvedVehicleId =
        storageIdMap.get(operation.payload.vehicleId) ?? operation.payload.vehicleId;

      const ref = await addDoc(collection(db, "users", operation.userId, "compartments"), {
        name: operation.payload.name,
        vehicleId: resolvedVehicleId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      compartmentIdMap.set(operation.id, ref.id);
      compartmentNameMap.set(operation.id, operation.payload.name);
      await removeOfflineOperation(operation.id);
      continue;
    }

    if (operation.type === "createItem") {
      const resolvedCompartmentId =
        compartmentIdMap.get(operation.payload.compartmentId) ??
        operation.payload.compartmentId;

      const resolvedCompartmentName =
        operation.payload.compartmentName ||
        compartmentNameMap.get(operation.payload.compartmentId) ||
        "";

      const resolvedVehicleId =
        storageIdMap.get(operation.payload.vehicleId) ?? operation.payload.vehicleId;

      await addDoc(collection(db, "users", operation.userId, "inventoryItems"), {
        name: operation.payload.name,
        quantity: operation.payload.quantity,
        status: operation.payload.status,
        compartmentId: resolvedCompartmentId,
        compartmentName: resolvedCompartmentName,
        vehicleId: resolvedVehicleId,
        vehicleName: operation.payload.vehicleName,
        notes: operation.payload.notes,
        source: operation.payload.source,
        itemPhotoUri: operation.payload.itemPhotoUri,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await removeOfflineOperation(operation.id);
    }
  }
}

export async function getOfflineCompartments(
  userId: string,
  vehicleId: string
) {
  const queue = await readQueue();

  return queue.flatMap((operation) => {
    if (
      operation.type !== "createCompartment" ||
      operation.userId !== userId ||
      operation.payload.vehicleId !== vehicleId
    ) {
      return [];
    }

    return [
      {
        id: operation.id,
        name: operation.payload.name,
        vehicleId: operation.payload.vehicleId,
        createdAt: operation.createdAt,
        updatedAt: operation.createdAt,
      },
    ];
  });
}

const STORAGE_SPACES_CACHE_PREFIX = "wmg.cache.storageSpaces.";

export async function cacheStorageSpaces(userId: string, spaces: unknown[]) {
  await AsyncStorage.setItem(
    `${STORAGE_SPACES_CACHE_PREFIX}${userId}`,
    JSON.stringify(spaces)
  );
}

export async function getCachedStorageSpaces(userId: string) {
  const raw = await AsyncStorage.getItem(`${STORAGE_SPACES_CACHE_PREFIX}${userId}`);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getOfflineItemsByCompartment(
  userId: string,
  compartmentId: string
) {
  const queue = await readQueue();

  return queue.flatMap((operation) => {
    if (
      operation.type !== "createItem" ||
      operation.userId !== userId ||
      operation.payload.compartmentId !== compartmentId
    ) {
      return [];
    }

    return [
      {
        id: operation.id,
        name: operation.payload.name,
        quantity: operation.payload.quantity,
        status: operation.payload.status,
        compartmentId: operation.payload.compartmentId,
        compartmentName: operation.payload.compartmentName,
        vehicleId: operation.payload.vehicleId,
        vehicleName: operation.payload.vehicleName,
        notes: operation.payload.notes,
        source: operation.payload.source,
        itemPhotoUri: operation.payload.itemPhotoUri,
        createdAt: operation.createdAt,
        updatedAt: operation.createdAt,
      },
    ];
  });
}

export async function updateOfflineCreatedItem(
  operationId: string,
  updates: Partial<{
    name: string;
    quantity: number;
    status: "packed" | "missing";
    compartmentId: string;
    compartmentName: string;
    vehicleId: string;
    vehicleName: string;
    notes: string;
    source: string;
    itemPhotoUri: string;
  }>
) {
  const queue = await readQueue();

  const nextQueue = queue.map((operation) => {
    if (
      operation.id !== operationId ||
      operation.type !== "createItem"
    ) {
      return operation;
    }

    return {
      ...operation,
      payload: {
        ...operation.payload,
        ...updates,
      },
    };
  });

  await writeQueue(nextQueue);
}


export async function getOfflineItemsByStatus(
  userId: string,
  status: "packed" | "missing"
) {
  const queue = await readQueue();

  return queue.flatMap((operation) => {
    if (
      operation.type !== "createItem" ||
      operation.userId !== userId ||
      operation.payload.status !== status
    ) {
      return [];
    }

    return [
      {
        id: operation.id,
        name: operation.payload.name,
        quantity: operation.payload.quantity,
        status: operation.payload.status,
        compartmentId: operation.payload.compartmentId,
        compartmentName: operation.payload.compartmentName,
        vehicleId: operation.payload.vehicleId,
        vehicleName: operation.payload.vehicleName,
        notes: operation.payload.notes,
        source: operation.payload.source,
        itemPhotoUri: operation.payload.itemPhotoUri,
        createdAt: operation.createdAt,
        updatedAt: operation.createdAt,
      },
    ];
  });
}

export async function getOfflineCompartmentById(
  userId: string,
  compartmentId: string
) {
  const queue = await readQueue();

  for (const operation of queue) {
    if (
      operation.type === "createCompartment" &&
      operation.userId === userId &&
      operation.id === compartmentId
    ) {
      return {
        id: operation.id,
        name: operation.payload.name,
        vehicleId: operation.payload.vehicleId,
        createdAt: operation.createdAt,
        updatedAt: operation.createdAt,
      };
    }
  }

  return null;
}


export async function getOfflineItems(userId: string) {
  const queue = await readQueue();

  return queue.flatMap((operation) => {
    if (
      operation.type !== "createItem" ||
      operation.userId !== userId
    ) {
      return [];
    }

    return [
      {
        id: operation.id,
        name: operation.payload.name,
        quantity: operation.payload.quantity,
        status: operation.payload.status,
        compartmentId: operation.payload.compartmentId,
        compartmentName: operation.payload.compartmentName,
        vehicleId: operation.payload.vehicleId,
        vehicleName: operation.payload.vehicleName,
        notes: operation.payload.notes,
        source: operation.payload.source,
        itemPhotoUri: operation.payload.itemPhotoUri,
        createdAt: operation.createdAt,
        updatedAt: operation.createdAt,
      },
    ];
  });
}
