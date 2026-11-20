import { model, Schema, type Document, Types } from "mongoose";
import mongoose from "mongoose";

export interface ITransaction extends Document {
  vendorId: Types.ObjectId;
  plan: "free" | "premium";
  amount: number;
  currency: string;
  stripeSessionId?: string;
  stripeSubscriptionId?: string;
  status: string;
}

const transactionSchema = new Schema<ITransaction>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: { type: String, enum: ["free", "premium"], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    stripeSessionId: { type: String },
    stripeSubscriptionId: { type: String },
    status: { type: String, required: true },
  },
  { timestamps: true }
);

export const Transaction =
  (mongoose.models.Transaction as mongoose.Model<ITransaction>) ||
  model<ITransaction>("Transaction", transactionSchema);
