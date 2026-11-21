import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type Role = "admin" | "vendor" | "customer";

/** Claims carried inside every access token. */
export interface TokenPayload {
  sub: string;
  role: Role;
  email: string;
}

/**
 * Signs a short-lived access token. Nothing else — no refresh tokens, no
 * roles computed on the client. The token is the single source of identity
 * and every protected route re-reads `role` from it.
 */
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    // jsonwebtoken types this as a branded StringValue; our env value is a
    // plain string validated by Zod, so narrow it once here.
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    issuer: "pizza-hub",
    audience: "pizza-hub-client",
  });
}

/** Returns the payload, or null when the token is missing/invalid/expired. */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: "pizza-hub",
      audience: "pizza-hub-client",
    });
    if (typeof decoded === "string") return null;

    const { sub, role, email } = decoded as Partial<TokenPayload>;
    if (typeof sub !== "string" || typeof role !== "string") return null;
    if (role !== "admin" && role !== "vendor" && role !== "customer") return null;

    return { sub, role, email: typeof email === "string" ? email : "" };
  } catch {
    return null;
  }
}
