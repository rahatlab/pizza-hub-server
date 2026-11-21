import { Router } from "express";
import { connectDB } from "../lib/db.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { badRequest, conflict, created, ok, unauthorized } from "../lib/response.js";
import { signToken } from "../lib/token.js";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth } from "../middleware/auth.js";
import { User, type UserDoc } from "../models/User.js";
import {
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "../schemas/auth.schema.js";

export const authRouter = Router();

/** Never leak the hash, and never send `password` to a client. */
function publicUser(user: UserDoc) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    image: user.image,
    phone: user.phone,
    address: user.address,
    businessName: user.businessName,
    businessLocation: user.businessLocation,
    plan: user.plan,
    premiumUntil: user.premiumUntil,
    favoriteItemIds: user.favoriteItemIds?.map((id) => id.toString()) ?? [],
    createdAt: user.createdAt,
  };
}

/**
 * POST /api/auth/register
 *
 * Public endpoint. Can create a customer or a vendor — never an admin,
 * because `role` is validated against ["customer","vendor"] upstream and
 * an unknown role would be rejected by Zod before reaching the database.
 */
authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    await connectDB();
    const input = registerSchema.parse(req.body);

    const existing = await User.findOne({ email: input.email }).lean();
    if (existing) {
      conflict(res, "An account with that email already exists");
      return;
    }

    // A vendor must describe the shop they are signing up.
    if (input.role === "vendor" && !input.businessName) {
      badRequest(res, "Business name is required for a vendor account");
      return;
    }

    const user = await User.create({
      name: input.name,
      email: input.email,
      password: await hashPassword(input.password),
      role: input.role,
      businessName: input.businessName ?? "",
      businessLocation: input.businessLocation ?? "",
    });

    const token = signToken({
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    return created(res, { token, user: publicUser(user) }, "Account created");
  }),
);

/** POST /api/auth/login */
authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    await connectDB();
    const input = loginSchema.parse(req.body);

    // `.select("+password")` because the schema hides it by default.
    const user = await User.findOne({ email: input.email }).select("+password");
    if (!user) {
      unauthorized(res, "Incorrect email or password");
      return;
    }

    const valid = await verifyPassword(input.password, user.password);
    if (!valid) {
      unauthorized(res, "Incorrect email or password");
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

/** GET /api/auth/me — used by the client to restore a session on reload. */
authRouter.get(
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

/** PATCH /api/auth/profile */
authRouter.patch(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    await connectDB();
    const input = updateProfileSchema.parse(req.body);

    const user = await User.findByIdAndUpdate(
      req.auth!.id,
      { $set: input },
      { new: true, runValidators: true },
    );
    if (!user) {
      unauthorized(res, "Account no longer exists");
      return;
    }

    return ok(res, { user: publicUser(user) }, "Profile updated");
  }),
);

/** POST /api/auth/logout — stateless JWT, so this is client-side only. */
authRouter.post("/logout", (_req, res) => {
  ok(res, { ok: true }, "Signed out");
});

/** Re-exported so route registration stays in one place. */
export const authPublicPaths = ["/api/auth/login", "/api/auth/register", "/api/auth/logout"];
