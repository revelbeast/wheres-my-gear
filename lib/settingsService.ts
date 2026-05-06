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

function getSafeBackgroundResizeMode(value: unknown): BackgroundResizeMode {
  if (value === "cover" || value === "contain" || value === "center") {
    return value;
  }

  return defaultProfile.backgroundResizeMode;
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
  const ref = profileDoc(userId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    await setDoc(ref, defaultProfile);
    return defaultProfile;
  }

  const data = snapshot.data() as Partial<AppProfile>;

  const mergedProfile: AppProfile = {
    ...defaultProfile,
    ...data,
    backgroundResizeMode: getSafeBackgroundResizeMode(
      data.backgroundResizeMode
    ),
    hapticsEnabled: data.hapticsEnabled ?? defaultProfile.hapticsEnabled,
    address: {
      ...defaultAddress,
      ...(data.address ?? {}),
    },
  };

  const cleanedProfile = removeLegacyHardcodedDefaults(mergedProfile);

  if (JSON.stringify(cleanedProfile) !== JSON.stringify(mergedProfile)) {
    await setDoc(ref, cleanedProfile, { merge: true });
  }

  return cleanedProfile;
}

export async function saveProfileSettings(
  userId: string,
  profile: AppProfile
) {
  await setDoc(profileDoc(userId), profile, { merge: true });
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const ref = notificationSettingsDoc();
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    await setDoc(ref, defaultNotificationSettings);
    return defaultNotificationSettings;
  }

  const data = snapshot.data() as Partial<NotificationSettings>;

  return {
    ...defaultNotificationSettings,
    ...data,
  };
}

export async function saveNotificationSettings(settings: NotificationSettings) {
  await setDoc(notificationSettingsDoc(), settings, { merge: true });
}