import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ImageBackground, StyleSheet, View, ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../auth/AuthProvider";
import { getProfileSettings } from "../../lib/settingsService";

type Props = ViewProps & {
  children: React.ReactNode;
};

const DEFAULT_BACKGROUND = require("../../assets/images/background_v4.jpg");

function isValidBackgroundUri(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export default function ScreenBackground({
  children,
  style,
  ...rest
}: Props) {
  const { user, initializing } = useAuth();
  const [backgroundUri, setBackgroundUri] = useState<string | null>(null);
  const [backgroundLoadFailed, setBackgroundLoadFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadBackground() {
        if (initializing) return;

        if (!user) {
          if (!isActive) return;
          setBackgroundUri(null);
          setBackgroundLoadFailed(false);
          return;
        }

        try {
          const profile = await getProfileSettings(user.uid);
          const savedBackgroundUri = (profile as any)?.backgroundPhotoUri;

          if (!isActive) return;

          if (isValidBackgroundUri(savedBackgroundUri)) {
            setBackgroundUri(savedBackgroundUri.trim());
            setBackgroundLoadFailed(false);
          } else {
            setBackgroundUri(null);
            setBackgroundLoadFailed(false);
          }
        } catch (err) {
          console.log("Failed to load saved background. Using default.", err);

          if (!isActive) return;

          setBackgroundUri(null);
          setBackgroundLoadFailed(false);
        }
      }

      loadBackground();

      return () => {
        isActive = false;
      };
    }, [user, initializing])
  );

  const useSavedBackground =
    typeof backgroundUri === "string" &&
    backgroundUri.trim().length > 0 &&
    !backgroundLoadFailed;

  const imageSource = useSavedBackground
    ? { uri: backgroundUri }
    : DEFAULT_BACKGROUND;

  return (
    <ImageBackground
      key={useSavedBackground ? backgroundUri : "default-background"}
      source={imageSource}
      style={styles.background}
      imageStyle={styles.image}
      resizeMode="cover"
      onError={() => {
        if (useSavedBackground) {
          console.log("Saved background image failed to load. Using default.");
          setBackgroundLoadFailed(true);
          setBackgroundUri(null);
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