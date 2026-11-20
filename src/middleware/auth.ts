import {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { verifyToken, type TokenPayload } from "../lib/jwt.js";
import { User } from "../models/User.js";
import { sendError } from "../lib/response.js";

/** Attached to req after auth middleware chain succeeds (fresh from DB). */
export interface AuthUser extends TokenPayload {
  _id: string;
  isBlocked: boolean;
  subscriptionPlan: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** 1. verifyJWT — signature + expiry (missing/invalid/expired → 401 UNAUTHORIZED). */
export function verifyJWT(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendError(res, "UNAUTHORIZED", "Authentication required. Please log in to continue.");
    return;
  }
  const token = authHeader.slice(7).trim();
  try {
    const payload = verifyToken(token);
    req.user = payload as AuthUser;
    next();
  } catch {
    sendError(res, "UNAUTHORIZED", "Token expired or invalid. Please log in again.");
  }
}

/** 2. loadUserFresh — load user fresh from DB (role, isBlocked, plan never stale). */
export async function loadUserFresh(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    sendError(res, "UNAUTHORIZED", "Authentication required.");
    return;
  }
  try {
    const user = await User.findById(req.user.userId).select(
      "name email role isBlocked subscriptionPlan subscriptionExpiresAt"
    );
    if (!user) {
      sendError(res, "UNAUTHORIZED", "User not found. Please log in again.");
      return;
    }
    req.user._id = user._id.toString();
    req.user.role = user.role;
    req.user.email = user.email;
    req.user.isBlocked = user.isBlocked;
    req.user.subscriptionPlan = user.subscriptionPlan;
    next();
  } catch {
    sendError(res, "INTERNAL_SERVER_ERROR", "Failed to load user.");
  }
}

/** 3. blockCheck — blocked user → 403 FORBIDDEN. */
export function blockCheck(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.user && req.user.isBlocked === true) {
    sendError(res, "FORBIDDEN", "Your account is blocked. Contact support.");
    return;
  }
  next();
}

/** 4. requireRole — role mismatch → 403 FORBIDDEN. */
export function requireRole(...allowedRoles: string[]) {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      sendError(res, "FORBIDDEN", "You do not have permission to perform this action.");
      return;
    }
    next();
  };
}

/** 5. ownershipCheck — resource owner (or admin) only → 403 FORBIDDEN.
 *  Pass a function that extracts the owner userId from req. */
export function ownershipCheck(getOwnerId: (req: Request) => string | undefined) {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      sendError(res, "UNAUTHORIZED", "Authentication required.");
      return;
    }
    const ownerId = getOwnerId(req);
    const isAdmin = req.user.role === "admin";
    if (ownerId && ownerId !== req.user._id && !isAdmin) {
      sendError(res, "FORBIDDEN", "You can only modify your own resources.");
      return;
    }
    next();
  };
}
