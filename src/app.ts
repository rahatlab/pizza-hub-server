import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { clientOrigins, env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { healthRouter } from "./routes/health.js";

export function createApp(): express.Express {
  const app = express();

  // Stripe webhooks need the raw body for signature verification, so this
  // must be registered BEFORE express.json() consumes the stream.
  app.use(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
  );

  app.use(helmet());
  app.use(
    cors({
      origin: clientOrigins,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Request log in development only
  if (env.NODE_ENV === "development") {
    app.use((req, _res, next) => {
      console.log(`→ ${req.method} ${req.originalUrl}`);
      next();
    });
  }

  app.get("/", (_req, res) => {
    res.json({
      service: "pizza-hub-server",
      version: "0.1.0",
      docs: "/api/health",
    });
  });

  app.use("/api/health", healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
