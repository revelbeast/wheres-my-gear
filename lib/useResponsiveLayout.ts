import { useWindowDimensions, Platform } from "react-native";

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();

  const isLandscape = width > height;

  const isPad =
    Platform.OS === "ios" &&
    (Platform.isPad === true || Math.min(width, height) >= 768);

  const isTablet = isPad;

  const isTabletLandscape = isTablet && isLandscape;

  return {
    width,
    height,
    isTablet,
    isLandscape,
    isTabletLandscape,
  };
}