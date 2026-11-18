export type PaymentAmountError = "invalid" | "too-large" | "outside-balance";

export function validateDemoPaymentAmount(
  amount: number,
  balance: number,
): PaymentAmountError | null {
  if (!Number.isFinite(amount) || amount <= 0) return "invalid";
  if (amount > 1_000_000) return "too-large";
  if (amount > balance) return "outside-balance";
  return null;
}
