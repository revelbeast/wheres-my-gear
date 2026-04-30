import Constants from "expo-constants";
import { router } from "expo-router";
import {
  ChevronRight,
  CircleHelp,
  FileText,
  Info,
  LogOut,
  MapPin,
  Moon,
  ShieldCheck,
  Star,
  Trash2,
  User,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
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

const USER_AGREEMENT_URL =
  "https://sites.google.com/view/wheresmygearapp/home";

const PRIVACY_POLICY_URL =
  "https://sites.google.com/view/wheresmygearapp/home";

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

  const [isDeletingAllData, setIsDeletingAllData] = useState(false);

  const version =
    Constants.expoConfig?.version ||
    Constants.manifest2?.extra?.expoClient?.version ||
    "1.0.0";

  useEffect(() => {
    if (!initializing && !user) {
      router.replace("/");
    }
  }, [user, initializing]);

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

  async function handleDeleteAllData() {
    if (!user || isDeletingAllData) {
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
          onPress: async () => {
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
          },
        },
      ]
    );
  }

  async function handleOpenUserAgreement() {
    try {
      await Linking.openURL(USER_AGREEMENT_URL);
    } catch (err) {
      console.error("Failed to open user agreement:", err);
      Alert.alert("Unable to Open", "The user agreement could not be opened.");
    }
  }

  async function handleOpenPrivacyPolicy() {
    try {
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch (err) {
      console.error("Failed to open privacy policy:", err);
      Alert.alert("Unable to Open", "The privacy policy could not be opened.");
    }
  }

  function handleRateApp() {
    Alert.alert(
      "Coming Soon",
      "Rate the App will be connected after the App Store listing is live."
    );
  }

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOutUser();
            router.replace("/");
          } catch (err) {
            console.error(err);
            Alert.alert("Error", "Failed to sign out.");
          }
        },
      },
    ]);
  }

  const iconColor = theme.colors.text;
  const dangerIconColor = theme.colors.danger;

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
              icon={<User size={20} color={iconColor} />}
              title="My Account"
              subtitle="Update your name, email, phone, photo, and background"
              onPress={() => router.push("/profile-settings")}
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
              onPress={() => router.push("/profile-address")}
            />
          </ThemedCard>

          <ThemedCard contentStyle={styles.profileCardContent}>
            <ProfileRow
              icon={<Star size={20} color={iconColor} />}
              title="Rate the App"
              subtitle="Leave a review when the app is live"
              onPress={handleRateApp}
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
              onPress={() => router.push("/faq")}
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
              subtitle="Edit font size, theme, and display preferences"
              onPress={() => router.push("/general-settings")}
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
              disabled={isDeletingAllData}
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