type AmazonProduct = {
  title: string;
  asin: string;
  image?: string;
  url: string;
};

type AmazonSearchResponse = any;

/**
 * NOTE:
 * PA-API requires signed requests.
 * This is a simplified structure placeholder.
 */
export async function fetchAmazonProduct(
  query: string
): Promise<AmazonProduct | null> {
  try {
    const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY;
    const SECRET_KEY = process.env.AMAZON_SECRET_KEY;
    const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG;

    if (!ACCESS_KEY || !SECRET_KEY || !PARTNER_TAG) {
      console.log("AMAZON API NOT CONFIGURED");
      return null;
    }

    /**
     * IMPORTANT:
     * In production you should NOT call PA-API directly from mobile.
     * You should proxy through your backend.
     */

    const res = await fetch(
      "https://webservices.amazon.com/paapi5/searchitems",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Keywords: query,
          PartnerTag: PARTNER_TAG,
          PartnerType: "Associates",
          Marketplace: "www.amazon.com",
        }),
      }
    );

    const data: AmazonSearchResponse = await res.json();

    const item = data?.SearchResult?.Items?.[0];

    if (!item) return null;

    return {
      title: item?.ItemInfo?.Title?.DisplayValue ?? "Amazon Item",
      asin: item?.ASIN,
      image: item?.Images?.Primary?.Large?.URL,
      url: item?.DetailPageURL,
    };
  } catch (err) {
    console.log("AMAZON LOOKUP ERROR:", err);
    return null;
  }
}