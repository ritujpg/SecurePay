import { describe, expect, it } from "vitest";
import { checkForPhishing } from "./phishing-check";

describe("checkForPhishing", () => {
  it("flags a shortened URL as suspicious and recommends verifying its destination", () => {
    const result = checkForPhishing("url", "https://bit.ly/abc123");

    expect(result.level).toBe("suspicious");
    expect(result.indicators.map(indicator => indicator.key)).toContain("urlShortener");
    expect(result.indicators[0].explanationKey).toBe("urlShortenerWhy");
    expect(result.defaultRecommendationKey).toBe("urlShortenerNext");
  });

  it("detects a known bank name in a non-official, unusually nested domain", () => {
    const result = checkForPhishing("url", "https://portal.secure-login.hdfc-bank-verification.example.com/signin");

    expect(result.level).toBe("suspicious");
    expect(result.indicators.map(indicator => indicator.key)).toEqual(expect.arrayContaining(["urlBrandLookalike", "urlManySubdomains"]));
  });

  it("flags an IP-address URL combined with an embedded address as high risk", () => {
    const result = checkForPhishing("url", "https://person@192.168.0.1/login");

    expect(result.level).toBe("highRisk");
    expect(result.indicators.map(indicator => indicator.key)).toEqual(expect.arrayContaining(["urlIpAddress", "urlHiddenAddress"]));
  });

  it("warns about HTTP without treating it as proof of phishing", () => {
    const result = checkForPhishing("url", "http://example.com/help");

    expect(result.level).toBe("likelySafe");
    expect(result.indicators.map(indicator => indicator.key)).toContain("urlNoHttps");
  });

  it("detects multiple urgent message indicators", () => {
    const result = checkForPhishing("message", "Your account will be blocked today. Click this link to restore access.");

    expect(result.level).toBe("highRisk");
    expect(result.indicators.map(indicator => indicator.key)).toEqual(expect.arrayContaining(["messageUrgentThreat", "messageLinkPressure"]));
    expect(result.defaultRecommendationKey).toBe("messageUrgentThreatNext");
  });

  it("treats a request for a UPI PIN as high risk", () => {
    const result = checkForPhishing("message", "Share your UPI PIN to receive your refund today.");

    expect(result.level).toBe("highRisk");
    expect(result.indicators.map(indicator => indicator.key)).toContain("messageSecretRequest");
    expect(result.indicators[0].explanationKey).toBe("messageSecretRequestWhy");
    expect(result.indicators[0].recommendationKey).toBe("messageSecretRequestNext");
  });

  it("does not overreact to benign or ambiguous content", () => {
    const benign = checkForPhishing("message", "Your appointment is tomorrow at 10 AM.");
    const ambiguous = checkForPhishing("message", "This note mentions a reward.");

    expect(benign.level).toBe("likelySafe");
    expect(benign.indicators).toHaveLength(0);
    expect(ambiguous.level).toBe("likelySafe");
    expect(ambiguous.indicators.map(indicator => indicator.key)).toContain("messageUnexpectedOffer");
  });
});