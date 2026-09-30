export type BarcodeIdentity = { barcode: string; barcodeType?: string };

function validGtin(value: string) {
  if (!/^\d+$/.test(value)) return false;
  let sum = 0;
  for (let i = value.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) {
    sum += (value.charCodeAt(i) - 48) * weight;
  }
  return (10 - sum % 10) % 10 === value.charCodeAt(value.length - 1) - 48;
}

function isRetailGtin(value: string, type: string) {
  // Also accept our stored GTIN-14 representation, preserving observed format.
  const lengthMatches = type === "upc_a"
    ? value.length === 12 || (value.length === 14 && value.startsWith("00"))
    : type === "ean13"
      ? value.length === 12 || value.length === 13 || (value.length === 14 && value.startsWith("0"))
      : type === "ean8"
        ? value.length === 8 || (value.length === 14 && value.startsWith("000000"))
        : false;
  return lengthMatches && validGtin(value);
}

export function barcodeIdentity(value: unknown, format: unknown): BarcodeIdentity | null {
  if (typeof value !== "string" || !value.trim() || /^wheresmygear:\/\//i.test(value.trim())) return null;
  const barcodeType = typeof format === "string" && format.trim() ? format.trim().toLowerCase() : undefined;
  // Opaque data stays exact; never strip punctuation, zeros, or payload whitespace.
  return {
    barcode: isRetailGtin(value, barcodeType ?? "") ? value.padStart(14, "0") : value,
    ...(barcodeType ? { barcodeType } : {}),
  };
}

export function barcodeIdentityKey(identity: BarcodeIdentity): string {
  const normalized = barcodeIdentity(identity.barcode, identity.barcodeType);
  if (!normalized) return "";
  return isRetailGtin(normalized.barcode, normalized.barcodeType ?? "")
    ? `gtin:${normalized.barcode}`
    : JSON.stringify([normalized.barcodeType ?? "unknown", normalized.barcode]);
}
