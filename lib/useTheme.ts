import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../components/auth/AuthProvider";
import {
  AppFontSize,
  AppTheme,
  getProfileSettings,
} from "./settingsService";
import {
  getLatestAppThemeUpdate,
  publishAppThemeUpdate,
  subscribeToAppThemeUpdates,
} from "./themeUpdateBus";

export type AppThemeColors = {
  mode: AppTheme;
  background: string;
  card: string;
  cardStrong: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  success: string;
  danger: string;
  warning: string;
  iconSurface: string;
  inputSurface: string;
  overlayBase: string;
  overlayTop: string;
  overlayBottom: string;
};

export type AppThemeFontSizes = {
  caption: number;
  small: number;
  body: number;
  bodyStrong: number;
  title: number;
  header: number;
};

export type AppThemeState = {
  mode: AppTheme;
  fontSize: AppFontSize;
  colors: AppThemeColors;
  fontSizes: AppThemeFontSizes;
  isLight: boolean;
  isDark: boolean;
  refreshTheme: () => Promise<void>;
};

const darkColors: AppThemeColors = {
  mode: "dark",
  background: "#05070C",
  card: "rgba(255,255,255,0.03)",
  cardStrong: "rgba(12,24,50,0.90)",
  border: "rgba(255,255,255,0.10)",
  text: "#FFFFFF",
  textSecondary: "#CBD5E1",
  textMuted: "#94A3B8",
  primary: "#2F80FF",
  success: "#22C55E",
  danger: "#EF4444",
  warning: "#F59E0B",
  iconSurface: "rgba(255,255,255,0.06)",
  inputSurface: "rgba(255,255,255,0.08)",
  overlayBase: "rgba(0,0,0,0.34)",
  overlayTop: "rgba(12,20,40,0.16)",
  overlayBottom: "rgba(0,0,0,0.20)",
};

const lightColors: AppThemeColors = {
  mode: "light",
  background: "#F8FAFC",
  card: "rgba(255,255,255,0.88)",
  cardStrong: "rgba(255,255,255,0.94)",
  border: "rgba(15,23,42,0.12)",
  text: "#111827",
  textSecondary: "#475569",
  textMuted: "#64748B",
  primary: "#2F80FF",
  success: "#16A34A",
  danger: "#DC2626",
  warning: "#D97706",
  iconSurface: "rgba(15,23,42,0.06)",
  inputSurface: "rgba(15,23,42,0.06)",
  overlayBase: "rgba(255,255,255,0.42)",
  overlayTop: "rgba(255,255,255,0.30)",
  overlayBottom: "rgba(255,255,255,0.20)",
};

const fontSizeMap: Record<AppFontSize, AppThemeFontSizes> = {
  small: {
    caption: 11,
    small: 12,
    body: 13,
    bodyStrong: 14,
    title: 16,
    header: 20,
  },
  medium: {
    caption: 12,
    small: 13,
    body: 14,
    bodyStrong: 16,
    title: 18,
    header: 22,
  },
  large: {
    caption: 13,
    small: 14,
    body: 16,
    bodyStrong: 18,
    title: 20,
    header: 24,
  },
};

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

function getInitialThemeForUser(userId: string | undefined): {
  mode: AppTheme;
  fontSize: AppFontSize;
} {
  const latestThemeUpdate = getLatestAppThemeUpdate();

  if (userId && latestThemeUpdate?.userId === userId) {
    return {
      mode: getSafeTheme(latestThemeUpdate.theme),
      fontSize: getSafeFontSize(latestThemeUpdate.fontSize),
    };
  }

  return {
    mode: "dark",
    fontSize: "medium",
  };
}

function themeStateMatches(
  currentMode: AppTheme,
  currentFontSize: AppFontSize,
  nextMode: AppTheme,
  nextFontSize: AppFontSize
) {
  return currentMode === nextMode && currentFontSize === nextFontSize;
}

export function useTheme(): AppThemeState {
  const { user, initializing } = useAuth();
  const initialTheme = getInitialThemeForUser(user?.uid);
  const isMountedRef = useRef(true);
  const activeUserIdRef = useRef<string | null>(user?.uid ?? null);

  const themeStateRef = useRef<{
    mode: AppTheme;
    fontSize: AppFontSize;
  }>({
    mode: initialTheme.mode,
    fontSize: initialTheme.fontSize,
  });

  const [mode, setMode] = useState<AppTheme>(initialTheme.mode);
  const [fontSize, setFontSize] = useState<AppFontSize>(
    initialTheme.fontSize
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    activeUserIdRef.current = user?.uid ?? null;
  }, [user]);

  const applyThemeState = useCallback(
    (nextMode: AppTheme, nextFontSize: AppFontSize) => {
      if (!isMountedRef.current) {
        return;
      }

      const safeMode = getSafeTheme(nextMode);
      const safeFontSize = getSafeFontSize(nextFontSize);

      if (
        themeStateMatches(
          themeStateRef.current.mode,
          themeStateRef.current.fontSize,
          safeMode,
          safeFontSize
        )
      ) {
        return;
      }

      themeStateRef.current = {
        mode: safeMode,
        fontSize: safeFontSize,
      };

      setMode(safeMode);
      setFontSize(safeFontSize);
    },
    []
  );

  const refreshTheme = useCallback(async () => {
    if (initializing) return;

    const activeUser = user;
    const activeUserId = activeUser?.uid ?? null;

    if (!activeUser) {
      applyThemeState("dark", "medium");
      return;
    }

    const latestThemeUpdate = getLatestAppThemeUpdate();

    if (latestThemeUpdate?.userId === activeUser.uid) {
      applyThemeState(latestThemeUpdate.theme, latestThemeUpdate.fontSize);
    }

    try {
      const profile = await getProfileSettings(activeUser.uid);

      if (
        !isMountedRef.current ||
        activeUserIdRef.current !== activeUserId
      ) {
        return;
      }

      const safeMode = getSafeTheme(profile.theme);
      const safeFontSize = getSafeFontSize(profile.fontSize);

      publishAppThemeUpdate(activeUser.uid, safeMode, safeFontSize);
      applyThemeState(safeMode, safeFontSize);
    } catch (err) {
      if (
        !isMountedRef.current ||
        activeUserIdRef.current !== activeUserId
      ) {
        return;
      }

      console.error("Failed to load theme settings:", err);

      const latestThemeUpdateAfterFailure = getLatestAppThemeUpdate();

      if (latestThemeUpdateAfterFailure?.userId === activeUser.uid) {
        applyThemeState(
          latestThemeUpdateAfterFailure.theme,
          latestThemeUpdateAfterFailure.fontSize
        );
        return;
      }

      applyThemeState("dark", "medium");
    }
  }, [applyThemeState, user, initializing]);

  useEffect(() => {
    if (!user) return;

    const activeUserId = user.uid;
    const latestThemeUpdate = getLatestAppThemeUpdate();

    if (latestThemeUpdate?.userId === activeUserId) {
      applyThemeState(latestThemeUpdate.theme, latestThemeUpdate.fontSize);
    }

    return subscribeToAppThemeUpdates((update) => {
      if (
        !isMountedRef.current ||
        activeUserIdRef.current !== activeUserId ||
        update.userId !== activeUserId
      ) {
        return;
      }

      applyThemeState(update.theme, update.fontSize);
    });
  }, [applyThemeState, user]);

  useEffect(() => {
    refreshTheme();
  }, [refreshTheme]);

  useFocusEffect(
    useCallback(() => {
      refreshTheme();
    }, [refreshTheme])
  );

  const activeColors = useMemo(() => {
    return mode === "light" ? lightColors : darkColors;
  }, [mode]);

  const activeFontSizes = useMemo(() => {
    return fontSizeMap[fontSize] ?? fontSizeMap.medium;
  }, [fontSize]);

  return {
    mode,
    fontSize,
    colors: activeColors,
    fontSizes: activeFontSizes,
    isLight: mode === "light",
    isDark: mode === "dark",
    refreshTheme,
  };
}