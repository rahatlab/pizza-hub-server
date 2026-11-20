import { model, Schema, type Document, Types } from "mongoose";
import mongoose from "mongoose";

export type OrderStatus = "pending" | "accepted" | "rejected" | "completed" | "cancelled";

export interface IOrder extends Document {
  customerId: Types.ObjectId;
  vendorId: Types.ObjectId;
  menuItemId: Types.ObjectId;
  status: OrderStatus;
  deliveryAddress: string;
  deliveryDate: Date;
  message?: string;
  totalPrice: number;
}

const orderSchema = new Schema<IOrder>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    menuItemId: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    deliveryAddress: { type: String, required: true },
    deliveryDate: { type: Date, required: true },
    message: { type: String },
    totalPrice: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ vendorId: 1, status: 1 });

export const Order =
  (mongoose.models.Order as mongoose.Model<IOrder>) ||
  model<IOrder>("Order", orderSchema);
