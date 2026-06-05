import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { storage } from "../firebaseConfig";

function getFileExtension(uri: string) {
  const cleanUri = uri.split("?")[0] ?? uri;
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? "jpg";
}

function getContentType(uri: string) {
  const extension = getFileExtension(uri);

  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";

  return "image/jpeg";
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-") || "photo";
}

export type CloudItemPhotoUploadResult = {
  localUri: string;
  storagePath: string;
  downloadUrl: string;
};

export async function uploadInventoryItemPhotoToCloud(input: {
  userId: string;
  itemId: string;
  localUri: string;
}) {
  const userId = input.userId.trim();
  const itemId = input.itemId.trim();
  const localUri = input.localUri.trim();

  if (!userId) {
    throw new Error("User ID is required to upload an item photo.");
  }

  if (!itemId) {
    throw new Error("Item ID is required to upload an item photo.");
  }

  if (!localUri) {
    throw new Error("Local photo URI is required to upload an item photo.");
  }

  const extension = getFileExtension(localUri);
  const storagePath = `users/${safeSegment(userId)}/inventoryItems/${safeSegment(
    itemId
  )}/main-${Date.now()}.${extension}`;

  const response = await fetch(localUri);
  const blob = await response.blob();
  const imageRef = ref(storage, storagePath);

  await uploadBytes(imageRef, blob, {
    contentType: getContentType(localUri),
  });

  const downloadUrl = await getDownloadURL(imageRef);

  return {
    localUri,
    storagePath,
    downloadUrl,
  } satisfies CloudItemPhotoUploadResult;
}

export async function deleteCloudPhotoByStoragePath(storagePath?: string) {
  const trimmedPath = storagePath?.trim() ?? "";

  if (!trimmedPath) {
    return;
  }

  try {
    await deleteObject(ref(storage, trimmedPath));
  } catch (err) {
    console.warn("Cloud photo cleanup skipped.", err);
  }
}

