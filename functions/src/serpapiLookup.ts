import axios from "axios";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

const serpApiKey = defineSecret("SERPAPI_API_KEY");

export async function searchSerpApi(query: string) {
  const cleanedQuery = query.trim();

  const response = await axios.get("https://serpapi.com/search.json", {
    params: {
      engine: "google_shopping",
      q: cleanedQuery,
      api_key: serpApiKey.value(),
    },
    timeout: 10000,
  });

  const result = response.data?.shopping_results?.[0];

  const hasImage = !!result?.thumbnail;
  const hasPrice = !!result?.price;
  const hasLink = !!result?.link || !!result?.product_link;
  const hasTitle = !!result?.title;

  // REAL confidence model (this is what matters for conversion)
  let confidence = 0.2;

  if (hasTitle) confidence += 0.2;
  if (hasImage) confidence += 0.2;
  if (hasPrice) confidence += 0.3;
  if (hasLink) confidence += 0.2;

  // clamp
  confidence = Math.min(0.95, confidence);

  return {
    found: !!result,
    source: "serpapi",
    confidence,

    title: result?.title ?? null,
    image: result?.thumbnail ?? null,
    price: result?.price ?? null,

    brand: result?.source ?? result?.merchant ?? null,
    description: result?.snippet ?? null,
    link: result?.link ?? result?.product_link ?? null,

    raw: result,
  };
}

export const lookupSerpApiProduct = onRequest(
  { secrets: [serpApiKey] },
  async (req, res) => {
    const query = req.body?.query ?? req.body?.upc;

    if (!query || typeof query !== "string") {
      res.status(400).json({
        found: false,
        source: "serpapi",
        error: "Query or UPC is required",
      });
      return;
    }

    const cleanedQuery = query.trim();

    try {
      const response = await axios.get("https://serpapi.com/search.json", {
        params: {
          engine: "google_shopping",
          q: cleanedQuery,
          api_key: serpApiKey.value(),
        },
        timeout: 10000,
      });

      const results = response.data?.shopping_results ?? [];

      const result =
        results.find((r: any) =>
          r?.price &&
          (r?.link || r?.product_link) &&
          r?.thumbnail
        ) ||
        results.find((r: any) => r?.price && (r?.link || r?.product_link)) ||
        results.find((r: any) => r?.price) ||
        results[0];

      if (!result) {
        res.json({
          found: false,
          source: "serpapi",
          confidence: 0,
          title: null,
          brand: null,
          image: null,
          description: null,
          link: null,
          price: null,
          query: cleanedQuery,
        });
        return;
      }

      res.json({
        found: true,
        source: "serpapi",
        confidence: Math.min(
          0.95,
          0.4 +
          (result?.price ? 0.3 : 0) +
          (result?.thumbnail ? 0.2 : 0) +
          (result?.snippet ? 0.1 : 0)
        ),

        title: result?.title ?? null,
        image: result?.thumbnail ?? null,
        price: result?.price ?? null,

        brand: result?.source ?? result?.merchant ?? null,
        description: result?.snippet ?? null,
        link: result?.link ?? result?.product_link ?? null,

        query: cleanedQuery,
      });
    } catch (err) {
      const details = axios.isAxiosError(err)
        ? err.response?.data ?? err.message
        : "Unknown SerpAPI error";

      console.log("SERPAPI LOOKUP FAILED:", details);

      res.json({
        found: false,
        source: "serpapi",
        confidence: 0,
        title: null,
        brand: null,
        image: null,
        description: null,
        link: null,
        price: null,
        query: cleanedQuery,
        error: "SerpAPI unavailable",
      });
    }
  }
);
