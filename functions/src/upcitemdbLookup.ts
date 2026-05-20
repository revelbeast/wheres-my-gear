import axios from "axios";
import { onRequest } from "firebase-functions/v2/https";

export const lookupUPCItemDB = onRequest(async (req, res) => {
  const upc = req.body?.upc;

  // 1. Validate input first (IMPORTANT ORDER)
  if (!upc || typeof upc !== "string") {
    res.status(400).json({
      error: "UPC is required",
    });
    return;
  }

  const cleanedUPC = upc.trim();

  try {
    // 2. Call UPCitemDB (trial endpoint uses GET + query param)
    const response = await axios.get(
      "https://api.upcitemdb.com/prod/trial/lookup",
      {
        params: {
          upc: cleanedUPC,
        },
        timeout: 8000,
      }
    );

    const item = response.data?.items?.[0];

    // 3. No match case
    if (!item) {
      res.json({
        found: false,
        source: "upcitemdb",
        confidence: 0,
        title: null,
        brand: null,
        image: null,
        description: null,
        upc: cleanedUPC,
      });
      return;
    }

    // 4. Success response (normalized)
    res.json({
      found: true,
      source: "upcitemdb",
      confidence: 0.75,
      title: item?.title ?? null,
      brand: item?.brand ?? null,
      image: item?.images?.[0] ?? null,
      description: item?.description ?? null,
      upc: cleanedUPC,
    });
  } catch (err) {
    // 5. Error fallback
    res.status(500).json({
      found: false,
      source: "upcitemdb",
      confidence: 0,
      title: null,
      brand: null,
      image: null,
      description: null,
      upc: cleanedUPC,
      error: "UPCitemDB request failed",
    });
  }
});