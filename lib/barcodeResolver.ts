type OpenFoodProduct = {
    name?: string | null;
};

type AmazonProduct = {
    title: string;
    asin: string;
    image?: string;
    url: string;
};

export type ScanResult = {
    barcode: string;
    found: boolean;
    bestName: string;
    confidence: "high" | "medium" | "low";
    requiresManualEntry: boolean;
    sources: {
        openFoodFacts?: OpenFoodProduct | null;
        amazon?: AmazonProduct | null;
    };
    affiliateLink?: string | null;
};

async function fetchOpenFoodFacts(
    barcode: string
): Promise<OpenFoodProduct | null> {
    try {
        const res = await fetch(
            `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
            {
                headers: {
                    Accept: "application/json",
                    "User-Agent": "wheres-my-gear-app",
                },
            }
        );

        const text = await res.text();

        // guard: HTML response (API error / redirect / block)
        if (!text || text.trim().startsWith("<")) {
            console.log("OPEN FOOD FACTS: Non-JSON response received");
            return null;
        }

        const data = JSON.parse(text);

        if (data?.status === 1) {
            return {
                name:
                    data?.product?.product_name ||
                    data?.product?.generic_name ||
                    null,
            };
        }

        return null;
    } catch (err) {
        console.log("OPEN FOOD FACTS ERROR:", err);
        return null;
    }
}

/**
 * Amazon resolver (Step 5C placeholder)
 * Will be replaced with PA-API in Step 5D
 */
import { buildAmazonAffiliateLink } from "./amazonAffiliate";

async function fetchAmazonProduct(
    barcode: string
): Promise<AmazonProduct | null> {
    try {
        // We now use Amazon SEARCH instead of PA-API lookup
        const fallbackQuery = `item ${barcode}`;

        const url = buildAmazonAffiliateLink(fallbackQuery);

        return {
            title: fallbackQuery,
            asin: "search",
            url,
        };
    } catch (err) {
        console.log("AMAZON AFFILIATE LINK ERROR:", err);
        return null;
    }
}

export async function resolveBarcode(
    barcode: string
): Promise<ScanResult> {
    const [food, amazon] = await Promise.all([
        fetchOpenFoodFacts(barcode),
        fetchAmazonProduct(barcode),
    ]);

    const bestAmazon = amazon;

    const bestName =
        bestAmazon?.title ||
        food?.name ||
        `Item ${barcode.slice(-4)}`;

    const found = Boolean(food || amazon);

    const confidence: ScanResult["confidence"] = amazon
        ? "high"
        : food
            ? "medium"
            : "low";

    return {
        barcode,
        found,
        bestName,
        confidence,
        requiresManualEntry: !found,
        sources: {
            openFoodFacts: food,
            amazon: amazon ?? null,
        },
        affiliateLink: bestAmazon?.url ?? null,
    };
}