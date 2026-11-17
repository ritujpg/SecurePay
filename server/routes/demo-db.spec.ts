import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../index";
import { canTransitionTransactionStatus } from "./demo-db";

const clientFetch = globalThis.fetch;
const openServers: Array<ReturnType<ReturnType<typeof createServer>["listen"]>> = [];
const previousNodeEnv = process.env.NODE_ENV;

async function startTestServer(enableLocalDemoDatabase = false) {
  process.env.NODE_ENV = "test";
  const server = createServer({ enableLocalDemoDatabase }).listen(0, "127.0.0.1");
  openServers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to start test server");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(openServers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  })));
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  vi.unstubAllGlobals();
});

describe("local demo database API boundary", () => {
  it("does not mount in the normal production server configuration", async () => {
    const baseUrl = await startTestServer();
    const response = await clientFetch(`${baseUrl}/api/demo-db/status`);

    expect(response.status).toBe(404);
  });

  it("rejects non-local browser origins", async () => {
    const baseUrl = await startTestServer(true);
    const response = await clientFetch(`${baseUrl}/api/demo-db/status`, {
      headers: { Origin: "https://attacker.example" },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "The demo database API is available only from localhost",
    });
  });

  it("rejects attempts to submit a plaintext password", async () => {
    const baseUrl = await startTestServer(true);
    const response = await clientFetch(`${baseUrl}/api/demo-db/password-checks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "9df2b3c4-5a67-4890-9123-456789abcdef",
        strength: "Strong",
        score: 80,
        length_check: true,
        uppercase_check: true,
        lowercase_check: true,
        number_check: true,
        special_character_check: true,
        password: "must-not-be-persisted",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Request body is invalid" });
  });

  it("rejects transaction statuses outside the database's allowed values", async () => {
    const baseUrl = await startTestServer(true);
    const response = await clientFetch(`${baseUrl}/api/demo-db/transactions/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        referenceNumber: "SPTEST",
        status: "Approved",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Request body is invalid" });
  });
});

describe("demo transaction status transitions", () => {
  it("allows all defined statuses to remain unchanged", () => {
    const statuses = ["Success", "Pending", "Failed", "Flagged", "Verification Required"] as const;
    for (const status of statuses) expect(canTransitionTransactionStatus(status, status)).toBe(true);
  });

  it("allows verification and pending transactions to reach valid outcomes", () => {
    expect(canTransitionTransactionStatus("Verification Required", "Pending")).toBe(true);
    expect(canTransitionTransactionStatus("Verification Required", "Success")).toBe(true);
    expect(canTransitionTransactionStatus("Verification Required", "Failed")).toBe(true);
    expect(canTransitionTransactionStatus("Verification Required", "Flagged")).toBe(true);
    expect(canTransitionTransactionStatus("Pending", "Success")).toBe(true);
    expect(canTransitionTransactionStatus("Pending", "Failed")).toBe(true);
    expect(canTransitionTransactionStatus("Pending", "Flagged")).toBe(true);
  });

  it("rejects transitions out of terminal statuses and back to verification", () => {
    expect(canTransitionTransactionStatus("Pending", "Verification Required")).toBe(false);
    expect(canTransitionTransactionStatus("Success", "Failed")).toBe(false);
    expect(canTransitionTransactionStatus("Failed", "Success")).toBe(false);
    expect(canTransitionTransactionStatus("Flagged", "Success")).toBe(false);
  });
});
