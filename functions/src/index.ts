import { setGlobalOptions } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";

setGlobalOptions({ maxInstances: 10 });

export const lookupAmazonCatalogItem = onCall((request) => {
  const barcode = request.data?.barcode;

  if (typeof barcode !== "string" || barcode.trim().length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "A barcode string is required."
    );
  }

  return {
    found: false,
    barcode: barcode.trim(),
    source: "amazon",
    message: "Amazon catalog lookup function foundation is working.",
  };
});
export { amazonLookupItem } from "./amazonLookupItem";
