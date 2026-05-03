import Constants from "expo-constants";
import { Platform } from "react-native";
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";

const PREMIUM_ENTITLEMENT_ID = "premium";

let configurePromise: Promise<boolean> | null = null;
let isConfigured = false;

function getRevenueCatApiKey() {
  const extra = Constants.expoConfig?.extra ?? {};

  if (Platform.OS === "ios") {
    return extra.revenueCatIosKey ?? extra.REVENUECAT_IOS_KEY ?? null;
  }

  if (Platform.OS === "android") {
    return extra.revenueCatAndroidKey ?? extra.REVENUECAT_ANDROID_KEY ?? null;
  }

  return null;
}

export async function configureRevenueCat(userId?: string | null) {
  if (isConfigured) {
    if (userId) {
      await Purchases.logIn(userId);
    }

    return true;
  }

  if (configurePromise) {
    const configured = await configurePromise;

    if (configured && userId) {
      await Purchases.logIn(userId);
    }

    return configured;
  }

  configurePromise = (async () => {
    try {
      const apiKey = getRevenueCatApiKey();

      if (!apiKey) {
        console.log("RevenueCat API key missing. Skipping configuration.");
        return false;
      }

      Purchases.configure({ apiKey });

      isConfigured = true;
      console.log("RevenueCat configured.");

      if (userId) {
        await Purchases.logIn(userId);
      }

      return true;
    } catch (e) {
      console.log("RevenueCat configuration failed:", e);
      isConfigured = false;
      configurePromise = null;
      return false;
    }
  })();

  return configurePromise;
}

export async function initRevenueCat(userId?: string | null) {
  return configureRevenueCat(userId);
}

export async function getOfferings() {
  try {
    const configured = await configureRevenueCat();

    if (!configured) {
      return null;
    }

    return await Purchases.getOfferings();
  } catch (e) {
    console.log("RevenueCat offerings unavailable:", e);
    return null;
  }
}

export async function getCustomerInfo() {
  try {
    const configured = await configureRevenueCat();

    if (!configured) {
      return null;
    }

    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.log("RevenueCat customer info unavailable:", e);
    return null;
  }
}

export function hasActivePremiumEntitlement(customerInfo: CustomerInfo | null) {
  if (!customerInfo) {
    return false;
  }

  return Boolean(customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID]);
}

export async function isPremiumUser() {
  try {
    const customerInfo = await getCustomerInfo();
    return hasActivePremiumEntitlement(customerInfo);
  } catch (e) {
    console.log("RevenueCat premium check unavailable:", e);
    return false;
  }
}

export async function purchasePackage(packageToPurchase: PurchasesPackage) {
  try {
    const configured = await configureRevenueCat();

    if (!configured) {
      return null;
    }

    const purchaseResult = await Purchases.purchasePackage(packageToPurchase);
    return purchaseResult.customerInfo;
  } catch (e: any) {
    if (e?.userCancelled) {
      return null;
    }

    console.log("RevenueCat purchase failed:", e);
    return null;
  }
}

export async function restorePurchases() {
  try {
    const configured = await configureRevenueCat();

    if (!configured) {
      return null;
    }

    return await Purchases.restorePurchases();
  } catch (e) {
    console.log("RevenueCat restore failed:", e);
    return null;
  }
}

export type RevenueCatOffering = PurchasesOffering;
export type RevenueCatPackage = PurchasesPackage;