import { Router } from "express";
import { Order } from "../models/Order.js";
import { MenuItem } from "../models/MenuItem.js";
import {
  verifyJWT,
  loadUserFresh,
  blockCheck,
  type AuthUser,
} from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { sendSuccess, sendError } from "../lib/response.js";

const router = Router();

const roleAuth = [verifyJWT, loadUserFresh, blockCheck];

/** GET /api/vendor/stats */
router.get(
  "/vendor/stats",
  ...roleAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    if (user.role !== "vendor") {
      sendError(res, "FORBIDDEN", "Vendor only");
      return;
    }
    const [totalItems, activeItems, pendingOrders, acceptedOrders] =
      await Promise.all([
        MenuItem.countDocuments({ vendorId: user._id }),
        MenuItem.countDocuments({ vendorId: user._id, status: "approved", available: true }),
        Order.countDocuments({ vendorId: user._id, status: "pending" }),
        Order.countDocuments({ vendorId: user._id, status: "accepted" }),
      ]);
    sendSuccess(
      res,
      { totalItems, activeItems, pendingOrders, acceptedOrders },
      "Vendor stats fetched"
    );
  })
);

/** GET /api/customer/stats */
router.get(
  "/customer/stats",
  ...roleAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    if (user.role !== "customer") {
      sendError(res, "FORBIDDEN", "Customer only");
      return;
    }
    const [total, pending, accepted, rejected] = await Promise.all([
      Order.countDocuments({ customerId: user._id }),
      Order.countDocuments({ customerId: user._id, status: "pending" }),
      Order.countDocuments({ customerId: user._id, status: "accepted" }),
      Order.countDocuments({ customerId: user._id, status: "rejected" }),
    ]);
    sendSuccess(
      res,
      { total, pending, accepted, rejected },
      "Customer stats fetched"
    );
  })
);

export default router;
