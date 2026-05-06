import { AppFontSize, AppTheme } from "./settingsService";

export type AppThemeUpdate = {
  userId: string;
  theme: AppTheme;
  fontSize: AppFontSize;
  version: number;
};

type ThemeUpdateListener = (update: AppThemeUpdate) => void;

let latestThemeUpdate: AppThemeUpdate | null = null;
let updateVersion = 0;

const listeners = new Set<ThemeUpdateListener>();

function getSafeTheme(value: unknown): AppTheme {
  if (value === "light" || value === "dark") {
    return value;
  }

  return "dark";
}

function getSafeFontSize(value: unknown): AppFontSize {
  if (value === "small" || value === "medium" || value === "large") {
    return value;
  }

  return "medium";
}

export function publishAppThemeUpdate(
  userId: string,
  theme: AppTheme,
  fontSize: AppFontSize
) {
  const safeUserId = userId.trim();
  const safeTheme = getSafeTheme(theme);
  const safeFontSize = getSafeFontSize(fontSize);

  if (!safeUserId) {
    return;
  }

  const isDuplicateUpdate =
    latestThemeUpdate?.userId === safeUserId &&
    latestThemeUpdate.theme === safeTheme &&
    latestThemeUpdate.fontSize === safeFontSize;

  if (isDuplicateUpdate) {
    return;
  }

  updateVersion += 1;

  latestThemeUpdate = {
    userId: safeUserId,
    theme: safeTheme,
    fontSize: safeFontSize,
    version: updateVersion,
  };

  listeners.forEach((listener) => {
    if (latestThemeUpdate) {
      listener(latestThemeUpdate);
    }
  });
}

export function getLatestAppThemeUpdate() {
  return latestThemeUpdate;
}

export function clearAppThemeUpdateForUser(userId: string | null | undefined) {
  if (!userId || latestThemeUpdate?.userId !== userId) {
    return;
  }

  latestThemeUpdate = null;
}

export function subscribeToAppThemeUpdates(listener: ThemeUpdateListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}