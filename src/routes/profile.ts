import { Router } from "express";
import { User } from "../models/User.js";
import {
  verifyJWT,
  loadUserFresh,
  blockCheck,
  type AuthUser,
} from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { sendSuccess, sendError } from "../lib/response.js";

const router = Router();

const auth = [verifyJWT, loadUserFresh, blockCheck];

/** PATCH /api/profile — name/image editable · role/subscription change forbidden */
router.patch(
  "/profile",
  ...auth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    const { name, image } = req.body;

    const update: Record<string, unknown> = {};
    if (name) update.name = name;
    if (image !== undefined) update.image = image;

    const updated = await User.findByIdAndUpdate(user._id, update, {
      new: true,
    }).select("name email role image isBlocked subscriptionPlan");

    if (!updated) {
      sendError(res, "NOT_FOUND", "User not found");
      return;
    }
    sendSuccess(res, updated, "Profile updated");
  })
);

export default router;
