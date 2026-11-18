import type { RandomForestPrediction } from "./ml-api";

export type PaymentMlStatus = "checking" | "ready" | "unavailable" | "insufficient-history";

export function canRunPaymentMl(
  databaseStatus: "loading" | "ready" | "seed-missing" | "error",
  historyComplete: boolean,
) {
  return databaseStatus === "ready" && historyComplete;
}

export function getPaymentMlStatusMessage(
  status: PaymentMlStatus | undefined,
  assessment?: RandomForestPrediction,
) {
  if (status === "checking") return "Running the trained fraud model…";
  if (status === "unavailable") return "Unavailable. No ML result was produced.";
  if (status === "insufficient-history") {
    return "Unavailable because complete Supabase transaction history could not be verified or contains invalid records.";
  }
  if (assessment) {
    return `Experimental model signal: ${assessment.assessment} relative to a validation-selected threshold. The score is uncalibrated and is not a fraud probability.`;
  }
  return "No model prediction is available.";
}
