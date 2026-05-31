import * as FileSystem from "expo-file-system/legacy";

const LOCAL_PHOTO_DIR = `${FileSystem.documentDirectory ?? ""}wmg-local-photos/`;

function getFileExtension(uri: string) {
  const cleanUri = uri.split("?")[0] ?? uri;
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? "jpg";
}

function createPhotoFileName(prefix: string, uri: string) {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9-_]/g, "-") || "photo";

  return `${safePrefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${getFileExtension(uri)}`;
}

export function isLocalAppPhotoUri(uri: string) {
  return Boolean(
    FileSystem.documentDirectory &&
      uri.startsWith(`${FileSystem.documentDirectory}wmg-local-photos/`)
  );
}

export async function savePhotoToLocalDocumentStorage(
  uri: string,
  prefix = "photo"
) {
  const trimmedUri = uri.trim();

  if (!trimmedUri) {
    return "";
  }

  if (!FileSystem.documentDirectory) {
    return trimmedUri;
  }

  if (isLocalAppPhotoUri(trimmedUri)) {
    return trimmedUri;
  }

  await FileSystem.makeDirectoryAsync(LOCAL_PHOTO_DIR, {
    intermediates: true,
  });

  const destinationUri = `${LOCAL_PHOTO_DIR}${createPhotoFileName(
    prefix,
    trimmedUri
  )}`;

  await FileSystem.copyAsync({
    from: trimmedUri,
    to: destinationUri,
  });

  return destinationUri;
}
