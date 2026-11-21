import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * One step of the order lifecycle. `actorName`/`actorRole` record WHO made
 * the change — the assignment asks the timeline to show who did what, not
 * only what happened.
 */
const timelineEntrySchema = new Schema(
  {
    status: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, enum: ["admin", "vendor", "customer"], required: true },
    note: { type: String, default: "", maxlength: 500 },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const orderItemSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },
    itemName: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    image: { type: String, default: "" },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    items: { type: [orderItemSchema], required: true, validate: [(v: unknown[]) => v.length > 0, "Order needs at least one item"] },

    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },

    deliveryDate: { type: Date, required: true, index: true },
    address: { type: String, required: true, maxlength: 400 },
    phone: { type: String, default: "", maxlength: 30 },
    instructions: { type: String, default: "", maxlength: 1000 },

    status: {
      type: String,
      enum: [
        "placed",
        "accepted",
        "preparing",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      default: "placed",
      index: true,
    },

    timeline: { type: [timelineEntrySchema], default: [] },
  },
  { timestamps: true },
);

/**
 * Assignment rule: the same customer cannot have two ACTIVE orders for the
 * same item on the same delivery date. A partial unique index enforces it
 * at the database level so the check survives concurrent requests.
 */
orderSchema.index(
  { customerId: 1, "items.itemId": 1, deliveryDate: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["placed", "accepted", "preparing", "out_for_delivery"] } },
    name: "one_active_order_per_item_per_day",
  },
);

orderSchema.index({ vendorId: 1, status: 1, createdAt: -1 });
orderSchema.index({ customerId: 1, createdAt: -1 });

export type OrderDoc = InferSchemaType<typeof orderSchema>;
export const Order: Model<OrderDoc> =
  mongoose.models.Order ?? mongoose.model<OrderDoc>("Order", orderSchema);
