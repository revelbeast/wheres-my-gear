import Constants from "expo-constants";
import { Platform } from "react-native";
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesPackage,
} from "react-native-purchases";

const REVENUECAT_IOS_KEY = Constants.expoConfig?.extra?.revenueCatIosKey;
const PREMIUM_ENTITLEMENT_IDS = ["Premium", "premium"];

let isConfigured = false;
let configurePromise: Promise<void> | null = null;
let loggedInUserId: string | null = null;

export function hasActivePremiumEntitlement(customerInfo: CustomerInfo | null) {
  if (!customerInfo?.entitlements?.active) {
    return false;
  }

  return PREMIUM_ENTITLEMENT_IDS.some(
    (entitlementId) => !!customerInfo.entitlements.active[entitlementId]
  );
}

async function assumeAlreadyConfiguredIfPossible() {
  try {
    await Purchases.getCustomerInfo();
    isConfigured = true;
    return true;
  } catch {
    return false;
  }
}

export async function initRevenueCat(userId?: string) {
  if (Platform.OS !== "ios") {
    return;
  }

  if (!REVENUECAT_IOS_KEY) {
    console.log("RevenueCat skipped: missing iOS API key.");
    return;
  }

  if (configurePromise) {
    await configurePromise;
  }

  if (!isConfigured) {
    const alreadyConfigured = await assumeAlreadyConfiguredIfPossible();

    if (!alreadyConfigured) {
      configurePromise = Promise.resolve()
        .then(async () => {
          Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);

          Purchases.configure({
            apiKey: REVENUECAT_IOS_KEY,
          });

          isConfigured = true;
        })
        .catch((error) => {
          configurePromise = null;
          isConfigured = false;
          console.log("RevenueCat configuration failed:", error);
        });

      await configurePromise;
    }
  }

  if (!isConfigured) {
    return;
  }

  if (userId && loggedInUserId !== userId) {
    try {
      await Purchases.logIn(userId);
      loggedInUserId = userId;
    } catch (error) {
      console.log("RevenueCat login failed:", error);
    }
  }
}

async function ensureRevenueCatConfigured() {
  await initRevenueCat();
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    await ensureRevenueCatConfigured();

    if (!isConfigured) {
      return null;
    }

    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.log("RevenueCat customer info unavailable:", e);
    return null;
  }
}

export async function isPremiumUser() {
  try {
    await ensureRevenueCatConfigured();

    if (!isConfigured) {
      return false;
    }

    const info = await Purchases.getCustomerInfo();

    return hasActivePremiumEntitlement(info);
  } catch (e) {
    console.log("RevenueCat premium check unavailable:", e);
    return false;
  }
}

export async function getOfferings() {
  try {
    await ensureRevenueCatConfigured();

    if (!isConfigured) {
      return null;
    }

    return await Purchases.getOfferings();
  } catch (e) {
    console.log("RevenueCat offerings unavailable:", e);
    return null;
  }
}

export async function purchasePackage(pkg: PurchasesPackage) {
  try {
    await ensureRevenueCatConfigured();

    if (!isConfigured) {
      return null;
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (e: any) {
    if (!e?.userCancelled) {
      console.log("RevenueCat purchase unavailable:", e);
    }

    return null;
  }
}

export async function restorePurchases() {
  try {
    await ensureRevenueCatConfigured();

    if (!isConfigured) {
      return null;
    }

    return await Purchases.restorePurchases();
  } catch (e) {
    console.log("RevenueCat restore unavailable:", e);
    return null;
  }
}