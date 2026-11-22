import { Router } from "express";
import Stripe from "stripe";
import { connectDB } from "../lib/db.js";
import { badRequest, ok } from "../lib/response.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { User } from "../models/User.js";
import { Transaction } from "../models/Transaction.js";
import { env } from "../config/env.js";

export const stripeRouter = Router();

const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY)
  : null;

/**
 * POST /api/stripe/checkout — vendor starts a Premium subscription.
 */
stripeRouter.post(
  "/checkout",
  requireAuth,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    if (!stripe || !env.STRIPE_PRICE_ID) {
      badRequest(res, "Stripe is not configured on this server");
      return;
    }
    await connectDB();
    const vendor = await User.findById(req.auth!.id);
    if (!vendor) {
      badRequest(res, "Account no longer exists");
      return;
    }
    if (vendor.plan === "premium") {
      badRequest(res, "You are already on the Premium plan");
      return;
    }

    // Reuse or create a Stripe customer.
    let customerId = vendor.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: vendor.email,
        name: vendor.businessName || vendor.name,
        metadata: { userId: vendor._id.toString() },
      });
      customerId = customer.id;
      vendor.stripeCustomerId = customerId;
      await vendor.save();
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${env.APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/payment-cancel`,
      metadata: { userId: vendor._id.toString() },
      subscription_data: {
        metadata: { userId: vendor._id.toString() },
      },
    });

    return ok(res, { url: session.url, sessionId: session.id }, "Checkout session created");
  }),
);

/**
 * POST /api/stripe/webhook — Stripe calls this with subscription events.
 *
 * IMPORTANT: this route must receive the RAW body (registered before
 * express.json() in app.ts) so the signature can be verified.
 */
stripeRouter.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
      res.status(503).send("Stripe not configured");
      return;
    }

    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      res.status(400).send("Missing stripe-signature header");
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      console.error("✖ Stripe webhook signature verification failed:", error);
      res.status(400).send("Invalid signature");
      return;
    }

    await connectDB();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) break;

        // Validate ObjectId format
        if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
          console.log("⚠ Webhook: invalid userId format, skipping");
          break;
        }

        const vendor = await User.findById(userId);
        if (!vendor) break;

        // Idempotency: skip if this session was already processed.
        const existing = await Transaction.findOne({ stripeSessionId: session.id });
        if (existing) break;

        vendor.plan = "premium";
        vendor.stripeCustomerId = session.customer as string;
        vendor.stripeSubscriptionId = session.subscription as string;
        vendor.premiumUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await vendor.save();

        await Transaction.create({
          vendorId: vendor._id,
          stripeSessionId: session.id,
          stripeSubscriptionId: session.subscription as string,
          stripeEventId: event.id,
          amount: (session.amount_total ?? 0) / 100,
          currency: session.currency ?? "usd",
          plan: "premium",
          status: "completed",
          description: "Premium subscription - monthly",
        });

        console.log(`✓ Vendor ${vendor.email} upgraded to Premium`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const vendor = await User.findOne({ stripeSubscriptionId: subscription.id });
        if (!vendor) break;

        vendor.plan = "free";
        vendor.premiumUntil = null;
        vendor.stripeSubscriptionId = "";
        await vendor.save();

        await Transaction.create({
          vendorId: vendor._id,
          stripeSubscriptionId: subscription.id,
          stripeEventId: event.id,
          amount: 0,
          currency: "usd",
          plan: "free",
          status: "refunded",
          description: "Subscription cancelled",
        });

        console.log(`✓ Vendor ${vendor.email} downgraded to Free`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const vendor = await User.findOne({ stripeCustomerId: customerId });
        if (!vendor) break;

        await Transaction.create({
          vendorId: vendor._id,
          stripeEventId: event.id,
          amount: (invoice.amount_due ?? 0) / 100,
          currency: invoice.currency ?? "usd",
          plan: "premium",
          status: "failed",
          description: "Premium payment failed",
        });

        console.log(`⚠ Payment failed for vendor ${vendor.email}`);
        break;
      }

      default:
        // Unhandled event type — acknowledge anyway.
        break;
    }

    res.status(200).json({ received: true });
  }),
);

/**
 * GET /api/stripe/status — check if Stripe is configured.
 */
stripeRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    return ok(res, {
      configured: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID),
      publishableKey: env.STRIPE_PUBLISHABLE_KEY || env.PUBLISH_KEY || "",
    });
  }),
);
