import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../index";

const clientFetch = globalThis.fetch;

async function startTestServer() {
  const app = createServer();
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to start test server");
  }
  return { server, port: address.port };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ML API proxy", () => {
  it("forwards a whitelisted model request to Flask and relays its response", async () => {
    const previousServiceUrl = process.env.ML_SERVICE_URL;
    process.env.ML_SERVICE_URL = "http://ml-service.test";
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ model: "Banking SMS Detector", prediction: "Phishing" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", upstreamFetch);

    const { server, port } = await startTestServer();

    try {
      const response = await clientFetch(`http://127.0.0.1:${port}/api/ml/predict-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Verify your account" }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ prediction: "Phishing" });
      expect(upstreamFetch).toHaveBeenCalledWith(
        new URL("http://ml-service.test/predict-sms"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ message: "Verify your account" }),
        }),
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
      if (previousServiceUrl === undefined) delete process.env.ML_SERVICE_URL;
      else process.env.ML_SERVICE_URL = previousServiceUrl;
    }
  });

  it("returns an explicit configuration error if Flask is not configured", async () => {
    const previousServiceUrl = process.env.ML_SERVICE_URL;
    delete process.env.ML_SERVICE_URL;
    const { server, port } = await startTestServer();

    try {
      const response = await clientFetch(`http://127.0.0.1:${port}/api/ml/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 10 }),
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ error: "ML_SERVICE_URL is not configured" });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
      if (previousServiceUrl !== undefined) process.env.ML_SERVICE_URL = previousServiceUrl;
    }
  });
});
