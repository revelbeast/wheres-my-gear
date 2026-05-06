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

export function publishAppBackgroundUpdate(
  userId: string,
  uri: string | null,
  resizeMode: BackgroundResizeMode
) {
  updateVersion += 1;

  latestBackgroundUpdate = {
    userId,
    uri,
    resizeMode,
    version: updateVersion,
  };

  listeners.forEach((listener) => {
    listener(latestBackgroundUpdate as AppBackgroundUpdate);
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