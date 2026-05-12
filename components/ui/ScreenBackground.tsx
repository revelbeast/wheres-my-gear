import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
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

type CachedBackgroundState = {
  userId: string;
  uri: string | null;
  resizeMode: BackgroundResizeMode;
};

const DEFAULT_BACKGROUND = require("../../assets/images/background_v4.jpg");

let cachedBackgroundState: CachedBackgroundState | null = null;

function isValidBackgroundUri(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function getSafeResizeMode(value: unknown): BackgroundResizeMode {
  if (value === "cover" || value === "contain" || value === "center") {
    return value;
  }

  return "cover";
}

function getSafeUri(value: unknown): string | null {
  return isValidBackgroundUri(value) ? (value as string).trim() : null;
}

function getCachedBackgroundForUser(
  userId: string | undefined
): CachedBackgroundState | null {
  if (!userId || cachedBackgroundState?.userId !== userId) {
    return null;
  }

  return cachedBackgroundState;
}

function setCachedBackgroundForUser(
  userId: string,
  uri: string | null,
  resizeMode: BackgroundResizeMode
) {
  cachedBackgroundState = {
    userId,
    uri: getSafeUri(uri),
    resizeMode: getSafeResizeMode(resizeMode),
  };
}

function getInitialBackgroundForUser(
  userId: string | undefined
): CachedBackgroundState | null {
  const cachedBackground = getCachedBackgroundForUser(userId);

  if (cachedBackground) {
    return cachedBackground;
  }

  const latestBackgroundUpdate = getLatestAppBackgroundUpdate();

  if (userId && latestBackgroundUpdate?.userId === userId) {
    const initialBackground = {
      userId,
      uri: getSafeUri(latestBackgroundUpdate.uri),
      resizeMode: getSafeResizeMode(latestBackgroundUpdate.resizeMode),
    };

    cachedBackgroundState = initialBackground;

    return initialBackground;
  }

  return null;
}

function backgroundsMatch(
  currentUri: string | null,
  currentResizeMode: BackgroundResizeMode,
  nextUri: string | null,
  nextResizeMode: BackgroundResizeMode
) {
  return currentUri === nextUri && currentResizeMode === nextResizeMode;
}

export default function ScreenBackground({
  children,
  style,
  backgroundUriOverride,
  backgroundResizeModeOverride,
  ...rest
}: Props) {
  const { user, initializing } = useAuth();

  const initialBackground = getInitialBackgroundForUser(user?.uid);
  const latestPublishedVersionRef = useRef(0);
  const backgroundStateRef = useRef<{
    uri: string | null;
    resizeMode: BackgroundResizeMode;
  }>({
    uri: initialBackground?.uri ?? null,
    resizeMode: initialBackground?.resizeMode ?? "cover",
  });

  const [backgroundUri, setBackgroundUri] = useState<string | null>(
    initialBackground?.uri ?? null
  );
  const [backgroundResizeMode, setBackgroundResizeMode] =
    useState<BackgroundResizeMode>(initialBackground?.resizeMode ?? "cover");
  const [backgroundLoadFailed, setBackgroundLoadFailed] = useState(false);

  const hasBackgroundUriOverride = backgroundUriOverride !== undefined;

  const applyBackgroundState = useCallback(
    (nextUri: string | null, nextResizeMode: BackgroundResizeMode) => {
      const safeUri = getSafeUri(nextUri);
      const safeResizeMode = getSafeResizeMode(nextResizeMode);

      if (
        backgroundsMatch(
          backgroundStateRef.current.uri,
          backgroundStateRef.current.resizeMode,
          safeUri,
          safeResizeMode
        )
      ) {
        return;
      }

      backgroundStateRef.current = {
        uri: safeUri,
        resizeMode: safeResizeMode,
      };

      setBackgroundUri(safeUri);
      setBackgroundResizeMode(safeResizeMode);
    },
    []
  );

  useEffect(() => {
    setBackgroundLoadFailed(false);
  }, [backgroundUriOverride, backgroundResizeModeOverride]);

  useEffect(() => {
    const uriToPrefetch = hasBackgroundUriOverride
      ? getSafeUri(backgroundUriOverride)
      : getSafeUri(backgroundUri);

    if (!uriToPrefetch) {
      return;
    }

    void Image.prefetch(uriToPrefetch).catch((error) => {
      console.log("Failed to prefetch saved background image.", error);
    });
  }, [backgroundUri, backgroundUriOverride, hasBackgroundUriOverride]);

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

      const safeUri = getSafeUri(update.uri);
      const safeResizeMode = getSafeResizeMode(update.resizeMode);

      setCachedBackgroundForUser(user.uid, safeUri, safeResizeMode);
      setBackgroundLoadFailed(false);
      applyBackgroundState(safeUri, safeResizeMode);
    };

    const latestUpdate = getLatestAppBackgroundUpdate();

    if (latestUpdate) {
      applyBackgroundUpdate(latestUpdate);
    }

    return subscribeToAppBackgroundUpdates(applyBackgroundUpdate);
  }, [applyBackgroundState, user]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadBackground() {
        if (initializing) return;

        const loadStartedAfterPublishedVersion =
          latestPublishedVersionRef.current;

        if (!user) {
          if (!isActive) return;

          cachedBackgroundState = null;
          applyBackgroundState(null, "cover");

          return;
        }

        const cachedState = getInitialBackgroundForUser(user.uid);

        if (cachedState) {
          applyBackgroundState(cachedState.uri, cachedState.resizeMode);
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

          const safeUri = getSafeUri(profile.backgroundPhotoUri);
          const safeResizeMode = getSafeResizeMode(
            profile.backgroundResizeMode
          );

          setCachedBackgroundForUser(user.uid, safeUri, safeResizeMode);
          applyBackgroundState(safeUri, safeResizeMode);
        } catch (err) {
          console.log("Failed to load saved background. Using default.", err);

          if (!isActive) return;

          const cachedStateAfterFailure = getInitialBackgroundForUser(user.uid);

          if (cachedStateAfterFailure) {
            applyBackgroundState(
              cachedStateAfterFailure.uri,
              cachedStateAfterFailure.resizeMode
            );
            return;
          }

          applyBackgroundState(null, "cover");
        }
      }

      loadBackground();

      return () => {
        isActive = false;
      };
    }, [applyBackgroundState, user, initializing])
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
            applyBackgroundState(null, "cover");
          }
        }
      }}
    >
      <View
        style={[
          styles.baseOverlay,
          { backgroundColor: "rgba(0,0,0,0.18)" }
        ]}
      />
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