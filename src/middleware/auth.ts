import type { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "../lib/response.js";
import { connectDB } from "../lib/db.js";
import { User } from "../models/User.js";
import { verifyToken, type Role } from "../lib/token.js";

export type { Role };

/** Shape attached to `req.auth` after a token verifies successfully. */
export interface AuthUser {
  id: string;
  role: Role;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

/**
 * Verifies the JWT sent as `Authorization: Bearer <token>`.
 *
 * The token is the ONLY source of identity — a role or user id sent in the
 * body or query string is never trusted. Missing, malformed or expired
 * tokens all return 401 with a message the client can show verbatim.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    unauthorized(res, "Missing authentication token");
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    unauthorized(res, "Your session is invalid or has expired, please sign in again");
    return;
  }

  // Enforce blocked-user restriction server-side (assignment requirement).
  void (async () => {
    try {
      await connectDB();
      const user = await User.findById(payload.sub).select("isBlocked role").lean();
      if (!user) {
        unauthorized(res, "Account no longer exists");
        return;
      }
      if (user.isBlocked) {
        forbidden(res, "Your account has been blocked. Contact support.");
        return;
      }
      req.auth = { id: payload.sub, role: (user.role as Role) ?? payload.role, email: payload.email };
      next();
    } catch (error) {
      next(error);
    }
  })();
}

/** Role gate — 403 (not 401) when authenticated but not permitted. */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      unauthorized(res);
      return;
    }
    if (!roles.includes(req.auth.role)) {
      forbidden(res, "You do not have access to this resource");
      return;
    }
    next();
  };
}

/**
 * Ownership guard. `resolveOwnerId` loads the resource and returns its
 * owning user id; admins pass through, everyone else must match.
 */
export function requireOwnership(
  resolveOwnerId: (req: Request) => string | undefined | Promise<string | undefined>,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.auth) {
      unauthorized(res);
      return;
    }
    if (req.auth.role === "admin") {
      next();
      return;
    }
    try {
      const ownerId = await resolveOwnerId(req);
      if (!ownerId) {
        forbidden(res, "Resource not found");
        return;
      }
      if (ownerId !== req.auth.id) {
        forbidden(res, "You can only modify your own resources");
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
