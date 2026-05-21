import axios from "axios";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

const serpApiKey = defineSecret("SERPAPI_API_KEY");

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

      const result = response.data?.shopping_results?.[0];

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
        confidence: 0.7,
        title: result?.title ?? null,
        brand: result?.source ?? null,
        image: result?.thumbnail ?? null,
        description: result?.snippet ?? null,
        link: result?.link ?? result?.product_link ?? null,
        price: result?.price ?? null,
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
