import { Router } from "express";
import { Review } from "../models/Review.js";
import { Order } from "../models/Order.js";
import { MenuItem } from "../models/MenuItem.js";
import {
  verifyJWT,
  loadUserFresh,
  blockCheck,
  requireRole,
  type AuthUser,
} from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { sendSuccess, sendError } from "../lib/response.js";
import { emitNewReview } from "../lib/socket.js";
import { emitNewReview } from "../lib/socket.js";

const router = Router();

const customerAuth = [
  verifyJWT,
  loadUserFresh,
  blockCheck,
  requireRole("customer"),
];

/** POST /api/reviews — customer + ordered-item only · one-per-item */
router.post(
  "/",
  ...customerAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    const { itemId, rating, comment } = req.body;

    if (!itemId || !rating || !comment) {
      sendError(res, "VALIDATION_ERROR", "itemId, rating, comment required");
      return;
    }
    const r = Number(rating);
    if (r < 1 || r > 5) {
      sendError(res, "VALIDATION_ERROR", "Rating must be 1-5");
      return;
    }

    // Must have ordered this item
    const hasOrdered = await Order.findOne({ itemId, customerId: user._id });
    if (!hasOrdered) {
      sendError(res, "FORBIDDEN", "You can only review items you ordered");
      return;
    }

    // One review per item per customer
    const existing = await Review.findOne({ itemId, customerId: user._id });
    if (existing) {
      sendError(res, "CONFLICT", "You already reviewed this item");
      return;
    }

    const item = await MenuItem.findById(itemId);
    if (!item) {
      sendError(res, "NOT_FOUND", "Menu item not found");
      return;
    }

    const review = await Review.create({
      itemId,
      customerId: user._id,
      vendorId: item.vendorId,
      rating: r,
      comment,
    });

    sendSuccess(res, review, "Review created", 201);

    // Realtime: emit to clients in the item's room
    try {
      emitNewReview(itemId, review);
    } catch {
      // Socket.io not initialized — client will poll instead
    }
  })
);

/** GET /api/reviews/:itemId — reviews list + avg */
router.get(
  "/:itemId",
  asyncHandler(async (req, res) => {
    const { itemId } = req.params;

    const reviews = await Review.find({ itemId })
      .populate("customerId", "name image")
      .sort({ createdAt: -1 });

    const avg =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    sendSuccess(
      res,
      { reviews, averageRating: Math.round(avg * 10) / 10, count: reviews.length },
      "Reviews fetched"
    );
  })
);

/** PATCH /api/reviews/:id — own review edit */
router.patch(
  "/:id",
  ...customerAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    const { id } = req.params;
    const { rating, comment } = req.body;

    const review = await Review.findOne({ _id: id, customerId: user._id });
    if (!review) {
      sendError(res, "NOT_FOUND", "Review not found or not yours");
      return;
    }

    if (rating !== undefined) {
      const r = Number(rating);
      if (r < 1 || r > 5) {
        sendError(res, "VALIDATION_ERROR", "Rating must be 1-5");
        return;
      }
      review.rating = r;
    }
    if (comment !== undefined) review.comment = comment;

    await review.save();
    sendSuccess(res, review, "Review updated");
  })
);

/** DELETE /api/reviews/:id — own review delete */
router.delete(
  "/:id",
  ...customerAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };
    const { id } = req.params;

    const review = await Review.findOneAndDelete({ _id: id, customerId: user._id });
    if (!review) {
      sendError(res, "NOT_FOUND", "Review not found or not yours");
      return;
    }
    sendSuccess(res, null, "Review deleted");

    // Realtime: emit to clients in the item's room
    try {
      emitNewReview(review.itemId.toString(), { deleted: true, reviewId: id });
    } catch {
      // Socket.io not initialized — client will poll instead
    }
  })
);

export default router;
