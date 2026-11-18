import { describe, expect, it } from "vitest";
import { canRunPaymentMl, getPaymentMlStatusMessage } from "./payment-ml-status";

describe("getPaymentMlStatusMessage", () => {
  it("only permits inference after a complete successful history refresh", () => {
    expect(canRunPaymentMl("ready", true)).toBe(true);
    expect(canRunPaymentMl("loading", true)).toBe(false);
    expect(canRunPaymentMl("error", true)).toBe(false);
    expect(canRunPaymentMl("ready", false)).toBe(false);
  });

  it("explains loading and unavailable states without implying a result", () => {
    expect(getPaymentMlStatusMessage("checking")).toContain("Running");
    expect(getPaymentMlStatusMessage("unavailable")).toContain("No ML result");
    expect(getPaymentMlStatusMessage("insufficient-history")).toContain("transaction history");
  });

  it("labels model assessments as experimental and uncalibrated", () => {
    expect(getPaymentMlStatusMessage("ready", {
      model: "Random Forest",
      prediction: 1,
      assessment: "elevated",
      model_score: 0.8,
      score_type: "uncalibrated_model_score",
      decision_threshold: 0.5,
    })).toContain("uncalibrated and is not a fraud probability");
  });

  it("does not claim a prediction when a ready state has no assessment", () => {
    expect(getPaymentMlStatusMessage("ready")).toBe("No model prediction is available.");
  });
});
