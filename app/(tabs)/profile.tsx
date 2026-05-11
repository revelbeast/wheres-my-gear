import Constants from "expo-constants";
import { router } from "expo-router";
import {
  ChevronRight,
  CircleHelp,
  Crown,
  FileText,
  Info,
  LogOut,
  Moon,
  RotateCcw,
  ShieldCheck,
  Star,
  Trash2,
  User,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, getDocs, writeBatch } from "firebase/firestore";

import ScreenBackground from "../../components/ui/ScreenBackground";
import { useAuth } from "../../components/auth/AuthProvider";
import HapticPressable from "../../components/ui/HapticPressable";
import {
  ThemedCard,
  ThemedText,
  useThemedValues,
} from "../../components/ui/Themed";
import { db } from "../../firebaseConfig";
import {
  getCustomerInfo,
  hasActivePremiumEntitlement,
  isPremiumUser,
  restorePurchases,
} from "../../lib/revenuecat";
import { useInteractionLock } from "../../lib/useInteractionLock";

const USER_AGREEMENT_URL =
  "https://sites.google.com/view/wheresmygearapp/home";

const PRIVACY_POLICY_URL =
  "https://revelbeast.github.io/wheres-my-gear-legal/";

const APP_STORE_REVIEW_URL =
  "https://apps.apple.com/app/id6762979732?action=write-review";

const APP_STORE_FALLBACK_URL =
  "https://apps.apple.com/app/id6762979732";

function ProfileRow({
    icon,
    title,
    subtitle,
    onPress,
    destructive = false,
    showChevron = true,
    disabled = false,
    iconBackgroundColor,
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    destructive?: boolean;
    showChevron?: boolean;
    disabled?: boolean;
    iconBackgroundColor?: string;
  }) {
  const theme = useThemedValues();

  return (
    <HapticPressable
      style={[styles.row, disabled && styles.disabledRow]}
      onPress={onPress}
      disabled={disabled || !onPress}
    >
      <View style={styles.rowLeft}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor:
                iconBackgroundColor ??
                theme.colors.iconSurface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {icon}
        </View>

        <View style={styles.textWrap}>
          <ThemedText
            variant="bodyStrong"
            color={destructive ? "danger" : "primary"}
            style={styles.title}
          >
            {title}
          </ThemedText>

          {subtitle ? (
            <ThemedText color="secondary" style={styles.subText}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {showChevron ? (
        <ChevronRight size={18} color={theme.colors.textSecondary} />
      ) : null}
    </HapticPressable>
  );
}

export default function ProfileScreen() {
  const { user, initializing, signOutUser } = useAuth();
  const theme = useThemedValues();

  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const isScreenMountedRef = useRef(true);
  const premiumCheckVersionRef = useRef(0);
  const restorePurchasesVersionRef = useRef(0);
  const deleteAllDataVersionRef = useRef(0);
  const navigationTransitionLockedRef = useRef(false);
  const navigationUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [isDeletingAllData, setIsDeletingAllData] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumSubtitle, setPremiumSubtitle] = useState(
    "Your Premium subscription is active"
  );
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);

  const version =
    Constants.expoConfig?.version ||
    Constants.manifest2?.extra?.expoClient?.version ||
    "1.0.0";

  useEffect(() => {
    isScreenMountedRef.current = true;

    return () => {
      isScreenMountedRef.current = false;
      premiumCheckVersionRef.current += 1;
      restorePurchasesVersionRef.current += 1;
      deleteAllDataVersionRef.current += 1;

      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
        navigationUnlockTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!initializing && !user) {
      router.replace("/");
    }
  }, [user, initializing]);

  useEffect(() => {
    const checkVersion = premiumCheckVersionRef.current + 1;
    premiumCheckVersionRef.current = checkVersion;

    async function checkPremiumStatus() {
      if (!user) {
        if (
          premiumCheckVersionRef.current === checkVersion &&
          isScreenMountedRef.current
        ) {
          setIsPremium(false);
          setPremiumSubtitle("Remove ads and unlock premium features");
          setPremiumSubtitle("Remove ads and unlock premium features");
        }

        return;
      }

      try {
        const customerInfo = await getCustomerInfo();
        const premiumEntitlement = customerInfo?.entitlements.active.premium;
        const premium = Boolean(premiumEntitlement);

        if (
          premiumCheckVersionRef.current !== checkVersion ||
          !isScreenMountedRef.current
        ) {
          return;
        }

        setIsPremium(premium);

        if (!premiumEntitlement) {
          setPremiumSubtitle("Remove ads and unlock premium features");
          return;
        }

        const expirationDateText = premiumEntitlement.expirationDate
          ? new Date(premiumEntitlement.expirationDate).toLocaleDateString()
          : null;
        const daysRemaining =
          premiumEntitlement.expirationDateMillis !== null
            ? Math.max(
              0,
              Math.ceil(
                (premiumEntitlement.expirationDateMillis - Date.now()) /
                (1000 * 60 * 60 * 24)
              )
            )
            : null;
        const periodType = premiumEntitlement.periodType?.toUpperCase?.() ?? "";
        const daysText =
          daysRemaining === null
            ? ""
            : ` in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;

        if (periodType === "TRIAL") {
          setPremiumSubtitle(`Trial ends${daysText}`);
        } else if (premiumEntitlement.willRenew && expirationDateText) {
          setPremiumSubtitle(`Premium renews on ${expirationDateText}`);
        } else if (expirationDateText) {
          setPremiumSubtitle(`Premium expires on ${expirationDateText}`);
        } else {
          setPremiumSubtitle("Premium subscription is active");
        }
      } catch (err) {
        if (
          premiumCheckVersionRef.current !== checkVersion ||
          !isScreenMountedRef.current
        ) {
          return;
        }

        console.error("Failed to check premium status:", err);
        setIsPremium(false);
      }
    }

    if (!initializing) {
      void checkPremiumStatus();
    }

    return () => {
      premiumCheckVersionRef.current += 1;
    };
  }, [initializing, user]);

  async function runWithLock(action: () => Promise<void> | void) {
    if (interactionLocked) return;

    lockInteraction();

    try {
      await action();
    } finally {
      unlockInteraction();
    }
  }

  function lockNavigationTransition() {
    if (navigationTransitionLockedRef.current) {
      return false;
    }

    navigationTransitionLockedRef.current = true;

    if (navigationUnlockTimeoutRef.current) {
      clearTimeout(navigationUnlockTimeoutRef.current);
    }

    navigationUnlockTimeoutRef.current = setTimeout(() => {
      if (!isScreenMountedRef.current) return;

      navigationTransitionLockedRef.current = false;
      navigationUnlockTimeoutRef.current = null;
    }, 1500);

    return true;
  }

  function runNavigationAction(action: () => void) {
    if (interactionLocked || navigationTransitionLockedRef.current) {
      return;
    }

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    action();
  }

  async function deleteDocsInBatches(docsToDelete: Array<{ ref: any }>) {
    const batchSize = 450;

    for (let i = 0; i < docsToDelete.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = docsToDelete.slice(i, i + batchSize);

      chunk.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();
    }
  }

  function handleOpenPaywall() {
    runNavigationAction(() => {
      router.push("/paywall");
    });
  }

  async function handleOpenSubscriptionDetails() {
    if (interactionLocked) return;

    await runWithLock(async () => {
      try {
        const customerInfo = await getCustomerInfo();
        const premiumEntitlement = customerInfo?.entitlements.active.premium;

        if (!premiumEntitlement) {
          Alert.alert(
            "Subscription Details",
            "No active Premium subscription was found for this account."
          );
          return;
        }

        const periodType = premiumEntitlement.periodType?.toUpperCase?.() ?? "";
        const isTrial = periodType === "TRIAL";
        const productId = isTrial
          ? "7-Day Free Trial"
          : premiumEntitlement.productIdentifier || "Premium";
        const isIntro = periodType === "INTRO";
        const planStatus = isTrial
          ? "Trial"
          : isIntro
            ? "Intro Offer"
            : "Premium";

        const latestPurchaseDate = premiumEntitlement.latestPurchaseDate
          ? new Date(premiumEntitlement.latestPurchaseDate).toLocaleDateString()
          : "Not available";
        const originalPurchaseDate = premiumEntitlement.originalPurchaseDate
          ? new Date(premiumEntitlement.originalPurchaseDate).toLocaleDateString()
          : "Not available";
        const expirationDate = premiumEntitlement.expirationDate
          ? new Date(premiumEntitlement.expirationDate).toLocaleDateString()
          : "Lifetime access";

        const daysRemaining =
          premiumEntitlement.expirationDateMillis !== null
            ? Math.max(
              0,
              Math.ceil(
                (premiumEntitlement.expirationDateMillis - Date.now()) /
                (1000 * 60 * 60 * 24)
              )
            )
            : null;

        const daysRemainingText =
          daysRemaining === null
            ? "No expiration"
            : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`;

        const startLabel = isTrial ? "Trial Started" : "Premium Started";
        const renewalText = isTrial
          ? `Trial Ends: ${expirationDate}`
          : premiumEntitlement.willRenew
            ? `Renews: ${expirationDate}`
            : `Expires: ${expirationDate}`;

        Alert.alert(
          "Premium Subscription",
          `Type: ${planStatus}\nPlan: ${productId}\n${startLabel}: ${originalPurchaseDate}\nLatest Purchase/Renewal: ${latestPurchaseDate}\n${renewalText}\nTime Remaining: ${daysRemainingText}\nAuto-renew: ${premiumEntitlement.willRenew ? "On" : "Off"}\n\nUse Manage to view, update, or cancel your Apple subscription.`,
          [
            {
              text: "Manage",
              onPress: () => {
                void Linking.openURL("https://apps.apple.com/account/subscriptions");
              },
            },
            { text: "OK", style: "cancel" },
          ]
        );
      } catch (err) {
        console.error("Failed to load subscription details:", err);
        Alert.alert(
          "Subscription Details Unavailable",
          "Unable to load subscription details right now. Please try again."
        );
      }
    });
  }

  function handleOpenProfileSettings() {
    runNavigationAction(() => {
      router.push("/profile-settings");
    });
  }

  function handleOpenFaq() {
    runNavigationAction(() => {
      router.push("/faq");
    });
  }

  function handleOpenGeneralSettings() {
    runNavigationAction(() => {
      router.push("/general-settings");
    });
  }

  async function handleRestorePurchases() {
    if (isRestoringPurchases || interactionLocked) {
      return;
    }

    Alert.alert(
      "Restore Purchases?",
      "This will check your Apple ID for an active Premium subscription and restore access if one is found. No new purchase will be made.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore Purchases",
          onPress: () => {
            void runWithLock(async () => {
              const restoreVersion = restorePurchasesVersionRef.current + 1;
              restorePurchasesVersionRef.current = restoreVersion;

              try {
                setIsRestoringPurchases(true);

                const customerInfo = await restorePurchases();
                const hasPremium = hasActivePremiumEntitlement(customerInfo);

                if (
                  restorePurchasesVersionRef.current !== restoreVersion ||
                  !isScreenMountedRef.current
                ) {
                  return;
                }

                setIsPremium(hasPremium);

                if (hasPremium) {
                  Alert.alert(
                    "Purchases Restored",
                    "Your Premium access has been restored."
                  );
                  return;
                }

                Alert.alert(
                  "No Purchases Found",
                  "No active Premium purchase was found for this Apple ID."
                );
              } catch (err) {
                if (
                  restorePurchasesVersionRef.current !== restoreVersion ||
                  !isScreenMountedRef.current
                ) {
                  return;
                }

                console.error("Failed to restore purchases:", err);
                Alert.alert(
                  "Restore Failed",
                  "Unable to restore purchases right now. Please try again."
                );
              } finally {
                if (
                  restorePurchasesVersionRef.current === restoreVersion &&
                  isScreenMountedRef.current
                ) {
                  setIsRestoringPurchases(false);
                }
              }
            });
          },
        },
      ]
    );
  }

  async function handleDeleteAllData() {
    if (!user || isDeletingAllData || interactionLocked) {
      return;
    }

    Alert.alert(
      "Delete All Data?",
      "This will permanently delete all Storage Spaces, Compartments, Inventory Items, Checklists, Checklist Items, and Checklist Templates. This cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: () => {
            void runWithLock(async () => {
              if (!user) return;

              const deleteVersion = deleteAllDataVersionRef.current + 1;
              deleteAllDataVersionRef.current = deleteVersion;

              try {
                setIsDeletingAllData(true);

                const userId = user.uid;

                const [
                  storageSpacesSnapshot,
                  compartmentsSnapshot,
                  inventoryItemsSnapshot,
                  checklistsSnapshot,
                  checklistTemplatesSnapshot,
                ] = await Promise.all([
                  getDocs(collection(db, "users", userId, "storageSpaces")),
                  getDocs(collection(db, "users", userId, "compartments")),
                  getDocs(collection(db, "users", userId, "inventoryItems")),
                  getDocs(collection(db, "users", userId, "checklists")),
                  getDocs(collection(db, "users", userId, "checklistTemplates")),
                ]);

                if (
                  deleteAllDataVersionRef.current !== deleteVersion ||
                  !isScreenMountedRef.current
                ) {
                  return;
                }

                const checklistItemDocs: Array<{ ref: any }> = [];

                for (const checklistDoc of checklistsSnapshot.docs) {
                  const itemsSnapshot = await getDocs(
                    collection(
                      db,
                      "users",
                      userId,
                      "checklists",
                      checklistDoc.id,
                      "items"
                    )
                  );

                  if (
                    deleteAllDataVersionRef.current !== deleteVersion ||
                    !isScreenMountedRef.current
                  ) {
                    return;
                  }

                  checklistItemDocs.push(...itemsSnapshot.docs);
                }

                const templateItemDocs: Array<{ ref: any }> = [];

                for (const templateDoc of checklistTemplatesSnapshot.docs) {
                  const itemsSnapshot = await getDocs(
                    collection(
                      db,
                      "users",
                      userId,
                      "checklistTemplates",
                      templateDoc.id,
                      "items"
                    )
                  );

                  if (
                    deleteAllDataVersionRef.current !== deleteVersion ||
                    !isScreenMountedRef.current
                  ) {
                    return;
                  }

                  templateItemDocs.push(...itemsSnapshot.docs);
                }

                await deleteDocsInBatches([
                  ...checklistItemDocs,
                  ...templateItemDocs,
                  ...inventoryItemsSnapshot.docs,
                  ...compartmentsSnapshot.docs,
                  ...storageSpacesSnapshot.docs,
                  ...checklistsSnapshot.docs,
                  ...checklistTemplatesSnapshot.docs,
                ]);

                if (
                  deleteAllDataVersionRef.current !== deleteVersion ||
                  !isScreenMountedRef.current
                ) {
                  return;
                }

                Alert.alert("Data Deleted", "All app data has been deleted.");
              } catch (err) {
                if (
                  deleteAllDataVersionRef.current !== deleteVersion ||
                  !isScreenMountedRef.current
                ) {
                  return;
                }

                console.error("Failed to delete all data:", err);
                Alert.alert(
                  "Delete Failed",
                  "Unable to delete all data. Please try again."
                );
              } finally {
                if (
                  deleteAllDataVersionRef.current === deleteVersion &&
                  isScreenMountedRef.current
                ) {
                  setIsDeletingAllData(false);
                }
              }
            });
          },
        },
      ]
    );
  }

  async function handleOpenUserAgreement() {
    if (interactionLocked) return;

    await runWithLock(async () => {
      try {
        await Linking.openURL(USER_AGREEMENT_URL);
      } catch (err) {
        console.error("Failed to open user agreement:", err);
        Alert.alert("Unable to Open", "The user agreement could not be opened.");
      }
    });
  }

  async function handleOpenPrivacyPolicy() {
    if (interactionLocked) return;

    await runWithLock(async () => {
      try {
        await Linking.openURL(PRIVACY_POLICY_URL);
      } catch (err) {
        console.error("Failed to open privacy policy:", err);
        Alert.alert("Unable to Open", "The privacy policy could not be opened.");
      }
    });
  }

  async function handleRateApp() {
    if (interactionLocked) return;

    await runWithLock(async () => {
      try {
        await Linking.openURL(APP_STORE_REVIEW_URL);
      } catch (err) {
        console.error("Failed to open App Store review page:", err);

        try {
          await Linking.openURL(APP_STORE_FALLBACK_URL);
        } catch (fallbackErr) {
          console.error("Failed to open App Store fallback page:", fallbackErr);

          Alert.alert(
            "Unable to Open App Store",
            "Please search for Where's My Gear in the App Store and leave a review there."
          );
        }
      }
    });
  }

  async function handleSignOut() {
    if (interactionLocked) return;

    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          void runWithLock(async () => {
            try {
              await signOutUser();

              if (!isScreenMountedRef.current) {
                return;
              }

              router.replace("/");
            } catch (err) {
              if (!isScreenMountedRef.current) {
                return;
              }

              console.error(err);
              Alert.alert("Error", "Failed to sign out.");
            }
          });
        },
      },
    ]);
  }

  const iconColor = theme.colors.text;
  const dangerIconColor = theme.colors.danger;
  const rowActionsDisabled =
    interactionLocked || isDeletingAllData || isRestoringPurchases;

  if (initializing) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.centered}>
            <ThemedText color="secondary">Loading account...</ThemedText>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  if (!user) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.centered}>
            <ThemedText variant="bodyStrong" style={styles.title}>
              Sign in required
            </ThemedText>
            <ThemedText color="secondary" style={styles.subText}>
              Please return to the main screen and sign in with Apple.
            </ThemedText>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText
            variant="header"
            style={[styles.header, styles.headerWhite]}
          >
            Profile
          </ThemedText>

          <ThemedCard contentStyle={styles.profileCardContent}>
            <ProfileRow
              icon={<Crown size={20} color="#FACC15" />}
              iconBackgroundColor="#000000"
              title={isPremium ? "Premium Active" : "Upgrade to Premium"}
              subtitle={
                isPremium
                  ? premiumSubtitle
                  : "Remove ads and unlock premium features"
              }
              onPress={
                isPremium ? handleOpenSubscriptionDetails : handleOpenPaywall
              }
              showChevron={false}
              disabled={rowActionsDisabled}
            />

            <View
              style={[
                styles.divider,
                { backgroundColor: theme.colors.border },
              ]}
            />

            <ProfileRow
              icon={<RotateCcw size={20} color={iconColor} />}
              title={
                isRestoringPurchases
                  ? "Restoring Purchases..."
                  : "Restore Purchases"
              }
              subtitle="Recover a previous Premium purchase"
              onPress={handleRestorePurchases}
              showChevron={false}
              disabled={rowActionsDisabled}
            />
          </ThemedCard>

          <ThemedCard contentStyle={styles.profileCardContent}>
            <ProfileRow
              icon={<User size={20} color={iconColor} />}
              title="My Account"
              subtitle="Update your name, email, phone, photo, and background"
              onPress={handleOpenProfileSettings}
              disabled={rowActionsDisabled}
            />

          </ThemedCard>

          <ThemedCard contentStyle={styles.profileCardContent}>
            <ProfileRow
              icon={<Star size={20} color={iconColor} />}
              title="Rate the App"
              subtitle="Leave a rating or review in the App Store"
              onPress={handleRateApp}
              disabled={rowActionsDisabled}
            />

            <View
              style={[
                styles.divider,
                { backgroundColor: theme.colors.border },
              ]}
            />

            <ProfileRow
              icon={<FileText size={20} color={iconColor} />}
              title="User Agreement"
              subtitle="View app terms and conditions"
              onPress={handleOpenUserAgreement}
              disabled={rowActionsDisabled}
            />

            <View
              style={[
                styles.divider,
                { backgroundColor: theme.colors.border },
              ]}
            />

            <ProfileRow
              icon={<ShieldCheck size={20} color={iconColor} />}
              title="Privacy Policy"
              subtitle="View how your data is handled"
              onPress={handleOpenPrivacyPolicy}
              disabled={rowActionsDisabled}
            />

            <View
              style={[
                styles.divider,
                { backgroundColor: theme.colors.border },
              ]}
            />

            <ProfileRow
              icon={<CircleHelp size={20} color={iconColor} />}
              title="FAQ"
              subtitle="Get answers to common questions"
              onPress={handleOpenFaq}
              disabled={rowActionsDisabled}
            />

            <View
              style={[
                styles.divider,
                { backgroundColor: theme.colors.border },
              ]}
            />

            <ProfileRow
              icon={<Moon size={20} color={iconColor} />}
              title="General Settings"
              subtitle="Edit theme and display preferences"
              onPress={handleOpenGeneralSettings}
              disabled={rowActionsDisabled}
            />
          </ThemedCard>

          <ThemedCard contentStyle={styles.profileCardContent}>
            <ProfileRow
              icon={<Info size={20} color={iconColor} />}
              title="Version"
              subtitle={`Where's My Gear v${version}`}
              showChevron={false}
            />
          </ThemedCard>

          <ThemedCard contentStyle={styles.profileCardContent}>
            <ProfileRow
              icon={<Trash2 size={20} color={dangerIconColor} />}
              title={isDeletingAllData ? "Deleting Data..." : "Delete All Data"}
              subtitle="Delete all Storage Spaces, Compartments, Inventory Items, and Checklists"
              destructive
              onPress={handleDeleteAllData}
              showChevron={false}
              disabled={rowActionsDisabled}
            />
          </ThemedCard>

          <ThemedCard contentStyle={styles.profileCardContent}>
            <ProfileRow
              icon={<LogOut size={20} color={dangerIconColor} />}
              title="Sign Out"
              subtitle="Sign out of your account"
              destructive
              onPress={handleSignOut}
              showChevron={false}
              disabled={rowActionsDisabled}
            />
          </ThemedCard>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },

  content: {
    padding: 16,
    paddingBottom: 120,
  },

  header: {
    marginBottom: 16,
  },

  headerWhite: {
    color: "#FFFFFF",
  },

  profileCardContent: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },

  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  disabledRow: {
    opacity: 0.6,
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },

  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  textWrap: {
    marginLeft: 14,
    flex: 1,
  },

  title: {
    marginBottom: 3,
  },

  subText: {
    lineHeight: 18,
  },

  divider: {
    height: 1,
    marginLeft: 52,
  },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
});