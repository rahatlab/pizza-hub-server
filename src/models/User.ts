import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * `InferSchemaType` does not know about `_id` or the timestamps Mongoose
 * adds at runtime, so they are declared explicitly — otherwise every
 * `user._id.toString()` call fails to type-check.
 */
export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Every account on the platform. `role` drives every authorization
 * decision downstream, and it is only ever set server-side:
 *   - public sign-up can create `customer` or `vendor`
 *   - `admin` is created by the seed script only
 */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Better Auth keeps the password hash in its own `accounts` collection,
    // so this document never holds a credential.
    emailVerified: { type: Boolean, default: false },

    role: {
      type: String,
      enum: ["admin", "vendor", "customer"],
      default: "customer",
      index: true,
    },

    image: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },

    /* --- vendor-only fields --- */
    businessName: { type: String, default: "", trim: true },
    businessLocation: { type: String, default: "", trim: true },
    // Free plan allows at most 3 ACTIVE menu items (assignment rule).
    plan: { type: String, enum: ["free", "premium"], default: "free" },
    stripeCustomerId: { type: String, default: "" },
    stripeSubscriptionId: { type: String, default: "" },
    // Set ONLY by a verified Stripe webhook — never by a client request.
    premiumUntil: { type: Date, default: null },

    /* --- customer-only fields --- */
    favoriteItemIds: [{ type: Schema.Types.ObjectId, ref: "MenuItem" }],
  },
  { timestamps: true },
);

userSchema.index({ role: 1, createdAt: -1 });

export const User: Model<UserDoc> =
  mongoose.models.User ?? mongoose.model<UserDoc>("User", userSchema);
