import React, { useCallback, useState } from "react";
import { ImageBackground, StyleSheet, View, ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import { useAuth } from "../auth/AuthProvider";
import { getProfileSettings } from "../../lib/settingsService";

type Props = ViewProps & {
  children: React.ReactNode;
};

export default function ScreenBackground({
  children,
  style,
  ...rest
}: Props) {
  const { user, initializing } = useAuth();
  const [backgroundUri, setBackgroundUri] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadBackground() {
        if (initializing) return;

        if (!user) {
          if (!isActive) return;
          setBackgroundUri(null);
          return;
        }

        try {
          const profile = await getProfileSettings(user.uid);
          if (!isActive) return;
          setBackgroundUri((profile as any)?.backgroundPhotoUri ?? null);
        } catch (err) {
          console.error("Failed to load background:", err);
          if (!isActive) return;
          setBackgroundUri(null);
        }
      }

      loadBackground();

      return () => {
        isActive = false;
      };
    }, [user, initializing])
  );

  return (
    <ImageBackground
      key={backgroundUri || "default-background"}
      source={
        backgroundUri
          ? { uri: backgroundUri }
          : require("../../assets/images/background_v4.jpg")
      }
      style={styles.background}
      imageStyle={styles.image}
      resizeMode="cover"
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
  },
});