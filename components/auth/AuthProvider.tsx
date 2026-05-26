import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import {
  User,
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

import { auth } from "../../firebaseConfig";
import { publishAppBackgroundUpdate } from "../../lib/backgroundUpdateBus";
import { getProfileSettings } from "../../lib/settingsService";
import {
  clearAppThemeUpdateForUser,
  publishAppThemeUpdate,
} from "../../lib/themeUpdateBus";
import {
  configureRevenueCat,
  logOutRevenueCatUser,
} from "../../lib/revenuecat";

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createAccountWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

WebBrowser.maybeCompleteAuthSession();

const extra = Constants.expoConfig?.extra ?? {};
const googleWebClientId =
  typeof extra.googleWebClientId === "string" ? extra.googleWebClientId : "";
const googleAndroidClientId =
  typeof extra.googleAndroidClientId === "string"
    ? extra.googleAndroidClientId
    : "";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getSafeBackgroundUri(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  const revenueCatConfiguredUserIdRef = useRef<string | null>(null);
  const authHydrationRequestRef = useRef(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      const hydrationRequestId = authHydrationRequestRef.current + 1;
      authHydrationRequestRef.current = hydrationRequestId;

      console.log("Firebase auth state changed:", {
        signedIn: !!nextUser,
        uid: nextUser?.uid ?? null,
        email: nextUser?.email ?? null,
      });

      async function hydrateAuthState() {
        if (!nextUser?.uid) {
          clearAppThemeUpdateForUser(user?.uid);
          revenueCatConfiguredUserIdRef.current = null;
          setUser(null);
          setInitializing(false);
          return;
        }

        try {
          const profile = await getProfileSettings(nextUser.uid);

          if (authHydrationRequestRef.current !== hydrationRequestId) {
            return;
          }

          publishAppThemeUpdate(
            nextUser.uid,
            profile.theme,
            profile.fontSize
          );

          publishAppBackgroundUpdate(
            nextUser.uid,
            getSafeBackgroundUri(profile.backgroundPhotoUri),
            profile.backgroundResizeMode
          );
        } catch (error) {
          console.log("Failed to hydrate saved app settings during auth startup.", error);
        }

        if (authHydrationRequestRef.current !== hydrationRequestId) {
          return;
        }

        setUser(nextUser);
        setInitializing(false);

        if (revenueCatConfiguredUserIdRef.current === nextUser.uid) {
          return;
        }

        revenueCatConfiguredUserIdRef.current = nextUser.uid;

        void configureRevenueCat(nextUser.uid).catch((error) => {
          console.error("Failed to configure RevenueCat for user:", error);
          revenueCatConfiguredUserIdRef.current = null;
        });
      }

      void hydrateAuthState();
    });

    return unsubscribe;
  }, [user?.uid]);

  async function signInWithApple() {
    console.log("Apple Sign-In started.");

    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    console.log("Apple credential received:", {
      user: appleCredential.user,
      email: appleCredential.email ?? null,
      hasIdentityToken: !!appleCredential.identityToken,
      hasAuthorizationCode: !!appleCredential.authorizationCode,
    });

    if (!appleCredential.identityToken) {
      throw new Error("Apple Sign-In failed because no identity token was returned.");
    }

    const provider = new OAuthProvider("apple.com");
    const firebaseCredential = provider.credential({
      idToken: appleCredential.identityToken,
    });

    console.log("Firebase Apple credential created. Signing in...");

    const result = await signInWithCredential(auth, firebaseCredential);

    console.log("Firebase Apple sign-in succeeded:", {
      uid: result.user.uid,
      email: result.user.email ?? null,
    });

    setUser(result.user);
  }

  async function signInWithGoogle() {
    console.log("Google Sign-In started.");

    if (!googleWebClientId) {
      throw new Error("Google Sign-In is missing the web client ID.");
    }

    let idToken: string | null = null;

    if (Platform.OS === "android") {
      if (!googleAndroidClientId) {
        throw new Error("Google Sign-In is missing the Android client ID.");
      }

      const redirectUri = AuthSession.makeRedirectUri({
        scheme: "com.revelbeast.wheresmygear",
      });

      const authRequestUrl =
        "https://accounts.google.com/o/oauth2/v2/auth" +
        `?client_id=${encodeURIComponent(googleAndroidClientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        "&response_type=code" +
        "&scope=openid%20profile%20email";

      const authResult = await WebBrowser.openAuthSessionAsync(
        authRequestUrl,
        redirectUri
      );

      if (authResult.type !== "success") {
        throw new Error("Google Sign-In was cancelled or did not complete.");
      }

      const redirectUrl = new URL(authResult.url);
      const queryParams = new URLSearchParams(redirectUrl.search);
      const authorizationCode = queryParams.get("code");

      if (!authorizationCode) {
        throw new Error("Google Sign-In failed because no authorization code was returned.");
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: googleAndroidClientId,
          code: authorizationCode,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }).toString(),
      });

      const tokenJson = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error("Google token exchange failed:", tokenJson);
        throw new Error("Google Sign-In token exchange failed.");
      }

      idToken = typeof tokenJson.id_token === "string" ? tokenJson.id_token : null;
    } else {
      const { GoogleSignin } = require("@react-native-google-signin/google-signin");

      GoogleSignin.configure({
        webClientId: googleWebClientId,
        offlineAccess: false,
      });

      const googleCredential = await GoogleSignin.signIn();

      idToken =
        (googleCredential as any)?.data?.idToken ??
        (googleCredential as any)?.idToken ??
        null;
    }

    if (!idToken) {
      throw new Error("Google Sign-In failed because no ID token was returned.");
    }

    const firebaseCredential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, firebaseCredential);

    console.log("Firebase Google sign-in succeeded:", {
      uid: result.user.uid,
      email: result.user.email ?? null,
    });

    setUser(result.user);
  }

  async function signInWithEmail(email: string, password: string) {
    const cleanEmail = normalizeEmail(email);

    const result = await signInWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    );

    setUser(result.user);
  }

  async function createAccountWithEmail(email: string, password: string) {
    const cleanEmail = normalizeEmail(email);

    const result = await createUserWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    );

    setUser(result.user);
  }

  async function sendPasswordReset(email: string) {
    const cleanEmail = normalizeEmail(email);
    await sendPasswordResetEmail(auth, cleanEmail);
  }

  async function signOutUser() {
    authHydrationRequestRef.current += 1;
    clearAppThemeUpdateForUser(user?.uid);
    revenueCatConfiguredUserIdRef.current = null;
    await logOutRevenueCatUser();
    await signOut(auth);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      initializing,
      signInWithApple,
      signInWithGoogle,
      signInWithEmail,
      createAccountWithEmail,
      sendPasswordReset,
      signOutUser,
    }),
    [user, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}