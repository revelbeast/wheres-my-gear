type OpenFoodProduct = {
    name?: string | null;
};

type UPCItemDBProduct = {
    title: string | null;
    brand: string | null;
    image: string | null;
    description: string | null;
    upc: string;
    confidence: number;
};


export type ScanResult = {
    barcode: string;
    found: boolean;
    bestName: string;
    confidence: "high" | "medium" | "low";
    requiresManualEntry: boolean;
    sources: {
        openFoodFacts?: OpenFoodProduct | null;
        upcitemdb?: UPCItemDBProduct | null;
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

async function fetchUPCItemDB(
    barcode: string
): Promise<UPCItemDBProduct | null> {
    try {
        const res = await fetch(
            "https://us-central1-wheres-my-gear-ab7a7.cloudfunctions.net/lookupUPCItemDB",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ upc: barcode }),
            }
        );

        const data = await res.json();

        if (!res.ok || data?.found !== true) {
            return null;
        }

        return {
            title: data?.title ?? null,
            brand: data?.brand ?? null,
            image: data?.image ?? null,
            description: data?.description ?? null,
            upc: data?.upc ?? barcode,
            confidence:
                typeof data?.confidence === "number"
                    ? data.confidence
                    : 0.75,
        };
    } catch (err) {
        console.log("UPCITEMDB LOOKUP ERROR:", err);
        return null;
    }
}

function hasStrongProductData(product: UPCItemDBProduct | null) {
    if (!product) {
        return false;
    }

    const title = product.title?.trim() ?? "";
    const hasUsefulTitle = title.length >= 12;
    const hasImage = Boolean(product.image);

    return hasUsefulTitle && hasImage;
}

export async function resolveBarcode(
    barcode: string
): Promise<ScanResult> {
    const [food, upcitemdb] = await Promise.all([
        fetchOpenFoodFacts(barcode),
        fetchUPCItemDB(barcode),
    ]);

    const bestName =
        upcitemdb?.title ||
        upcitemdb?.brand ||
        food?.name ||
        `Item ${barcode.slice(-4)}`;

    const found = Boolean(upcitemdb || food);

    const confidence: ScanResult["confidence"] =
        hasStrongProductData(upcitemdb)
            ? "high"
            : upcitemdb || food
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
            upcitemdb: upcitemdb ?? null,
        },
        affiliateLink: null,
    };
}
