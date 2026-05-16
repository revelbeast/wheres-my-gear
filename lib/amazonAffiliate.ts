const AMAZON_BASE_URL = "https://www.amazon.com/s";

const DEFAULT_TAG = "milesandmomen-20"; // your StoreID / tracking ID

export function buildAmazonAffiliateLink(query: string): string {
  const cleanQuery = encodeURIComponent(query.trim());

  return `${AMAZON_BASE_URL}?k=${cleanQuery}&tag=${DEFAULT_TAG}`;
}