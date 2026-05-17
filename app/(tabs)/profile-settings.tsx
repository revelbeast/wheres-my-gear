import { BlurView } from "expo-blur";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytes,
} from "firebase/storage";
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
  AppAddress,
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

function formatState(value: string) {
  return value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
}

function formatZipCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 5);
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
  const actionLockRef = useRef(false);
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
  const [showBackgroundOptions, setShowBackgroundOptions] = useState(false);
  const [, setActionLockRevision] = useState(0);

  const userId = user?.uid ?? "";
  const pickingProfilePhoto = activeImagePicker === "profile";
  const pickingBackgroundPhoto = activeImagePicker === "background";
  const pickingAnyImage = activeImagePicker !== null;
  const interactionBusy =
    saving || pickingAnyImage || signingOut || actionLockRef.current;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      profileLoadVersionRef.current += 1;
      actionLockRef.current = false;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
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

  async function runWithActionLock(action: () => Promise<void> | void) {
    if (actionLockRef.current || !isMountedRef.current) {
      return;
    }

    actionLockRef.current = true;
    setActionLockRevision((value) => value + 1);

    try {
      await action();
    } finally {
      actionLockRef.current = false;

      if (isMountedRef.current) {
        setActionLockRevision((value) => value + 1);
      }
    }
  }

  function scrollToFocusedInput(y: number) {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    scrollTimeoutRef.current = setTimeout(() => {
      scrollTimeoutRef.current = null;

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
    if (!profile || !userId || interactionBusy) return;

    await runWithActionLock(async () => {
      try {
        if (!isMountedRef.current) return;

        setSaving(true);

        await saveProfileSettings(userId, profile);

        if (!isMountedRef.current) {
          return;
        }

        setShowBackgroundOptions(false);
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
    });
  }

  async function handlePickProfilePhoto() {
    if (!profile || !userId || interactionBusy) return;

    await runWithActionLock(async () => {
      const activeUserId = userId;
      const activeProfile = profile;
      const previousProfilePhotoUri = activeProfile.profilePhotoUri;

      try {
        if (!isMountedRef.current) return;

        setActiveImagePicker("profile");

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.9,
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

        if (!isMountedRef.current || activeUserId !== userId) {
          return;
        }

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
    });
  }

  async function handlePickBackgroundPhoto() {
    if (!profile || !userId || interactionBusy) return;

    await runWithActionLock(async () => {
      const activeUserId = userId;
      const activeProfile = profile;
      const previousBackgroundPhotoUri = activeProfile.backgroundPhotoUri;

      try {
        if (!isMountedRef.current) return;

        setActiveImagePicker("background");

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
        setShowBackgroundOptions(true);

        await saveProfileSettings(activeUserId, nextProfile);

        if (!isMountedRef.current || activeUserId !== userId) {
          return;
        }

        publishAppBackgroundUpdate(
          activeUserId,
          uploadedUrl,
          nextProfile.backgroundResizeMode
        );

        if (previousBackgroundPhotoUri !== uploadedUrl) {
          await safelyDeleteStoredImage(previousBackgroundPhotoUri);
        }

        await cleanupStoredImagesForKind(
          activeUserId,
          "background",
          uploadedUrl
        );
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
    });
  }

  async function handleRemoveBackground() {
    if (!profile || !userId || interactionBusy) return;

    await runWithActionLock(async () => {
      const activeUserId = userId;
      const activeProfile = profile;
      const previousBackgroundPhotoUri = activeProfile.backgroundPhotoUri;

      try {
        if (!isMountedRef.current) return;

        setBackgroundPreviewUri(null);
        setShowBackgroundOptions(false);

        const nextProfile = {
          ...activeProfile,
          backgroundPhotoUri: "",
          backgroundResizeMode: "cover" as BackgroundResizeMode,
        };

        setProfile(nextProfile);

        await saveProfileSettings(activeUserId, nextProfile);

        if (!isMountedRef.current || activeUserId !== userId) {
          return;
        }

        publishAppBackgroundUpdate(
          activeUserId,
          null,
          nextProfile.backgroundResizeMode
        );

        void (async () => {
          try {
            await safelyDeleteStoredImage(previousBackgroundPhotoUri);
            await cleanupStoredImagesForKind(activeUserId, "background");
          } catch (cleanupError) {
            console.warn("Background cleanup did not complete:", cleanupError);
          }
        })();
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
    });
  }

  async function handleSelectBackgroundFit(mode: BackgroundResizeMode) {
    if (!profile || !userId || interactionBusy) return;

    await runWithActionLock(async () => {
      const activeUserId = userId;
      const activeProfile = profile;

      try {
        const nextProfile = {
          ...activeProfile,
          backgroundResizeMode: mode,
        };

        if (!isMountedRef.current) return;

        setProfile(nextProfile);

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
    });
  }

  async function handleSignOut() {
    if (interactionBusy) return;

    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          if (interactionBusy) return;

          await runWithActionLock(async () => {
            try {
              if (!isMountedRef.current) return;

              setSigningOut(true);

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
          });
        },
      },
    ]);
  }

  function updateField<K extends keyof AppProfile>(key: K, value: AppProfile[K]) {
    if (interactionBusy) return;

    setProfile((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateAddressField<K extends keyof AppAddress>(
    key: K,
    value: AppAddress[K]
  ) {
    if (interactionBusy) return;

    setProfile((prev) =>
      prev
        ? {
          ...prev,
          address: {
            ...prev.address,
            [key]: value,
          },
        }
        : prev
    );
  }

  if (loading || !profile) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.container}>
            <AppHeader
              title="My Account"
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
              title="My Account"
              showBackButton
              backHref="/(tabs)/profile"
            />

            <View style={styles.heroSection}>
              <HapticPressable
                onPress={handlePickProfilePhoto}
                disabled={interactionBusy}
                style={[
                  styles.heroPhotoButton,
                  interactionBusy && styles.disabledInteraction,
                ]}
              >

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
                    <UserCircle2 size={54} color={theme.colors.text} />
                  </View>
                )}

                <View
                  style={[
                    styles.cameraBadge,
                    {
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.card,
                    },
                  ]}
                >
                  <ImagePlus size={22} color="#FFFFFF" />
                </View>
              </HapticPressable>

              <ThemedText variant="header" style={styles.heroTitle}>
                {displayName}
              </ThemedText>

              <View
                style={[
                  styles.phonePill,
                  {
                    backgroundColor: theme.isLight
                      ? "rgba(219,234,254,0.92)"
                      : "rgba(15,23,42,0.58)",
                    borderColor: theme.colors.primary,
                  },
                ]}
              >
                <ThemedText style={styles.heroPhoneText}>
                  {profile.phoneNumber || "Add your phone number below"}
                </ThemedText>
              </View>

              {user?.email ? (
                <View
                  style={[
                    styles.emailPill,
                    {
                      backgroundColor: theme.isLight
                        ? "rgba(255,255,255,0.78)"
                        : "rgba(15,23,42,0.50)",
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.emailText,
                      {
                        color: theme.isLight ? "#000000" : "#FFFFFF",
                      },
                    ]}
                  >
                    {user.email}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            <HapticPressable
              onPress={handlePickBackgroundPhoto}
              disabled={interactionBusy}
              style={[
                styles.backgroundPhotoCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.isLight
                    ? "rgba(148,163,184,0.62)"
                    : "rgba(226,232,240,0.34)",
                },
                interactionBusy && styles.disabledInteraction,
              ]}
            >
              <BlurView
                intensity={theme.isLight ? 24 : 38}
                tint={theme.isLight ? "light" : "dark"}
                style={styles.backgroundPhotoBlur}
              >
                <View style={styles.backgroundPhotoRow}>
                  <View style={styles.backgroundThumbWrap}>
                    {activeBackgroundUri ? (
                      <Image
                        key={activeBackgroundUri}
                        source={{ uri: activeBackgroundUri }}
                        style={styles.backgroundThumb}
                      />
                    ) : (
                      <View
                        style={[
                          styles.backgroundThumbFallback,
                          { backgroundColor: theme.colors.inputSurface },
                        ]}
                      >
                        <ImagePlus size={22} color={theme.colors.text} />
                      </View>
                    )}
                  </View>

                  <View style={styles.backgroundTextWrap}>
                    <ThemedText
                      variant="bodyStrong"
                      style={[
                        styles.backgroundTitle,
                        {
                          color: theme.isLight ? "#000000" : theme.colors.text,
                        },
                      ]}
                    >
                      Background Photo
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.backgroundSubtitle,
                        {
                          color: theme.isLight ? "#000000" : theme.colors.textSecondary,
                        },
                      ]}
                    >
                      {pickingBackgroundPhoto
                        ? "Opening photo library..."
                        : "Edit your background"}
                    </ThemedText>

                    <HapticPressable
                      onPress={handleRemoveBackground}
                      disabled={interactionBusy}
                      style={interactionBusy && styles.disabledInteraction}
                    >
                      <ThemedText color="secondary" style={styles.backgroundResetText}>
                        Reset Background to Default
                      </ThemedText>
                    </HapticPressable>
                  </View>

                  <View
                    style={[
                      styles.backgroundIconCircle,
                      { backgroundColor: theme.colors.iconSurface },
                    ]}
                  >
                    <ImagePlus size={20} color={theme.colors.text} />
                  </View>
                </View>
              </BlurView>
            </HapticPressable>

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
                editable={!interactionBusy}
                onFocus={() => scrollToFocusedInput(90)}
              />

              <LabeledInput
                label="Last Name"
                value={profile.lastName}
                onChangeText={(t) => updateField("lastName", t)}
                editable={!interactionBusy}
                onFocus={() => scrollToFocusedInput(140)}
              />

              <LabeledInput
                label="Phone"
                value={profile.phoneNumber}
                onChangeText={(t) =>
                  updateField("phoneNumber", formatPhoneNumber(t))
                }
                keyboardType="phone-pad"
                editable={!interactionBusy}
                onFocus={() => scrollToFocusedInput(190)}
              />

              {showBackgroundOptions &&
                (profile.backgroundPhotoUri || backgroundPreviewUri) ? (
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
                          onPress={() => handleSelectBackgroundFit(option.value)}
                          disabled={interactionBusy}
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
                            interactionBusy && styles.disabledInteraction,
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
                </>
              ) : null}
            </ThemedCard>

            <ThemedCard
              style={styles.formCard}
              contentStyle={styles.formCardContent}
            >
              <ThemedText variant="bodyStrong" style={styles.sectionTitle}>
                Address
              </ThemedText>

              <LabeledInput
                label="Street Address"
                value={profile.address.streetAddress}
                onChangeText={(t) => updateAddressField("streetAddress", t)}
                placeholder="Enter street address"
                editable={!interactionBusy}
                onFocus={() => scrollToFocusedInput(300)}
              />

              <LabeledInput
                label="Apartment / Suite"
                value={profile.address.apartmentSuite}
                onChangeText={(t) => updateAddressField("apartmentSuite", t)}
                placeholder="Apt, suite, unit, etc."
                editable={!interactionBusy}
                onFocus={() => scrollToFocusedInput(350)}
              />

              <LabeledInput
                label="City"
                value={profile.address.city}
                onChangeText={(t) => updateAddressField("city", t)}
                placeholder="Enter city"
                editable={!interactionBusy}
                onFocus={() => scrollToFocusedInput(400)}
              />

              <View style={styles.inlineFieldsRow}>
                <View style={styles.stateField}>
                  <LabeledInput
                    label="State"
                    value={profile.address.state}
                    onChangeText={(t) => updateAddressField("state", formatState(t))}
                    placeholder="State"
                    autoCapitalize="characters"
                    editable={!interactionBusy}
                    onFocus={() => scrollToFocusedInput(450)}
                  />
                </View>

                <View style={styles.zipField}>
                  <LabeledInput
                    label="ZIP Code"
                    value={profile.address.zipCode}
                    onChangeText={(t) =>
                      updateAddressField("zipCode", formatZipCode(t))
                    }
                    placeholder="ZIP Code"
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    editable={!interactionBusy}
                    onFocus={() => scrollToFocusedInput(450)}
                  />
                </View>
              </View>

              <LabeledInput
                label="Country"
                value={profile.address.country}
                onChangeText={(t) => updateAddressField("country", t)}
                placeholder="Country"
                editable={!interactionBusy}
                onFocus={() => scrollToFocusedInput(500)}
              />
            </ThemedCard>

            <ThemedCard
              style={styles.actionsCard}
              contentStyle={styles.actionsCardContent}
            >
              <ThemedButton
                onPress={handleSave}
                disabled={interactionBusy}
                style={styles.saveButton}
              >
                <Check size={18} color="#FFFFFF" />
                <ThemedText style={styles.buttonText}>
                  {saving ? "Saving..." : "Save Changes"}
                </ThemedText>
              </ThemedButton>

              <HapticPressable
                onPress={handleSignOut}
                disabled={interactionBusy}
                style={[
                  styles.secondarySignOutButton,
                  {
                    borderColor: theme.colors.primary,
                    backgroundColor: "rgba(15,23,42,0.28)",
                  },
                  interactionBusy && styles.disabledInteraction,
                ]}
              >
                <LogOut size={18} color={theme.colors.primary} />
                <ThemedText
                  style={[
                    styles.secondarySignOutText,
                    { color: theme.colors.primary },
                  ]}
                >
                  {signingOut ? "Signing Out..." : "Sign Out"}
                </ThemedText>
              </HapticPressable>
            </ThemedCard>
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

  heroSection: {
    alignItems: "center",
    marginBottom: 22,
    paddingTop: 4,
  },

  heroPhotoButton: {
    width: 136,
    height: 136,
    borderRadius: 68,
    marginBottom: 18,
  },

  heroPhoto: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 2,
    borderColor: "rgba(191,219,254,0.88)",
    resizeMode: "cover",
  },

  heroPhotoFallback: {
    width: 136,
    height: 136,
    borderRadius: 68,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(191,219,254,0.88)",
  },

  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: 4,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  heroTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },

  phonePill: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  heroPhoneText: {
    color: "#2F80FF",
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.2,
  },

  emailPill: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },

  emailText: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "center",
  },

  backgroundPhotoCard: {
    minHeight: 96,
    borderRadius: 22,
    borderWidth: 1.5,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },

  backgroundPhotoBlur: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  backgroundPhotoRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  backgroundThumbWrap: {
    width: 58,
    height: 58,
    borderRadius: 14,
    overflow: "hidden",
    marginRight: 14,
  },

  backgroundThumb: {
    width: 58,
    height: 58,
    borderRadius: 14,
  },

  backgroundThumbFallback: {
    width: 58,
    height: 58,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  backgroundTextWrap: {
    flex: 1,
  },

  backgroundTitle: {
    color: "#FFFFFF",
    fontWeight: "800",
    marginBottom: 4,
  },

  backgroundSubtitle: {
    lineHeight: 18,
  },

  backgroundResetText: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 8,
  },

  backgroundIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
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

  inlineFieldsRow: {
    flexDirection: "row",
    gap: 10,
  },

  stateField: {
    flex: 0.42,
  },

  zipField: {
    flex: 0.58,
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

  actionsCard: {
    marginBottom: 16,
  },

  actionsCardContent: {
    padding: 14,
    gap: 12,
  },

  saveButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#2F80FF",
  },

  secondarySignOutButton: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },

  secondarySignOutText: {
    fontWeight: "800",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },

  disabledInteraction: {
    opacity: 0.6,
  },
});