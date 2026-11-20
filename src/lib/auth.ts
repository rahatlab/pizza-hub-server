import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { MongoClient } from "mongodb";
import { env } from "../config/env.js";

let client: MongoClient | null = null;
let db: import("mongodb").Db | null = null;

export async function getAuthDb(): Promise<import("mongodb").Db> {
  if (db) return db;
  if (!client) {
    client = new MongoClient(env.mongodbUri);
    await client.connect();
  }
  db = client.db(env.mongodbDbName);
  return db;
}

/**
 * better-auth instance (MongoDB adapter + email/password + Google OAuth + JWT plugin).
 * Mounted on Express at /api/auth/* (see src/routes/auth.ts).
 * Session cookie is used ONLY to issue our own JWT at /api/auth/jwt;
 * all protected APIs verify the JWT (Authorization: Bearer) + fresh DB user load.
 */
export const auth = betterAuth({
  database: mongodbAdapter(await getAuthDb()),
  secret: env.betterAuthSecret,
  baseURL: env.betterAuthUrl,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 6,
  },
  socialProviders: {
    google: {
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
    },
  },
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    updateAge: 86400, // 24h
    cookieCache: {
      enabled: true,
      maxAge: 86400,
    },
  },
});
