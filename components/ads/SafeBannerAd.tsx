import React, { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

type SafeBannerAdProps = {
  enabled?: boolean;
};

const IOS_PRODUCTION_BANNER_AD_UNIT_ID =
  "ca-app-pub-6678004145625444/3104443587";

export default function SafeBannerAd({ enabled = true }: SafeBannerAdProps) {
  const [adsModule, setAdsModule] = useState<any>(null);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    try {
      const googleMobileAds = require("react-native-google-mobile-ads");
      setAdsModule(googleMobileAds);
      setHasFailed(false);
    } catch (error) {
      console.error("Failed to load banner ad module:", error);
      setAdsModule(null);
      setHasFailed(true);
    }
  }, [enabled]);

  const adUnitId = useMemo(() => {
    if (!adsModule) return "";

    const testIds = adsModule.TestIds;

    if (__DEV__) {
      return testIds?.BANNER ?? "";
    }

    if (Platform.OS === "ios") {
      return IOS_PRODUCTION_BANNER_AD_UNIT_ID;
    }

    return "";
  }, [adsModule]);

  if (!enabled || hasFailed || !adsModule || !adUnitId) {
    return null;
  }

  const BannerAd = adsModule.BannerAd;
  const BannerAdSize = adsModule.BannerAdSize;

  if (!BannerAd || !BannerAdSize) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error: unknown) => {
          console.error("Banner ad failed to load:", error);
          setHasFailed(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
});