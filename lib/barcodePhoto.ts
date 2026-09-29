// No network probe: a usable catalog image is a nonempty HTTP(S) URL.
export function usableCatalogImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname ? value.trim() : null;
  } catch { return null; }
}

export function isOwnedBarcodePhoto(uri: string, cacheDirectory: string | null): boolean {
  const prefix = cacheDirectory ? `${cacheDirectory}Camera/` : "";
  return !!prefix && uri.startsWith(prefix) && /^[a-zA-Z0-9-]+\.jpe?g$/i.test(uri.slice(prefix.length));
}

export async function selectBarcodePhoto(
  catalog: unknown,
  capture: () => Promise<{ uri?: string } | undefined>,
): Promise<{ image: string; fallback: boolean }> {
  const image = usableCatalogImage(catalog);
  if (image) return { image, fallback: false };
  try {
    const photo = await capture();
    return { image: photo?.uri ?? "", fallback: !!photo?.uri };
  } catch {
    // Photography is optional; it must not turn successful decoding into an error.
    return { image: "", fallback: false };
  }
}
