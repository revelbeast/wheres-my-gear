import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../components/auth/AuthProvider";
import {
    AppFontSize,
    AppTheme,
    getProfileSettings,
} from "./settingsService";

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

export function useTheme(): AppThemeState {
  const { user, initializing } = useAuth();

  const [mode, setMode] = useState<AppTheme>("dark");
  const [fontSize, setFontSize] = useState<AppFontSize>("medium");

  const refreshTheme = useCallback(async () => {
    if (initializing) return;

    if (!user) {
      setMode("dark");
      setFontSize("medium");
      return;
    }

    try {
      const profile = await getProfileSettings(user.uid);
      setMode(profile.theme ?? "dark");
      setFontSize(profile.fontSize ?? "medium");
    } catch (err) {
      console.error("Failed to load theme settings:", err);
      setMode("dark");
      setFontSize("medium");
    }
  }, [user, initializing]);

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