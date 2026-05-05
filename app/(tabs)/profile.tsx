import Constants from "expo-constants";
import { router } from "expo-router";
import * as StoreReview from "expo-store-review";
import {
  ChevronRight,
  CircleHelp,
  Crown,
  FileText,
  Info,
  LogOut,
  MapPin,
  Moon,
  RotateCcw,
  ShieldCheck,
  Star,
  Trash2,
  User,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, getDocs, writeBatch } from "firebase/firestore";

import ScreenBackground from "../../components/ui/ScreenBackground";
import { useAuth } from "../../components/auth/AuthProvider";
import {
  ThemedCard,
  ThemedText,
  useThemedValues,
} from "../../components/ui/Themed";
import { db } from "../../firebaseConfig";
import {
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
  "itms-apps://itunes.apple.com/app/id6762979732?action=write-review";

function ProfileRow({
  icon,
  title,
  subtitle,
  onPress,
  destructive = false,
  showChevron = true,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  disabled?: boolean;
}) {
  const theme = useThemedValues();

  return (
    <Pressable
      style={[styles.row, disabled && styles.disabledRow]}
      onPress={onPress}
      disabled={disabled || !onPress}
    >
      <View style={styles.rowLeft}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: theme.colors.iconSurface,
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
    </Pressable>
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

  const navigationTransitionLockedRef = useRef(false);
  const navigationUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [isDeletingAllData, setIsDeletingAllData] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);

  const version =
    Constants.expoConfig?.version ||
    Constants.manifest2?.extra?.expoClient?.version ||
    "1.0.0";

  useEffect(() => {
    return () => {
      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!initializing && !user) {
      router.replace("/");
    }
  }, [user, initializing]);

  useEffect(() => {
    async function checkPremiumStatus() {
      if (!user) {
        setIsPremium(false);
        return;
      }

      try {
        const premium = await isPremiumUser();
        setIsPremium(premium);
      } catch (err) {
        console.error("Failed to check premium status:", err);
        setIsPremium(false);
      }
    }

    if (!initializing) {
      checkPremiumStatus();
    }
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

  function handleOpenProfileSettings() {
    runNavigationAction(() => {
      router.push("/profile-settings");
    });
  }

  function handleOpenProfileAddress() {
    runNavigationAction(() => {
      router.push("/profile-address");
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

    await runWithLock(async () => {
      try {
        setIsRestoringPurchases(true);

        const customerInfo = await restorePurchases();
        const hasPremium = hasActivePremiumEntitlement(customerInfo);

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
        console.error("Failed to restore purchases:", err);
        Alert.alert(
          "Restore Failed",
          "Unable to restore purchases right now. Please try again."
        );
      } finally {
        setIsRestoringPurchases(false);
      }
    });
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

                Alert.alert("Data Deleted", "All app data has been deleted.");
              } catch (err) {
                console.error("Failed to delete all data:", err);
                Alert.alert(
                  "Delete Failed",
                  "Unable to delete all data. Please try again."
                );
              } finally {
                setIsDeletingAllData(false);
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
        const isAvailable = await StoreReview.isAvailableAsync();

        if (isAvailable) {
          await StoreReview.requestReview();
          return;
        }

        const canOpenStore = await Linking.canOpenURL(APP_STORE_REVIEW_URL);

        if (canOpenStore) {
          await Linking.openURL(APP_STORE_REVIEW_URL);
          return;
        }

        Alert.alert(
          "Rate the App",
          "Ratings and reviews will be available after the App Store listing is live."
        );
      } catch (err) {
        console.error("Failed to open app review:", err);
        Alert.alert(
          "Unable to Open",
          "The review screen could not be opened right now."
        );
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
              router.replace("/");
            } catch (err) {
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
          <ThemedText variant="header" style={styles.header}>
            Profile
          </ThemedText>

          <ThemedCard contentStyle={styles.profileCardContent}>
            <ProfileRow
              icon={<Crown size={20} color="#FACC15" />}
              title={isPremium ? "Premium Active" : "Upgrade to Premium"}
              subtitle={
                isPremium
                  ? "Your Premium subscription is active"
                  : "Remove ads and unlock premium features"
              }
              onPress={isPremium ? undefined : handleOpenPaywall}
              showChevron={!isPremium}
              disabled={!isPremium && rowActionsDisabled}
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

            <View
              style={[
                styles.divider,
                { backgroundColor: theme.colors.border },
              ]}
            />

            <ProfileRow
              icon={<MapPin size={20} color={iconColor} />}
              title="My Address"
              subtitle="Edit your address information"
              onPress={handleOpenProfileAddress}
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
  },

  content: {
    padding: 16,
    paddingBottom: 120,
  },

  header: {
    marginBottom: 16,
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