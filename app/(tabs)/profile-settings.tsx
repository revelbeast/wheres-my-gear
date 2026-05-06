import * as ImageManipulator from "expo-image-manipulator";
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
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytes,
} from "firebase/storage";

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
import { publishAppBackgroundUpdate } from "../../lib/backgroundUpdateBus";
import {
  AppProfile,
  BackgroundResizeMode,
  getProfileSettings,
  saveProfileSettings,
} from "../../lib/settingsService";

type ImagePickerKind = "profile" | "background";

const PROFILE_IMAGE_MAX_DIMENSION = 512;
const BACKGROUND_IMAGE_MAX_WIDTH = 1600;
const PROFILE_IMAGE_QUALITY = 0.78;
const BACKGROUND_IMAGE_QUALITY = 0.8;
const MAX_UPLOAD_ATTEMPTS = 2;
const UPLOAD_RETRY_DELAYS_MS = [700];

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

function getStorageSafeFileName(kind: ImagePickerKind) {
  return `${kind}-${Date.now()}.jpg`;
}

function getCacheBustedUrl(downloadUrl: string) {
  return `${downloadUrl}${downloadUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
}

function getStoragePathFromUrl(imageUrl?: string) {
  if (
    typeof imageUrl !== "string" ||
    !imageUrl.includes("firebasestorage.googleapis.com")
  ) {
    return null;
  }

  try {
    return ref(storage, imageUrl).fullPath;
  } catch (err) {
    console.log("Could not resolve Firebase Storage path from URL.", err);
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withUploadRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;

      if (attempt >= MAX_UPLOAD_ATTEMPTS) {
        break;
      }

      console.log(
        `${operationName} failed on attempt ${attempt}. Retrying...`,
        err
      );

      await sleep(UPLOAD_RETRY_DELAYS_MS[attempt - 1] ?? 1200);
    }
  }

  throw lastError;
}

async function safelyDeleteStoredImage(imageUrl?: string) {
  const path = getStoragePathFromUrl(imageUrl);
  if (!path) return;

  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    console.log("Old Firebase Storage image could not be deleted.", err);
  }
}

async function cleanupStoredImagesForKind(
  userId: string,
  kind: ImagePickerKind,
  keepImageUrl?: string
) {
  try {
    const keepPath = getStoragePathFromUrl(keepImageUrl);
    const folderRef = ref(storage, `users/${userId}/profile`);
    const result = await listAll(folderRef);

    await Promise.all(
      result.items
        .filter((itemRef) => itemRef.name.startsWith(`${kind}-`))
        .filter((itemRef) => itemRef.fullPath !== keepPath)
        .map(async (itemRef) => {
          try {
            await deleteObject(itemRef);
          } catch (err) {
            console.log("Stored image cleanup skipped one file.", err);
          }
        })
    );
  } catch (err) {
    console.log("Firebase Storage image cleanup could not complete.", err);
  }
}

async function optimizeImageForUpload(localUri: string, kind: ImagePickerKind) {
  const resizeAction =
    kind === "profile"
      ? {
          resize: {
            width: PROFILE_IMAGE_MAX_DIMENSION,
            height: PROFILE_IMAGE_MAX_DIMENSION,
          },
        }
      : {
          resize: {
            width: BACKGROUND_IMAGE_MAX_WIDTH,
          },
        };

  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [resizeAction],
    {
      compress:
        kind === "profile" ? PROFILE_IMAGE_QUALITY : BACKGROUND_IMAGE_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  return result.uri;
}

async function uploadProfileImage(
  userId: string,
  localUri: string,
  kind: ImagePickerKind
) {
  const optimizedUri = await optimizeImageForUpload(localUri, kind);
  const response = await withUploadRetry(
    () => fetch(optimizedUri),
    "Image file preparation"
  );
  const blob = await response.blob();
  const fileName = getStorageSafeFileName(kind);
  const imageRef = ref(storage, `users/${userId}/profile/${fileName}`);

  await withUploadRetry(
    () =>
      uploadBytes(imageRef, blob, {
        contentType: "image/jpeg",
      }),
    "Firebase Storage upload"
  );

  const downloadUrl = await withUploadRetry(
    () => getDownloadURL(imageRef),
    "Firebase Storage download URL retrieval"
  );

  return getCacheBustedUrl(downloadUrl);
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
  const isMountedRef = useRef(true);
  const profileLoadVersionRef = useRef(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeImagePicker, setActiveImagePicker] =
    useState<ImagePickerKind | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [backgroundPreviewUri, setBackgroundPreviewUri] = useState<
    string | null
  >(null);

  const userId = user?.uid ?? "";
  const pickingProfilePhoto = activeImagePicker === "profile";
  const pickingBackgroundPhoto = activeImagePicker === "background";
  const pickingAnyImage = activeImagePicker !== null;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const loadVersion = profileLoadVersionRef.current + 1;
    profileLoadVersionRef.current = loadVersion;

    void loadProfile(loadVersion);
  }, [userId]);

  const displayName = useMemo(() => {
    if (!profile) return "";

    const fullName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();

    return fullName || "Profile";
  }, [profile]);

  const activeBackgroundUri =
    backgroundPreviewUri ?? profile?.backgroundPhotoUri ?? "";

  function scrollToFocusedInput(y: number) {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }

      scrollViewRef.current?.scrollTo({
        y,
        animated: true,
      });
    }, Platform.OS === "ios" ? 120 : 80);
  }

  async function loadProfile(loadVersion: number) {
    if (!userId) {
      if (!isMountedRef.current) return;

      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      if (isMountedRef.current) {
        setLoading(true);
      }

      const data = await getProfileSettings(userId);

      if (
        !isMountedRef.current ||
        profileLoadVersionRef.current !== loadVersion
      ) {
        return;
      }

      setProfile(data);
    } catch (err) {
      console.error("Failed to load profile settings:", err);
    } finally {
      if (
        isMountedRef.current &&
        profileLoadVersionRef.current === loadVersion
      ) {
        setLoading(false);
      }
    }
  }

  async function handleSave() {
    if (!profile || !userId || saving) return;

    try {
      if (isMountedRef.current) {
        setSaving(true);
      }

      await saveProfileSettings(userId, profile);

      if (!isMountedRef.current) {
        return;
      }

      Alert.alert("Saved", "Your profile has been updated.");
    } catch (err) {
      console.error("Failed to save profile settings:", err);

      if (!isMountedRef.current) {
        return;
      }

      Alert.alert("Error", "Failed to save profile.");
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  }

  async function handlePickProfilePhoto() {
    if (!profile || !userId || pickingAnyImage) return;

    try {
      if (isMountedRef.current) {
        setActiveImagePicker("profile");
      }

      const activeUserId = userId;
      const activeProfile = profile;
      const previousProfilePhotoUri = activeProfile.profilePhotoUri;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!isMountedRef.current || result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Photo not selected", "No valid image was returned.");
        return;
      }

      const uploadedUrl = await uploadProfileImage(
        activeUserId,
        asset.uri,
        "profile"
      );

      if (!isMountedRef.current || activeUserId !== userId) {
        return;
      }

      const nextProfile = {
        ...activeProfile,
        profilePhotoUri: uploadedUrl,
      };

      setProfile(nextProfile);
      await saveProfileSettings(activeUserId, nextProfile);

      if (previousProfilePhotoUri !== uploadedUrl) {
        await safelyDeleteStoredImage(previousProfilePhotoUri);
      }

      await cleanupStoredImagesForKind(activeUserId, "profile", uploadedUrl);
    } catch (err) {
      console.error("Failed to pick profile photo:", err);

      if (!isMountedRef.current) {
        return;
      }

      Alert.alert(
        "Photo upload failed",
        "Please check your connection and try selecting the photo again."
      );
    } finally {
      if (isMountedRef.current) {
        setActiveImagePicker(null);
      }
    }
  }

  async function handlePickBackgroundPhoto() {
    if (!profile || !userId || pickingAnyImage) return;

    try {
      if (isMountedRef.current) {
        setActiveImagePicker("background");
      }

      const activeUserId = userId;
      const activeProfile = profile;
      const previousBackgroundPhotoUri = activeProfile.backgroundPhotoUri;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!isMountedRef.current || result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Photo not selected", "No valid image was returned.");
        return;
      }

      setBackgroundPreviewUri(asset.uri);

      const uploadedUrl = await uploadProfileImage(
        activeUserId,
        asset.uri,
        "background"
      );

      if (!isMountedRef.current || activeUserId !== userId) {
        return;
      }

      const nextProfile = {
        ...activeProfile,
        backgroundPhotoUri: uploadedUrl,
      };

      setProfile(nextProfile);
      setBackgroundPreviewUri(null);

      await saveProfileSettings(activeUserId, nextProfile);

      publishAppBackgroundUpdate(
        activeUserId,
        uploadedUrl,
        nextProfile.backgroundResizeMode
      );

      if (previousBackgroundPhotoUri !== uploadedUrl) {
        await safelyDeleteStoredImage(previousBackgroundPhotoUri);
      }

      await cleanupStoredImagesForKind(activeUserId, "background", uploadedUrl);
    } catch (err) {
      console.error("Failed to pick background photo:", err);

      if (!isMountedRef.current) {
        return;
      }

      setBackgroundPreviewUri(null);

      Alert.alert(
        "Background upload failed",
        "Please check your connection and try selecting the background again."
      );
    } finally {
      if (isMountedRef.current) {
        setActiveImagePicker(null);
      }
    }
  }

  async function handleRemoveBackground() {
    if (!profile || !userId || pickingAnyImage) return;

    try {
      const activeUserId = userId;
      const previousBackgroundPhotoUri = profile.backgroundPhotoUri;

      if (isMountedRef.current) {
        setBackgroundPreviewUri(null);
      }

      const nextProfile = {
        ...profile,
        backgroundPhotoUri: "",
        backgroundResizeMode: "cover" as BackgroundResizeMode,
      };

      if (isMountedRef.current) {
        setProfile(nextProfile);
      }

      await saveProfileSettings(activeUserId, nextProfile);

      if (!isMountedRef.current || activeUserId !== userId) {
        return;
      }

      publishAppBackgroundUpdate(
        activeUserId,
        null,
        nextProfile.backgroundResizeMode
      );

      await safelyDeleteStoredImage(previousBackgroundPhotoUri);
      await cleanupStoredImagesForKind(activeUserId, "background");
    } catch (err) {
      console.error("Failed to remove custom background:", err);

      if (!isMountedRef.current) {
        return;
      }

      Alert.alert(
        "Background removal failed",
        "Please check your connection and try removing the background again."
      );
    }
  }

  async function handleSelectBackgroundFit(mode: BackgroundResizeMode) {
    if (!profile || !userId || pickingAnyImage) return;

    try {
      const activeUserId = userId;

      const nextProfile = {
        ...profile,
        backgroundResizeMode: mode,
      };

      if (isMountedRef.current) {
        setProfile(nextProfile);
      }

      await saveProfileSettings(activeUserId, nextProfile);

      if (!isMountedRef.current || activeUserId !== userId) {
        return;
      }

      publishAppBackgroundUpdate(
        activeUserId,
        nextProfile.backgroundPhotoUri || null,
        nextProfile.backgroundResizeMode
      );
    } catch (err) {
      console.error("Failed to save background fit:", err);

      if (!isMountedRef.current) {
        return;
      }

      Alert.alert(
        "Background setting failed",
        "Please check your connection and try again."
      );
    }
  }

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            if (isMountedRef.current) {
              setSigningOut(true);
            }

            await signOutUser();
          } catch (err) {
            console.error("Failed to sign out:", err);

            if (!isMountedRef.current) {
              return;
            }

            Alert.alert("Error", "Failed to sign out.");
          } finally {
            if (isMountedRef.current) {
              setSigningOut(false);
            }
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
    <ScreenBackground
      backgroundUriOverride={activeBackgroundUri}
      backgroundResizeModeOverride={profile.backgroundResizeMode}
    >
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

            <ThemedCard
              style={styles.heroCard}
              contentStyle={styles.heroCardContent}
            >
              <View style={styles.heroRow}>
                <View style={styles.heroPhotoWrap}>
                  {profile.profilePhotoUri ? (
                    <Image
                      key={profile.profilePhotoUri}
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

            <ThemedCard
              style={styles.formCard}
              contentStyle={styles.formCardContent}
            >
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
                  disabled={pickingAnyImage}
                  style={styles.photoButton}
                >
                  <ThemedText style={styles.buttonText}>
                    {pickingProfilePhoto ? "Opening..." : "Choose Photo"}
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
                  disabled={pickingAnyImage}
                  style={styles.photoButton}
                >
                  <ThemedText style={styles.buttonText}>
                    {pickingBackgroundPhoto
                      ? "Opening..."
                      : "Choose Background"}
                  </ThemedText>
                </ThemedButton>

                {profile.backgroundPhotoUri || backgroundPreviewUri ? (
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
                            disabled={pickingAnyImage}
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
                              pickingAnyImage && styles.disabledInteraction,
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

                    <HapticPressable
                      onPress={handleRemoveBackground}
                      disabled={pickingAnyImage}
                      style={pickingAnyImage && styles.disabledInteraction}
                    >
                      <ThemedText color="secondary" style={styles.cancelText}>
                        Remove Custom Background
                      </ThemedText>
                    </HapticPressable>
                  </>
                ) : null}
              </View>
            </ThemedCard>

            <ThemedButton
              onPress={handleSave}
              disabled={saving || pickingAnyImage}
            >
              <Check size={18} color="#fff" />
              <ThemedText style={styles.buttonText}>
                {saving ? "Saving..." : "Save Profile"}
              </ThemedText>
            </ThemedButton>

            <ThemedButton
              destructive
              onPress={handleSignOut}
              disabled={signingOut || pickingAnyImage}
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

  disabledInteraction: {
    opacity: 0.6,
  },
});