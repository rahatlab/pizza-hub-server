import { model, Schema, type Document, Types } from "mongoose";
import mongoose from "mongoose";

export type OrderStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface IOrder extends Document {
  itemId: Types.ObjectId;
  vendorId: Types.ObjectId;
  customerId: Types.ObjectId;
  deliveryDate: Date;
  deliveryAddress: string;
  message?: string;
  status: OrderStatus;
}

const orderSchema = new Schema<IOrder>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deliveryDate: { type: Date, required: true },
    deliveryAddress: { type: String, required: true },
    message: { type: String },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ vendorId: 1, status: 1 });
orderSchema.index({ itemId: 1, deliveryDate: 1 });

export const Order =
  (mongoose.models.Order as mongoose.Model<IOrder>) ||
  model<IOrder>("Order", orderSchema);
