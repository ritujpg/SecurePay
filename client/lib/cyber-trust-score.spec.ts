import { describe, expect, it } from "vitest";
import { calculateCyberTrustScore, clampCyberTrustScore, cyberTrustRingDegrees, type CyberTrustSignals } from "./cyber-trust-score";

const completeSignals: CyberTrustSignals = {
  securityEnabled: true,
  biometricsEnabled: true,
  transactionAlertsEnabled: true,
  sessionAuthenticated: true,
  loginMobileRecognized: true,
  pinFailures: 0,
  lockedUntil: 0,
};

describe("calculateCyberTrustScore", () => {
  it("maps clamped scores to a proportional, closed ring angle", () => {
    expect(cyberTrustRingDegrees(0)).toBe(0);
    expect(cyberTrustRingDegrees(75)).toBe(270);
    expect(cyberTrustRingDegrees(100)).toBe(360);
    expect(cyberTrustRingDegrees(140)).toBe(360);
    expect(cyberTrustRingDegrees(-10)).toBe(0);
    expect(clampCyberTrustScore(Number.NaN)).toBe(0);
  });

  it("calculates the complete posture deterministically and reaches the upper boundary", () => {
    expect(calculateCyberTrustScore(completeSignals, 1000)).toEqual(calculateCyberTrustScore(completeSignals, 1000));
    expect(calculateCyberTrustScore(completeSignals, 1000)).toMatchObject({ score: 88, rating: "excellent", illustrative: true });
  });

  it("keeps score boundaries within zero and one hundred", () => {
    const noControls: CyberTrustSignals = {
      securityEnabled: false,
      biometricsEnabled: false,
      transactionAlertsEnabled: false,
      sessionAuthenticated: false,
      loginMobileRecognized: false,
      pinFailures: 3,
      lockedUntil: 2000,
    };
    expect(calculateCyberTrustScore(noControls, 1000)).toMatchObject({ score: 0, rating: "needsImprovement" });
    expect(calculateCyberTrustScore(completeSignals, 1000).score).toBeLessThanOrEqual(88);
  });

  it("uses the documented rating boundaries", () => {
    const fairSignals: CyberTrustSignals = { ...completeSignals, securityEnabled: true, biometricsEnabled: false, transactionAlertsEnabled: true, sessionAuthenticated: false, loginMobileRecognized: true, pinFailures: 1 };
    const goodSignals: CyberTrustSignals = { ...completeSignals, securityEnabled: false, biometricsEnabled: true, transactionAlertsEnabled: true, sessionAuthenticated: true, loginMobileRecognized: false };
    const excellentSignals: CyberTrustSignals = { ...completeSignals, loginMobileRecognized: false };

    expect(calculateCyberTrustScore(fairSignals, 1000)).toMatchObject({ score: 40, rating: "fair" });
    expect(calculateCyberTrustScore(goodSignals, 1000)).toMatchObject({ score: 60, rating: "good" });
    expect(calculateCyberTrustScore(excellentSignals, 1000)).toMatchObject({ score: 80, rating: "excellent", illustrative: true });
  });

  it("marks missing signals as illustrative and does not award their points", () => {
    expect(calculateCyberTrustScore({}, 1000)).toMatchObject({ score: 0, illustrative: true, explanationKey: "cyberTrustLimited", factors: [] });
    expect(calculateCyberTrustScore({ securityEnabled: true }, 1000)).toMatchObject({ score: 20, illustrative: true });
  });

  it("recalculates for changed security settings and active PIN lockouts", () => {
    const weaker = calculateCyberTrustScore({ ...completeSignals, biometricsEnabled: false, lockedUntil: 5000 }, 1000);
    expect(weaker.score).toBe(56);
    expect(weaker.rating).toBe("fair");
    expect(weaker.factors.filter(factor => factor.status === "attention")).toHaveLength(2);
  });
});