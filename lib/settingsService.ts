import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

const DEMO_USER_ID = "demo-user-123";

export type AppProfile = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  theme: "dark" | "light";
  profilePhotoUri: string;
};

const defaultProfile: AppProfile = {
  username: "rich",
  firstName: "Rich",
  lastName: "Garcia",
  email: "",
  phoneNumber: "",
  theme: "dark",
  profilePhotoUri: "",
};

function profileDoc() {
  return doc(db, "users", DEMO_USER_ID, "settings", "profile");
}

export async function getProfileSettings(): Promise<AppProfile> {
  const snapshot = await getDoc(profileDoc());

  if (!snapshot.exists()) {
    await setDoc(profileDoc(), defaultProfile);
    return defaultProfile;
  }

  return {
    ...defaultProfile,
    ...(snapshot.data() as Partial<AppProfile>),
  };
}

export async function saveProfileSettings(profile: AppProfile) {
  await setDoc(profileDoc(), profile, { merge: true });
}