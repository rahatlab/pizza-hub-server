import { model, Schema, type Document, Types } from "mongoose";

export type MenuCategory =
  | "Classic Pizzas"
  | "Vegetarian"
  | "Meat Lovers"
  | "Specialty/Gourmet"
  | "Sides & Appetizers"
  | "Beverages & Desserts";

export type MenuStatus = "pending" | "approved" | "rejected" | "inactive";

export interface IMenuItem extends Document {
  vendorId: Types.ObjectId;
  itemName: string;
  category: MenuCategory;
  description: string;
  price: number;
  location: string;
  images: string[]; // ImgBB URLs
  status: MenuStatus;
  available: boolean;
}

const menuItemSchema = new Schema<IMenuItem>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    itemName: { type: String, required: true, index: "text" },
    category: {
      type: String,
      enum: [
        "Classic Pizzas",
        "Vegetarian",
        "Meat Lovers",
        "Specialty/Gourmet",
        "Sides & Appetizers",
        "Beverages & Desserts",
      ],
      required: true,
      index: true,
    },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    location: { type: String, required: true },
    images: [{ type: String, required: true }],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "inactive"],
      default: "pending",
      index: true,
    },
    available: { type: Boolean, default: true },
  },
  { timestamps: true }
);

menuItemSchema.index({ status: 1, category: 1, location: 1 });
menuItemSchema.index({ status: 1, available: 1 });

export const MenuItem =
  (mongoose.models.MenuItem as mongoose.Model<IMenuItem>) ||
  model<IMenuItem>("MenuItem", menuItemSchema);
