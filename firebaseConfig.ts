import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { initializeApp, getApp, getApps } from "firebase/app";
import * as FirebaseAuth from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const extra = Constants.expoConfig?.extra ?? {};

const firebaseConfig = {
  apiKey: extra.firebaseApiKey,
  authDomain: extra.firebaseAuthDomain,
  projectId: extra.firebaseProjectId,
  storageBucket: extra.firebaseStorageBucket,
  messagingSenderId: extra.firebaseMessagingSenderId,
  appId: extra.firebaseAppId,
};

if (!firebaseConfig.apiKey) {
  console.error("Firebase API key is missing. Check EAS env variables.");
}

if (!firebaseConfig.projectId) {
  console.error("Firebase project ID is missing. Check EAS env variables.");
}

if (!firebaseConfig.storageBucket) {
  console.error("Firebase Storage bucket is missing. Check EAS env variables.");
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const authModule = FirebaseAuth as any;

let firebaseAuth;

try {
  firebaseAuth = authModule.initializeAuth(app, {
    persistence: authModule.getReactNativePersistence(AsyncStorage),
  });
} catch {
  firebaseAuth = FirebaseAuth.getAuth(app);
}

export const auth = firebaseAuth;
export const db = getFirestore(app);
export const storage = getStorage(app);