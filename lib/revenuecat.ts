import Constants from "expo-constants";
import { Platform } from "react-native";
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";

const PREMIUM_ENTITLEMENT_ID = "premium";
const PREMIUM_PLUS_ENTITLEMENT_ID = "premium_plus";
const PREMIUM_PLUS_PRODUCT_IDS = ["premium_plus_annual"];

let configurePromise: Promise<boolean> | null = null;
let isConfigured = false;
let currentLoggedInUserId: string | null = null;

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

async function logInRevenueCatUser(userId?: string | null) {
  const trimmedUserId = userId?.trim();

  if (!trimmedUserId) {
    return;
  }

  if (currentLoggedInUserId === trimmedUserId) {
    return;
  }

  try {
    await Purchases.logIn(trimmedUserId);
    currentLoggedInUserId = trimmedUserId;

    console.log("RevenueCat user linked:", {
      appUserId: trimmedUserId,
    });
  } catch (e: any) {
    const message = String(e?.message ?? e ?? "");

    if (
      message.toLowerCase().includes("same as the one already cached") ||
      message.toLowerCase().includes("already cached")
    ) {
      currentLoggedInUserId = trimmedUserId;
      return;
    }

    throw e;
  }
}

export async function configureRevenueCat(userId?: string | null) {
  if (isConfigured) {
    await logInRevenueCatUser(userId);
    return true;
  }

  if (configurePromise) {
    const configured = await configurePromise;

    if (configured) {
      await logInRevenueCatUser(userId);
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

      await logInRevenueCatUser(userId);

      return true;
    } catch (e: any) {
      const message = String(e?.message ?? e ?? "");

      if (
        message.toLowerCase().includes("already set") ||
        message.toLowerCase().includes("already configured")
      ) {
        isConfigured = true;
        await logInRevenueCatUser(userId);
        return true;
      }

      console.log("RevenueCat configuration failed:", e);
      isConfigured = false;
      configurePromise = null;
      currentLoggedInUserId = null;
      return false;
    }
  })();

  return configurePromise;
}

export async function initRevenueCat(userId?: string | null) {
  return configureRevenueCat(userId);
}

export async function logOutRevenueCatUser() {
  if (!isConfigured && configurePromise) {
    await configurePromise;
  }

  if (!isConfigured || !currentLoggedInUserId) {
    currentLoggedInUserId = null;
    return;
  }

  try {
    await Purchases.logOut();
    console.log("RevenueCat user logged out.");
  } catch (e) {
    console.log("RevenueCat logout unavailable:", e);
  } finally {
    currentLoggedInUserId = null;
  }
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

export function hasActivePremiumPlusEntitlement(customerInfo: CustomerInfo | null) {
  if (!customerInfo) {
    return false;
  }

  const hasPremiumPlusEntitlement = Boolean(
    customerInfo.entitlements.active[PREMIUM_PLUS_ENTITLEMENT_ID]
  );

  const hasPremiumPlusProduct = PREMIUM_PLUS_PRODUCT_IDS.some((productId) =>
    customerInfo.activeSubscriptions?.includes(productId)
  );

  return hasPremiumPlusEntitlement || hasPremiumPlusProduct;
}

export function hasPremiumPlusAccess(customerInfo: CustomerInfo | null) {
  return hasActivePremiumPlusEntitlement(customerInfo);
}

export async function isPremiumPlusUser() {
  try {
    const customerInfo = await getCustomerInfo();
    return hasPremiumPlusAccess(customerInfo);
  } catch (e) {
    console.log("RevenueCat premium plus check unavailable:", e);
    return false;
  }
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