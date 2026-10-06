import { requireOptionalNativeModule } from 'expo-modules-core';

export type AppleGearAvailability = {
  available: boolean;
  vision: boolean;
  guidedGeneration: boolean;
  reason?: string;
};

type NativeRecognizer = { getAvailability(): Promise<unknown> };
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
