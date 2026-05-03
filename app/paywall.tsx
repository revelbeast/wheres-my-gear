import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { ArrowLeft, CheckCircle2, Crown } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { SafeAreaView } from "react-native-safe-area-context";

import ScreenBackground from "../components/ui/ScreenBackground";
import {
  ThemedButton,
  ThemedText,
  useThemedValues,
} from "../components/ui/Themed";
import {
  getOfferings,
  hasActivePremiumEntitlement,
  isPremiumUser,
  purchasePackage,
  restorePurchases,
} from "../lib/revenuecat";

const PRIVACY_POLICY_URL = "https://revelbeast.github.io/wheres-my-gear-legal/";
const TERMS_OF_USE_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

export default function PaywallScreen() {
  const theme = useThemedValues();

  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(
    null
  );

  const priceText = useMemo(() => {
    return annualPackage?.product?.priceString ?? "$12.99/year";
  }, [annualPackage]);

  useEffect(() => {
    loadPaywall();
  }, []);

  async function loadPaywall() {
    try {
      setLoading(true);

      const offerings = await getOfferings();

      const pkg =
        offerings?.current?.annual ??
        offerings?.current?.availablePackages?.[0] ??
        null;

      setAnnualPackage(pkg);
    } catch (error) {
      console.error("Failed to load paywall:", error);
      setAnnualPackage(null);
    } finally {
      setLoading(false);
    }
  }

  async function openLink(url: string) {
    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert("Unable to open link", "Please try again later.");
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error("Failed to open link:", error);
      Alert.alert("Unable to open link", "Please try again later.");
    }
  }

  async function handlePurchase() {
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
          { text: "Try Again", onPress: loadPaywall },
          { text: "OK", style: "cancel" },
        ]
      );
      return;
    }

    try {
      setPurchasing(true);

      const customerInfo = await purchasePackage(annualPackage);
      const activePremium = hasActivePremiumEntitlement(customerInfo);

      if (activePremium) {
        Alert.alert(
          "Premium unlocked",
          "Your Premium subscription is now active.",
          [{ text: "Continue", onPress: () => router.back() }]
        );
        return;
      }

      const premium = await isPremiumUser();

      if (premium) {
        Alert.alert(
          "Premium restored",
          "Your Premium subscription is active.",
          [{ text: "Continue", onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          "Purchase not completed",
          "Premium was not activated. Please try again."
        );
      }
    } catch (error: any) {
      console.error("Purchase failed:", error);

      if (error?.userCancelled) return;

      Alert.alert(
        "Purchase unavailable",
        "We could not complete the Premium purchase. Please try again."
      );
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    try {
      setRestoring(true);

      const customerInfo = await restorePurchases();
      const activePremium = hasActivePremiumEntitlement(customerInfo);

      if (activePremium) {
        Alert.alert(
          "Purchases restored",
          "Your Premium subscription is active.",
          [{ text: "Continue", onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          "No active subscription found",
          "We could not find an active Premium subscription for this Apple ID."
        );
      }
    } catch (error) {
      console.error("Restore failed:", error);
      Alert.alert(
        "Restore unavailable",
        "We could not restore purchases. Please try again."
      );
    } finally {
      setRestoring(false);
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={22} color="#FFFFFF" />
            </Pressable>

            <ThemedText variant="title" style={styles.headerTitle}>
              Premium
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
              Upgrade to Premium
            </ThemedText>

            <ThemedText style={styles.heroSubtitle}>
              Remove ads and unlock premium features for organizing your gear,
              storage spaces, compartments, and checklists.
            </ThemedText>

            <View style={styles.priceWrap}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <ThemedText variant="header" style={styles.priceText}>
                    Premium Subscription
                  </ThemedText>
                  <ThemedText style={styles.subscriptionText}>
                    Annual plan
                  </ThemedText>
                  <ThemedText variant="header" style={styles.priceText}>
                    {priceText}
                  </ThemedText>
                  <ThemedText style={styles.trialText}>
                    Includes your 7-day free trial when available.
                  </ThemedText>
                </>
              )}
            </View>

            <View style={styles.featureList}>
              <FeatureRow text="Remove ads across the app" />
              <FeatureRow text="Unlock Premium organizer features" />
              <FeatureRow text="Keep storage spaces, compartments, and checklists organized" />
              <FeatureRow text="Restore purchases anytime" />
            </View>

            <ThemedButton
              style={styles.subscribeButton}
              onPress={handlePurchase}
              disabled={purchasing}
            >
              <ThemedText style={styles.subscribeButtonText}>
                {purchasing ? "Processing..." : "Start Premium"}
              </ThemedText>
            </ThemedButton>

            <Pressable
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={restoring}
            >
              <ThemedText style={styles.restoreText}>
                {restoring ? "Restoring..." : "Restore Purchases"}
              </ThemedText>
            </Pressable>

            <ThemedText style={styles.disclaimerText}>
              Premium is an auto-renewable annual subscription. Subscription
              renews automatically unless canceled at least 24 hours before the
              end of the current period. Manage or cancel in your Apple ID
              subscriptions.
            </ThemedText>

            <View style={styles.legalLinksRow}>
              <Pressable
                onPress={() => openLink(PRIVACY_POLICY_URL)}
                style={styles.legalLinkButton}
              >
                <ThemedText style={styles.legalLinkText}>
                  Privacy Policy
                </ThemedText>
              </Pressable>

              <ThemedText style={styles.legalDivider}>•</ThemedText>

              <Pressable
                onPress={() => openLink(TERMS_OF_USE_URL)}
                style={styles.legalLinkButton}
              >
                <ThemedText style={styles.legalLinkText}>
                  Terms of Use
                </ThemedText>
              </Pressable>
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
});