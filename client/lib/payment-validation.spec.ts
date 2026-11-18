import { describe, expect, it } from "vitest";
import { validateDemoPaymentAmount } from "./payment-validation";

describe("validateDemoPaymentAmount", () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid amount %s", amount => {
    expect(validateDemoPaymentAmount(amount, 500_000)).toBe("invalid");
  });

  it("enforces the transaction API maximum", () => {
    expect(validateDemoPaymentAmount(1_000_001, 2_000_000)).toBe("too-large");
    expect(validateDemoPaymentAmount(1_000_000, 2_000_000)).toBeNull();
  });

  it("rejects amounts above the available demo balance", () => {
    expect(validateDemoPaymentAmount(501, 500)).toBe("outside-balance");
    expect(validateDemoPaymentAmount(500, 500)).toBeNull();
  });
});
