import { useWindowDimensions } from "react-native";

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768;
  const isLandscape = width > height;

  return {
    width,
    height,
    isTablet,
    isLandscape,
  };
}