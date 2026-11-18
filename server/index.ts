import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import mlRouter from "./routes/ml";
import demoDbRouter from "./routes/demo-db";

export function createServer({
  enableLocalDemoDatabase = false,
  enableLocalMlService = false,
}: {
  enableLocalDemoDatabase?: boolean;
  enableLocalMlService?: boolean;
} = {}) {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (enableLocalMlService && process.env.NODE_ENV !== "production") {
    app.use("/api/ml", mlRouter);
  }
  if (enableLocalDemoDatabase && process.env.NODE_ENV !== "production") {
    app.use("/api/demo-db", demoDbRouter);
  }

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  app.use((error: unknown, _req, res, next) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "entity.parse.failed"
    ) {
      res.status(400).json({ error: "Malformed JSON request body" });
      return;
    }
    next(error);
  });

  return app;
}
