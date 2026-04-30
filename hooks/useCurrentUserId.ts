import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import {
    OAuthProvider,
    User,
    onAuthStateChanged,
    signInWithCredential,
    signOut,
} from "firebase/auth";
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { auth } from "../../firebaseConfig";

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  signInWithApple: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  async function signInWithApple() {
    const rawNonce = bytesToHex(Crypto.getRandomBytes(16));
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!appleCredential.identityToken) {
      throw new Error("Apple Sign-In failed. No identity token returned.");
    }

    const provider = new OAuthProvider("apple.com");
    const firebaseCredential = provider.credential({
      idToken: appleCredential.identityToken,
      rawNonce,
    });

    await signInWithCredential(auth, firebaseCredential);
  }

  async function signOutUser() {
    await signOut(auth);
  }

  const value = useMemo(
    () => ({
      user,
      initializing,
      signInWithApple,
      signOutUser,
    }),
    [user, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}