import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, CheckCircle2, Crown } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { SafeAreaView } from "react-native-safe-area-context";

import HapticPressable from "../components/ui/HapticPressable";
import ScreenBackground from "../components/ui/ScreenBackground";
import {
  ThemedButton,
  ThemedText,
  useThemedValues,
} from "../components/ui/Themed";
import {
  getOfferings,
  hasActivePremiumEntitlement,
  hasActivePremiumPlusEntitlement,
  isPremiumPlusUser,
  isPremiumUser,
  purchasePackage,
  restorePurchases,
} from "../lib/revenuecat";

const PRIVACY_POLICY_URL = "https://revelbeast.github.io/wheres-my-gear/";
const TERMS_OF_USE_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

export default function PaywallScreen() {
  const theme = useThemedValues();
  const params = useLocalSearchParams<{
    plan?: string;
  }>();

  const isPremiumPlusPaywall = params.plan === "premium_plus";
  const isMountedRef = useRef(true);
  const paywallLoadVersionRef = useRef(0);
  const purchaseVersionRef = useRef(0);
  const restoreVersionRef = useRef(0);
  const linkOpenVersionRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(
    null
  );

  const priceText = useMemo(() => {
    return annualPackage?.product?.priceString ?? (isPremiumPlusPaywall ? "$17.99/year" : "$12.99/year");
  }, [annualPackage, isPremiumPlusPaywall]);

  useEffect(() => {
    isMountedRef.current = true;

    const loadVersion = paywallLoadVersionRef.current + 1;
    paywallLoadVersionRef.current = loadVersion;

    void loadPaywall(loadVersion);

    return () => {
      isMountedRef.current = false;
      paywallLoadVersionRef.current += 1;
      purchaseVersionRef.current += 1;
      restoreVersionRef.current += 1;
      linkOpenVersionRef.current += 1;
    };
  }, []);

  function handleBackPress() {
    if (purchasing || restoring) {
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/profile");
  }

  async function loadPaywall(loadVersion?: number) {
    const activeLoadVersion =
      loadVersion ?? paywallLoadVersionRef.current + 1;

    if (!loadVersion) {
      paywallLoadVersionRef.current = activeLoadVersion;
    }

    try {
      if (isMountedRef.current) {
        setLoading(true);
      }

      const offerings = await getOfferings();

      if (
        !isMountedRef.current ||
        paywallLoadVersionRef.current !== activeLoadVersion
      ) {
        return;
      }

      const availablePackages = offerings?.current?.availablePackages ?? [];
      const targetProductId = isPremiumPlusPaywall
        ? (Platform.OS === "android"
            ? "premium_plus_annual:premium-plus-annual"
            : "premium_plus_annual")
        : (Platform.OS === "android"
            ? "premium_annual:premium-annual"
            : "premium_annual");

      const matchedPackage =
        availablePackages.find(
          (availablePackage) =>
            availablePackage.product.identifier === targetProductId
        ) ?? null;

      const pkg = isPremiumPlusPaywall
        ? matchedPackage
        : matchedPackage ?? offerings?.current?.annual ?? availablePackages[0] ?? null;

      setAnnualPackage(pkg);
    } catch (error) {
      console.error("Failed to load paywall:", error);

      if (
        !isMountedRef.current ||
        paywallLoadVersionRef.current !== activeLoadVersion
      ) {
        return;
      }

      setAnnualPackage(null);
    } finally {
      if (
        isMountedRef.current &&
        paywallLoadVersionRef.current === activeLoadVersion
      ) {
        setLoading(false);
      }
    }
  }

  async function openLink(url: string) {
    const activeLinkVersion = linkOpenVersionRef.current + 1;
    linkOpenVersionRef.current = activeLinkVersion;

    try {
      const supported = await Linking.canOpenURL(url);

      if (
        !isMountedRef.current ||
        linkOpenVersionRef.current !== activeLinkVersion
      ) {
        return;
      }

      if (!supported) {
        Alert.alert("Unable to open link", "Please try again later.");
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error("Failed to open link:", error);

      if (
        !isMountedRef.current ||
        linkOpenVersionRef.current !== activeLinkVersion
      ) {
        return;
      }

      Alert.alert("Unable to open link", "Please try again later.");
    }
  }

  async function handlePurchase() {
    if (purchasing || restoring) {
      return;
    }

    if (loading) {
      Alert.alert(
        "Subscription loading",
        "Premium is still loading. Please try again in a moment."
      );
      return;
    }

    if (!annualPackage) {
      Alert.alert(
        "Subscription unavailable",
        "The Premium subscription could not be loaded. Please check your connection and try again.",
        [
          { text: "Try Again", onPress: () => void loadPaywall() },
          { text: "OK", style: "cancel" },
        ]
      );
      return;
    }

    const activePurchaseVersion = purchaseVersionRef.current + 1;
    purchaseVersionRef.current = activePurchaseVersion;

    try {
      if (isMountedRef.current) {
        setPurchasing(true);
      }

      const customerInfo = await purchasePackage(annualPackage);

      if (
        !isMountedRef.current ||
        purchaseVersionRef.current !== activePurchaseVersion
      ) {
        return;
      }

      const purchaseActivated = isPremiumPlusPaywall
        ? hasActivePremiumPlusEntitlement(customerInfo)
        : hasActivePremiumEntitlement(customerInfo);

      if (purchaseActivated) {
        Alert.alert(
          isPremiumPlusPaywall ? "Premium+ unlocked" : "Premium unlocked",
          isPremiumPlusPaywall
            ? "Your Premium+ subscription is now active."
            : "Your Premium subscription is now active.",
          [
            {
              text: "Continue",
              onPress: () => {
                if (isMountedRef.current) {
                  router.replace("/(tabs)");
                }
              },
            },
          ]
        );
        return;
      }

      const premium = isPremiumPlusPaywall
        ? await isPremiumPlusUser()
        : await isPremiumUser();

      if (
        !isMountedRef.current ||
        purchaseVersionRef.current !== activePurchaseVersion
      ) {
        return;
      }

      if (premium) {
        Alert.alert(
          isPremiumPlusPaywall
            ? "Premium+ restored"
            : "Premium restored",
          isPremiumPlusPaywall
            ? "Your Premium+ subscription is active."
            : "Your Premium subscription is active.",
          [
            {
              text: "Continue",
              onPress: () => {
                if (isMountedRef.current) {
                  router.replace("/(tabs)");
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          "Purchase not completed",
          "Premium was not activated. Please try again."
        );
      }
    } catch (error: any) {
      console.error("Purchase failed:", error);

      if (
        !isMountedRef.current ||
        purchaseVersionRef.current !== activePurchaseVersion
      ) {
        return;
      }

      if (error?.userCancelled) return;

      Alert.alert(
        "Purchase unavailable",
        "We could not complete the Premium purchase. Please try again."
      );
    } finally {
      if (
        isMountedRef.current &&
        purchaseVersionRef.current === activePurchaseVersion
      ) {
        setPurchasing(false);
      }
    }
  }

  async function handleRestore() {
    if (purchasing || restoring) {
      return;
    }

    const activeRestoreVersion = restoreVersionRef.current + 1;
    restoreVersionRef.current = activeRestoreVersion;

    try {
      if (isMountedRef.current) {
        setRestoring(true);
      }

      const customerInfo = await restorePurchases();

      if (
        !isMountedRef.current ||
        restoreVersionRef.current !== activeRestoreVersion
      ) {
        return;
      }

      const restoredAccess = isPremiumPlusPaywall
        ? hasActivePremiumPlusEntitlement(customerInfo)
        : hasActivePremiumEntitlement(customerInfo);

      if (restoredAccess) {
        Alert.alert(
          "Purchases restored",
          isPremiumPlusPaywall
            ? "Your Premium+ subscription is active."
            : "Your Premium subscription is active.",
          [
            {
              text: "Continue",
              onPress: () => {
                if (isMountedRef.current) {
                  router.replace("/(tabs)");
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          "No active subscription found",
          "We could not find an active Premium subscription for this Apple ID."
        );
      }
    } catch (error) {
      console.error("Restore failed:", error);

      if (
        !isMountedRef.current ||
        restoreVersionRef.current !== activeRestoreVersion
      ) {
        return;
      }

      Alert.alert(
        "Restore unavailable",
        "We could not restore purchases. Please try again."
      );
    } finally {
      if (
        isMountedRef.current &&
        restoreVersionRef.current === activeRestoreVersion
      ) {
        setRestoring(false);
      }
    }
  }

  const actionDisabled = purchasing || restoring;

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <HapticPressable
              style={[styles.backButton, actionDisabled && styles.disabledAction]}
              onPress={handleBackPress}
              disabled={actionDisabled}
            >
              <ArrowLeft size={22} color="#FFFFFF" />
            </HapticPressable>

            <ThemedText variant="title" style={styles.headerTitle}>
              {isPremiumPlusPaywall ? "Premium+" : "Premium"}
            </ThemedText>

            <View style={styles.headerSpacer} />
          </View>

          <BlurView
            intensity={35}
            tint="dark"
            style={[
              styles.heroCard,
              {
                borderColor: theme.colors.border,
                backgroundColor: "rgba(7, 20, 44, 0.72)",
              },
            ]}
          >
            <View style={styles.iconCircle}>
              <Crown size={34} color="#FFFFFF" />
            </View>

            <ThemedText variant="header" style={styles.heroTitle}>
              {isPremiumPlusPaywall
                ? "Upgrade to Premium+"
                : "Upgrade to Premium"}
            </ThemedText>

            <ThemedText style={styles.heroSubtitle}>
              {isPremiumPlusPaywall
                ? "Unlock Gear Assistant, Scan w/AI, QR / Barcode Scanner, Create QR Labels, and Archive access."
                : "Remove ads and unlock premium features for organizing your gear, storage spaces, compartments, and checklists."}
            </ThemedText>

            <View style={styles.priceWrap}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <ThemedText variant="header" style={styles.priceText}>
                    {isPremiumPlusPaywall
                      ? "Premium+ Subscription"
                      : "Premium Subscription"}
                  </ThemedText>
                  <ThemedText style={styles.subscriptionText}>
                    Annual plan
                  </ThemedText>
                  <ThemedText variant="header" style={styles.priceText}>
                    {priceText}
                  </ThemedText>
                  <ThemedText style={styles.trialText}>
                    7 days free, then {priceText}. Cancel anytime.
                  </ThemedText>
                </>
              )}
            </View>

            <View style={styles.featureList}>
              {isPremiumPlusPaywall ? (
                <>
                  <FeatureRow text="Gear Assistant voice inventory" />
                  <FeatureRow text="Scan w/AI smart gear recognition" />
                  <FeatureRow text="QR / Barcode Scanner access" />
                  <FeatureRow text="Create QR Labels for boxes, bins, shelves, and compartments" />
                  <FeatureRow text="Archive access for hidden gear" />
                  <FeatureRow text="Future smart gear tools and scan enhancements" />
                  <FeatureRow text="Includes all Premium features" />
                </>
              ) : (
                <>
                  <FeatureRow text="Remove ads across the app" />
                  <FeatureRow text="Unlock Premium organizer features" />
                  <FeatureRow text="Keep storage spaces, compartments, and checklists organized" />
                  <FeatureRow text="Restore purchases anytime" />
                </>
              )}
            </View>

            <ThemedButton
              style={styles.subscribeButton}
              onPress={handlePurchase}
              disabled={loading || actionDisabled}
            >
              <ThemedText style={styles.subscribeButtonText}>
                {purchasing
                  ? "Processing..."
                  : isPremiumPlusPaywall
                    ? "Upgrade to Premium+"
                    : "Start 7-Day Free Trial"}
              </ThemedText>
            </ThemedButton>

            <HapticPressable
              style={[styles.restoreButton, actionDisabled && styles.disabledAction]}
              onPress={handleRestore}
              disabled={actionDisabled}
            >
              <ThemedText style={styles.restoreText}>
                {restoring ? "Restoring..." : "Restore Purchases"}
              </ThemedText>
            </HapticPressable>

            <ThemedText style={styles.disclaimerText}>
              Premium is an auto-renewable annual subscription. Subscription
              renews automatically unless canceled at least 24 hours before the
              end of the current period. Manage or cancel in your Apple ID
              subscriptions.
            </ThemedText>

            <View style={styles.legalLinksRow}>
              <HapticPressable
                onPress={() => openLink(PRIVACY_POLICY_URL)}
                style={[
                  styles.legalLinkButton,
                  actionDisabled && styles.disabledAction,
                ]}
                disabled={actionDisabled}
              >
                <ThemedText style={styles.legalLinkText}>
                  Privacy Policy
                </ThemedText>
              </HapticPressable>

              <ThemedText style={styles.legalDivider}>•</ThemedText>

              <HapticPressable
                onPress={() => openLink(TERMS_OF_USE_URL)}
                style={[
                  styles.legalLinkButton,
                  actionDisabled && styles.disabledAction,
                ]}
                disabled={actionDisabled}
              >
                <ThemedText style={styles.legalLinkText}>
                  Terms of Use
                </ThemedText>
              </HapticPressable>
            </View>
          </BlurView>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function FeatureRow({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <CheckCircle2 size={18} color="#22C55E" />
      <ThemedText style={styles.featureText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 130,
  },
  headerRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  headerTitle: { color: "#FFFFFF", fontWeight: "800" },
  headerSpacer: { width: 42 },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 18,
    backgroundColor: "rgba(37, 99, 235, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  heroTitle: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    marginBottom: 10,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.84)",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },
  priceWrap: {
    minHeight: 112,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  priceText: {
    color: "#FFFFFF",
    fontWeight: "900",
    textAlign: "center",
  },
  subscriptionText: {
    color: "rgba(255,255,255,0.78)",
    marginTop: 6,
    marginBottom: 6,
    textAlign: "center",
    fontWeight: "700",
  },
  trialText: {
    color: "rgba(255,255,255,0.72)",
    marginTop: 6,
    textAlign: "center",
  },
  featureList: {
    gap: 12,
    marginTop: 8,
    marginBottom: 22,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    flex: 1,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 20,
  },
  subscribeButton: {
    minHeight: 52,
    borderRadius: 16,
    marginTop: 2,
  },
  subscribeButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  restoreButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  restoreText: {
    color: "#FFFFFF",
    fontWeight: "700",
    opacity: 0.9,
  },
  disclaimerText: {
    color: "rgba(255,255,255,0.62)",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 17,
  },
  legalLinksRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 14,
    gap: 8,
  },
  legalLinkButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  legalLinkText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  legalDivider: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
  },
  disabledAction: {
    opacity: 0.6,
  },
});