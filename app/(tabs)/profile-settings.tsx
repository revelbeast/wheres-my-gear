import * as ImagePicker from "expo-image-picker";
import { Check, ImagePlus, LogOut, UserCircle2 } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { useAuth } from "../../components/auth/AuthProvider";
import AppHeader from "../../components/ui/AppHeader";
import HapticPressable from "../../components/ui/HapticPressable";
import ScreenBackground from "../../components/ui/ScreenBackground";
import {
  ThemedButton,
  ThemedCard,
  ThemedInput,
  ThemedText,
  useThemedValues,
} from "../../components/ui/Themed";
import { storage } from "../../firebaseConfig";
import {
  AppProfile,
  BackgroundResizeMode,
  getProfileSettings,
  saveProfileSettings,
} from "../../lib/settingsService";

const BACKGROUND_FIT_OPTIONS: {
  label: string;
  value: BackgroundResizeMode;
  description: string;
}[] = [
  {
    label: "Fill Screen",
    value: "cover",
    description: "Fills the screen and may crop the photo.",
  },
  {
    label: "Fit Full Photo",
    value: "contain",
    description: "Shows the full photo with less cropping.",
  },
  {
    label: "Center Photo",
    value: "center",
    description: "Centers the photo without stretching it.",
  },
];

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function getStorageSafeFileName(kind: "profile" | "background") {
  return `${kind}-${Date.now()}.jpg`;
}

async function uploadProfileImage(
  userId: string,
  localUri: string,
  kind: "profile" | "background"
) {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const fileName = getStorageSafeFileName(kind);
  const imageRef = ref(storage, `users/${userId}/profile/${fileName}`);

  await uploadBytes(imageRef, blob, {
    contentType: "image/jpeg",
  });

  return getDownloadURL(imageRef);
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = "sentences",
  editable = true,
  onFocus,
}: {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  editable?: boolean;
  onFocus?: () => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <ThemedText variant="small" style={styles.label}>
        {label}
      </ThemedText>

      <ThemedInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
        onFocus={onFocus}
        returnKeyType="done"
        style={!editable && styles.inputDisabled}
      />
    </View>
  );
}

export default function ProfileSettingsScreen() {
  const { user, signOutUser } = useAuth();
  const theme = useThemedValues();
  const scrollViewRef = useRef<ScrollView | null>(null);

  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const displayName = useMemo(() => {
    if (!profile) return "";

    const fullName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();

    return fullName || "Profile";
  }, [profile]);

  function scrollToFocusedInput(y: number) {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y,
        animated: true,
      });
    }, Platform.OS === "ios" ? 120 : 80);
  }

  async function loadProfile() {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getProfileSettings(user.uid);
      setProfile(data);
    } catch (err) {
      console.error("Failed to load profile settings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!profile || !user) return;

    try {
      setSaving(true);
      await saveProfileSettings(user.uid, profile);
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (err) {
      console.error("Failed to save profile settings:", err);
      Alert.alert("Error", "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePickProfilePhoto() {
    if (!profile || !user) return;

    try {
      setPickingImage(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Photo not selected", "No valid image was returned.");
        return;
      }

      const uploadedUrl = await uploadProfileImage(
        user.uid,
        asset.uri,
        "profile"
      );

      const nextProfile = {
        ...profile,
        profilePhotoUri: uploadedUrl,
      };

      setProfile(nextProfile);
      await saveProfileSettings(user.uid, nextProfile);
    } catch (err) {
      console.error("Failed to pick profile photo:", err);
      Alert.alert("Photo upload failed", "Please try selecting a photo again.");
    } finally {
      setPickingImage(false);
    }
  }

  async function handlePickBackgroundPhoto() {
    if (!profile || !user) return;

    try {
      setPickingImage(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Photo not selected", "No valid image was returned.");
        return;
      }

      const uploadedUrl = await uploadProfileImage(
        user.uid,
        asset.uri,
        "background"
      );

      const nextProfile = {
        ...profile,
        backgroundPhotoUri: uploadedUrl,
      };

      setProfile(nextProfile);
      await saveProfileSettings(user.uid, nextProfile);
    } catch (err) {
      console.error(err);
      Alert.alert("Failed", "Could not set background.");
    } finally {
      setPickingImage(false);
    }
  }

  async function handleRemoveBackground() {
    if (!profile || !user) return;

    const nextProfile = {
      ...profile,
      backgroundPhotoUri: "",
      backgroundResizeMode: "cover" as BackgroundResizeMode,
    };

    setProfile(nextProfile);
    await saveProfileSettings(user.uid, nextProfile);
  }

  async function handleSelectBackgroundFit(mode: BackgroundResizeMode) {
    if (!profile || !user) return;

    const nextProfile = {
      ...profile,
      backgroundResizeMode: mode,
    };

    setProfile(nextProfile);
    await saveProfileSettings(user.uid, nextProfile);
  }

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            setSigningOut(true);
            await signOutUser();
          } catch (err) {
            console.error("Failed to sign out:", err);
            Alert.alert("Error", "Failed to sign out.");
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  }

  function updateField<K extends keyof AppProfile>(key: K, value: AppProfile[K]) {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (loading || !profile) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.container}>
            <AppHeader
              title="Profile Settings"
              showBackButton
              backHref="/(tabs)/profile"
            />
            <ThemedText color="secondary">Loading profile...</ThemedText>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
            showsVerticalScrollIndicator={false}
          >
            <AppHeader
              title="Profile Settings"
              showBackButton
              backHref="/(tabs)/profile"
            />

            <ThemedCard style={styles.heroCard} contentStyle={styles.heroCardContent}>
              <View style={styles.heroRow}>
                <View style={styles.heroPhotoWrap}>
                  {profile.profilePhotoUri ? (
                    <Image
                      source={{ uri: profile.profilePhotoUri }}
                      style={styles.heroPhoto}
                    />
                  ) : (
                    <View
                      style={[
                        styles.heroPhotoFallback,
                        { backgroundColor: theme.colors.iconSurface },
                      ]}
                    >
                      <UserCircle2 size={34} color={theme.colors.text} />
                    </View>
                  )}
                </View>

                <View style={styles.heroTextWrap}>
                  <ThemedText
                    variant="title"
                    color="blue"
                    style={styles.heroTitle}
                  >
                    {displayName}
                  </ThemedText>

                  <ThemedText color="secondary" style={styles.heroSubtitle}>
                    {user?.email ?? "Account basics only for now"}
                  </ThemedText>
                </View>
              </View>
            </ThemedCard>

            <ThemedCard style={styles.formCard} contentStyle={styles.formCardContent}>
              <ThemedText variant="bodyStrong" style={styles.sectionTitle}>
                Account Basics
              </ThemedText>

              <LabeledInput
                label="First Name"
                value={profile.firstName}
                onChangeText={(t) => updateField("firstName", t)}
                onFocus={() => scrollToFocusedInput(90)}
              />

              <LabeledInput
                label="Last Name"
                value={profile.lastName}
                onChangeText={(t) => updateField("lastName", t)}
                onFocus={() => scrollToFocusedInput(140)}
              />

              <LabeledInput
                label="Email"
                value={profile.email}
                onChangeText={(t) => updateField("email", t)}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => scrollToFocusedInput(190)}
              />

              <LabeledInput
                label="Phone"
                value={profile.phoneNumber}
                onChangeText={(t) =>
                  updateField("phoneNumber", formatPhoneNumber(t))
                }
                keyboardType="phone-pad"
                onFocus={() => scrollToFocusedInput(240)}
              />

              <View
                style={[
                  styles.photoCard,
                  {
                    backgroundColor: theme.colors.iconSurface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.photoHeader}>
                  <ImagePlus size={18} color={theme.colors.text} />
                  <ThemedText variant="bodyStrong">Profile Photo</ThemedText>
                </View>

                <ThemedText color="secondary" style={styles.photoText}>
                  Select a photo from your device library.
                </ThemedText>

                <ThemedButton
                  onPress={handlePickProfilePhoto}
                  disabled={pickingImage}
                  style={styles.photoButton}
                >
                  <ThemedText style={styles.buttonText}>
                    {pickingImage ? "Opening..." : "Choose Photo"}
                  </ThemedText>
                </ThemedButton>
              </View>

              <View
                style={[
                  styles.photoCard,
                  {
                    backgroundColor: theme.colors.iconSurface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.photoHeader}>
                  <ImagePlus size={18} color={theme.colors.text} />
                  <ThemedText variant="bodyStrong">App Background</ThemedText>
                </View>

                <ThemedText color="secondary" style={styles.photoText}>
                  Customize the background across the entire app.
                </ThemedText>

                <ThemedButton
                  onPress={handlePickBackgroundPhoto}
                  disabled={pickingImage}
                  style={styles.photoButton}
                >
                  <ThemedText style={styles.buttonText}>
                    {pickingImage ? "Opening..." : "Choose Background"}
                  </ThemedText>
                </ThemedButton>

                {profile.backgroundPhotoUri ? (
                  <>
                    <View style={styles.fitSection}>
                      <ThemedText variant="small" style={styles.fitTitle}>
                        Background Fit
                      </ThemedText>

                      {BACKGROUND_FIT_OPTIONS.map((option) => {
                        const isSelected =
                          profile.backgroundResizeMode === option.value;

                        return (
                          <HapticPressable
                            key={option.value}
                            onPress={() =>
                              handleSelectBackgroundFit(option.value)
                            }
                            style={[
                              styles.fitOption,
                              {
                                borderColor: isSelected
                                  ? theme.colors.primary
                                  : theme.colors.border,
                                backgroundColor: isSelected
                                  ? theme.colors.card
                                  : theme.colors.inputSurface,
                              },
                            ]}
                          >
                            <View style={styles.fitOptionTextWrap}>
                              <ThemedText
                                variant="bodyStrong"
                                style={styles.fitOptionLabel}
                              >
                                {option.label}
                              </ThemedText>

                              <ThemedText
                                color="secondary"
                                style={styles.fitOptionDescription}
                              >
                                {option.description}
                              </ThemedText>
                            </View>

                            {isSelected ? (
                              <Check size={18} color={theme.colors.primary} />
                            ) : null}
                          </HapticPressable>
                        );
                      })}
                    </View>

                    <HapticPressable onPress={handleRemoveBackground}>
                      <ThemedText color="secondary" style={styles.cancelText}>
                        Remove Custom Background
                      </ThemedText>
                    </HapticPressable>
                  </>
                ) : null}
              </View>
            </ThemedCard>

            <ThemedButton onPress={handleSave} disabled={saving}>
              <Check size={18} color="#fff" />
              <ThemedText style={styles.buttonText}>
                {saving ? "Saving..." : "Save Profile"}
              </ThemedText>
            </ThemedButton>

            <ThemedButton
              destructive
              onPress={handleSignOut}
              disabled={signingOut}
              style={styles.signOutButton}
            >
              <LogOut size={18} color="#fff" />
              <ThemedText style={styles.buttonText}>
                {signingOut ? "Signing Out..." : "Sign Out"}
              </ThemedText>
            </ThemedButton>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 16 },

  keyboardAvoidingView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 220,
  },

  heroCard: {
    marginBottom: 16,
  },

  heroCardContent: {
    padding: 14,
  },

  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
  },

  heroPhotoWrap: {
    marginRight: 12,
  },

  heroPhoto: {
    width: 52,
    height: 52,
    borderRadius: 16,
  },

  heroPhotoFallback: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  heroTextWrap: {
    flex: 1,
  },

  heroTitle: {
    fontWeight: "800",
  },

  heroSubtitle: {
    marginTop: 2,
  },

  formCard: {
    marginBottom: 16,
  },

  formCardContent: {
    padding: 14,
  },

  sectionTitle: {
    marginBottom: 10,
  },

  fieldWrap: {
    marginBottom: 10,
  },

  label: {
    fontWeight: "600",
    marginBottom: 4,
  },

  inputDisabled: {
    opacity: 0.6,
  },

  photoCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },

  photoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },

  photoText: {
    marginBottom: 10,
  },

  photoButton: {
    minHeight: 46,
  },

  fitSection: {
    marginTop: 14,
    gap: 8,
  },

  fitTitle: {
    fontWeight: "700",
    marginBottom: 2,
  },

  fitOption: {
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  fitOptionTextWrap: {
    flex: 1,
  },

  fitOptionLabel: {
    fontWeight: "700",
  },

  fitOptionDescription: {
    marginTop: 2,
  },

  cancelText: {
    textAlign: "center",
    marginTop: 14,
  },

  signOutButton: {
    marginTop: 12,
    marginBottom: 16,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});