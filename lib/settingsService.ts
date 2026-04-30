import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export type AppTheme = "dark" | "light";
export type AppFontSize = "small" | "medium" | "large";

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
  address: AppAddress;
};

const defaultAddress: AppAddress = {
  streetAddress: "",
  apartmentSuite: "",
  city: "",
  state: "",
  zipCode: "",
  country: "United States",
};

const defaultProfile: AppProfile = {
  username: "rich",
  firstName: "Rich",
  lastName: "Garcia",
  email: "",
  phoneNumber: "",
  theme: "dark",
  fontSize: "medium",
  profilePhotoUri: "",
  backgroundPhotoUri: "",
  address: defaultAddress,
};

function profileDoc(userId: string) {
  return doc(db, "users", userId, "settings", "profile");
}

export async function getProfileSettings(userId: string): Promise<AppProfile> {
  const snapshot = await getDoc(profileDoc(userId));

  if (!snapshot.exists()) {
    await setDoc(profileDoc(userId), defaultProfile);
    return defaultProfile;
  }

  const data = snapshot.data() as Partial<AppProfile>;

  return {
    ...defaultProfile,
    ...data,
    address: {
      ...defaultAddress,
      ...(data.address ?? {}),
    },
  };
}

export async function saveProfileSettings(
  userId: string,
  profile: AppProfile
) {
  await setDoc(profileDoc(userId), profile, { merge: true });
}