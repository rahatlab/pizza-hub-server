import { Router } from "express";
import { z } from "zod";
import { connectDB } from "../lib/db.js";
import { badRequest, notFound, ok, unauthorized } from "../lib/response.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { MenuItem, type MenuItemDoc } from "../models/MenuItem.js";
import { User } from "../models/User.js";

export const vendorRouter = Router();

// Re-export publicItem from menu router by redefining here for clarity
function publicItem(item: MenuItemDoc) {
  return {
    id: item._id.toString(),
    itemName: item.itemName,
    description: item.description,
    category: item.category,
    price: item.price,
    location: item.location,
    images: item.images ?? [],
    vendorId: item.vendorId.toString(),
    status: item.status,
    ratingAvg: item.ratingAvg ?? 0,
    ratingCount: item.ratingCount ?? 0,
    reviewCount: item.reviews?.length ?? 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/**
 * GET /api/vendor/menu — the vendor's own items (all statuses).
 */
vendorRouter.get(
  "/menu",
  requireAuth,
  requireRole("vendor", "admin"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const filter: Record<string, unknown> = {};
    if (req.auth!.role === "vendor") filter.vendorId = req.auth!.id;
    // admin can pass ?vendorId=
    if (req.auth!.role === "admin" && typeof req.query.vendorId === "string") {
      filter.vendorId = req.query.vendorId;
    }

    const items = await MenuItem.find(filter).sort({ createdAt: -1 }).lean();
    const vendor = req.auth!.role === "vendor" ? await User.findById(req.auth!.id) : null;

    return ok(res, {
      items: items.map((item) => publicItem(item as unknown as MenuItemDoc)),
      plan: vendor?.plan ?? "free",
      activeCount: items.filter((i) => ["pending", "approved", "inactive"].includes(i.status)).length,
      limit: vendor?.plan === "premium" ? null : 3,
    });
  }),
);

/**
 * GET /api/vendor/orders — alias for vendor's orders (convenience).
 */
vendorRouter.get(
  "/orders",
  requireAuth,
  requireRole("vendor", "admin"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { Order } = await import("../models/Order.js");
    const filter: Record<string, unknown> = {};
    if (req.auth!.role === "vendor") filter.vendorId = req.auth!.id;
    if (req.auth!.role === "admin" && typeof req.query.vendorId === "string") {
      filter.vendorId = req.query.vendorId;
    }
    const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
    if (statusFilter) filter.status = statusFilter;

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
    return ok(res, { orders });
  }),
);

/**
 * GET /api/vendor/stats — quick counts for the vendor dashboard.
 */
vendorRouter.get(
  "/stats",
  requireAuth,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const vendorId = req.auth!.id;
    const { Order } = await import("../models/Order.js");

    const [totalItems, activeItems, pendingItems, totalOrders, pendingOrders, deliveredOrders] =
      await Promise.all([
        MenuItem.countDocuments({ vendorId }),
        MenuItem.countDocuments({ vendorId, status: { $in: ["pending", "approved", "inactive"] } }),
        MenuItem.countDocuments({ vendorId, status: "pending" }),
        Order.countDocuments({ vendorId }),
        Order.countDocuments({ vendorId, status: { $in: ["placed", "accepted", "preparing", "out_for_delivery"] } }),
        Order.countDocuments({ vendorId, status: "delivered" }),
      ]);

    return ok(res, {
      totalItems,
      activeItems,
      pendingItems,
      totalOrders,
      pendingOrders,
      deliveredOrders,
    });
  }),
);

/**
 * GET /api/admin/users — list all users (admin only).
 */
vendorRouter.get(
  "/admin/users",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const role = typeof req.query.role === "string" ? req.query.role : undefined;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const filter: Record<string, unknown> = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    const users = await User.find(filter).sort({ createdAt: -1 }).lean();
    return ok(res, {
      users: users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        image: u.image ?? "",
        plan: u.plan,
        isBlocked: u.isBlocked ?? false,
        createdAt: u.createdAt,
        businessName: u.businessName,
      })),
    });
  }),
);

/**
 * GET /api/admin/stats — platform overview.
 */
vendorRouter.get(
  "/admin/stats",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { Order } = await import("../models/Order.js");
    const [totalUsers, totalVendors, totalCustomers, totalItems, pendingItems, totalOrders, totalTransactions] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: "vendor" }),
        User.countDocuments({ role: "customer" }),
        MenuItem.countDocuments(),
        MenuItem.countDocuments({ status: "pending" }),
        Order.countDocuments(),
        (await import("../models/Transaction.js")).Transaction.countDocuments(),
      ]);
    return ok(res, {
      totalUsers,
      totalVendors,
      totalCustomers,
      totalItems,
      pendingItems,
      totalOrders,
      totalTransactions,
    });
  }),
);

/**
 * PATCH /api/admin/users/:id/role — change a user's role (admin only).
 */
vendorRouter.patch(
  "/admin/users/:id/role",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { role } = z.object({ role: z.enum(["admin", "vendor", "customer"]) }).parse(req.body);
    const user = await User.findById(req.params.id);
    if (!user) {
      notFound(res, "User not found");
      return;
    }
    // Prevent demoting the last admin
    if (user.role === "admin" && role !== "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        badRequest(res, "Cannot remove the last admin");
        return;
      }
    }
    user.role = role;
    await user.save();
    return ok(res, { id: user._id.toString(), role: user.role }, "Role updated");
  }),
);

/**
 * PATCH /api/admin/users/:id/block — block/unblock a user (admin only).
 */
vendorRouter.patch(
  "/admin/users/:id/block",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { blocked } = z.object({ blocked: z.boolean() }).parse(req.body);
    const user = await User.findById(req.params.id);
    if (!user) {
      notFound(res, "User not found");
      return;
    }
    if (user.role === "admin") {
      badRequest(res, "Admin accounts cannot be blocked");
      return;
    }
    user.isBlocked = blocked;
    await user.save();
    return ok(res, { id: user._id.toString(), isBlocked: user.isBlocked }, blocked ? "User blocked" : "User unblocked");
  }),
);
