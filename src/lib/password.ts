import bcrypt from "bcryptjs";

const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/** Timing-safe comparison; returns false for any malformed hash. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash);
}
