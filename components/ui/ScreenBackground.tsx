import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ImageBackground,
  ImageResizeMode,
  StyleSheet,
  View,
  ViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../auth/AuthProvider";
import {
  BackgroundResizeMode,
  getProfileSettings,
} from "../../lib/settingsService";
import {
  getLatestAppBackgroundUpdate,
  subscribeToAppBackgroundUpdates,
} from "../../lib/backgroundUpdateBus";

type Props = ViewProps & {
  children: React.ReactNode;
  backgroundUriOverride?: string | null;
  backgroundResizeModeOverride?: BackgroundResizeMode;
};

const DEFAULT_BACKGROUND = require("../../assets/images/background_v4.jpg");

function isValidBackgroundUri(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function getSafeResizeMode(value: unknown): BackgroundResizeMode {
  if (value === "cover" || value === "contain" || value === "center") {
    return value;
  }

  return "cover";
}

export default function ScreenBackground({
  children,
  style,
  backgroundUriOverride,
  backgroundResizeModeOverride,
  ...rest
}: Props) {
  const { user, initializing } = useAuth();

  const latestPublishedVersionRef = useRef(0);

  const [backgroundUri, setBackgroundUri] = useState<string | null>(null);
  const [backgroundResizeMode, setBackgroundResizeMode] =
    useState<BackgroundResizeMode>("cover");
  const [backgroundLoadFailed, setBackgroundLoadFailed] = useState(false);

  const hasBackgroundUriOverride = backgroundUriOverride !== undefined;

  useEffect(() => {
    setBackgroundLoadFailed(false);
  }, [backgroundUriOverride, backgroundResizeModeOverride]);

  useEffect(() => {
    if (!user) return;

    const applyBackgroundUpdate = (update: {
      userId: string;
      uri: string | null;
      resizeMode: BackgroundResizeMode;
      version: number;
    }) => {
      if (update.userId !== user.uid) return;

      latestPublishedVersionRef.current = Math.max(
        latestPublishedVersionRef.current,
        update.version
      );

      setBackgroundLoadFailed(false);

      setBackgroundUri(
        isValidBackgroundUri(update.uri) ? update.uri?.trim() ?? null : null
      );

      setBackgroundResizeMode(getSafeResizeMode(update.resizeMode));
    };

    const latestUpdate = getLatestAppBackgroundUpdate();

    if (latestUpdate) {
      applyBackgroundUpdate(latestUpdate);
    }

    return subscribeToAppBackgroundUpdates(applyBackgroundUpdate);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadBackground() {
        if (initializing) return;

        const loadStartedAfterPublishedVersion =
          latestPublishedVersionRef.current;

        setBackgroundLoadFailed(false);

        if (!user) {
          if (!isActive) return;

          setBackgroundUri(null);
          setBackgroundResizeMode("cover");

          return;
        }

        try {
          const profile = await getProfileSettings(user.uid);

          if (!isActive) return;

          if (
            latestPublishedVersionRef.current !==
            loadStartedAfterPublishedVersion
          ) {
            return;
          }

          const savedBackgroundUri =
            typeof profile.backgroundPhotoUri === "string"
              ? profile.backgroundPhotoUri.trim()
              : "";

          const savedResizeMode = getSafeResizeMode(
            profile.backgroundResizeMode
          );

          setBackgroundUri(
            isValidBackgroundUri(savedBackgroundUri)
              ? savedBackgroundUri
              : null
          );

          setBackgroundResizeMode(savedResizeMode);
        } catch (err) {
          console.log("Failed to load saved background. Using default.", err);

          if (!isActive) return;

          setBackgroundUri(null);
          setBackgroundResizeMode("cover");
        }
      }

      loadBackground();

      return () => {
        isActive = false;
      };
    }, [user, initializing])
  );

  const effectiveBackgroundUri = hasBackgroundUriOverride
    ? typeof backgroundUriOverride === "string"
      ? backgroundUriOverride.trim()
      : ""
    : backgroundUri;

  const effectiveResizeMode = backgroundResizeModeOverride
    ? getSafeResizeMode(backgroundResizeModeOverride)
    : backgroundResizeMode;

  const shouldUseSavedBackground =
    isValidBackgroundUri(effectiveBackgroundUri) &&
    !backgroundLoadFailed;

  const imageSource = shouldUseSavedBackground
    ? { uri: effectiveBackgroundUri as string }
    : DEFAULT_BACKGROUND;

  const resizeMode: ImageResizeMode = shouldUseSavedBackground
    ? effectiveResizeMode
    : "cover";

  return (
    <ImageBackground
      source={imageSource}
      style={styles.background}
      imageStyle={styles.image}
      resizeMode={resizeMode}
      onError={() => {
        if (shouldUseSavedBackground) {
          console.log("Saved background image failed to load. Using default.");

          setBackgroundLoadFailed(true);

          if (!hasBackgroundUriOverride) {
            setBackgroundUri(null);
          }
        }
      }}
    >
      <View style={styles.baseOverlay} />
      <View style={styles.topGlow} />
      <View style={styles.bottomShade} />

      <SafeAreaView style={[styles.safeArea, style]} {...rest}>
        {children}
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#05070C",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  baseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.34)",
  },

  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "32%",
    backgroundColor: "rgba(12,20,40,0.16)",
  },

  bottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "38%",
    backgroundColor: "rgba(0,0,0,0.20)",
  },

  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
});