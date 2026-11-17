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
        result: "Fraudulent",
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(predictRandomForest({ amount: 25, step: 3 })).resolves.toMatchObject({
      prediction: 1,
      result: "Fraudulent",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/ml/predict", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ amount: 25, step: 3 }),
    }));
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

    await expect(predictRandomForest({ step: 1 })).rejects.toMatchObject({
      name: "MlApiError",
      status: 400,
      message: "Missing features",
    });
  });

  it("rejects empty SMS and phishing message input before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(() => predictBankingSms("  ")).toThrow(MlApiError);
    expect(() => predictPhishing("")).toThrow(MlApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
