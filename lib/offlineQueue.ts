const toggleReplayGuard = new Set<string>();

import AsyncStorage from "@react-native-async-storage/async-storage";
import { addDoc, collection, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
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
    }
  | {
      id: string;
      type: "createChecklist";
      userId: string;
      payload: {
        name: string;
        category: string;
        customCategoryLabel: string;
        templateId: string | null;
        vehicleId: string | null;
        tripId: string | null;
      };
      createdAt: string;
    }
  | {
      id: string;
      type: "createChecklistItem";
      userId: string;
      payload: {
        checklistId: string;
        name: string;
        sortOrder: number;
      };
      createdAt: string;
    }
  | {
      id: string;
      type: "toggleChecklistItemPacked";
      userId: string;
      payload: {
        checklistId: string;
        itemId: string;
        packed: boolean;
      };
      createdAt: string;
    }
  | {
      id: string;
      type: "deleteChecklistItem";
      userId: string;
      payload: {
        checklistId: string;
        itemId: string;
      };
      createdAt: string;
    }
  | {
      id: string;
      type: "updateChecklistItemName";
      userId: string;
      payload: {
        checklistId: string;
        itemId: string;
        name: string;
      };
      createdAt: string;
    }
  | {
      id: string;
      type: "updateChecklistItemQuantity";
      userId: string;
      payload: {
        checklistId: string;
        itemId: string;
        quantity: number;
      };
      createdAt: string;
    }
  | {
      id: string;
      type: "createChecklistTemplate";
      userId: string;
      payload: {
        name: string;
        category: string;
        customCategoryLabel: string;
        items: Array<{
          name: string;
          quantity: number;
          packed: boolean;
          notes: string;
          sortOrder: number;
          itemPhotoUri: string;
        }>;
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
  console.log("OFFLINE QUEUE: enqueue", operation.type, operation.id, operation.payload);
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

export async function getOfflineChecklists(userId: string) {
  const queue = await readQueue();

  return queue.flatMap((operation) => {
    if (
      operation.type !== "createChecklist" ||
      operation.userId !== userId
    ) {
      return [];
    }

    return [
      {
        id: operation.id,
        name: operation.payload.name,
        category: operation.payload.category,
        customCategoryLabel: operation.payload.customCategoryLabel,
        templateId: operation.payload.templateId,
        status: "active",
        packedCount: 0,
        totalCount: 0,
        missingCount: 0,
        vehicleId: operation.payload.vehicleId,
        tripId: operation.payload.tripId,
        notes: "",
        isArchived: false,
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
  console.log(
    "OFFLINE QUEUE: flush start",
    queue.map((operation) => ({
      id: operation.id,
      type: operation.type,
      payload: operation.payload,
    }))
  );

  const storageIdMap = new Map<string, string>();
  const compartmentIdMap = new Map<string, string>();
  const compartmentNameMap = new Map<string, string>();
  const checklistIdMap = new Map<string, string>();
  const checklistItemIdMap = new Map<string, string>();

  for (const operation of queue) {

    if (operation.type === "createStorageSpace") {
      const ref = await addDoc(
        collection(db, "users", operation.userId, "storageSpaces"),
        {
          name: operation.payload.name,
          category: operation.payload.category,
          subtype: operation.payload.subtype,
          notes: operation.payload.notes,
          isArchived: false,
          archivedAt: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      storageIdMap.set(operation.id, ref.id);
      await removeOfflineOperation(operation.id);
      continue;
    }

    if (operation.type === "createChecklist") {
      const ref = await addDoc(
        collection(db, "users", operation.userId, "checklists"),
        {
          name: operation.payload.name,
          category: operation.payload.category,
          customCategoryLabel: operation.payload.customCategoryLabel,
          templateId: operation.payload.templateId,
          status: "active",
          packedCount: 0,
          totalCount: 0,
          missingCount: 0,
          vehicleId: operation.payload.vehicleId,
          tripId: operation.payload.tripId,
          notes: "",
          isArchived: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      checklistIdMap.set(operation.id, ref.id);
      await removeOfflineOperation(operation.id);
      continue;
    }

    if (operation.type === "createChecklistItem") {
      console.log("OFFLINE QUEUE: replay createChecklistItem", operation.id, operation.payload);
      const resolvedChecklistId =
        checklistIdMap.get(operation.payload.checklistId) ??
        operation.payload.checklistId;

      let queuedPacked = false;

      for (const queuedOperation of queue) {
        if (
          queuedOperation.type === "toggleChecklistItemPacked" &&
          queuedOperation.userId === operation.userId &&
          queuedOperation.payload.checklistId === operation.payload.checklistId &&
          queuedOperation.payload.itemId === operation.id
        ) {
          queuedPacked = queuedOperation.payload.packed;
        }
      }

      const ref = await addDoc(
        collection(
          db,
          "users",
          operation.userId,
          "checklists",
          resolvedChecklistId,
          "items"
        ),
        {
          name: operation.payload.name,
          notes: "",
          quantity: 1,
          packed: queuedPacked,
          packedAt: queuedPacked ? serverTimestamp() : null,
          sortOrder: operation.payload.sortOrder,
          sourceTemplateItemId: null,
          itemPhotoUri: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      checklistItemIdMap.set(operation.id, ref.id);
      console.log("OFFLINE QUEUE: mapped checklist item", operation.id, "=>", ref.id, "queuedPacked:", queuedPacked);

      await removeOfflineOperation(operation.id);
      continue;
    }

    if (operation.type === "toggleChecklistItemPacked") {
      console.log("OFFLINE QUEUE: replay toggleChecklistItemPacked", operation.id, operation.payload);
    const key = operation.id;
    if (toggleReplayGuard.has(key)) continue;
    toggleReplayGuard.add(key);
    
    
      const resolvedChecklistId =
        checklistIdMap.get(operation.payload.checklistId) ??
        operation.payload.checklistId;

      const resolvedItemId =
        checklistItemIdMap.get(operation.payload.itemId) ??
        operation.payload.itemId;

      console.log("OFFLINE QUEUE: resolved toggle target", {
        checklistId: resolvedChecklistId,
        itemId: resolvedItemId,
        packed: operation.payload.packed,
      });

      const itemRef = doc(
        db,
        "users",
        operation.userId,
        "checklists",
        resolvedChecklistId,
        "items",
        resolvedItemId
      );

      await updateDoc(itemRef, {
        packed: operation.payload.packed,
        packedAt: operation.payload.packed ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });

      await removeOfflineOperation(operation.id);
      continue;
    }

    if (operation.type === "deleteChecklistItem") {
      const resolvedChecklistId =
        checklistIdMap.get(operation.payload.checklistId) ??
        operation.payload.checklistId;

      const resolvedItemId =
        checklistItemIdMap.get(operation.payload.itemId) ??
        operation.payload.itemId;

      const itemRef = doc(
        db,
        "users",
        operation.userId,
        "checklists",
        resolvedChecklistId,
        "items",
        resolvedItemId
      );

      await deleteDoc(itemRef);
      await removeOfflineOperation(operation.id);
      continue;
    }

    if (operation.type === "updateChecklistItemName") {
      const resolvedChecklistId =
        checklistIdMap.get(operation.payload.checklistId) ??
        operation.payload.checklistId;

      const resolvedItemId =
        checklistItemIdMap.get(operation.payload.itemId) ??
        operation.payload.itemId;

      const itemRef = doc(
        db,
        "users",
        operation.userId,
        "checklists",
        resolvedChecklistId,
        "items",
        resolvedItemId
      );

      await updateDoc(itemRef, {
        name: operation.payload.name,
        updatedAt: serverTimestamp(),
      });

      await removeOfflineOperation(operation.id);
      continue;
    }

    if (operation.type === "updateChecklistItemQuantity") {
      const resolvedChecklistId =
        checklistIdMap.get(operation.payload.checklistId) ??
        operation.payload.checklistId;

      const resolvedItemId =
        checklistItemIdMap.get(operation.payload.itemId) ??
        operation.payload.itemId;

      const itemRef = doc(
        db,
        "users",
        operation.userId,
        "checklists",
        resolvedChecklistId,
        "items",
        resolvedItemId
      );

      await updateDoc(itemRef, {
        quantity: operation.payload.quantity,
        updatedAt: serverTimestamp(),
      });

      await removeOfflineOperation(operation.id);
      continue;
    }

    if (operation.type === "createChecklistTemplate") {
      const templateRef = await addDoc(
        collection(db, "users", operation.userId, "checklistTemplates"),
        {
          name: operation.payload.name,
          category: operation.payload.category,
          customCategoryLabel: operation.payload.customCategoryLabel,
          description: "",
          isDefault: false,
          itemCount: operation.payload.items.length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      for (const item of operation.payload.items) {
        await addDoc(
          collection(
            db,
            "users",
            operation.userId,
            "checklistTemplates",
            templateRef.id,
            "items"
          ),
          {
            name: item.name,
            quantity: item.quantity,
            packed: item.packed,
            notes: item.notes,
            sortOrder: item.sortOrder,
            itemPhotoUri: item.itemPhotoUri,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );
      }

      await removeOfflineOperation(operation.id);
      continue;
    }

    if (operation.type === "createCompartment") {
      const resolvedVehicleId =
        storageIdMap.get(operation.payload.vehicleId) ??
        operation.payload.vehicleId;

      const ref = await addDoc(
        collection(db, "users", operation.userId, "compartments"),
        {
          name: operation.payload.name,
          vehicleId: resolvedVehicleId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

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
        storageIdMap.get(operation.payload.vehicleId) ??
        operation.payload.vehicleId;

      await addDoc(
        collection(db, "users", operation.userId, "inventoryItems"),
        {
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
        }
      );

      await removeOfflineOperation(operation.id);
      continue;
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

export async function getOfflineChecklistItems(
  userId: string,
  checklistId: string
) {
  const queue = await readQueue();

  const packedByItemId = new Map<string, boolean>();

  for (const operation of queue) {
    if (
      operation.type === "toggleChecklistItemPacked" &&
      operation.userId === userId &&
      operation.payload.checklistId === checklistId
    ) {
      packedByItemId.set(operation.payload.itemId, operation.payload.packed);
    }
  }

  return queue.flatMap((operation) => {
    if (
      operation.type !== "createChecklistItem" ||
      operation.userId !== userId ||
      operation.payload.checklistId !== checklistId
    ) {
      return [];
    }

    const packed = packedByItemId.get(operation.id) ?? false;

    return [
      {
        id: operation.id,
        name: operation.payload.name,
        notes: "",
        quantity: 1,
        packed,
        packedAt: packed ? operation.createdAt : null,
        sortOrder: operation.payload.sortOrder,
        sourceTemplateItemId: null,
        itemPhotoUri: "",
        createdAt: operation.createdAt,
        updatedAt: operation.createdAt,
      },
    ];
  });
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
