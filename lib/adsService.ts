import { Platform } from "react-native";

let adsInitializationPromise: Promise<boolean> | null = null;

async function requestTrackingPermissionSafely() {
  if (Platform.OS !== "ios") {
    return;
  }

  try {
    const trackingTransparency = require("expo-tracking-transparency");

    const currentStatus =
      await trackingTransparency.getTrackingPermissionsAsync();

    if (currentStatus.status === "undetermined") {
      await trackingTransparency.requestTrackingPermissionsAsync();
    }
  } catch (error) {
    console.error("Ad tracking permission request failed:", error);
  }
}

export async function initializeAdsSafely() {
  if (adsInitializationPromise) {
    return adsInitializationPromise;
  }

  adsInitializationPromise = (async () => {
    try {
      await requestTrackingPermissionSafely();

      const googleMobileAds = require("react-native-google-mobile-ads");
      const mobileAds = googleMobileAds.default ?? googleMobileAds;

      await mobileAds().initialize();

      console.log("Google Mobile Ads initialized safely.");
      return true;
    } catch (error) {
      console.error("Google Mobile Ads initialization failed:", error);
      return false;
    }
  })();

  return adsInitializationPromise;
}