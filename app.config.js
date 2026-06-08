export default {
  expo: {
    name: "Where's My Gear",
    slug: "wheres-my-gear",
    version: "1.0.14",
    orientation: "default",
    scheme: "wheres-my-gear",

    icon: "./assets/images/app-icon.png",

    ios: {
      bundleIdentifier: "com.richgarcia.wheresmygear",
      buildNumber: "46",
      supportsTablet: true,
      usesIap: true,
      usesAppleSignIn: true,
    },

    android: {
      package: "com.revelbeast.wheresmygear",
      versionCode: 9,
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/images/app-icon.png",
        backgroundColor: "#0b1020",
      },
      intentFilters: [
        {
          action: "VIEW",
          data: [
            {
              scheme: "com.revelbeast.wheresmygear",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },

    plugins: [
      "expo-apple-authentication",
      "expo-web-browser",
      "expo-font",
      "expo-router",
      [
        "expo-speech-recognition",
        {
          microphonePermission:
            "Allow Where's My Gear to use your microphone for Gear Assistant.",
          speechRecognitionPermission:
            "Allow Where's My Gear to recognize speech for Gear Assistant.",
        },
      ],
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme:
            "com.googleusercontent.apps.742156812361-dkqbs9o24bhmnk7vrf46clhuv3vep8oo",
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
      revenueCatIosKey: "appl_mSZszlOmDuRtonDUwsKqTsoYsDX",
      revenueCatAndroidKey: "goog_kQGiZroVpnrsZIhIedjpdBuZxYb",
      googleWebClientId:
        "742156812361-dkqbs9o24bhmnk7vrf46clhuv3vep8oo.apps.googleusercontent.com",
      googleAndroidClientId:
        "742156812361-k57ebtl2j0h636t2j68ll3l0pqcvj21m.apps.googleusercontent.com",
    },
  },
};