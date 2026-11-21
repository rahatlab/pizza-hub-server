import { Router } from "express";
import mongoose from "mongoose";
import { ok } from "../lib/response.js";
import { asyncHandler } from "../middleware/error.js";

export const healthRouter = Router();

/**
 * Liveness + readiness probe. Used by the deployment platform and by the
 * client to surface a clear message instead of a generic 504.
 */
healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const dbState = mongoose.connection.readyState;
    const db = dbState === 1 ? "connected" : dbState === 2 ? "connecting" : "disconnected";

    return ok(res, {
      status: db === "connected" ? "ok" : "degraded",
      db,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }),
);
