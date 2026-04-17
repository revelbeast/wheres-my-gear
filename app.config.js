export default {
  expo: {
    name: "Where's My Gear",
    slug: "wheres-my-gear",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "wheresmygear",
    ios: {
      bundleIdentifier: "com.milesandmoments.wheresmygear"
    },
    extra: {
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID,
      revenueCatIosKey: process.env.REVENUECAT_IOS_KEY
    }
  }
};