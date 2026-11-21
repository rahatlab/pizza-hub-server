import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { forbidden, unauthorized } from "../lib/response.js";

/** Roles allowed on the platform. Admin is never granted via public registration. */
export type Role = "admin" | "vendor" | "customer";

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
 * Never trusts a role or user id sent in the body/query — the token is the
 * only source of identity. Returns 401 for missing/invalid/expired tokens.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    unauthorized(res, "Missing authentication token");
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof decoded.sub !== "string" || typeof decoded.role !== "string") {
      unauthorized(res, "Malformed authentication token");
      return;
    }
    req.auth = {
      id: decoded.sub,
      role: decoded.role as Role,
      email: typeof decoded.email === "string" ? decoded.email : "",
    };
    next();
  } catch (error) {
    const message =
      error instanceof jwt.TokenExpiredError
        ? "Your session has expired, please sign in again"
        : "Invalid authentication token";
    unauthorized(res, message);
  }
}

/** Role gate — returns 403 (not 401) when the role does not match. */
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
 * Ownership guard. `resolveOwnerId` extracts the owning user id from the
 * loaded resource; admins pass through, everyone else must match.
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
