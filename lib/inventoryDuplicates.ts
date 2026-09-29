import type { Item } from "./gearService";

// Preserve the compartment Add Item matching rules. Matches are advisory only.
export function normalizeDuplicateItemName(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}

export function findPossibleDuplicateItems(items: Item[], name: string): Item[] {
  const normalized = normalizeDuplicateItemName(name);
  if (!normalized) return [];
  return items.filter((item) => {
    const existing = normalizeDuplicateItemName(item.name || "");
    return !!existing && (existing === normalized || existing.includes(normalized) || normalized.includes(existing));
  });
}

export function formatDuplicateItemLocation(item: Item) {
  const parts = [item.vehicleName?.trim(), item.compartmentName?.trim()].filter(Boolean);
  return parts.length ? `Location: ${parts.join(" > ")}` : "Location: Not available";
}
