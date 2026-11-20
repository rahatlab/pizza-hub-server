import { model, Schema, type Document, Types } from "mongoose";
import mongoose from "mongoose";

export type MenuStatus = "pending" | "approved" | "rejected";
export type MenuCategory =
  | "pizza"
  | "burger"
  | "pasta"
  | "sides"
  | "desserts"
  | "beverages";

export interface IMenuItem extends Document {
  vendorId: Types.ObjectId;
  name: string;
  description: string;
  price: number; // in minor currency units (taka cents equivalent)
  category: MenuCategory;
  imageUrl: string;
  available: boolean;
  status: MenuStatus;
  location?: string; // vendor service area
}

const menuItemSchema = new Schema<IMenuItem>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, index: "text" },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ["pizza", "burger", "pasta", "sides", "desserts", "beverages"],
      required: true,
      index: true,
    },
    imageUrl: { type: String, required: true },
    available: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    location: { type: String },
  },
  { timestamps: true }
);

menuItemSchema.index({ status: 1, available: 1 });

export const MenuItem =
  (mongoose.models.MenuItem as mongoose.Model<IMenuItem>) ||
  model<IMenuItem>("MenuItem", menuItemSchema);
