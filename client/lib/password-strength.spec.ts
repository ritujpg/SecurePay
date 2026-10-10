import { describe, expect, it } from "vitest";
import { evaluatePasswordStrength } from "./password-strength";

describe("evaluatePasswordStrength", () => {
  it("rates a familiar but not common short password as weak", () => {
    const result = evaluatePasswordStrength("giraffe22");

    expect(result.level).toBe("weak");
    expect(result.recommendationKeys).toContain("passwordRecLonger");
  });

  it("rates a short common password as very weak and recommends concrete changes", () => {
    const result = evaluatePasswordStrength("password123");

    expect(result.level).toBe("veryWeak");
    expect(result.explanationKeys).toContain("passwordReasonCommon");
    expect(result.recommendationKeys).toContain("passwordRecLonger");
    expect(result.recommendationKeys).toContain("passwordRecCommon");
  });

  it("rates a mixed password with a predictable pattern below strong", () => {
    const result = evaluatePasswordStrength("River1234!River");

    expect(result.level).toBe("moderate");
    expect(result.explanationKeys).toContain("passwordReasonSequence");
    expect(result.recommendationKeys).toContain("passwordRecSequence");
  });

  it("rates a long mixed passphrase as very strong", () => {
    const result = evaluatePasswordStrength("Copper!Meadow7Window");

    expect(result.level).toBe("veryStrong");
    expect(result.score).toBeGreaterThanOrEqual(68);
    expect(result.recommendationKeys).toContain("passwordRecUnique");
  });

  it("rates a long mixed password as strong", () => {
    const result = evaluatePasswordStrength("Lantern6!MeadowFox");

    expect(result.level).toBe("strong");
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThan(68);
  });

  it("penalizes repeated characters and provides a matching recommendation", () => {
    const result = evaluatePasswordStrength("AaaaBBBB1111!!!!");

    expect(result.explanationKeys).toContain("passwordReasonRepeated");
    expect(result.recommendationKeys).toContain("passwordRecRepeated");
  });
});