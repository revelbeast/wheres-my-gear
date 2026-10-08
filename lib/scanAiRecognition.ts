import { getAvailability, recognizeImage } from './appleGearRecognizer';

export type ScanAiResult = {
  found: true;
  suggestedName: string;
  source: string;
  brand: string;
  image: string;
  description: string;
  matchConfidence: string;
  matchStatus: 'possible';
};

// The screen owns attempt identity, cancellation and photo lifetime. Null is terminal
// cancellation/staleness, never a request to retry or fall back again.
export async function recognizeScanPhoto(options: {
  platform: string;
  photo: { uri: string; base64?: string | null };
  requestId: string;
  isActive: () => boolean;
  appleStarted: () => void;
  appleSettled: () => void;
  awsStarted: (controller: AbortController) => void;
}): Promise<ScanAiResult | null> {
  const { photo, requestId, isActive } = options;
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  if (!isActive()) return null;
  if (options.platform === 'ios') {
    const availability = await getAvailability();
    if (!isActive()) return null;
    if (availability?.available === true && availability.vision === true && availability.guidedGeneration === true) {
      options.appleStarted();
      let result;
      try {
        result = await recognizeImage(photo.uri, requestId);
      } finally {
        // Only the original native recognition Promise establishes settlement.
        options.appleSettled();
      }
      if (!isActive()) return null;
      if (!result.ok && result.reason === 'cancelled') return null;
      const name = result.ok ? text(result.itemName) : '';
      const placeholders = /^(nil|null|n\/a|unknown|none|unidentified item|product not named)$/i;
      if (result.ok === true && result.identified === true && name && !placeholders.test(name)) {
        return { found: true, suggestedName: name, source: 'Apple Foundation Models',
          brand: text(result.brand), image: photo.uri, description: text(result.description),
          matchConfidence: '', matchStatus: 'possible' };
      }
    }
  }
  if (!isActive()) return null;
  if (!photo.base64) throw new Error('Missing image for AWS analysis');
  const controller = new AbortController();
  options.awsStarted(controller);
  if (!isActive()) { controller.abort(); return null; }
  // Apple has settled (or was skipped). This timeout belongs only to AWS.
  const timeout = setTimeout(() => controller.abort(), 35000);
  try {
    const response = await fetch(
      'https://us-central1-wheres-my-gear-ab7a7.cloudfunctions.net/analyzeGearImageWithRekognition',
      { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: photo.base64 }) }
    );
    if (!isActive()) return null;
    if (controller.signal.aborted || !response.ok) throw new Error('AI request failed');
    const result = await response.json();
    if (!isActive()) return null;
    if (controller.signal.aborted || result?.error || !result?.found ||
        typeof result.title !== 'string' || !result.title.trim()) throw new Error('No usable AI result');
    return { found: true, suggestedName: result.title, source: 'AWS Rekognition',
      brand: result.brand ?? '', image: photo.uri, description: result.description ?? '',
      matchConfidence: result.confidence != null ? String(result.confidence) : '', matchStatus: 'possible' };
  } finally {
    clearTimeout(timeout);
  }
}
