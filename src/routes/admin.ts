import { Router } from "express";
import { User } from "../models/User.js";
import { MenuItem } from "../models/MenuItem.js";
import { Transaction } from "../models/Transaction.js";
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

const adminAuth = [
  verifyJWT,
  loadUserFresh,
  blockCheck,
  requireRole("admin"),
];

/** GET /api/admin/users — search name/email · filter role */
router.get(
  "/users",
  ...adminAuth,
  asyncHandler(async (req, res) => {
    const { search, role, page = "1", limit = "20" } = req.query;

    const filter: Record<string, unknown> = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: new RegExp(String(search), "i") },
        { email: new RegExp(String(search), "i") },
      ];
    }

    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 50);
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(filter).select("-authId").sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      User.countDocuments(filter),
    ]);

    sendSuccess(
      res,
      { users, page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      "Users fetched"
    );
  })
);

/** PATCH /api/admin/users/:id/block — block/unblock */
router.patch(
  "/users/:id/block",
  ...adminAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { blocked } = req.body;

    const user = await User.findById(id);
    if (!user) {
      sendError(res, "NOT_FOUND", "User not found");
      return;
    }

    user.isBlocked = blocked === true || blocked === "true";
    await user.save();
    sendSuccess(res, user, `User ${user.isBlocked ? "blocked" : "unblocked"}`);
  })
);

/** GET /api/admin/menu — search/filter all items */
router.get(
  "/menu",
  ...adminAuth,
  asyncHandler(async (req, res) => {
    const { search, category, status, page = "1", limit = "20" } = req.query;

    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { itemName: new RegExp(String(search), "i") },
        { description: new RegExp(String(search), "i") },
      ];
    }

    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 50);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      MenuItem.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      MenuItem.countDocuments(filter),
    ]);

    sendSuccess(
      res,
      { items, page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      "Admin menu items fetched"
    );
  })
);

/** PATCH /api/admin/menu/:id/status — approve/reject/change status */
router.patch(
  "/menu/:id/status",
  ...adminAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "approved", "rejected", "inactive"].includes(status)) {
      sendError(res, "VALIDATION_ERROR", "Invalid status");
      return;
    }

    const item = await MenuItem.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!item) {
      sendError(res, "NOT_FOUND", "Menu item not found");
      return;
    }
    sendSuccess(res, item, `Item ${status}`);
  })
);

/** DELETE /api/admin/menu/:id — delete inappropriate */
router.delete(
  "/menu/:id",
  ...adminAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const item = await MenuItem.findByIdAndDelete(id);
    if (!item) {
      sendError(res, "NOT_FOUND", "Menu item not found");
      return;
    }
    sendSuccess(res, null, "Menu item deleted");
  })
);

/** GET /api/admin/transactions — read-only */
router.get(
  "/transactions",
  ...adminAuth,
  asyncHandler(async (req, res) => {
    const transactions = await Transaction.find()
      .populate("vendorId", "name email businessName")
      .sort({ createdAt: -1 });
    sendSuccess(res, transactions, "Transactions fetched");
  })
);

/** GET /api/admin/stats — overview counts */
router.get(
  "/stats",
  ...adminAuth,
  asyncHandler(async (req, res) => {
    const [
      totalUsers,
      totalVendors,
      totalCustomers,
      totalMenuItems,
      pendingItems,
      totalTransactions,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "vendor" }),
      User.countDocuments({ role: "customer" }),
      MenuItem.countDocuments(),
      MenuItem.countDocuments({ status: "pending" }),
      Transaction.countDocuments(),
    ]);

    sendSuccess(
      res,
      {
        totalUsers,
        totalVendors,
        totalCustomers,
        totalMenuItems,
        pendingItems,
        totalTransactions,
      },
      "Admin stats fetched"
    );
  })
);

export default router;
