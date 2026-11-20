import { Router } from "express";
import { MenuItem } from "../models/MenuItem.js";
import { asyncHandler } from "../middleware/error.js";
import { sendSuccess, sendError } from "../lib/response.js";
import { ErrorCodes } from "../lib/response.js";

const router = Router();

/** GET /api/menu — approved+active only · search / category / location / sort / pagination */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const {
      search,
      category,
      location,
      sort = "price_asc",
      page = "1",
      limit = "12",
    } = req.query;

    const filter: Record<string, unknown> = {
      status: "approved",
      available: true,
    };
    if (category) filter.category = category;
    if (location) filter.location = new RegExp(String(location), "i");
    if (search) {
      filter.$text = { $search: String(search) };
    }

    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 12, 1), 50);
    const skip = (pageNum - 1) * limitNum;

    const sortMap: Record<string, 1 | -1> = {
      price_asc: 1,
      price_desc: -1,
    };
    const sortOption: Record<string, 1 | -1> = {};
    if (sortMap[String(sort)] !== undefined) {
      sortOption.price = sortMap[String(sort)];
    } else {
      sortOption.createdAt = -1;
    }

    const [items, total] = await Promise.all([
      MenuItem.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      MenuItem.countDocuments(filter),
    ]);

    sendSuccess(
      res,
      {
        items,
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      "Menu items fetched"
    );
  })
);

/** GET /api/menu/:id — single item · invalid id → 404 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const item = await MenuItem.findById(id).lean();
    if (!item) {
      sendError(res, "NOT_FOUND", "Menu item not found");
      return;
    }
    sendSuccess(res, item, "Menu item fetched");
  })
);

export default router;
