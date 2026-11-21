import { Router } from "express";
import { z } from "zod";
import { connectDB } from "../lib/db.js";
import { badRequest, ok } from "../lib/response.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { MenuItem, type MenuItemDoc } from "../models/MenuItem.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";

export const adminRouter = Router();

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
 * GET /api/admin/menu — all items across all statuses (admin only).
 */
adminRouter.get(
  "/menu",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const items = await MenuItem.find(filter).sort({ createdAt: -1 }).lean();
    // Attach vendor name
    const vendorIds = [...new Set(items.map((i) => i.vendorId.toString()))];
    const vendors = await User.find({ _id: { $in: vendorIds } }).lean();
    const vendorMap = new Map(vendors.map((v) => [v._id.toString(), v]));
    const enriched = items.map((item) => ({
      ...publicItem(item as unknown as MenuItemDoc),
      vendor: {
        id: item.vendorId.toString(),
        name: vendorMap.get(item.vendorId.toString())?.name ?? "Unknown",
        businessName: vendorMap.get(item.vendorId.toString())?.businessName ?? "",
      },
    }));
    return ok(res, { items: enriched });
  }),
);

/**
 * GET /api/admin/transactions — all subscription transactions (admin only).
 */
adminRouter.get(
  "/transactions",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const transactions = await Transaction.find({}).sort({ createdAt: -1 }).lean();
    // Attach vendor name
    const vendorIds = [...new Set(transactions.map((t) => t.vendorId.toString()))];
    const vendors = await User.find({ _id: { $in: vendorIds } }).lean();
    const vendorMap = new Map(vendors.map((v) => [v._id.toString(), v]));
    const enriched = transactions.map((t) => ({
      id: t._id.toString(),
      vendorId: t.vendorId.toString(),
      vendorName: vendorMap.get(t.vendorId.toString())?.name ?? "Unknown",
      businessName: vendorMap.get(t.vendorId.toString())?.businessName ?? "",
      stripeSessionId: t.stripeSessionId,
      amount: t.amount,
      currency: t.currency,
      plan: t.plan,
      status: t.status,
      description: t.description,
      createdAt: t.createdAt,
    }));
    return ok(res, { transactions: enriched });
  }),
);

/**
 * GET /api/admin/orders — all orders (admin only).
 */
adminRouter.get(
  "/orders",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { Order } = await import("../models/Order.js");
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
    return ok(res, { orders });
  }),
);
