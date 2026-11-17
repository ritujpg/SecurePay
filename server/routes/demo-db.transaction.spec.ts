import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
  getSupabaseServiceClient: vi.fn(),
}));

vi.mock("../lib/supabase", () => mocks);

import { createServer } from "../index";

const clientFetch = globalThis.fetch;
const previousNodeEnv = process.env.NODE_ENV;
const userId = "11111111-1111-4111-8111-111111111111";
const accountId = "22222222-2222-4222-8222-222222222222";
const transactionId = "33333333-3333-4333-8333-333333333333";
const riskId = "44444444-4444-4444-8444-444444444444";
const idempotencyKey = transactionId;

const transactionResponse = {
  id: transactionId,
  account_id: accountId,
  recipient_name: "Test Recipient",
  recipient_upi: "recipient@example",
  amount: 125,
  transaction_type: "UPI",
  recipient_type: "New",
  transaction_time: "2026-11-17T00:00:00+00:00",
  status: "Success",
  reference_number: `SP${transactionId.replace(/-/g, "").toUpperCase()}`,
  risk: {
    id: riskId,
    transaction_id: transactionId,
    risk_score: 20,
    risk_level: "Low",
    amount_risk: 5,
    behaviour_risk: 0,
    recipient_risk: 10,
    frequency_risk: 0,
    decision: "APPROVE",
    explanation: "Low local demo risk.",
    analysed_at: "2026-11-17T00:00:00+00:00",
  },
};

const requestBody = {
  idempotencyKey,
  recipientName: "Test Recipient",
  recipientUpi: "recipient@example",
  amount: 125,
  transactionType: "UPI",
  recipientType: "New",
  riskScore: 20,
  riskLevel: "Low",
  amountRisk: 5,
  behaviourRisk: 0,
  recipientRisk: 10,
  frequencyRisk: 0,
  explanation: "Low local demo risk.",
  finalStatus: "Success",
};

async function startTestServer() {
  const server = createServer({ enableLocalDemoDatabase: true }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to start test server");
  const baseUrl = `http://127.0.0.1:${address.port}/api/demo-db`;
  return {
    server,
    url: `${baseUrl}/transactions`,
    statusUrl: `${baseUrl}/transactions/status`,
  };
}

function configureAnonClient() {
  const userQuery = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: userId,
        full_name: "Demo User",
        mobile_number: null,
        email: null,
        preferred_language: "English",
      },
      error: null,
    }),
  };
  const accountsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: [{ id: accountId, status: "Active" }],
      error: null,
    }),
  };
  mocks.getSupabaseClient.mockReturnValue({
    from: vi.fn((table: string) => table === "users" ? userQuery : accountsQuery),
  });
  return { userQuery, accountsQuery };
}

beforeEach(() => {
  process.env.NODE_ENV = "test";
  mocks.getSupabaseClient.mockReset();
  mocks.getSupabaseServiceClient.mockReset();
  configureAnonClient();
});

afterEach(() => {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  vi.restoreAllMocks();
});

describe("atomic demo transaction endpoint", () => {
  it("sends the final status and all transaction details in one RPC call", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { created: true, transaction: transactionResponse },
      error: null,
    });
    mocks.getSupabaseServiceClient.mockReturnValue({ rpc });
    const { server, url } = await startTestServer();

    try {
      const response = await clientFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toEqual({ transaction: transactionResponse });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith("create_demo_transaction_atomic", expect.objectContaining({
        p_idempotency_key: idempotencyKey,
        p_payload_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_user_id: userId,
        p_account_id: accountId,
        p_final_status: "Success",
        p_amount: 125,
      }));
      expect(mocks.getSupabaseClient().from).toHaveBeenCalledTimes(2);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("returns conflict when the RPC rejects a reused key with different details", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "IDEMPOTENCY_CONFLICT" },
    });
    mocks.getSupabaseServiceClient.mockReturnValue({ rpc });
    const { server, url } = await startTestServer();

    try {
      const response = await clientFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: "This transaction retry key was already used for different details",
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("returns the existing result for an idempotent retry", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { created: true, transaction: transactionResponse }, error: null })
      .mockResolvedValueOnce({ data: { created: false, transaction: transactionResponse }, error: null });
    mocks.getSupabaseServiceClient.mockReturnValue({ rpc });
    const { server, url } = await startTestServer();

    try {
      const responses = await Promise.all([requestBody, requestBody].map(body =>
        clientFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      ));

      expect(responses.map(response => response.status).sort()).toEqual([200, 201]);
      await expect(Promise.all(responses.map(response => response.json()))).resolves.toEqual([
        { transaction: transactionResponse },
        { transaction: transactionResponse },
      ]);
      expect(rpc).toHaveBeenCalledTimes(2);
      expect(rpc.mock.calls[0][1].p_payload_hash).toBe(rpc.mock.calls[1][1].p_payload_hash);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("does not claim success or make secondary writes when the atomic RPC fails", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23514", message: "constraint violation" },
    });
    mocks.getSupabaseServiceClient.mockReturnValue({ rpc });
    const { server, url } = await startTestServer();

    try {
      const response = await clientFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({ error: "Demo database request failed" });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(mocks.getSupabaseClient().from).toHaveBeenCalledTimes(2);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("sends concurrent duplicate requests through the same idempotency key", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { created: true, transaction: transactionResponse }, error: null })
      .mockResolvedValueOnce({ data: { created: false, transaction: transactionResponse }, error: null });
    mocks.getSupabaseServiceClient.mockReturnValue({ rpc });
    const { server, url } = await startTestServer();

    try {
      const responses = await Promise.all([requestBody, requestBody].map(body =>
        clientFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      ));

      expect(responses.map(response => response.status).sort()).toEqual([200, 201]);
      expect(rpc).toHaveBeenCalledTimes(2);
      expect(rpc.mock.calls[0][1].p_idempotency_key).toBe(rpc.mock.calls[1][1].p_idempotency_key);
      expect(rpc.mock.calls[0][1].p_payload_hash).toBe(rpc.mock.calls[1][1].p_payload_hash);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("fingerprints changed transaction details differently for the same key", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { created: true, transaction: transactionResponse },
      error: null,
    });
    mocks.getSupabaseServiceClient.mockReturnValue({ rpc });
    const { server, url } = await startTestServer();

    try {
      for (const body of [requestBody, { ...requestBody, amount: 126 }]) {
        const response = await clientFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        expect(response.status).toBe(201);
      }

      const firstHash = rpc.mock.calls[0][1].p_payload_hash;
      const secondHash = rpc.mock.calls[1][1].p_payload_hash;
      expect(firstHash).not.toBe(secondHash);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("includes the selected account in the idempotency fingerprint", async () => {
    const otherAccountId = "55555555-5555-4555-8555-555555555555";
    const { userQuery } = configureAnonClient();
    const accountsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn()
        .mockResolvedValueOnce({ data: [{ id: accountId, status: "Active" }], error: null })
        .mockResolvedValueOnce({ data: [{ id: otherAccountId, status: "Active" }], error: null }),
    };
    const from = vi.fn((table: string) => table === "users" ? userQuery : accountsQuery);
    mocks.getSupabaseClient.mockReturnValue({ from });
    const rpc = vi.fn().mockResolvedValue({
      data: { created: true, transaction: transactionResponse },
      error: null,
    });
    mocks.getSupabaseServiceClient.mockReturnValue({ rpc });
    const { server, url } = await startTestServer();

    try {
      for (const body of [requestBody, requestBody]) {
        const response = await clientFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        expect(response.status).toBe(201);
      }

      expect(rpc.mock.calls[0][1].p_account_id).toBe(accountId);
      expect(rpc.mock.calls[1][1].p_account_id).toBe(otherAccountId);
      expect(rpc.mock.calls[0][1].p_payload_hash).not.toBe(rpc.mock.calls[1][1].p_payload_hash);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("returns an explicit unavailable response when the server key is not configured", async () => {
    mocks.getSupabaseServiceClient.mockImplementation(() => {
      throw new Error("VITE_SUPABASE_URL and server-only SUPABASE_SERVICE_ROLE_KEY are required for atomic demo transactions");
    });
    const { server, url } = await startTestServer();

    try {
      const response = await clientFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        error: expect.stringContaining("SUPABASE_SERVICE_ROLE_KEY"),
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("reports invalid server database configuration without attempting an RPC", async () => {
    mocks.getSupabaseServiceClient.mockImplementation(() => {
      throw new Error("Invalid Supabase URL configuration");
    });
    const { server, url } = await startTestServer();

    try {
      const response = await clientFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({ error: "Demo database request failed" });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("uses the atomic status RPC for legacy status transitions", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { updated: true },
      error: null,
    });
    mocks.getSupabaseServiceClient.mockReturnValue({ rpc });
    const { server, statusUrl } = await startTestServer();

    try {
      const response = await clientFetch(statusUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceNumber: "SP33333333333343338333333333333333",
          status: "Flagged",
        }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ updated: true });
      expect(rpc).toHaveBeenCalledWith("update_demo_transaction_status_atomic", {
        p_user_id: userId,
        p_reference_number: "SP33333333333343338333333333333333",
        p_status: "Flagged",
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("reports an unchanged status accurately", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { updated: false },
      error: null,
    });
    mocks.getSupabaseServiceClient.mockReturnValue({ rpc });
    const { server, statusUrl } = await startTestServer();

    try {
      const response = await clientFetch(statusUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceNumber: "SP33333333333343338333333333333333",
          status: "Success",
        }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ updated: false });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("returns not found when the status RPC cannot find the user's transaction", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "TRANSACTION_NOT_FOUND" },
    });
    mocks.getSupabaseServiceClient.mockReturnValue({ rpc });
    const { server, statusUrl } = await startTestServer();

    try {
      const response = await clientFetch(statusUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceNumber: "SPNOTFOUND",
          status: "Success",
        }),
      });

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Demo transaction was not found" });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
