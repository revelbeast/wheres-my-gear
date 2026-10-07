import { requireOptionalNativeModule } from 'expo-modules-core';

export type AppleGearAvailability = {
  available: boolean;
  vision: boolean;
  guidedGeneration: boolean;
  reason?: string;
};

type NativeRecognizer = {
  getAvailability(): Promise<unknown>;
  cancelRecognition?(requestId: string): Promise<unknown>;
  recognizeImage(imageUri: string, requestId: string): Promise<unknown>;
};
const unavailable = (reason: string): AppleGearAvailability => ({
  available: false, vision: false, guidedGeneration: false, reason,
});

export async function getAvailability(): Promise<AppleGearAvailability> {
  try {
    const native = requireOptionalNativeModule<NativeRecognizer>('AppleGearRecognizer');
    if (!native) return unavailable('native_module_unavailable');
    const value = await native.getAvailability();
    if (!value || typeof value !== 'object') return unavailable('invalid_native_response');
    const result = value as Record<string, unknown>;
    if (typeof result.available !== 'boolean' || typeof result.vision !== 'boolean' ||
        typeof result.guidedGeneration !== 'boolean' ||
        (result.reason !== undefined && typeof result.reason !== 'string') ||
        (result.available && (!result.vision || !result.guidedGeneration))) {
      return unavailable('invalid_native_response');
    }
    return {
      available: result.available,
      vision: result.vision,
      guidedGeneration: result.guidedGeneration,
      ...(typeof result.reason === 'string' ? { reason: result.reason } : {}),
    };
  } catch {
    return unavailable('native_availability_failed');
  }
}

export type AppleGearRecognition =
  | { ok: true; identified: boolean; itemName: string | null; brand: string | null;
      model: string | null; description: string | null }
  | { ok: false; reason: string; message?: string };

export async function recognizeImage(imageUri: string, requestId: string): Promise<AppleGearRecognition> {
  const failure = (reason: string): AppleGearRecognition => ({ ok: false, reason });
  if (typeof imageUri !== 'string' || !imageUri.startsWith('file://')) return failure('invalid_image_uri');
  if (typeof requestId !== 'string' || !requestId.trim()) return failure('invalid_request_id');
  try {
    const native = requireOptionalNativeModule<NativeRecognizer>('AppleGearRecognizer');
    if (!native || typeof native.recognizeImage !== 'function') return failure('native_module_unavailable');
    const value = await native.recognizeImage(imageUri, requestId);
    if (!value || typeof value !== 'object') return failure('invalid_native_response');
    const result = value as Record<string, unknown>;
    if (result.ok === false && typeof result.reason === 'string' && result.reason.trim() &&
        (result.message === undefined || typeof result.message === 'string')) {
      return { ok: false, reason: result.reason,
        ...(typeof result.message === 'string' ? { message: result.message } : {}) };
    }
    const keys = ['itemName', 'brand', 'model', 'description'] as const;
    if (result.ok !== true || typeof result.identified !== 'boolean' ||
        keys.some(key => result[key] !== null && typeof result[key] !== 'string')) {
      return failure('invalid_native_response');
    }
    const clean = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const text = value.trim();
      // Whole-field markers only: preserve legitimate names/descriptions containing these words.
      return !text || /^(nil|null|n\/a|unknown|none)$/i.test(text) ? null : text;
    };
    const itemName = clean(result.itemName);
    if (result.identified && !itemName) return failure('invalid_native_response');
    return { ok: true, identified: result.identified, itemName, brand: clean(result.brand),
      model: clean(result.model), description: clean(result.description) };
  } catch {
    return failure('native_recognition_failed');
  }
}

// Acknowledgement only. The original recognizeImage Promise remains the settlement barrier.
export async function cancelRecognition(requestId: string): Promise<void> {
  if (typeof requestId !== 'string' || !requestId.trim() || requestId.length > 128) return;
  try {
    const native = requireOptionalNativeModule<NativeRecognizer>('AppleGearRecognizer');
    if (typeof native?.cancelRecognition === 'function') await native.cancelRecognition(requestId);
  } catch {
    // Missing/older native modules and harmless cancellation failures must not crash callers.
    // This does not establish settlement: callers must still observe recognizeImage.
  }
}
