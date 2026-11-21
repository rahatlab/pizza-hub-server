import "dotenv/config";
import { z } from "zod";

/**
 * Single source of truth for environment variables.
 * Fails fast at boot with a readable message instead of
 * throwing `undefined` somewhere deep in a request handler.
 *
 * Secrets are read from process.env only — never hardcoded,
 * never committed (see .gitignore / .env.example).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_ORIGIN: z.string().default("http://localhost:3000"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.string().min(1).default("pizzahub"),

  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url(),
  APP_URL: z.string().url(),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("1d"),

  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_PRICE_ID: z.string().optional().default(""),

  IMGBB_API_KEY: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.error(`\n✖ Invalid environment variables:\n${issues}\n`);
  console.error("Copy .env.example to .env and fill in the missing values.\n");
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

/** Allowed CORS origins, derived from a single comma-separated env var. */
export const clientOrigins = env.CLIENT_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
