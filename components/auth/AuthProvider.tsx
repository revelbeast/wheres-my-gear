import * as AppleAuthentication from "expo-apple-authentication";
import {
  User,
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

import { auth } from "../../firebaseConfig";
import {
  configureRevenueCat,
  logOutRevenueCatUser,
} from "../../lib/revenuecat";

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createAccountWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  const revenueCatConfiguredUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      console.log("Firebase auth state changed:", {
        signedIn: !!nextUser,
        uid: nextUser?.uid ?? null,
        email: nextUser?.email ?? null,
      });

      setUser(nextUser);
      setInitializing(false);

      if (!nextUser?.uid) {
        revenueCatConfiguredUserIdRef.current = null;
        return;
      }

      if (revenueCatConfiguredUserIdRef.current === nextUser.uid) {
        return;
      }

      revenueCatConfiguredUserIdRef.current = nextUser.uid;

      void configureRevenueCat(nextUser.uid).catch((error) => {
        console.error("Failed to configure RevenueCat for user:", error);
        revenueCatConfiguredUserIdRef.current = null;
      });
    });

    return unsubscribe;
  }, []);

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