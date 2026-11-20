import { Router } from "express";
import { MenuItem } from "../models/MenuItem.js";
import { User } from "../models/User.js";
import {
  verifyJWT,
  loadUserFresh,
  blockCheck,
  requireRole,
  type AuthUser,
} from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { sendSuccess, sendError } from "../lib/response.js";
import { ErrorCodes } from "../lib/response.js";

const router = Router();

const vendorAuth = [verifyJWT, loadUserFresh, blockCheck, requireRole("vendor")];

/** POST /api/vendor/menu — create → default pending · free plan max 3 active enforce */
router.post(
  "/",
  ...vendorAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    const {
      itemName,
      category,
      description,
      price,
      location,
      images,
    } = req.body;

    if (!itemName || !category || !description || !price || !location || !images) {
      sendError(res, "VALIDATION_ERROR", "All fields are required");
      return;
    }

    // Free plan limit: max 3 active items
    if (user.subscriptionPlan === "free") {
      const activeCount = await MenuItem.countDocuments({
        vendorId: user._id,
        status: "approved",
        available: true,
      });
      if (activeCount >= 3) {
        sendError(
          res,
          "FORBIDDEN",
          "Free plan allows max 3 active menu items. Upgrade to Premium for unlimited.",
          403
        );
        return;
      }
    }

    const item = await MenuItem.create({
      vendorId: user._id,
      itemName,
      category,
      description,
      price: Number(price),
      location,
      images: Array.isArray(images) ? images : [images],
      status: "pending",
      available: true,
    });

    sendSuccess(res, item, "Menu item created (pending approval)", 201);
  })
);

/** GET /api/vendor/menu — own items, all status */
router.get(
  "/",
  ...vendorAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    const items = await MenuItem.find({ vendorId: user._id }).sort({
      createdAt: -1,
    });
    sendSuccess(res, items, "Vendor menu items fetched");
  })
);

/** PUT /api/vendor/menu/:id — update (owner only) */
router.put(
  "/:id",
  ...vendorAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    const { id } = req.params;
    const updates = req.body;

    const item = await MenuItem.findOne({ _id: id, vendorId: user._id });
    if (!item) {
      sendError(res, "NOT_FOUND", "Menu item not found or not yours");
      return;
    }

    Object.assign(item, updates);
    if (updates.price) item.price = Number(updates.price);
    if (updates.images) item.images = Array.isArray(updates.images) ? updates.images : [updates.images];

    await item.save();
    sendSuccess(res, item, "Menu item updated");
  })
);

/** DELETE /api/vendor/menu/:id — delete (owner only) */
router.delete(
  "/:id",
  ...vendorAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    const { id } = req.params;

    const item = await MenuItem.findOneAndDelete({ _id: id, vendorId: user._id });
    if (!item) {
      sendError(res, "NOT_FOUND", "Menu item not found or not yours");
      return;
    }
    sendSuccess(res, null, "Menu item deleted");
  })
);

/** PATCH /api/vendor/menu/:id/availability — availability toggle */
router.patch(
  "/:id/availability",
  ...vendorAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    const { id } = req.params;
    const { available } = req.body;

    const item = await MenuItem.findOne({ _id: id, vendorId: user._id });
    if (!item) {
      sendError(res, "NOT_FOUND", "Menu item not found or not yours");
      return;
    }

    item.available = available === true || available === "true";
    await item.save();
    sendSuccess(res, item, "Availability updated");
  })
);

export default router;
