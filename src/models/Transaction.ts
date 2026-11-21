import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Vendor subscription payments only — customer pizza orders are NOT paid
 * through Stripe in this assignment, so this collection never touches them.
 */
const transactionSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    stripeSessionId: { type: String, default: "", index: true },
    stripeSubscriptionId: { type: String, default: "" },
    stripeEventId: { type: String, default: "", unique: true, sparse: true },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "usd" },

    plan: { type: String, enum: ["free", "premium"], default: "premium" },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
      index: true,
    },

    // Human-readable reason shown in the vendor dashboard table.
    description: { type: String, default: "", maxlength: 300 },
  },
  { timestamps: true },
);

transactionSchema.index({ vendorId: 1, createdAt: -1 });

export type TransactionDoc = InferSchemaType<typeof transactionSchema>;
export const Transaction: Model<TransactionDoc> =
  mongoose.models.Transaction ??
  mongoose.model<TransactionDoc>("Transaction", transactionSchema);
