import { useWindowDimensions } from "react-native";

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();

  const isTablet = Math.max(width, height) >= 1024;
  const isLandscape = width > height;

  return {
    width,
    height,
    isTablet,
    isLandscape,
  };
}