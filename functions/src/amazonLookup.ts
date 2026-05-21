import axios from "axios";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

const clientId = defineSecret("AMAZON_CREATORS_CLIENT_ID");
const clientSecret = defineSecret("AMAZON_CREATORS_CLIENT_SECRET");
const partnerTag = defineSecret("AMAZON_ASSOCIATES_PARTNER_TAG");

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0;

async function getCreatorsAccessToken() {
  const now = Date.now();

  if (cachedAccessToken && now < cachedAccessTokenExpiresAt) {
    return cachedAccessToken;
  }

  const response = await axios.post(
    "https://api.amazon.com/auth/o2/token",
    {
      grant_type: "client_credentials",
      client_id: clientId.value(),
      client_secret: clientSecret.value(),
      scope: "creatorsapi::default",
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  cachedAccessToken = response.data.access_token;
  cachedAccessTokenExpiresAt = now + Math.max((response.data.expires_in - 60) * 1000, 0);

  return cachedAccessToken;
}

export const lookupAmazonItem = onRequest(
  { secrets: [clientId, clientSecret, partnerTag] },
  async (req, res) => {
    const asin = req.body?.asin?.trim();

    if (!asin) {
      res.status(400).json({ error: "ASIN required" });
      return;
    }

    try {
      const accessToken = await getCreatorsAccessToken();

      const response = await axios.post(
        "https://creatorsapi.amazon/catalog/v1/getItems",
        {
          itemIds: [asin],
          itemIdType: "ASIN",
          marketplace: "www.amazon.com",
          partnerTag: partnerTag.value(),
          resources: [
            "images.primary.small",
            "images.primary.medium",
            "images.primary.large",
            "itemInfo.title",
            "itemInfo.features",
            "offersV2.listings.price"
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "x-marketplace": "www.amazon.com",
          },
        }
      );

      const item = response.data?.itemsResult?.items?.[0];

      res.json({
        found: !!item,
        source: "amazonCreatorsApi",
        asin,
        title: item?.itemInfo?.title?.displayValue ?? null,
        image:
          item?.images?.primary?.large?.url ??
          item?.images?.primary?.medium?.url ??
          item?.images?.primary?.small?.url ??
          null,
        price:
          item?.offersV2?.listings?.[0]?.price?.displayAmount ??
          item?.offersV2?.summaries?.[0]?.lowestPrice?.displayAmount ??
          null,
        detailPageURL: item?.detailPageURL ?? null,
        raw: item ?? null,
      });
    } catch (err: any) {
      res.status(500).json({
        found: false,
        source: "amazonCreatorsApi",
        asin,
        error: "Amazon Creators API lookup failed",
        details: err?.response?.data || err.message,
      });
    }
  }
);
