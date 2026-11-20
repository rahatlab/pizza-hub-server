import jwt, { type JwtPayload, type SignOptions, type VerifyOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

const SIGN_DEFAULTS: SignOptions = {
  expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  issuer: "pizzahub",
};

const VERIFY_DEFAULTS: VerifyOptions = {
  issuer: "pizzahub",
};

/** Sign a JWT with { userId, email, role }. */
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, SIGN_DEFAULTS);
}

/** Verify a JWT and return its payload. Throws on invalid/expired. */
export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret, VERIFY_DEFAULTS) as
    | JwtPayload
    | string;
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }
  return {
    userId: decoded.userId as string,
    email: decoded.email as string,
    role: decoded.role as string,
  };
}
