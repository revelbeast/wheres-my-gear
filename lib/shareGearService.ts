import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  getAllItems,
  getCompartments,
  getRoomsByStorageSpace,
  getStorageSpaceById,
  type Compartment,
  type Item,
  type Room,
  type StorageSpace,
} from "./gearService";

export type ShareGearScope = "storageSpace";

type SharedStorageSpace = Omit<
  StorageSpace,
  "id" | "createdAt" | "updatedAt" | "archivedAt"
> & {
  sourceId: string;
};

type SharedRoom = Omit<
  Room,
  "id" | "storageSpaceId" | "createdAt" | "updatedAt" | "archivedAt"
> & {
  sourceId: string;
  sourceStorageSpaceId: string;
};

type SharedCompartment = Omit<
  Compartment,
  "id" | "vehicleId" | "roomId" | "createdAt" | "updatedAt"
> & {
  sourceId: string;
  sourceStorageSpaceId: string;
  sourceRoomId?: string;
};

type SharedItem = Omit<
  Item,
  | "id"
  | "vehicleId"
  | "compartmentId"
  | "createdAt"
  | "updatedAt"
  | "itemPhotoUri"
  | "itemPhotoStoragePath"
  | "itemPhotoDownloadUrl"
  | "photoBackedUp"
> & {
  sourceId: string;
  sourceStorageSpaceId?: string;
  sourceCompartmentId?: string;
};

export type ShareGearFile = {
  app: "wheres-my-gear";
  feature: "share-gear";
  version: 1;
  exportedAt: string;
  scope: ShareGearScope;
  storageSpace: SharedStorageSpace;
  rooms: SharedRoom[];
  compartments: SharedCompartment[];
  items: SharedItem[];
};

function safeFileName(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);

  return cleaned || "shared-gear";
}

function stripStorageSpace(space: StorageSpace): SharedStorageSpace {
  const {
    id,
    createdAt,
    updatedAt,
    archivedAt,
    ...rest
  } = space;

  return {
    ...rest,
    sourceId: id,
  };
}

function stripRoom(room: Room): SharedRoom {
  const {
    id,
    storageSpaceId,
    createdAt,
    updatedAt,
    archivedAt,
    ...rest
  } = room;

  return {
    ...rest,
    sourceId: id,
    sourceStorageSpaceId: storageSpaceId,
  };
}

function stripCompartment(compartment: Compartment): SharedCompartment {
  const {
    id,
    vehicleId,
    roomId,
    createdAt,
    updatedAt,
    ...rest
  } = compartment;

  return {
    ...rest,
    sourceId: id,
    sourceStorageSpaceId: vehicleId,
    sourceRoomId: roomId,
  };
}

function stripItem(item: Item): SharedItem {
  const {
    id,
    vehicleId,
    compartmentId,
    createdAt,
    updatedAt,
    itemPhotoUri,
    itemPhotoStoragePath,
    itemPhotoDownloadUrl,
    photoBackedUp,
    ...rest
  } = item;

  return {
    ...rest,
    sourceId: id,
    sourceStorageSpaceId: vehicleId,
    sourceCompartmentId: compartmentId,
  };
}

export async function buildShareGearStorageSpaceFile(
  storageSpaceId: string
): Promise<ShareGearFile> {
  const storageSpace = await getStorageSpaceById(storageSpaceId);

  if (!storageSpace) {
    throw new Error("Storage space not found.");
  }

  const [rooms, compartments, allItems] = await Promise.all([
    getRoomsByStorageSpace(storageSpaceId),
    getCompartments(storageSpaceId),
    getAllItems(),
  ]);

  const compartmentIds = new Set(compartments.map((compartment) => compartment.id));

  const scopedItems = allItems.filter((item) => {
    if (item.vehicleId === storageSpaceId) return true;
    if (item.compartmentId && compartmentIds.has(item.compartmentId)) return true;
    return false;
  });

  return {
    app: "wheres-my-gear",
    feature: "share-gear",
    version: 1,
    exportedAt: new Date().toISOString(),
    scope: "storageSpace",
    storageSpace: stripStorageSpace(storageSpace),
    rooms: rooms.map(stripRoom),
    compartments: compartments.map(stripCompartment),
    items: scopedItems.map(stripItem),
  };
}

export async function shareStorageSpaceGear(storageSpaceId: string) {
  const shareFile = await buildShareGearStorageSpaceFile(storageSpaceId);

  if (!FileSystem.cacheDirectory) {
    throw new Error("File sharing is not available on this device.");
  }

  const fileName = `${safeFileName(shareFile.storageSpace.name)}.wmgshare`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(shareFile, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    throw new Error("Sharing is not available on this device.");
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: "application/json",
    dialogTitle: "Share Gear",
    UTI: "public.json",
  });

  return fileUri;
}
