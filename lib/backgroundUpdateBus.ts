import { BackgroundResizeMode } from "./settingsService";

export type AppBackgroundUpdate = {
  userId: string;
  uri: string | null;
  resizeMode: BackgroundResizeMode;
  version: number;
};

type BackgroundUpdateListener = (update: AppBackgroundUpdate) => void;

let latestBackgroundUpdate: AppBackgroundUpdate | null = null;
let updateVersion = 0;

const listeners = new Set<BackgroundUpdateListener>();

function getSafeUri(uri: string | null): string | null {
  if (typeof uri !== "string") {
    return null;
  }

  const trimmedUri = uri.trim();

  return trimmedUri.length > 0 ? trimmedUri : null;
}

function getSafeResizeMode(resizeMode: BackgroundResizeMode): BackgroundResizeMode {
  if (resizeMode === "cover" || resizeMode === "contain" || resizeMode === "center") {
    return resizeMode;
  }

  return "cover";
}

export function publishAppBackgroundUpdate(
  userId: string,
  uri: string | null,
  resizeMode: BackgroundResizeMode
) {
  const safeUserId = userId.trim();
  const safeUri = getSafeUri(uri);
  const safeResizeMode = getSafeResizeMode(resizeMode);

  if (!safeUserId) {
    return;
  }

  const isDuplicateUpdate =
    latestBackgroundUpdate?.userId === safeUserId &&
    latestBackgroundUpdate.uri === safeUri &&
    latestBackgroundUpdate.resizeMode === safeResizeMode;

  if (isDuplicateUpdate) {
    return;
  }

  updateVersion += 1;

  latestBackgroundUpdate = {
    userId: safeUserId,
    uri: safeUri,
    resizeMode: safeResizeMode,
    version: updateVersion,
  };

  listeners.forEach((listener) => {
    if (latestBackgroundUpdate) {
      listener(latestBackgroundUpdate);
    }
  });
}

export function getLatestAppBackgroundUpdate() {
  return latestBackgroundUpdate;
}

export function subscribeToAppBackgroundUpdates(
  listener: BackgroundUpdateListener
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}