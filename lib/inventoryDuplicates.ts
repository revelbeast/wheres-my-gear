import { barcodeIdentity, barcodeIdentityKey, type BarcodeIdentity } from "./barcodeIdentity";
import type { Item } from "./gearService";

// Exact trimmed, case-insensitive names. Matches are advisory only.
export function normalizeDuplicateItemName(value: string) {
  return value.trim().toLowerCase();
}

export function findPossibleDuplicateItems(items: Item[], name: string): Item[] {
  const normalized = normalizeDuplicateItemName(name);
  if (!normalized) return [];
  return items.filter((item) => {
    const existing = normalizeDuplicateItemName(item.name || "");
    return existing === normalized;
  });
}

export function formatDuplicateItemLocation(item: Item) {
  const parts = [item.vehicleName?.trim(), item.compartmentName?.trim()].filter(Boolean);
  return parts.length ? `Location: ${parts.join(" > ")}` : "Location: Not available";
}

// Commercial review only; AI and manual name matching retain their existing rules.
export function findBarcodeDuplicateItems(items: Item[], identity: BarcodeIdentity, name: string) {
  const key = barcodeIdentityKey(identity);
  const exact = items.filter((item) => {
    const existing = barcodeIdentity(item.barcode, item.barcodeType);
    return !!key && !!existing && barcodeIdentityKey(existing) === key;
  });
  return exact.length
    ? { kind: "barcode" as const, items: exact }
    : { kind: "name" as const, items: findPossibleDuplicateItems(items, name) };
}
