import { afterEach, describe, expect, it, vi } from "vitest";
import { MlApiError, predictBankingSms, predictPhishing, predictRandomForest } from "./ml-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ML API client", () => {
  it("posts a numeric feature object to the existing Random Forest proxy route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        model: "Random Forest",
        prediction: 1,
        assessment: "elevated",
        model_score: 0.9449,
        score_type: "uncalibrated_model_score",
        decision_threshold: 0.7275,
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(predictRandomForest({
      log_amount: 3.2,
      log_sender_history_count: 0,
      log_beneficiary_history_count: 0,
      type_CASH_IN: 0,
      type_CASH_OUT: 0,
      type_DEBIT: 0,
      type_PAYMENT: 0,
      type_TRANSFER: 1,
    })).resolves.toMatchObject({
      prediction: 1,
      assessment: "elevated",
      model_score: 0.9449,
      score_type: "uncalibrated_model_score",
      decision_threshold: 0.7275,
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/ml/predict", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        log_amount: 3.2,
        log_sender_history_count: 0,
        log_beneficiary_history_count: 0,
        type_CASH_IN: 0,
        type_CASH_OUT: 0,
        type_DEBIT: 0,
        type_PAYMENT: 0,
        type_TRANSFER: 1,
      }),
    }));
  });

  it("rejects a response that labels an uncalibrated score as a fraud probability", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        model: "Random Forest",
        prediction: 1,
        result: "Fraudulent",
        fraud_probability: 99,
        decision_threshold: 70,
      }), { status: 200 }),
    ));

    await expect(predictRandomForest({
      log_amount: 1,
      log_sender_history_count: 0,
      log_beneficiary_history_count: 0,
      type_CASH_IN: 0,
      type_CASH_OUT: 0,
      type_DEBIT: 0,
      type_PAYMENT: 0,
      type_TRANSFER: 1,
    })).rejects.toMatchObject({
      name: "MlApiError",
      message: "The ML service response did not match the expected format",
    });
  });

  it("sends text using the Flask message request shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        model: "Phishing Detector",
        prediction: "Phishing",
        risk_level: "Phishing",
        phishing_risk_score: 82,
        probabilities: { Phishing: 82, Legitimate: 18 },
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await predictPhishing("Urgent: verify your account");

    expect(fetchMock).toHaveBeenCalledWith("/api/ml/predict-phishing", expect.objectContaining({
      body: JSON.stringify({ message: "Urgent: verify your account" }),
    }));
  });

  it("preserves safe Phishing Detector results and probabilities", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        model: "Phishing Detector",
        prediction: "Safe",
        risk_level: "Safe",
        phishing_risk_score: 12.83,
        probabilities: { Phishing: 12.83, Safe: 87.17 },
      }), { status: 200 }),
    ));

    await expect(predictPhishing("Your appointment is tomorrow at 10 AM.")).resolves.toMatchObject({
      prediction: "Safe",
      risk_level: "Safe",
      phishing_risk_score: 12.83,
    });
  });

  it("uses the Banking SMS Detector endpoint for message input", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        model: "Banking SMS Detector",
        prediction: "Phishing",
        risk_level: "Suspicious",
        phishing_risk_score: 42.5,
        probabilities: { Phishing: 42.5, Legitimate: 57.5 },
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await predictBankingSms("Your account will be blocked");

    expect(fetchMock).toHaveBeenCalledWith("/api/ml/predict-sms", expect.objectContaining({
      body: JSON.stringify({ message: "Your account will be blocked" }),
    }));
  });

  it("preserves safe Banking SMS Detector results and probabilities", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        model: "Banking SMS Detector",
        prediction: "Safe",
        risk_level: "Safe",
        phishing_risk_score: 29.08,
        probabilities: { Phishing: 29.08, Safe: 70.92 },
      }), { status: 200 }),
    ));

    await expect(predictBankingSms("Your appointment is tomorrow at 10 AM.")).resolves.toMatchObject({
      prediction: "Safe",
      risk_level: "Safe",
      phishing_risk_score: 29.08,
    });
  });

  it("surfaces API validation errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Missing features", features: ["amount"] }), { status: 400 }),
    ));

    await expect(predictRandomForest({
      log_amount: 1,
      log_sender_history_count: 0,
      log_beneficiary_history_count: 0,
      type_CASH_IN: 0,
      type_CASH_OUT: 0,
      type_DEBIT: 0,
      type_PAYMENT: 0,
      type_TRANSFER: 1,
    })).rejects.toMatchObject({
      name: "MlApiError",
      status: 400,
      message: "Missing features",
    });
  });

  it("rejects non-finite or extra payment feature inputs before making a request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const validFeatures = {
      log_amount: 1,
      log_sender_history_count: 0,
      log_beneficiary_history_count: 0,
      type_CASH_IN: 0,
      type_CASH_OUT: 0,
      type_DEBIT: 0,
      type_PAYMENT: 0,
      type_TRANSFER: 1,
    };

    expect(() => predictRandomForest({
      ...validFeatures,
      log_amount: Number.POSITIVE_INFINITY,
    })).toThrow(MlApiError);
    expect(() => predictRandomForest({
      ...validFeatures,
      unknown: 1,
    } as typeof validFeatures)).toThrow(MlApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects empty SMS and phishing message input before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(() => predictBankingSms("  ")).toThrow(MlApiError);
    expect(() => predictPhishing("")).toThrow(MlApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
