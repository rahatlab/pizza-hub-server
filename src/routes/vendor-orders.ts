import { Router } from "express";
import { Order } from "../models/Order.js";
import {
  verifyJWT,
  loadUserFresh,
  blockCheck,
  requireRole,
  type AuthUser,
} from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { sendSuccess, sendError } from "../lib/response.js";

const router = Router();

const vendorAuth = [
  verifyJWT,
  loadUserFresh,
  blockCheck,
  requireRole("vendor"),
];

/** GET /api/vendor/orders — received orders */
router.get(
  "/",
  ...vendorAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    const orders = await Order.find({ vendorId: user._id })
      .populate("itemId customerId", "name email itemName category price")
      .sort({ createdAt: -1 });
    sendSuccess(res, orders, "Vendor orders fetched");
  })
);

/** PATCH /api/vendor/orders/:id — accept/reject · pending only, once · owner only */
router.patch(
  "/:id",
  ...vendorAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    const { id } = req.params;
    const { status } = req.body;

    if (!["accepted", "rejected"].includes(status)) {
      sendError(res, "VALIDATION_ERROR", "Status must be accepted or rejected");
      return;
    }

    const order = await Order.findOne({ _id: id, vendorId: user._id });
    if (!order) {
      sendError(res, "NOT_FOUND", "Order not found or not yours");
      return;
    }
    if (order.status !== "pending") {
      sendError(res, "FORBIDDEN", "Order already handled (accepted/rejected/cancelled)");
      return;
    }

    order.status = status;
    await order.save();
    sendSuccess(res, order, `Order ${status}`);
  })
);

export default router;
