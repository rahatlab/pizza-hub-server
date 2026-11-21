import { Router } from "express";
import { z } from "zod";
import { connectDB } from "../lib/db.js";
import { badRequest, created, notFound, ok, unauthorized } from "../lib/response.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { MenuItem, type MenuItemDoc } from "../models/MenuItem.js";
import { User } from "../models/User.js";

export const menuRouter = Router();

const FREE_PLAN_LIMIT = 3;

const categories = [
  "Classic Pizzas",
  "Vegetarian",
  "Meat Lovers",
  "Specialty / Gourmet",
  "Sides & Appetizers",
  "Beverages & Desserts",
] as const;

export function publicItem(item: MenuItemDoc) {
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

const createSchema = z.object({
  itemName: z.string().trim().min(2, "Item name must be at least 2 characters").max(120),
  description: z.string().trim().max(2000).optional().default(""),
  category: z.enum(categories),
  price: z.number().positive("Price must be greater than zero"),
  location: z.string().trim().min(2, "Location is required").max(160),
  images: z.array(z.string().url("Each image must be a valid URL")).max(6).optional().default([]),
});

const updateSchema = createSchema.partial().extend({
  status: z.enum(["inactive", "pending"]).optional(),
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().default(""),
});

menuRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const location = typeof req.query.location === "string" ? req.query.location.trim() : "";
    const sort = typeof req.query.sort === "string" ? req.query.sort : "newest";
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 12));

    if (category && !categories.includes(category as (typeof categories)[number])) {
      badRequest(res, "Unknown category");
      return;
    }
    if (minPrice !== undefined && (Number.isNaN(minPrice) || minPrice < 0)) {
      badRequest(res, "Invalid minPrice");
      return;
    }
    if (maxPrice !== undefined && (Number.isNaN(maxPrice) || maxPrice < 0)) {
      badRequest(res, "Invalid maxPrice");
      return;
    }

    const filter: Record<string, unknown> = { status: "approved" };
    if (category) filter.category = category;
    if (location) filter.location = { $regex: location, $options: "i" };
    if (minPrice !== undefined || maxPrice !== undefined) {
      const range: Record<string, number> = {};
      if (minPrice !== undefined) range.$gte = minPrice;
      if (maxPrice !== undefined) range.$lte = maxPrice;
      filter.price = range;
    }
    if (search) {
      filter.$text = { $search: search };
    }

    const sortSpec: Record<string, 1 | -1> =
      sort === "priceAsc"
        ? { price: 1 }
        : sort === "priceDesc"
          ? { price: -1 }
          : sort === "nameAsc"
            ? { itemName: 1 }
            : sort === "rating"
              ? { ratingAvg: -1, ratingCount: -1 }
              : { createdAt: -1 };

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      MenuItem.find(filter).sort(sortSpec).skip(skip).limit(limit).lean(),
      MenuItem.countDocuments(filter),
    ]);

    return ok(res, {
      items: items.map((item) => publicItem(item as unknown as MenuItemDoc)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  }),
);

menuRouter.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    await connectDB();
    const counts = await MenuItem.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const map = new Map(counts.map((c) => [c._id as string, c.count as number]));
    return ok(
      res,
      categories.map((name) => ({ name, count: map.get(name) ?? 0 })),
    );
  }),
);

menuRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await connectDB();
    const item = await MenuItem.findById(req.params.id);
    if (!item || item.status !== "approved") {
      notFound(res, "Menu item not found");
      return;
    }
    return ok(res, {
      ...publicItem(item),
      reviews: item.reviews.map((review) => ({
        id: review._id.toString(),
        customerId: review.customerId.toString(),
        customerName: review.customerName,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
      })),
    });
  }),
);

menuRouter.post(
  "/",
  requireAuth,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const input = createSchema.parse(req.body);

    const vendor = await User.findById(req.auth!.id);
    if (!vendor) {
      unauthorized(res, "Account no longer exists");
      return;
    }

    if (vendor.plan !== "premium") {
      const active = await MenuItem.countDocuments({
        vendorId: vendor._id,
        status: { $in: ["pending", "approved", "inactive"] },
      });
      if (active >= FREE_PLAN_LIMIT) {
        badRequest(
          res,
          "Free plan allows only 3 menu items. Upgrade to Premium for unlimited items.",
        );
        return;
      }
    }

    const item = await MenuItem.create({
      itemName: input.itemName,
      description: input.description,
      category: input.category,
      price: input.price,
      location: input.location,
      images: input.images,
      vendorId: vendor._id,
      status: "pending",
    });

    return created(res, publicItem(item), "Item submitted for approval");
  }),
);

menuRouter.patch(
  "/:id",
  requireAuth,
  requireRole("vendor", "admin"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const input = updateSchema.parse(req.body);

    const item = await MenuItem.findById(req.params.id);
    if (!item) {
      notFound(res, "Menu item not found");
      return;
    }

    if (req.auth!.role === "vendor" && item.vendorId.toString() !== req.auth!.id) {
      unauthorized(res, "You can only edit your own menu items");
      return;
    }

    Object.assign(item, input);
    await item.save();

    return ok(res, publicItem(item), "Item updated");
  }),
);

menuRouter.delete(
  "/:id",
  requireAuth,
  requireRole("vendor", "admin"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const item = await MenuItem.findById(req.params.id);
    if (!item) {
      notFound(res, "Menu item not found");
      return;
    }
    if (req.auth!.role === "vendor" && item.vendorId.toString() !== req.auth!.id) {
      unauthorized(res, "You can only delete your own menu items");
      return;
    }

    await item.deleteOne();
    return ok(res, { id: item._id.toString() }, "Item deleted");
  }),
);

menuRouter.patch(
  "/:id/moderate",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { status } = z
      .object({ status: z.enum(["approved", "rejected"]) })
      .parse(req.body);

    const item = await MenuItem.findById(req.params.id);
    if (!item) {
      notFound(res, "Menu item not found");
      return;
    }

    item.status = status;
    await item.save();

    return ok(res, publicItem(item), `Item ${status}`);
  }),
);

menuRouter.post(
  "/:id/reviews",
  requireAuth,
  requireRole("customer"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const input = reviewSchema.parse(req.body);

    const item = await MenuItem.findById(req.params.id);
    if (!item || item.status !== "approved") {
      notFound(res, "Menu item not found");
      return;
    }

    const customer = await User.findById(req.auth!.id);
    if (!customer) {
      unauthorized(res, "Account no longer exists");
      return;
    }

    const already = item.reviews.some(
      (review) => review.customerId.toString() === customer._id.toString(),
    );
    if (already) {
      badRequest(res, "You have already reviewed this item");
      return;
    }

    item.reviews.push({
      customerId: customer._id,
      customerName: customer.name,
      rating: input.rating,
      comment: input.comment,
    } as never);

    const count = item.reviews.length;
    const sum = item.reviews.reduce((acc, review) => acc + review.rating, 0);
    item.ratingCount = count;
    item.ratingAvg = Math.round((sum / count) * 10) / 10;

    await item.save();

    return created(res, {
      ratingAvg: item.ratingAvg,
      ratingCount: item.ratingCount,
    }, "Review added");
  }),
);
