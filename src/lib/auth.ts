import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { clientOrigins, env, isProduction } from "../config/env.js";
import { dbProxy } from "./mongo.js";

/**
 * Better Auth owns identity: it creates the user, hashes the password,
 * runs Google OAuth and issues the session cookie. PizzaHub's own APIs
 * authorise with a JWT minted from that session (see routes/account.ts),
 * so `role` is always re-read from the database and never trusted from a
 * browser request.
 *
 * The instance is created lazily because Better Auth builds database
 * indexes as soon as it is constructed — which requires an open Mongo
 * connection. `getAuth()` is therefore only safe after `connectDB()`.
 */

const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** Assignment rule: 6+ characters with one uppercase and one lowercase. */
export function assertPasswordStrength(value: unknown): void {
  if (typeof value !== "string" || value.length < 6) {
    throw new APIError("BAD_REQUEST", {
      message: "Password must be at least 6 characters",
    });
  }
  if (!/[A-Z]/.test(value)) {
    throw new APIError("BAD_REQUEST", {
      message: "Password needs at least one uppercase letter",
    });
  }
  if (!/[a-z]/.test(value)) {
    throw new APIError("BAD_REQUEST", {
      message: "Password needs at least one lowercase letter",
    });
  }
}

function createAuth() {
  return betterAuth({
    appName: "PizzaHub",
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,

    // The Next.js app lives on another origin, so every browser origin that
    // may call /api/auth is listed here — this doubles as the CSRF allow-list.
    trustedOrigins: clientOrigins,

    // `usePlural` makes Better Auth write to `users` / `sessions` / `accounts`,
    // exactly where Mongoose puts them.
    // `generateId: false` lets MongoDB own `_id`, so a Better Auth user and a
    // Mongoose document share the same ObjectId type.
    database: mongodbAdapter(dbProxy, { usePlural: true }),
    advanced: {
      database: { generateId: false },
      useSecureCookies: isProduction,
    },

    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 6,
      maxPasswordLength: 128,
      requireEmailVerification: false,
    },

    ...(googleConfigured
      ? {
          socialProviders: {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              prompt: "select_account" as const,
            },
          },
          // A Google account with the same verified address links to the
          // existing email/password account instead of failing with
          // "account not linked".
          account: {
            accountLinking: { enabled: true, trustedProviders: ["google"] },
          },
        }
      : {}),

    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },

    user: {
      additionalFields: {
        // Chosen on the sign-up form; enforced by the hook below.
        role: {
          type: "string",
          required: false,
          defaultValue: "customer",
          input: true,
        },
        phone: { type: "string", required: false, input: true },
        businessName: { type: "string", required: false, input: true },
        businessLocation: { type: "string", required: false, input: true },
        // Never accepted from a browser — only a verified Stripe webhook
        // promotes a vendor to premium.
        plan: {
          type: "string",
          required: false,
          defaultValue: "free",
          input: false,
        },
      },
    },

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;

        const body = (ctx.body ?? {}) as Record<string, unknown>;

        assertPasswordStrength(body.password);

        const role = body.role ?? "customer";
        if (role !== "customer" && role !== "vendor") {
          // Blocks `role: "admin"` — admin accounts come from the seed script.
          throw new APIError("BAD_REQUEST", {
            message: "Choose either a customer or a vendor account",
          });
        }

        const businessName =
          typeof body.businessName === "string" ? body.businessName.trim() : "";

        if (role === "vendor" && !businessName) {
          throw new APIError("BAD_REQUEST", {
            message: "Business name is required for a vendor account",
          });
        }

        // Normalise before the handler stores it.
        body.role = role;
        body.businessName = businessName;
      }),
    },
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;

let instance: AuthInstance | null = null;

/** Builds the Better Auth instance once. Requires a live Mongo connection. */
export function getAuth(): AuthInstance {
  instance ??= createAuth();
  return instance;
}

export const googleEnabled = googleConfigured;
