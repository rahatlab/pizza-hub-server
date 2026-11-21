import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { clientOrigins, env } from "./config/env.js";
import { getAuth } from "./lib/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { accountRouter } from "./routes/account.js";
import { healthRouter } from "./routes/health.js";
import { uploadRouter } from "./routes/upload.js";

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

  // Better Auth reads the raw request stream itself, so its catch-all has to
  // be mounted BEFORE express.json(). Everything under /api/auth — sign-up,
  // sign-in, Google callback, sign-out — is handled by this one route.
  app.all("/api/auth/*", toNodeHandler(getAuth()));

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
  app.use("/api/account", accountRouter);
  app.use("/api/upload", uploadRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
