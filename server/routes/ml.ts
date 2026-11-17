import { Router } from "express";

const modelEndpoints = {
  "predict": "/predict",
  "predict-isolation": "/predict-isolation",
  "predict-sms": "/predict-sms",
  "predict-phishing": "/predict-phishing",
  "predict-xgboost": "/predict-xgboost",
} as const;

const router = Router();

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
      target = new URL(endpoint, serviceUrl.endsWith("/") ? serviceUrl : `${serviceUrl}/`);
    } catch {
      res.status(500).json({ error: "ML_SERVICE_URL must be a valid URL" });
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown network error";
      res.status(502).json({ error: `Unable to reach the ML service: ${message}` });
      return;
    }

    const responseBody = await upstream.text();
    res.status(upstream.status).type("application/json").send(responseBody);
  });
}

export default router;
