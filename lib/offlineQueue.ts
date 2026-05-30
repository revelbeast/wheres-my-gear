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

  for (const operation of queue) {
    if (operation.type === "createStorageSpace") {
      await addDoc(collection(db, "users", operation.userId, "storageSpaces"), {
        name: operation.payload.name,
        category: operation.payload.category,
        subtype: operation.payload.subtype,
        notes: operation.payload.notes,
        isArchived: false,
        archivedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await removeOfflineOperation(operation.id);
      continue;
    }

    if (operation.type === "createCompartment") {
      await addDoc(collection(db, "users", operation.userId, "compartments"), {
        name: operation.payload.name,
        vehicleId: operation.payload.vehicleId,
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
