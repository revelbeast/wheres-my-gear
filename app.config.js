export default {
  expo: {
    name: "Where's My Gear",
    slug: "wheres-my-gear",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "wheres-my-gear",

    icon: "./assets/images/app-icon.png",

    ios: {
      bundleIdentifier: "com.richgarcia.wheresmygear",
      supportsTablet: false,
    },

    android: {
      package: "com.milesandmoments.wheresmygear",
      adaptiveIcon: {
        foregroundImage: "./assets/images/app-icon.png",
        backgroundColor: "#0b1020",
      },
    },

    plugins: [
      [
        "expo-tracking-transparency",
        {
          userTrackingPermission:
            "This identifier will be used to deliver personalized ads and support the free version of Where's My Gear.",
        },
      ],
      [
        "react-native-google-mobile-ads",
        {
          iosAppId: "ca-app-pub-3940256099942544~1458002511",
          androidAppId: "ca-app-pub-3940256099942544~3347511713",
        },
      ],
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
      revenueCatIosKey: process.env.REVENUECAT_IOS_KEY,
    },
  },
};