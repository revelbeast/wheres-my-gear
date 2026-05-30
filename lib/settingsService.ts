import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export type AppTheme = "dark" | "light";
export type AppFontSize = "small" | "medium" | "large";
export type BackgroundResizeMode = "cover" | "contain" | "center";

export type AppAddress = {
  streetAddress: string;
  apartmentSuite: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
};

export type AppProfile = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  theme: AppTheme;
  fontSize: AppFontSize;
  profilePhotoUri: string;
  backgroundPhotoUri?: string;
  backgroundResizeMode: BackgroundResizeMode;
  hapticsEnabled: boolean;
  address: AppAddress;
};

export type NotificationSettings = {
  checklistReminders: boolean;
  tripReminders: boolean;
  packingReminders: boolean;
};

const defaultAddress: AppAddress = {
  streetAddress: "",
  apartmentSuite: "",
  city: "",
  state: "",
  zipCode: "",
  country: "",
};

const defaultProfile: AppProfile = {
  username: "",
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  theme: "dark",
  fontSize: "medium",
  profilePhotoUri: "",
  backgroundPhotoUri: "",
  backgroundResizeMode: "cover",
  hapticsEnabled: true,
  address: defaultAddress,
};

const defaultNotificationSettings: NotificationSettings = {
  checklistReminders: true,
  tripReminders: true,
  packingReminders: false,
};

const legacyHardcodedProfileValues = {
  username: "",
  firstName: "",
  lastName: "",
};

function profileDoc(userId: string) {
  return doc(db, "users", userId, "settings", "profile");
}

function notificationSettingsDoc() {
  return doc(db, "appSettings", "notifications");
}

function isSafeUserId(userId: string): boolean {
  return typeof userId === "string" && userId.trim().length > 0;
}

function getSafeString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
}

function getSafeOptionalString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
}

function getSafeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value !== "boolean") {
    return fallback;
  }

  return value;
}

function getSafeTheme(value: unknown): AppTheme {
  if (value === "dark" || value === "light") {
    return value;
  }

  return defaultProfile.theme;
}

function getSafeFontSize(value: unknown): AppFontSize {
  if (value === "small" || value === "medium" || value === "large") {
    return value;
  }

  return defaultProfile.fontSize;
}

function getSafeBackgroundResizeMode(value: unknown): BackgroundResizeMode {
  if (value === "cover" || value === "contain" || value === "center") {
    return value;
  }

  return defaultProfile.backgroundResizeMode;
}

function normalizeAddress(value: unknown): AppAddress {
  const address =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<AppAddress>)
      : {};

  return {
    streetAddress: getSafeString(address.streetAddress),
    apartmentSuite: getSafeString(address.apartmentSuite),
    city: getSafeString(address.city),
    state: getSafeString(address.state),
    zipCode: getSafeString(address.zipCode),
    country: getSafeString(address.country),
  };
}

function sanitizeProfilePayload(profile: Partial<AppProfile>): AppProfile {
  return {
    username: getSafeString(profile.username),
    firstName: getSafeString(profile.firstName),
    lastName: getSafeString(profile.lastName),
    email: getSafeString(profile.email).toLowerCase(),
    phoneNumber: getSafeString(profile.phoneNumber),
    theme: getSafeTheme(profile.theme),
    fontSize: getSafeFontSize(profile.fontSize),
    profilePhotoUri: getSafeOptionalString(profile.profilePhotoUri),
    backgroundPhotoUri: getSafeOptionalString(profile.backgroundPhotoUri),
    backgroundResizeMode: getSafeBackgroundResizeMode(
      profile.backgroundResizeMode
    ),
    hapticsEnabled: getSafeBoolean(
      profile.hapticsEnabled,
      defaultProfile.hapticsEnabled
    ),
    address: normalizeAddress(profile.address),
  };
}

function mergeProfileData(data: Partial<AppProfile>): AppProfile {
  return sanitizeProfilePayload({
    ...defaultProfile,
    ...data,
    address: {
      ...defaultAddress,
      ...(data.address ?? {}),
    },
  });
}

function sanitizeNotificationSettings(
  settings: Partial<NotificationSettings>
): NotificationSettings {
  return {
    checklistReminders: getSafeBoolean(
      settings.checklistReminders,
      defaultNotificationSettings.checklistReminders
    ),
    tripReminders: getSafeBoolean(
      settings.tripReminders,
      defaultNotificationSettings.tripReminders
    ),
    packingReminders: getSafeBoolean(
      settings.packingReminders,
      defaultNotificationSettings.packingReminders
    ),
  };
}

function clearLegacyTestAddress(profile: AppProfile): AppProfile {
  const address = profile.address ?? defaultAddress;

  const looksLikeLegacyLaceyTestAddress =
    address.streetAddress === "" &&
    address.apartmentSuite === "" &&
    address.city.trim().toLowerCase() === "lacey" &&
    address.state === "" &&
    address.zipCode === "" &&
    (address.country === "" || address.country === "United States");

  if (!looksLikeLegacyLaceyTestAddress) {
    return profile;
  }

  return {
    ...profile,
    address: {
      ...address,
      city: "",
      country: "",
    },
  };
}

function removeLegacyHardcodedDefaults(profile: AppProfile): AppProfile {
  const hasLegacyName =
    profile.username === legacyHardcodedProfileValues.username &&
    profile.firstName === legacyHardcodedProfileValues.firstName &&
    profile.lastName === legacyHardcodedProfileValues.lastName;

  const looksLikeUntouchedDefault =
    hasLegacyName &&
    profile.email === "" &&
    profile.phoneNumber === "" &&
    profile.profilePhotoUri === "" &&
    profile.backgroundPhotoUri === "" &&
    profile.address.streetAddress === "" &&
    profile.address.apartmentSuite === "" &&
    profile.address.city === "" &&
    profile.address.state === "" &&
    profile.address.zipCode === "";

  if (!looksLikeUntouchedDefault) {
    return clearLegacyTestAddress(profile);
  }

  return clearLegacyTestAddress({
    ...profile,
    username: "",
    firstName: "",
    lastName: "",
  });
}

export async function getProfileSettings(userId: string): Promise<AppProfile> {
  if (!isSafeUserId(userId)) {
    return defaultProfile;
  }

  const ref = profileDoc(userId.trim());

  let snapshot;
  try {
    snapshot = await getDoc(ref);
  } catch (error) {
    console.warn("Profile settings unavailable offline. Using defaults.", error);
    return sanitizeProfilePayload(defaultProfile);
  }

  if (!snapshot.exists()) {
    try {
      await setDoc(ref, sanitizeProfilePayload(defaultProfile), { merge: true });
    } catch (error) {
      console.warn("Unable to create default profile settings.", error);
    }

    return sanitizeProfilePayload(defaultProfile);
  }

  const data = snapshot.data() as Partial<AppProfile>;
  const mergedProfile = mergeProfileData(data);
  const cleanedProfile = removeLegacyHardcodedDefaults(mergedProfile);

  if (JSON.stringify(cleanedProfile) !== JSON.stringify(data)) {
    await setDoc(ref, cleanedProfile, { merge: true });
  }

  return cleanedProfile;
}

export async function saveProfileSettings(
  userId: string,
  profile: AppProfile
) {
  if (!isSafeUserId(userId)) {
    throw new Error("Cannot save profile settings without a valid user ID.");
  }

  const sanitizedProfile = sanitizeProfilePayload(profile);

  await setDoc(profileDoc(userId.trim()), sanitizedProfile, { merge: true });
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const ref = notificationSettingsDoc();
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    const sanitizedSettings = sanitizeNotificationSettings(
      defaultNotificationSettings
    );

    await setDoc(ref, sanitizedSettings, { merge: true });
    return sanitizedSettings;
  }

  const data = snapshot.data() as Partial<NotificationSettings>;

  return sanitizeNotificationSettings({
    ...defaultNotificationSettings,
    ...data,
  });
}

export async function saveNotificationSettings(settings: NotificationSettings) {
  const sanitizedSettings = sanitizeNotificationSettings(settings);

  await setDoc(notificationSettingsDoc(), sanitizedSettings, { merge: true });
}