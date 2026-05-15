import { useEffect, useState } from "react";
import { Dimensions } from "react-native";

function getLayout() {
  // IMPORTANT: use SCREEN, not WINDOW
  const { width, height } = Dimensions.get("screen");

  const isLandscape = width > height;

  // iPad heuristic (stable across launch)
  const isTablet = Math.min(width, height) >= 768;

  return {
    isTablet,
    isLandscape,
    isTabletLandscape: isTablet && isLandscape,
    width,
    height,
  };
}

export function useDeviceLayout() {
  const [layout, setLayout] = useState(getLayout);

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", () => {
      setLayout(getLayout());
    });

    // force stable initial measurement AFTER mount
    const timeout = setTimeout(() => {
      setLayout(getLayout());
    }, 50);

    return () => {
      sub?.remove?.();
      clearTimeout(timeout);
    };
  }, []);

  return layout;
}