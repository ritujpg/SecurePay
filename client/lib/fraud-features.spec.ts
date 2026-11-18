import { describe, expect, it } from "vitest";
import { buildPaymentFraudFeatures } from "./fraud-features";

describe("buildPaymentFraudFeatures", () => {
  it("counts attempted transactions from earlier UTC hours regardless of outcome", () => {
    const features = buildPaymentFraudFeatures({
      amount: 100,
      recipientUpi: "friend@securepay",
      paymentType: "UPI",
      at: new Date("2026-01-03T11:30:00Z"),
      historyComplete: true,
      transactions: [
        {
          type: "sent",
          status: "successful",
          amount: 50,
          receiverUpi: "friend@securepay",
          timestamp: "2026-01-02T10:00:00Z",
        },
        {
          type: "sent",
          status: "blocked",
          amount: 25,
          receiverUpi: "friend@securepay",
          timestamp: "2026-01-03T09:00:00Z",
        },
        {
          type: "received",
          status: "successful",
          amount: 25,
          receiverUpi: "self@securepay",
          timestamp: "2026-01-03T10:00:00Z",
        },
        {
          type: "sent",
          status: "successful",
          amount: 25,
          receiverUpi: "friend@securepay",
          timestamp: "2026-01-03T11:15:00Z",
        },
        {
          type: "sent",
          status: "failed",
          amount: 25,
          receiverUpi: "friend@securepay",
          timestamp: "2026-01-02T09:00:00Z",
        },
        {
          type: "sent",
          status: "pending",
          amount: 25,
          receiverUpi: "friend@securepay",
          timestamp: "2026-01-01T10:00:00Z",
        },
        {
          type: "sent",
          status: "successful",
          amount: 25,
          receiverUpi: "friend@securepay",
          timestamp: "2026-01-04T10:00:00Z",
        },
      ],
    });

    expect(features.log_sender_history_count).toBeCloseTo(Math.log1p(4));
    expect(features.log_beneficiary_history_count).toBeCloseTo(Math.log1p(4));
    expect(features.type_TRANSFER).toBe(1);
    expect(features.type_PAYMENT).toBe(0);
    expect(Object.keys(features)).toEqual([
      "log_amount",
      "log_sender_history_count",
      "log_beneficiary_history_count",
      "type_CASH_IN",
      "type_CASH_OUT",
      "type_DEBIT",
      "type_PAYMENT",
      "type_TRANSFER",
    ]);
  });

  it("maps bill payments and recharges to the PaySim payment category", () => {
    const features = buildPaymentFraudFeatures({
      amount: 0,
      recipientUpi: "utility@billpay",
      paymentType: "Bill Payment",
      at: new Date("2026-01-03T11:30:00Z"),
      historyComplete: true,
      transactions: [],
    });

    expect(features.log_amount).toBe(0);
    expect(features.log_sender_history_count).toBe(0);
    expect(features.log_beneficiary_history_count).toBe(0);
    expect(features.type_PAYMENT).toBe(1);
    expect(features.type_TRANSFER).toBe(0);
  });

  it("requires complete history and supports first-time senders and beneficiaries", () => {
    const input = {
      amount: 1,
      recipientUpi: "new@securepay",
      paymentType: "UPI" as const,
      at: new Date("2026-01-03T11:00:00Z"),
      transactions: [],
      historyComplete: true,
    };
    const features = buildPaymentFraudFeatures(input);
    expect(features.log_sender_history_count).toBe(0);
    expect(features.log_beneficiary_history_count).toBe(0);
    expect(() => buildPaymentFraudFeatures({ ...input, historyComplete: false }))
      .toThrow("Complete transaction history is required");
  });

  it("rejects malformed sent history rather than silently dropping records", () => {
    expect(() => buildPaymentFraudFeatures({
      amount: 1,
      recipientUpi: "friend@securepay",
      paymentType: "UPI",
      at: new Date("2026-01-03T11:30:00Z"),
      historyComplete: true,
      transactions: [
        { type: "sent", status: "failed", amount: 1, receiverUpi: "friend@securepay", timestamp: "not-a-timestamp" },
      ],
    })).toThrow("Transaction history contains invalid feature data");
  });

  it("excludes same-hour events and counts repeated earlier beneficiary attempts", () => {
    const features = buildPaymentFraudFeatures({
      amount: 1,
      recipientUpi: "friend@securepay",
      paymentType: "UPI",
      at: new Date("2026-01-03T11:30:00Z"),
      historyComplete: true,
      transactions: [
        { type: "sent", status: "successful", amount: 1, receiverUpi: "friend@securepay", timestamp: "2026-01-03T11:15:00Z" },
        { type: "sent", status: "failed", amount: 1, receiverUpi: "friend@securepay", timestamp: "2026-01-03T09:59:59Z" },
        { type: "sent", status: "blocked", amount: 1, receiverUpi: "other@securepay", timestamp: "2026-01-03T09:00:00Z" },
      ],
    });
    expect(features.log_sender_history_count).toBeCloseTo(Math.log1p(2));
    expect(features.log_beneficiary_history_count).toBeCloseTo(Math.log1p(1));
  });

  it("counts earlier-hour transactions across recent hour, day, week, and older history", () => {
    const features = buildPaymentFraudFeatures({
      amount: 10,
      recipientUpi: "friend@securepay",
      paymentType: "UPI",
      at: new Date("2026-01-10T11:30:00Z"),
      historyComplete: true,
      transactions: [
        { type: "sent", status: "successful", amount: 1, receiverUpi: "friend@securepay", timestamp: "2026-01-10T10:59:59Z" },
        { type: "sent", status: "failed", amount: 1, receiverUpi: "friend@securepay", timestamp: "2026-01-09T11:00:00Z" },
        { type: "sent", status: "pending", amount: 1, receiverUpi: "friend@securepay", timestamp: "2026-01-03T12:00:00Z" },
        { type: "sent", status: "blocked", amount: 1, receiverUpi: "friend@securepay", timestamp: "2026-01-02T11:00:00Z" },
        { type: "sent", status: "successful", amount: 1, receiverUpi: "friend@securepay", timestamp: "2026-01-10T11:00:00Z" },
        { type: "sent", status: "successful", amount: 1, receiverUpi: "friend@securepay", timestamp: "2026-01-10T12:00:00Z" },
      ],
    });

    expect(features.log_sender_history_count).toBeCloseTo(Math.log1p(4));
    expect(features.log_beneficiary_history_count).toBeCloseTo(Math.log1p(4));
  });

  it("matches the PaySim history features for equivalent hourly fixture rows", () => {
    const features = buildPaymentFraudFeatures({
      amount: 100,
      recipientUpi: "friend@securepay",
      paymentType: "UPI",
      at: new Date("2026-01-03T10:00:00Z"),
      historyComplete: true,
      transactions: [
        { type: "sent", status: "successful", amount: 100, receiverUpi: "friend@securepay", timestamp: "2026-01-03T08:10:00Z" },
        { type: "sent", status: "failed", amount: 100, receiverUpi: "friend@securepay", timestamp: "2026-01-03T08:30:00Z" },
        { type: "sent", status: "pending", amount: 100, receiverUpi: "friend@securepay", timestamp: "2026-01-03T09:10:00Z" },
      ],
    });

    expect(features.log_amount).toBeCloseTo(Math.log1p(100));
    expect(features.log_sender_history_count).toBeCloseTo(Math.log1p(3));
    expect(features.log_beneficiary_history_count).toBeCloseTo(Math.log1p(3));
    expect(features.type_TRANSFER).toBe(1);
    expect(features.type_PAYMENT).toBe(0);
  });
});
