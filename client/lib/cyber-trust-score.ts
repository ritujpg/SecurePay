export type CyberTrustSignals = {
  securityEnabled?: boolean;
  biometricsEnabled?: boolean;
  transactionAlertsEnabled?: boolean;
  sessionAuthenticated?: boolean;
  loginMobileRecognized?: boolean;
  pinFailures?: number;
  lockedUntil?: number;
};

export type CyberTrustFactor = {
  key: string;
  status: "good" | "attention";
  weight: number;
  recommendationKey?: string;
};

export type CyberTrustScoreResult = {
  score: number;
  rating: "needsImprovement" | "fair" | "good" | "excellent";
  illustrative: boolean;
  explanationKey: string;
  factors: CyberTrustFactor[];
};

export function clampCyberTrustScore(score: number) {
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
}

export function cyberTrustRingDegrees(score: number) {
  return clampCyberTrustScore(score) * 3.6;
}

export function calculateCyberTrustScore(signals: CyberTrustSignals = {}, now = Date.now()): CyberTrustScoreResult {
  const factors: CyberTrustFactor[] = [];
  let score = 0;
  let missingSignals = true;
  const positiveRecommendationKeys: Record<string, string> = {
    cyberFactorSecurity: "cyberKeepSecurity",
    cyberFactorBiometrics: "cyberKeepBiometrics",
    cyberFactorAlerts: "cyberKeepAlerts",
    cyberFactorSession: "cyberKeepSession",
    cyberFactorMobile: "cyberKeepMobile",
    cyberFactorPinAttempts: "cyberKeepPin",
  };
  const addBooleanSignal = (value: boolean | undefined, key: string, weight: number, recommendationKey: string) => {
    if (value === undefined) {
      missingSignals = true;
      return;
    }
    const isGood = value;
    if (isGood) score += weight;
    factors.push({ key, status: isGood ? "good" : "attention", weight, recommendationKey: isGood ? positiveRecommendationKeys[key] : recommendationKey });
  };

  addBooleanSignal(signals.securityEnabled, "cyberFactorSecurity", 20, "cyberRecSecurity");
  addBooleanSignal(signals.biometricsEnabled, "cyberFactorBiometrics", 16, "cyberRecBiometrics");
  addBooleanSignal(signals.transactionAlertsEnabled, "cyberFactorAlerts", 12, "cyberRecAlerts");
  addBooleanSignal(signals.sessionAuthenticated, "cyberFactorSession", 16, "cyberRecSession");
  addBooleanSignal(signals.loginMobileRecognized, "cyberFactorMobile", 8, "cyberRecMobile");

  if (signals.pinFailures === undefined || signals.lockedUntil === undefined) {
    missingSignals = true;
  } else {
    const isGood = signals.pinFailures === 0 && signals.lockedUntil <= now;
    if (isGood) score += 16;
    factors.push({ key: "cyberFactorPinAttempts", status: isGood ? "good" : "attention", weight: 16, recommendationKey: isGood ? positiveRecommendationKeys.cyberFactorPinAttempts : "cyberRecPinAttempts" });
  }

  const boundedScore = clampCyberTrustScore(score);
  const rating = boundedScore < 40 ? "needsImprovement"
    : boundedScore < 60 ? "fair"
      : boundedScore < 80 ? "good"
        : "excellent";

  return {
    score: boundedScore,
    rating,
    illustrative: missingSignals,
    explanationKey: missingSignals ? "cyberTrustLimited" : "cyberTrustBased",
    factors: factors.sort((a, b) => Number(a.status === "good") - Number(b.status === "good") || b.weight - a.weight).slice(0, 3),
  };
}