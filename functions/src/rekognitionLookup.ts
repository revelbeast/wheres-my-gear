import {
  DetectLabelsCommand,
  DetectTextCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

const awsAccessKeyId = defineSecret("AWS_REKOGNITION_ACCESS_KEY_ID");
const awsSecretAccessKey = defineSecret("AWS_REKOGNITION_SECRET_ACCESS_KEY");
const awsRegion = defineSecret("AWS_REKOGNITION_REGION");

function normalizeConfidence(value: number | undefined): number {
  if (typeof value !== "number") return 0;
  return Math.max(0, Math.min(1, value / 100));
}

function cleanDetectedText(text: string | undefined): string | null {
  if (!text) return null;

  const cleaned = text
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

function scoreProductText(value: string): number {
  const normalized = value.toLowerCase();

  let score = 0;

  if (value.length >= 5) score += 2;
  if (value.length >= 10) score += 2;
  if (/\\b(wipes?|spray|bottle|case|bag|pack|kit|tool|charger|cable|light|gloves?|jacket|pants|shirt|shoes?|boots?|tent|stove|filter|knife|blanket)\\b/i.test(value)) score += 6;
  if (/\\b(tooth|dental|plaque|pet|dog|cat|gear|outdoor|camp|first aid|battery|water)\\b/i.test(value)) score += 3;
  if (/[A-Z]{3,}/.test(value)) score += 1;

  if (/\\b(\\d+\\s?(ct|count|oz|fl oz|lb|lbs|kg|g|ml|l)|for dogs?|for cats?|new|free|the|and|with)\\b/i.test(value)) score -= 3;
  if (normalized.length <= 3) score -= 5;

  return score;
}

function buildSuggestedName(labels: string[], detectedText: string[]): string | null {
  const usefulText = detectedText
    .map(cleanDetectedText)
    .filter((value): value is string => !!value)
    .filter((value) => value.length >= 3);

  const sortedText = [...usefulText].sort(
    (a, b) => scoreProductText(b) - scoreProductText(a)
  );

  const brandCandidate =
    usefulText.find((value) => /™|®/.test(value)) ??
    usefulText.find((value) => /^[A-Z][A-Z\\s&'-]{4,}$/.test(value)) ??
    null;

  const productCandidate =
    sortedText.find((value) => value !== brandCandidate) ??
    sortedText[0] ??
    null;

  if (brandCandidate && productCandidate) {
    return `${brandCandidate} ${productCandidate}`.trim();
  }

  if (productCandidate) {
    return productCandidate;
  }

  const usefulLabels = labels
    .filter((label) => label.length >= 3)
    .slice(0, 3);

  return usefulLabels.length > 0 ? usefulLabels.join(" ") : null;
}

export const analyzeGearImageWithRekognition = onRequest(
  {
    secrets: [
      awsAccessKeyId,
      awsSecretAccessKey,
      awsRegion,
    ],
    timeoutSeconds: 30,
    memory: "512MiB",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({
        found: false,
        source: "aws-rekognition",
        error: "POST method required",
      });
      return;
    }

    const imageBase64 = req.body?.imageBase64;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      res.status(400).json({
        found: false,
        source: "aws-rekognition",
        error: "imageBase64 is required",
      });
      return;
    }

    try {
      const imageBytes = Buffer.from(
        imageBase64.replace(/^data:image\/\w+;base64,/, ""),
        "base64"
      );

      const client = new RekognitionClient({
        region: awsRegion.value(),
        credentials: {
          accessKeyId: awsAccessKeyId.value(),
          secretAccessKey: awsSecretAccessKey.value(),
        },
      });

      const [labelResponse, textResponse] = await Promise.all([
        client.send(
          new DetectLabelsCommand({
            Image: {
              Bytes: imageBytes,
            },
            MaxLabels: 10,
            MinConfidence: 60,
          })
        ),
        client.send(
          new DetectTextCommand({
            Image: {
              Bytes: imageBytes,
            },
          })
        ),
      ]);

      const labels = (labelResponse.Labels ?? [])
        .map((label) => ({
          name: label.Name ?? null,
          confidence: normalizeConfidence(label.Confidence),
        }))
        .filter((label) => !!label.name);

      const detectedText = (textResponse.TextDetections ?? [])
        .filter((item) => item.Type === "LINE")
        .map((item) => ({
          text: cleanDetectedText(item.DetectedText),
          confidence: normalizeConfidence(item.Confidence),
        }))
        .filter((item) => !!item.text);

      const labelNames = labels
        .map((label) => label.name)
        .filter((name): name is string => !!name);

      const textLines = detectedText
        .map((item) => item.text)
        .filter((text): text is string => !!text);

      const bestLabelConfidence = labels[0]?.confidence ?? 0;
      const bestTextConfidence = detectedText[0]?.confidence ?? 0;
      const confidence = Math.min(
        0.95,
        Math.max(bestLabelConfidence, bestTextConfidence)
      );

      const suggestedName = buildSuggestedName(labelNames, textLines);

      res.json({
        found: labels.length > 0 || detectedText.length > 0,
        source: "aws-rekognition",
        confidence,
        title: suggestedName,
        brand: textLines[0] ?? null,
        image: null,
        description: labelNames.join(", ") || null,
        link: null,
        price: null,
        labels,
        detectedText,
      });
    } catch (err) {
      console.log("AWS REKOGNITION LOOKUP FAILED:", err);

      res.json({
        found: false,
        source: "aws-rekognition",
        confidence: 0,
        title: null,
        brand: null,
        image: null,
        description: null,
        link: null,
        price: null,
        labels: [],
        detectedText: [],
        error: "AWS Rekognition unavailable",
      });
    }
  }
);
