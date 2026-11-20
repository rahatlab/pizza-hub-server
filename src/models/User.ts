import mongoose from "mongoose";
import { model, Schema, type Document, Types } from "mongoose";

export type UserRole = "customer" | "vendor" | "admin";

export interface IUser extends Document {
  authId: string; // better-auth user id
  email: string;
  name: string;
  image?: string;
  role: UserRole;
  isBlocked: boolean;
  businessName?: string; // vendor only
  subscriptionPlan: "free" | "premium";
  subscriptionExpiresAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    authId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    image: { type: String },
    role: {
      type: String,
      enum: ["customer", "vendor", "admin"],
      default: "customer",
      index: true,
    },
    isBlocked: { type: Boolean, default: false, index: true },
    businessName: { type: String },
    subscriptionPlan: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
      index: true,
    },
    subscriptionExpiresAt: { type: Date },
  },
  { timestamps: true }
);

export const User =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  model<IUser>("User", userSchema);
