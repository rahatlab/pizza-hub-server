import { Router } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { User } from "../models/User.js";
import { signToken } from "../lib/jwt.js";
import { sendSuccess, sendError } from "../lib/response.js";
import { ErrorCodes } from "../lib/response.js";

const router = Router();

/** better-auth standard routes: /api/auth/sign-in, /sign-up, /sign-out, /session, etc. */
router.use(
  "/",
  async (req, res, next) => {
    await toNodeHandler(auth)(req, res as any).catch(next);
  }
);

/**
 * POST /api/auth/jwt
 * Verify better-auth session (cookie) → issue our own JWT { userId, email, role }.
 * Client stores it in localStorage and sends Authorization: Bearer on protected APIs.
 */
router.post(
  "/jwt",
  async (req, res) => {
    try {
      const session = await auth.api.getSession({
        headers: req.headers as Record<string, string>,
      });
      if (!session?.user) {
        sendError(res, "UNAUTHORIZED", "Authentication required. Please log in to continue.");
        return;
      }
      const user = await User.findById(session.user.id).select(
        "name email role isBlocked"
      );
      if (!user || user.isBlocked) {
        sendError(res, "UNAUTHORIZED", "User not found or blocked.");
        return;
      }
      const token = signToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });
      sendSuccess(res, { token }, "JWT issued", 200);
    } catch {
      sendError(res, "UNAUTHORIZED", "Session invalid. Please log in again.");
    }
  }
);

export default router;
