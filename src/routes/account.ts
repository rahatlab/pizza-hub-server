import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { getAuth } from "../lib/auth.js";
import { connectDB } from "../lib/db.js";
import { badRequest, ok, unauthorized } from "../lib/response.js";
import { signToken } from "../lib/token.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { User, type UserDoc } from "../models/User.js";
import { updateProfileSchema } from "../schemas/auth.schema.js";

export const accountRouter = Router();

/** The only shape of a user that ever leaves the server. */
export function publicUser(user: UserDoc) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    image: user.image ?? "",
    phone: user.phone ?? "",
    address: user.address ?? "",
    businessName: user.businessName ?? "",
    businessLocation: user.businessLocation ?? "",
    plan: user.plan,
    premiumUntil: user.premiumUntil ?? null,
    favoriteItemIds: (user.favoriteItemIds ?? []).map((id) => id.toString()),
    createdAt: user.createdAt,
  };
}

/**
 * POST /api/account/token
 *
 * Better Auth signs the user in and sets its own session cookie. The client
 * then swaps that session for the JWT every other PizzaHub API expects.
 * Minting the token here (server-side, from the database record) is what
 * makes the role claim trustworthy.
 */
accountRouter.post(
  "/token",
  asyncHandler(async (req, res) => {
    await connectDB();

    const session = await getAuth().api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user) {
      unauthorized(res, "Sign in to continue");
      return;
    }

    const user = await User.findById(session.user.id);
    if (!user) {
      unauthorized(res, "Account no longer exists");
      return;
    }

    const token = signToken({
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    return ok(res, { token, user: publicUser(user) }, "Signed in");
  }),
);

/** GET /api/account/me — restores a session after a page reload. */
accountRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    await connectDB();
    const user = await User.findById(req.auth!.id);
    if (!user) {
      unauthorized(res, "Account no longer exists");
      return;
    }
    return ok(res, { user: publicUser(user) });
  }),
);

/** PATCH /api/account/profile */
accountRouter.patch(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    await connectDB();
    const input = updateProfileSchema.parse(req.body);

    const user = await User.findById(req.auth!.id);
    if (!user) {
      unauthorized(res, "Account no longer exists");
      return;
    }

    // Customers have no shop, and only vendors may rename one.
    if (user.role !== "vendor") {
      delete input.businessName;
      delete input.businessLocation;
    }
    if (input.businessName !== undefined && !input.businessName) {
      badRequest(res, "Business name cannot be empty");
      return;
    }

    user.set(input);
    await user.save();

    return ok(res, { user: publicUser(user) }, "Profile updated");
  }),
);

/**
 * POST /api/account/logout
 *
 * Clears the Better Auth session cookie and nothing else — the JWT is
 * stateless, so the client drops its copy.
 */
accountRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    // Best effort: an expired session is not an error worth surfacing.
    await getAuth()
      .api.signOut({ headers: fromNodeHeaders(req.headers) })
      .catch(() => undefined);

    return ok(res, { ok: true }, "Signed out");
  }),
);
