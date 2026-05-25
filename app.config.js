export default {
  expo: {
    name: "Where's My Gear",
    slug: "wheres-my-gear",
    version: "1.0.8",
    orientation: "default",
    scheme: "wheres-my-gear",

    icon: "./assets/images/app-icon.png",

    ios: {
      bundleIdentifier: "com.richgarcia.wheresmygear",
      buildNumber: "37",
      supportsTablet: true,
      usesIap: true,
      usesAppleSignIn: true,
    },

    android: {
      package: "com.revelbeast.wheresmygear",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/images/app-icon.png",
        backgroundColor: "#0b1020",
      },
    },

    plugins: [
      "expo-apple-authentication",
      "expo-web-browser",

    ],

    extra: {
      eas: {
        projectId: "261a4b33-a761-486a-b49f-7b836fec05c5",
      },
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID,
      revenueCatIosKey: "appl_mSZszlOmDuRtonDUwsKqTsoYsDX",
      revenueCatAndroidKey: "goog_kQGiZroVpnrsZIhIedjpdBuZxYb",
    },
  },
};