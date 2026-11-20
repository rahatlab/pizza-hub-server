import { model, Schema, type Document, Types } from "mongoose";
import mongoose from "mongoose";

export interface IReview extends Document {
  itemId: Types.ObjectId;
  customerId: Types.ObjectId;
  vendorId: Types.ObjectId;
  rating: number;
  comment: string;
}

const reviewSchema = new Schema<IReview>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
  },
  { timestamps: true }
);

reviewSchema.index({ itemId: 1, customerId: 1 }, { unique: true });
reviewSchema.index({ itemId: 1 });
reviewSchema.index({ vendorId: 1 });

export const Review =
  (mongoose.models.Review as mongoose.Model<IReview>) ||
  model<IReview>("Review", reviewSchema);
