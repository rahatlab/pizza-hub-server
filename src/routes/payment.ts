import { Router } from "express";
import express from "express";
import Stripe from "stripe";
import { User } from "../models/User.js";
import { Transaction } from "../models/Transaction.js";
import {
  verifyJWT,
  loadUserFresh,
  blockCheck,
  requireRole,
  type AuthUser,
} from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { sendSuccess, sendError } from "../lib/response.js";
import { env } from "../config/env.js";

const router = Router();

const stripe = new Stripe(env.stripeSecretKey, {
  apiVersion: "2025-02-24.acacia",
});

/** POST /api/payment/checkout — vendor creates Stripe Checkout session */
router.post(
  "/checkout",
  verifyJWT,
  loadUserFresh,
  blockCheck,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser & { _id: string };

    if (!env.stripeSecretKey || !env.stripePriceId) {
      sendError(
        res,
        "INTERNAL_SERVER_ERROR",
        "Stripe not configured on server"
      );
      return;
    }

    // Check if already premium and not expired
    const userDoc = await User.findById(user._id).select(
      "subscriptionPlan subscriptionExpiresAt"
    );
    if (
      userDoc?.subscriptionPlan === "premium" &&
      userDoc.subscriptionExpiresAt &&
      new Date(userDoc.subscriptionExpiresAt) > new Date()
    ) {
      sendError(res, "CONFLICT", "You already have an active premium subscription");
      return;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: env.stripePriceId, quantity: 1 }],
      customer_email: user.email,
      metadata: { vendorId: user._id.toString() },
      success_url: `${env.clientUrl}/payment/success`,
      cancel_url: `${env.clientUrl}/payment/cancel`,
    });

    sendSuccess(
      res,
      { url: session.url, sessionId: session.id },
      "Checkout session created"
    );
  })
);

export default router;

/** Stripe webhook — raw body verification (mounted separately in app.ts) */
export const webhookRouter = Router();

webhookRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig || !env.stripeWebhookSecret) {
      sendError(res, "UNAUTHORIZED", "Webhook signature missing");
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig as string,
        env.stripeWebhookSecret
      );
    } catch {
      sendError(res, "UNAUTHORIZED", "Invalid webhook signature");
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const vendorId = session.metadata?.vendorId;
      if (!vendorId) {
        sendError(res, "INTERNAL_SERVER_ERROR", "No vendorId in session");
        return;
      }

      // Save transaction
      await Transaction.create({
        vendorId,
        plan: "premium",
        amount: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        stripeSessionId: session.id,
        stripeSubscriptionId: session.subscription as string,
        status: "completed",
      });

      // Activate premium (30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await User.findByIdAndUpdate(vendorId, {
        subscriptionPlan: "premium",
        subscriptionExpiresAt: expiresAt,
      });
    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const vendorId = subscription.metadata?.vendorId;
      if (vendorId) {
        await User.findByIdAndUpdate(vendorId, {
          subscriptionPlan: "free",
          subscriptionExpiresAt: undefined,
        });
      }
    }

    res.status(200).json({ received: true });
  })
);
