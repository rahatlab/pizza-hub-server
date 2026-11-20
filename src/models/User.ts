import { model, Schema, type Document, Types } from "mongoose";
import mongoose from "mongoose";

export type UserRole = "customer" | "vendor" | "admin";

export interface IUser extends Document {
  authId: string; // better-auth user id
  email: string;
  name: string;
  role: UserRole;
  image?: string;
  blocked: boolean;
  googleId?: string;
}

const userSchema = new Schema<IUser>(
  {
    authId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ["customer", "vendor", "admin"],
      default: "customer",
      index: true,
    },
    image: { type: String },
    blocked: { type: Boolean, default: false, index: true },
    googleId: { type: String, sparse: true, index: true },
  },
  { timestamps: true }
);

export const User =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  model<IUser>("User", userSchema);
