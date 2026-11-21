import { Router } from "express";
import { z } from "zod";
import { connectDB } from "../lib/db.js";
import { badRequest, created, notFound, ok, unauthorized } from "../lib/response.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { MenuItem } from "../models/MenuItem.js";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";

export const orderRouter = Router();

const DELIVERY_FEE = 2.5;

const createSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.number().int().min(1).max(20).default(1),
      }),
    )
    .min(1, "Order needs at least one item")
    .max(20),
  deliveryDate: z.string().min(1, "Delivery date is required"),
  address: z.string().trim().min(5, "Delivery address is required").max(400),
  phone: z.string().trim().max(30).optional().default(""),
  instructions: z.string().trim().max(1000).optional().default(""),
});

const statusSchema = z.object({
  status: z.enum(["accepted", "preparing", "out_for_delivery", "delivered", "cancelled"]),
  note: z.string().trim().max(500).optional().default(""),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  placed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

/** Shape of an order returned to the client. */
export function publicOrder(order: {
  _id: { toString(): string };
  customerId: { toString(): string };
  vendorId: { toString(): string };
  items: Array<{ itemId: { toString(): string } | string; itemName: string; price: number; quantity: number; image: string }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryDate: Date;
  address: string;
  phone: string;
  instructions: string;
  status: string;
  timeline: Array<{
    status: string;
    actorId: { toString(): string };
    actorName: string;
    actorRole: string;
    note: string;
    at: Date;
    _id: { toString(): string };
  }>;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: order._id.toString(),
    customerId: order.customerId.toString(),
    vendorId: order.vendorId.toString(),
    items: order.items.map((item) => ({
      itemId: typeof item.itemId === "string" ? item.itemId : item.itemId.toString(),
      itemName: item.itemName,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
      lineTotal: Math.round(item.price * item.quantity * 100) / 100,
    })),
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    deliveryDate: order.deliveryDate,
    address: order.address,
    phone: order.phone,
    instructions: order.instructions,
    status: order.status,
    timeline: order.timeline.map((entry) => ({
      id: entry._id.toString(),
      status: entry.status,
      actorId: entry.actorId.toString(),
      actorName: entry.actorName,
      actorRole: entry.actorRole,
      note: entry.note,
      at: entry.at,
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Create order                                                         */
/* ------------------------------------------------------------------ */

orderRouter.post(
  "/",
  requireAuth,
  requireRole("customer"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const input = createSchema.parse(req.body);

    const customer = await User.findById(req.auth!.id);
    if (!customer) {
      unauthorized(res, "Account no longer exists");
      return;
    }

    // Resolve every item, enforce single-vendor orders and compute totals.
    const menuItemIds = [...new Set(input.items.map((i) => i.itemId))];
    const menuItems = await MenuItem.find({ _id: { $in: menuItemIds }, status: "approved" });
    if (menuItems.length !== menuItemIds.length) {
      badRequest(res, "One or more items are no longer available");
      return;
    }

    const itemMap = new Map(menuItems.map((m) => [m._id.toString(), m]));
    const vendorIds = new Set(menuItems.map((m) => m.vendorId.toString()));
    if (vendorIds.size > 1) {
      badRequest(res, "All items in an order must come from the same restaurant");
      return;
    }
    const vendorId = [...vendorIds][0];

    const deliveryDate = new Date(input.deliveryDate);
    if (Number.isNaN(deliveryDate.getTime())) {
      badRequest(res, "Invalid delivery date");
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deliveryDate < today) {
      badRequest(res, "Delivery date cannot be in the past");
      return;
    }

    let subtotal = 0;
    const orderItems = input.items.map((line) => {
      const item = itemMap.get(line.itemId)!;
      subtotal += item.price * line.quantity;
      return {
        itemId: item._id,
        itemName: item.itemName,
        price: item.price,
        quantity: line.quantity,
        image: item.images?.[0] ?? "",
      };
    });
    subtotal = Math.round(subtotal * 100) / 100;
    const total = Math.round((subtotal + DELIVERY_FEE) * 100) / 100;

    const order = new Order({
      customerId: customer._id,
      vendorId,
      items: orderItems,
      subtotal,
      deliveryFee: DELIVERY_FEE,
      total,
      deliveryDate,
      address: input.address,
      phone: input.phone,
      instructions: input.instructions,
      status: "placed",
      timeline: [
        {
          status: "placed",
          actorId: customer._id,
          actorName: customer.name,
          actorRole: "customer",
          note: "Order placed",
          at: new Date(),
        },
      ],
    });

    try {
      await order.save();
    } catch (error) {
      // Duplicate active order (same customer + item + delivery date).
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: number }).code === 11000
      ) {
        badRequest(
          res,
          "You already have an active order for this item on that delivery date",
        );
        return;
      }
      throw error;
    }

    return created(res, publicOrder(order), "Order placed");
  }),
);

/* ------------------------------------------------------------------ */
/* List orders                                                          */
/* ------------------------------------------------------------------ */

orderRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    await connectDB();
    const { role, id } = req.auth!;

    const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const filter: Record<string, unknown> = {};
    if (role === "customer") filter.customerId = id;
    else if (role === "vendor") filter.vendorId = id;
    // admin sees all
    if (statusFilter) filter.status = statusFilter;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return ok(res, {
      orders: orders.map((o) => publicOrder(o as unknown as Parameters<typeof publicOrder>[0])),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    });
  }),
);

/* ------------------------------------------------------------------ */
/* Order detail                                                         */
/* ------------------------------------------------------------------ */

orderRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    await connectDB();
    const order = await Order.findById(req.params.id);
    if (!order) {
      notFound(res, "Order not found");
      return;
    }

    const { role, id } = req.auth!;
    if (role === "customer" && order.customerId.toString() !== id) {
      unauthorized(res, "You can only view your own orders");
      return;
    }
    if (role === "vendor" && order.vendorId.toString() !== id) {
      unauthorized(res, "You can only view orders for your restaurant");
      return;
    }

    return ok(res, publicOrder(order));
  }),
);

/* ------------------------------------------------------------------ */
/* Update status                                                        */
/* ------------------------------------------------------------------ */

orderRouter.patch(
  "/:id/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    await connectDB();
    const { status, note } = statusSchema.parse(req.body);

    const order = await Order.findById(req.params.id);
    if (!order) {
      notFound(res, "Order not found");
      return;
    }

    const { role, id } = req.auth!;
    const isVendor = role === "vendor" && order.vendorId.toString() === id;
    const isAdmin = role === "admin";
    const isCustomer = role === "customer" && order.customerId.toString() === id;

    // Customers may only cancel their own not-yet-delivered orders.
    if (isCustomer && status !== "cancelled") {
      unauthorized(res, "Customers can only cancel an order");
      return;
    }
    if (isCustomer && !["placed", "accepted"].includes(order.status)) {
      badRequest(res, "This order can no longer be cancelled");
      return;
    }
    if (!isVendor && !isAdmin && !isCustomer) {
      unauthorized(res, "You cannot update this order");
      return;
    }
    if (isVendor || isAdmin) {
      // Vendors/admins handle the lifecycle; customers only cancel.
      if (status === "cancelled" && !isCustomer) {
        // vendors/admins can cancel too
      }
    }

    if (!ALLOWED_TRANSITIONS[order.status]?.includes(status)) {
      badRequest(res, `Cannot move an order from "${order.status}" to "${status}"`);
      return;
    }

    const actor = await User.findById(id);
    if (!actor) {
      unauthorized(res, "Account no longer exists");
      return;
    }

    order.status = status;
    order.timeline.push({
      status,
      actorId: actor._id,
      actorName: actor.name,
      actorRole: role as "admin" | "vendor" | "customer",
      note: note || defaultNote(status),
      at: new Date(),
    } as never);
    await order.save();

    return ok(res, publicOrder(order), `Order ${status.replace(/_/g, " ")}`);
  }),
);

function defaultNote(status: string): string {
  switch (status) {
    case "accepted":
      return "Order accepted by the restaurant";
    case "preparing":
      return "Kitchen started preparing";
    case "out_for_delivery":
      return "Out for delivery";
    case "delivered":
      return "Delivered to the customer";
    case "cancelled":
      return "Order cancelled";
    default:
      return "";
  }
}
