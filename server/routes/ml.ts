import { Router, type Request } from "express";

const modelEndpoints = {
  "predict": "/predict",
  "predict-isolation": "/predict-isolation",
  "predict-sms": "/predict-sms",
  "predict-phishing": "/predict-phishing",
  "predict-xgboost": "/predict-xgboost",
} as const;

const router = Router();

function isLoopback(value: string) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1" || value === "localhost";
}

function isLocalRequest(req: Request) {
  const remoteAddress = req.socket.remoteAddress?.replace(/^::ffff:/, "");
  const host = req.get("host");
  if (!remoteAddress || !host || !isLoopback(remoteAddress)) return false;

  let hostName: string;
  try {
    hostName = new URL(`http://${host}`).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return false;
  }
  if (!isLoopback(hostName)) return false;

  const origin = req.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    return (originUrl.protocol === "http:" || originUrl.protocol === "https:") &&
      isLoopback(originUrl.hostname.replace(/^\[|\]$/g, ""));
  } catch {
    return false;
  }
}

router.use((req, res, next) => {
  if (!isLocalRequest(req)) {
    res.status(403).json({ error: "The ML API is available only from localhost" });
    return;
  }
  next();
});

for (const [route, endpoint] of Object.entries(modelEndpoints)) {
  router.post(`/${route}`, async (req, res) => {
    const serviceUrl = process.env.ML_SERVICE_URL;
    if (!serviceUrl) {
      res.status(503).json({ error: "ML_SERVICE_URL is not configured" });
      return;
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      res.status(400).json({ error: "A JSON object is required" });
      return;
    }

    let target: URL;
    try {
      const configuredUrl = new URL(serviceUrl);
      if (
        configuredUrl.protocol !== "http:" ||
        !isLoopback(configuredUrl.hostname.replace(/^\[|\]$/g, "")) ||
        configuredUrl.username ||
        configuredUrl.password ||
        configuredUrl.pathname !== "/" ||
        configuredUrl.search ||
        configuredUrl.hash
      ) {
        throw new Error("ML_SERVICE_URL must point to a loopback HTTP service");
      }
      target = new URL(endpoint, configuredUrl);
    } catch {
      res.status(500).json({ error: "ML_SERVICE_URL must point to a loopback HTTP service" });
      return;
    }

    let upstream: Response;
    try {
      upstream = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      res.status(502).json({ error: "Unable to reach the ML service" });
      return;
    }

    const responseBody = await upstream.text();
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(responseBody);
    } catch {
      res.status(502).json({ error: "The ML service returned an invalid response" });
      return;
    }
    if (typeof parsedBody !== "object" || parsedBody === null || Array.isArray(parsedBody)) {
      res.status(502).json({ error: "The ML service returned an invalid response" });
      return;
    }
    res.status(upstream.status).json(parsedBody);
  });
}

export default router;
