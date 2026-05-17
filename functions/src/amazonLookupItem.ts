import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { SignatureV4 } from "@aws-sdk/signature-v4";

// 🔐 Secrets
const LWA_CLIENT_ID = defineSecret("AMAZON_LWA_CLIENT_ID");
const LWA_CLIENT_SECRET = defineSecret("AMAZON_LWA_CLIENT_SECRET");
const REFRESH_TOKEN = defineSecret("AMAZON_REFRESH_TOKEN");
const AWS_ACCESS_KEY_ID = defineSecret("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = defineSecret("AWS_SECRET_ACCESS_KEY");

// ------------------------------
// 1. Get LWA Access Token
// ------------------------------
async function getLwaAccessToken() {
    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", REFRESH_TOKEN.value());
    params.append("client_id", LWA_CLIENT_ID.value());
    params.append("client_secret", LWA_CLIENT_SECRET.value());

    const res = await fetch("https://api.amazon.com/auth/o2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error("LWA token error: " + err);
    }

    return res.json();
}

// ------------------------------
// 2. SP-API request signer
// ------------------------------
async function signRequest({
    method,
    url,
    region,
    accessToken,
    body,
}: {
    method: string;
    url: string;
    region: string;
    accessToken: string;
    body?: any;
}) {
    const endpoint = new URL(url);

    const request = new HttpRequest({
        method,
        hostname: endpoint.hostname,
        path: endpoint.pathname + endpoint.search,
        headers: {
            "content-type": "application/json",
            host: endpoint.hostname,
            "x-amz-access-token": accessToken,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const signer = new SignatureV4({
        credentials: {
            accessKeyId: AWS_ACCESS_KEY_ID.value(),
            secretAccessKey: AWS_SECRET_ACCESS_KEY.value(),
        },
        region,
        service: "execute-api",
        sha256: Sha256,
    });

    return signer.sign(request);
}

// ------------------------------
// 3. Main Function
// ------------------------------
export const amazonLookupItem = onRequest(
    {
        cors: true,
        secrets: [
            LWA_CLIENT_ID,
            LWA_CLIENT_SECRET,
            REFRESH_TOKEN,
            AWS_ACCESS_KEY_ID,
            AWS_SECRET_ACCESS_KEY,
        ],
    },
    async (req, res) => {
        try {
            const { barcode } = req.body;
            if (!AWS_ACCESS_KEY_ID.value() || !AWS_SECRET_ACCESS_KEY.value()) {
                throw new Error("Missing AWS credentials in runtime environment");
            }

            if (!barcode) {
                res.status(400).json({ error: "Missing barcode" });
                return;
            }

            // 1. Get LWA token
            const lwa = await getLwaAccessToken();
            const accessToken = lwa.access_token;
            console.log("LWA token response keys:", Object.keys(lwa));
            console.log(
                "LWA access token present:",
                typeof accessToken === "string",
                "length:",
                typeof accessToken === "string" ? accessToken.length : 0
            );

            // 2. Build SP-API URL
            const marketplaceId = "ATVPDKIKX0DER";

            const url =
                `https://sellingpartnerapi-na.amazon.com/catalog/2022-04-01/items` +
                `?identifiers=${encodeURIComponent(barcode)}` +
                `&identifiersType=UPC` +
                `&marketplaceIds=${marketplaceId}` +
                `&includedData=summaries,images`;

            // 3. Sign request
            const signed = await signRequest({
                method: "GET",
                url,
                region: "us-east-1",
                accessToken,
            });

            // 4. Call SP-API
            const finalHeaders = {
                ...(signed.headers as Record<string, string>),
                "x-amz-access-token": accessToken,
            };

            const response = await fetch(url, {
                method: signed.method,
                headers: finalHeaders,
            });

            const data = await response.json();

            console.log("Amazon SP-API response status:", response.status);
            console.log(
                "Amazon SP-API response body:",
                JSON.stringify(data).slice(0, 2000)
            );

            if (req.body?.debug === true) {
                res.status(response.status).json(data);
                return;
            }

            // 5. Normalize response
            const item = data?.items?.[0];

            const result = {
                title: item?.attributes?.title?.[0]?.value || "Unknown Product",
                brand: item?.attributes?.brand?.[0]?.value || "Unknown Brand",
                asin: item?.asin || null,
                image: item?.images?.[0]?.images?.[0]?.link || null,
                category: item?.classifications?.[0]?.displayName || null,
                confidence: item ? 0.9 : 0.0,
                rawFound: !!item,
            };

            res.json(result);
        } catch (err: any) {
            console.error(err);
            res.status(500).json({
                error: err.message || "Unknown error",
            });
        }
    }
);