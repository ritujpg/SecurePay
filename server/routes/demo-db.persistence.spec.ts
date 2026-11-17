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
const passwordKey = "22222222-2222-4222-8222-222222222222";
const phishingKey = "33333333-3333-4333-8333-333333333333";

const passwordBody = {
  idempotencyKey: passwordKey,
  strength: "Strong",
  score: 90,
  length_check: true,
  uppercase_check: true,
  lowercase_check: true,
  number_check: true,
  special_character_check: true,
};

const phishingBody = {
  idempotencyKey: phishingKey,
  input_type: "MESSAGE",
  input_hash: "a".repeat(64),
  risk_level: "Suspicious",
  risk_score: 50,
  explanation: "The message contains suspicious wording.",
};

async function startTestServer() {
  const server = createServer({ enableLocalDemoDatabase: true }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to start test server");
  return {
    server,
    passwordUrl: `http://127.0.0.1:${address.port}/api/demo-db/password-checks`,
    phishingUrl: `http://127.0.0.1:${address.port}/api/demo-db/phishing-checks`,
  };
}

function configureDatabase(failOn?: { table: string; attempt: number }) {
  const rows = new Map<string, Map<string, Record<string, unknown>>>();
  const upsertAttempts = new Map<string, number>();
  const from = vi.fn((table: string) => {
    let upsertRow: Record<string, unknown> | undefined;
    let conflictColumn = "id";
    let filterColumn = "";
    let filterValue: unknown;
    const tableRows = rows.get(table) ?? new Map<string, Record<string, unknown>>();
    rows.set(table, tableRows);

    const query: {
      select: (columns?: string) => typeof query | Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
      order: () => typeof query;
      limit: () => typeof query;
      eq: (column: string, value: unknown) => typeof query;
      upsert: (row: Record<string, unknown>, options: { onConflict: string }) => typeof query;
      maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: null }>;
    } = {
      select: (columns?: string) => {
        if (upsertRow) {
          conflictColumn = columns ?? conflictColumn;
          const attempt = (upsertAttempts.get(table) ?? 0) + 1;
          upsertAttempts.set(table, attempt);
          if (failOn?.table === table && failOn.attempt === attempt) {
            return Promise.resolve({ data: null, error: { message: "mock database failure" } });
          }
          const key = String(upsertRow[conflictColumn]);
          const inserted = !tableRows.has(key);
          if (inserted) tableRows.set(key, upsertRow);
          return Promise.resolve({
            data: inserted ? [{ [conflictColumn]: upsertRow[conflictColumn] }] : [],
            error: null,
          });
        }
        return query;
      },
      order: () => query,
      limit: () => query,
      eq: (column, value) => {
        filterColumn = column;
        filterValue = value;
        return query;
      },
      upsert: (row, options) => {
        upsertRow = row;
        conflictColumn = options.onConflict;
        return query;
      },
      maybeSingle: async () => {
        if (table === "users") {
          return {
            data: {
              id: userId,
              full_name: "Demo User",
              mobile_number: null,
              email: null,
              preferred_language: "English",
            },
            error: null,
          };
        }
        const record = tableRows.get(String(filterValue));
        return {
          data: record && record[filterColumn] === filterValue ? record : null,
          error: null,
        };
      },
    };
    return query;
  });

  mocks.getSupabaseClient.mockReturnValue({ from });
  return { rows, from };
}

async function postJson(url: string, body: unknown) {
  return clientFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.NODE_ENV = "test";
  mocks.getSupabaseClient.mockReset();
  mocks.getSupabaseServiceClient.mockReset();
});

afterEach(() => {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  vi.restoreAllMocks();
});

describe("demo password and phishing persistence", () => {
  it("persists a password check without storing a password value", async () => {
    const { rows } = configureDatabase();
    const { server, passwordUrl } = await startTestServer();

    try {
      const response = await postJson(passwordUrl, passwordBody);

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toEqual({ saved: true });
      expect(rows.get("password_checks")?.get(passwordKey)).toMatchObject({
        user_id: userId,
        score: 90,
      });
      expect(rows.get("security_checks")?.size).toBe(1);
      expect(rows.get("security_activity")?.size).toBe(1);
      expect(rows.get("password_checks")?.get(passwordKey)).not.toHaveProperty("password");
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("repairs a partial write on retry and reports the retry as unchanged", async () => {
    const { rows } = configureDatabase({ table: "security_checks", attempt: 1 });
    const { server, passwordUrl } = await startTestServer();

    try {
      const firstResponse = await postJson(passwordUrl, passwordBody);
      expect(firstResponse.status).toBe(502);
      await expect(firstResponse.json()).resolves.toEqual({ error: "Demo database request failed" });
      expect(rows.get("password_checks")?.size).toBe(1);
      expect(rows.get("security_checks")?.size ?? 0).toBe(0);

      const retryResponse = await postJson(passwordUrl, passwordBody);
      expect(retryResponse.status).toBe(200);
      await expect(retryResponse.json()).resolves.toEqual({ saved: true });
      expect(rows.get("password_checks")?.size).toBe(1);
      expect(rows.get("security_checks")?.size).toBe(1);
      expect(rows.get("security_activity")?.size).toBe(1);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("accepts identical duplicates but rejects a key reused with changed details", async () => {
    configureDatabase();
    const { server, passwordUrl } = await startTestServer();

    try {
      expect((await postJson(passwordUrl, passwordBody)).status).toBe(201);
      expect((await postJson(passwordUrl, passwordBody)).status).toBe(200);

      const changed = await postJson(passwordUrl, { ...passwordBody, score: 89 });
      expect(changed.status).toBe(409);
      await expect(changed.json()).resolves.toEqual({
        error: "This check retry key was already used for different details",
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("persists phishing history using only the supplied hash and safe explanation", async () => {
    const { rows } = configureDatabase();
    const { server, phishingUrl } = await startTestServer();

    try {
      const response = await postJson(phishingUrl, phishingBody);

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toEqual({ saved: true });
      expect(rows.get("phishing_checks")?.get(phishingKey)).toMatchObject({
        input_hash: "a".repeat(64),
        risk_level: "Suspicious",
      });
      expect(JSON.stringify([...rows.values()])).not.toContain("raw message");
      expect(rows.get("security_checks")?.size).toBe(1);
      expect(rows.get("security_activity")?.size).toBe(1);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("rejects invalid input without attempting persistence", async () => {
    const { from } = configureDatabase();
    const { server, passwordUrl } = await startTestServer();

    try {
      const response = await postJson(passwordUrl, { ...passwordBody, password: "not-saved" });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: "Request body is invalid" });
      expect(from).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("returns service unavailable when database configuration is missing", async () => {
    mocks.getSupabaseClient.mockImplementation(() => {
      throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required for the local demo database API");
    });
    const { server, passwordUrl } = await startTestServer();

    try {
      const response = await postJson(passwordUrl, passwordBody);

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ error: "The demo database is not configured" });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
