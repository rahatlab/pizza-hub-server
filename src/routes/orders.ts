import { Router } from "express";
import { Order } from "../models/Order.js";
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

const router = Router();

const customerAuth = [
  verifyJWT,
  loadUserFresh,
  blockCheck,
  requireRole("customer"),
];

/** POST /api/orders — customer role · auto-detect customer/vendor/item · status pending */
router.post(
  "/orders",
  ...customerAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    const { itemId, deliveryDate, deliveryAddress, message } = req.body;

    if (!itemId || !deliveryDate || !deliveryAddress) {
      sendError(res, "VALIDATION_ERROR", "itemId, deliveryDate, deliveryAddress required");
      return;
    }

    // Admin cannot place orders
    if (user.role === "admin") {
      sendError(res, "FORBIDDEN", "Admin cannot place orders");
      return;
    }

    const item = await MenuItem.findById(itemId);
    if (!item) {
      sendError(res, "NOT_FOUND", "Menu item not found");
      return;
    }

    // Only approved + active items orderable
    if (item.status !== "approved" || !item.available) {
      sendError(res, "FORBIDDEN", "Item is not available for ordering");
      return;
    }

    // Vendor cannot order their own item
    if (item.vendorId.toString() === user._id) {
      sendError(res, "FORBIDDEN", "You cannot order your own item");
      return;
    }

    // Duplicate active order check (same item + delivery date, pending/accepted)
    const existing = await Order.findOne({
      itemId,
      deliveryDate: new Date(deliveryDate),
      status: { $in: ["pending", "accepted"] },
    });
    if (existing) {
      sendError(res, "CONFLICT", "You already have an active order for this item on this date");
      return;
    }

    const order = await Order.create({
      itemId,
      vendorId: item.vendorId,
      customerId: user._id,
      deliveryDate: new Date(deliveryDate),
      deliveryAddress,
      message,
      status: "pending",
    });

    sendSuccess(res, order, "Order placed", 201);
  })
);

/** GET /api/customer/orders — own orders */
router.get(
  "/customer/orders",
  ...customerAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    const orders = await Order.find({ customerId: user._id })
      .populate("itemId", "itemName category price images vendorId")
      .sort({ createdAt: -1 });
    sendSuccess(res, orders, "Customer orders fetched");
  })
);

/** PATCH /api/customer/orders/:id/cancel — pending only */
router.patch(
  "/customer/orders/:id/cancel",
  ...customerAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, customerId: user._id });
    if (!order) {
      sendError(res, "NOT_FOUND", "Order not found or not yours");
      return;
    }
    if (order.status !== "pending") {
      sendError(res, "FORBIDDEN", "Only pending orders can be cancelled");
      return;
    }

    order.status = "cancelled";
    await order.save();
    sendSuccess(res, order, "Order cancelled");
  })
);

export default router;
