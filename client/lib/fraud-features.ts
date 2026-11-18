import type { PaymentFraudFeatures } from "./ml-api";

type PriorTransaction = {
  type: "sent" | "received" | "request";
  status: "successful" | "blocked" | "pending" | "failed";
  amount: number;
  receiverUpi: string;
  timestamp: string;
};

type PaymentFeatureInput = {
  amount: number;
  recipientUpi: string;
  paymentType: "UPI" | "Bill Payment" | "Recharge";
  at: Date;
  transactions: PriorTransaction[];
  historyComplete: boolean;
};

export function buildPaymentFraudFeatures({
  amount,
  recipientUpi,
  paymentType,
  at,
  transactions,
  historyComplete,
}: PaymentFeatureInput): PaymentFraudFeatures {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(at.getTime())) {
    throw new Error("Payment amount and timestamp must be finite");
  }
  if (!historyComplete) {
    throw new Error("Complete transaction history is required for fraud features");
  }

  const currentHour = Math.floor(at.getTime() / 3_600_000);
  const sentTransactions = transactions.filter(transaction => transaction.type === "sent");
  for (const transaction of sentTransactions) {
    const transactionTime = Date.parse(transaction.timestamp);
    if (
      !Number.isFinite(transaction.amount) ||
      transaction.amount < 0 ||
      !Number.isFinite(transactionTime)
    ) {
      throw new Error("Transaction history contains invalid feature data");
    }
  }
  const priorTransactions = sentTransactions.filter(transaction =>
    Math.floor(Date.parse(transaction.timestamp) / 3_600_000) < currentHour,
  );
  const recipientKey = recipientUpi.trim().toLowerCase();
  const beneficiaryHistoryCount = priorTransactions.filter(
    transaction => transaction.receiverUpi.trim().toLowerCase() === recipientKey,
  ).length;
  const transactionType = paymentType === "UPI" ? "TRANSFER" : "PAYMENT";

  return {
    log_amount: Math.log1p(amount),
    log_sender_history_count: Math.log1p(priorTransactions.length),
    log_beneficiary_history_count: Math.log1p(beneficiaryHistoryCount),
    type_CASH_IN: 0,
    type_CASH_OUT: 0,
    type_DEBIT: 0,
    type_PAYMENT: Number(transactionType === "PAYMENT"),
    type_TRANSFER: Number(transactionType === "TRANSFER"),
  };
}
