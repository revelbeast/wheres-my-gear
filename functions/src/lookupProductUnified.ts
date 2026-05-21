import { searchSerpApi } from "./serpapiLookup";

export type UnifiedProduct = {
    found: boolean;

    source: "amazon" | "serpapi" | "none";

    confidence: number;

    title: string | null;
    image: string | null;
    price: string | null;

    brand: string | null;
    description: string | null;
    link: string | null;

    raw?: any;
};
export async function lookupProductUnified(query: string): Promise<UnifiedProduct> {
    if (!query) {
        return {
            found: false,
            source: "none",
            confidence: 0,
            title: null,
            image: null,
            price: null,
            brand: null,
            description: null,
            link: null,
            raw: null,
        };
    }

    try {
        const serp = await searchSerpApi(query);

        return {
            found: serp?.found ?? false,
            source: "serpapi",
            confidence: serp?.confidence ?? 0,
            title: serp?.title ?? null,
            image: serp?.image ?? null,
            price: serp?.price ?? null,
            brand: serp?.brand ?? null,
            description: serp?.description ?? null,
            link: serp?.link ?? null,
            raw: serp,
        };
    } catch (err) {
        return {
            found: false,
            source: "none",
            confidence: 0,
            title: null,
            image: null,
            price: null,
            brand: null,
            description: null,
            link: null,
            raw: err,
        };
    }
}