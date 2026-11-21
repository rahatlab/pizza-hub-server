import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Review is embedded — no extra collection, no join on every card render. */
const reviewSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    customerName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const menuItemSchema = new Schema(
  {
    itemName: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 2000 },
    category: {
      type: String,
      required: true,
      enum: [
        "Classic Pizzas",
        "Vegetarian",
        "Meat Lovers",
        "Specialty / Gourmet",
        "Sides & Appetizers",
        "Beverages & Desserts",
      ],
      index: true,
    },
    price: { type: Number, required: true, min: 0 },
    location: { type: String, required: true, trim: true, maxlength: 160 },

    // Hosted on ImgBB (assignment requirement) — only https URLs allowed.
    images: {
      type: [String],
      validate: {
        validator: (urls: string[]) => urls.every((u) => /^https:\/\//.test(u)),
        message: "Menu images must be https ImgBB URLs",
      },
    },

    vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // pending → approved / rejected; inactive is the vendor toggling visibility.
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "inactive"],
      default: "pending",
      index: true,
    },

    // Denormalized so a card can render a rating without reading reviews[].
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    reviews: { type: [reviewSchema], default: [] },
  },
  { timestamps: true },
);

// Advanced search + sort (challenge requirement) runs on these.
menuItemSchema.index({ itemName: "text", description: "text", location: "text" });
menuItemSchema.index({ status: 1, price: 1 });
menuItemSchema.index({ category: 1, price: -1 });

export type MenuItemDoc = InferSchemaType<typeof menuItemSchema>;
export const MenuItem: Model<MenuItemDoc> =
  mongoose.models.MenuItem ?? mongoose.model<MenuItemDoc>("MenuItem", menuItemSchema);
