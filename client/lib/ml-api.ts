import { z } from "zod";

const numericFeaturesSchema = z.record(z.string(), z.number().finite());
const messageInputSchema = z.object({ message: z.string().trim().min(1) });

const randomForestResponseSchema = z.object({
  model: z.literal("Random Forest"),
  prediction: z.number().int(),
  result: z.enum(["Fraudulent", "Legitimate"]),
});

const isolationForestResponseSchema = z.object({
  model: z.literal("Isolation Forest"),
  raw_prediction: z.number().int(),
  prediction: z.number().int(),
  result: z.enum(["Fraudulent", "Legitimate"]),
});

const textPredictionResponseSchema = z.object({
  prediction: z.string(),
  risk_level: z.enum(["Phishing", "Suspicious", "Safe"]),
  phishing_risk_score: z.number(),
  probabilities: z.record(z.string(), z.number()),
});

const smsResponseSchema = textPredictionResponseSchema.extend({
  model: z.literal("Banking SMS Detector"),
});

const phishingResponseSchema = textPredictionResponseSchema.extend({
  model: z.literal("Phishing Detector"),
});

const xgboostResponseSchema = z.object({
  model: z.literal("XGBoost Transaction Risk"),
  prediction: z.number().int(),
  result: z.enum(["Fraudulent", "Legitimate"]),
  fraud_probability: z.number(),
  legitimate_probability: z.number(),
});

export type NumericFeatures = z.infer<typeof numericFeaturesSchema>;
export type RandomForestPrediction = z.infer<typeof randomForestResponseSchema>;
export type IsolationForestPrediction = z.infer<typeof isolationForestResponseSchema>;
export type SmsPrediction = z.infer<typeof smsResponseSchema>;
export type PhishingPrediction = z.infer<typeof phishingResponseSchema>;
export type XgboostPrediction = z.infer<typeof xgboostResponseSchema>;

export class MlApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MlApiError";
  }
}

async function postPrediction<T>(
  endpoint: string,
  payload: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/ml/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    throw new MlApiError(`Unable to contact the ML service: ${message}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new MlApiError("The ML service returned an invalid response", response.status);
  }

  if (!response.ok) {
    const apiMessage =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : `The ML service returned HTTP ${response.status}`;
    throw new MlApiError(apiMessage, response.status);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new MlApiError("The ML service response did not match the expected format", response.status);
  }

  return parsed.data;
}

function validateFeatures(features: NumericFeatures): NumericFeatures {
  const parsed = numericFeaturesSchema.safeParse(features);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    throw new MlApiError("Transaction features must be a non-empty object of finite numbers");
  }
  return parsed.data;
}

function validateMessage(message: string): { message: string } {
  const parsed = messageInputSchema.safeParse({ message });
  if (!parsed.success) {
    throw new MlApiError("Please enter a message to check");
  }
  return parsed.data;
}

export function predictRandomForest(features: NumericFeatures) {
  return postPrediction("predict", validateFeatures(features), randomForestResponseSchema);
}

export function predictIsolationForest(features: NumericFeatures) {
  return postPrediction("predict-isolation", validateFeatures(features), isolationForestResponseSchema);
}

export function predictBankingSms(message: string) {
  return postPrediction("predict-sms", validateMessage(message), smsResponseSchema);
}

export function predictPhishing(message: string) {
  return postPrediction("predict-phishing", validateMessage(message), phishingResponseSchema);
}

export function predictXgboost(features: NumericFeatures) {
  return postPrediction("predict-xgboost", validateFeatures(features), xgboostResponseSchema);
}
