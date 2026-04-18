import { v } from "convex/values"
import Stripe from "stripe"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server"
import { ErrorCode, throwError } from "./errors"
import { getWebUrl } from "./helpers"

async function hasCoachClientRelationship(
  ctx: QueryCtx,
  coachId: string,
  clientId: string
): Promise<boolean> {
  const booking = await ctx.db
    .query("coachBookings")
    .withIndex("by_coach", (q) => q.eq("coachId", coachId))
    .filter((f) => f.eq(f.field("clientId"), clientId))
    .first()
  if (booking) {
    return true
  }

  const conv = await ctx.db
    .query("conversations")
    .withIndex("by_participants", (q) => q.eq("renterId", clientId).eq("ownerId", coachId))
    .filter((f) => f.eq(f.field("conversationType"), "coach"))
    .first()
  return !!conv
}

export const getById = query({
  args: { id: v.id("coachInvoices") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }
    const invoice = await ctx.db.get(args.id)
    if (!invoice) {
      return null
    }
    if (invoice.coachId !== identity.subject && invoice.clientId !== identity.subject) {
      return null
    }
    return invoice
  },
})

export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity || identity.subject !== args.userId) {
      return []
    }

    const [asCoach, asClient] = await Promise.all([
      ctx.db
        .query("coachInvoices")
        .withIndex("by_coach", (q) => q.eq("coachId", args.userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("coachInvoices")
        .withIndex("by_client", (q) => q.eq("clientId", args.userId))
        .order("desc")
        .collect(),
    ])

    const seen = new Set<string>()
    const merged = [...asCoach, ...asClient].filter((inv) => {
      if (seen.has(inv._id)) return false
      seen.add(inv._id)
      return true
    })
    return merged.sort((a, b) => b.createdAt - a.createdAt)
  },
})

export const findByCheckoutSession = internalQuery({
  args: { stripeCheckoutSessionId: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("coachInvoices")
      .withIndex("by_stripe_checkout_session", (q) =>
        q.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
      )
      .first(),
})

export const findByPaymentIntent = internalQuery({
  args: { stripePaymentIntentId: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("coachInvoices")
      .withIndex("by_stripe_payment_intent", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .first(),
})

export const create = mutation({
  args: {
    clientId: v.string(),
    amount: v.number(),
    description: v.string(),
    coachServiceId: v.optional(v.id("coachServices")),
    coachBookingId: v.optional(v.id("coachBookings")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }
    const coachId = identity.subject
    if (args.clientId === coachId) {
      throwError(ErrorCode.INVALID_INPUT, "Cannot invoice yourself")
    }

    const ok = await hasCoachClientRelationship(ctx, coachId, args.clientId)
    if (!ok) {
      throwError(
        ErrorCode.FORBIDDEN,
        "You can only send invoices to clients you have an existing coaching booking or conversation with"
      )
    }

    if (args.coachBookingId) {
      const b = await ctx.db.get(args.coachBookingId)
      if (!b || b.coachId !== coachId || b.clientId !== args.clientId) {
        throwError(ErrorCode.NOT_FOUND, "Booking not found for this client")
      }
    }

    if (args.coachServiceId) {
      const s = await ctx.db.get(args.coachServiceId)
      if (!s || s.coachId !== coachId) {
        throwError(ErrorCode.NOT_FOUND, "Coach service not found")
      }
    }

    if (args.amount < 100 || args.amount > 2_500_000) {
      throwError(ErrorCode.INVALID_AMOUNT, "Amount must be between $1.00 and $25,000.00")
    }

    const now = Date.now()
    return await ctx.db.insert("coachInvoices", {
      coachId,
      clientId: args.clientId,
      coachServiceId: args.coachServiceId,
      coachBookingId: args.coachBookingId,
      amount: args.amount,
      description: args.description.trim(),
      status: "unpaid",
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const cancel = mutation({
  args: { coachInvoiceId: v.id("coachInvoices") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }
    const invoice = await ctx.db.get(args.coachInvoiceId)
    if (!invoice) {
      throwError(ErrorCode.NOT_FOUND, "Invoice not found")
    }
    if (invoice.coachId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Only the coach can cancel this invoice")
    }
    if (invoice.status !== "unpaid" && invoice.status !== "payment_pending") {
      throwError(ErrorCode.INVALID_STATUS, "This invoice cannot be cancelled")
    }
    await ctx.db.patch(args.coachInvoiceId, {
      status: "cancelled",
      updatedAt: Date.now(),
    })
    return args.coachInvoiceId
  },
})

export const updateWithCheckoutSession = internalMutation({
  args: {
    coachInvoiceId: v.id("coachInvoices"),
    stripeCheckoutSessionId: v.string(),
    stripeCheckoutUrl: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.coachInvoiceId, {
      status: "payment_pending",
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      stripeCheckoutUrl: args.stripeCheckoutUrl,
      stripePaymentIntentId: args.stripePaymentIntentId,
      updatedAt: Date.now(),
    })
  },
})

export const handlePaymentSuccess = internalMutation({
  args: {
    coachInvoiceId: v.id("coachInvoices"),
    stripeChargeId: v.string(),
    stripePaymentIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.coachInvoiceId)
    if (!invoice) {
      return
    }
    if (invoice.status !== "payment_pending") {
      return
    }
    const now = Date.now()
    await ctx.db.patch(args.coachInvoiceId, {
      status: "paid",
      stripeChargeId: args.stripeChargeId,
      stripePaymentIntentId: args.stripePaymentIntentId,
      paidAt: now,
      updatedAt: now,
    })
  },
})

export const createCheckoutSession = action({
  args: { coachInvoiceId: v.id("coachInvoices") },
  handler: async (
    ctx,
    args
  ): Promise<{ checkoutUrl: string | null; coachInvoiceId: Id<"coachInvoices"> }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const invoice = await ctx.runQuery(api.coachInvoices.getById, { id: args.coachInvoiceId })
    if (!invoice) {
      throwError(ErrorCode.NOT_FOUND, "Invoice not found")
    }
    const isCoach = invoice.coachId === identity.subject
    const isClient = invoice.clientId === identity.subject
    if (!isCoach && !isClient) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized")
    }
    if (invoice.status === "paid" || invoice.status === "cancelled") {
      throwError(ErrorCode.INVALID_STATUS, "This invoice is no longer payable")
    }
    if (invoice.status === "payment_pending" && invoice.stripeCheckoutUrl) {
      return { checkoutUrl: invoice.stripeCheckoutUrl, coachInvoiceId: args.coachInvoiceId }
    }
    if (invoice.status !== "unpaid") {
      throwError(ErrorCode.INVALID_STATUS, "Invoice is not awaiting payment setup")
    }

    const coach = await ctx.runQuery(api.users.getByExternalId, {
      externalId: invoice.coachId,
    })
    if (!coach?.stripeAccountId) {
      throwError(ErrorCode.STRIPE_ACCOUNT_INCOMPLETE, "Complete Stripe Connect to send invoices")
    }

    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throwError(ErrorCode.STRIPE_ERROR, "STRIPE_SECRET_KEY environment variable is not set")
    }
    const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" })

    const connectAccount = await stripe.accounts.retrieve(coach.stripeAccountId)
    if (!connectAccount.charges_enabled) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_DISABLED,
        "Your Stripe account cannot accept charges yet."
      )
    }

    const webUrl = getWebUrl()
    const title = invoice.coachServiceId
      ? "Coaching invoice"
      : "Coaching services"

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: title,
              description: invoice.description,
            },
            unit_amount: invoice.amount,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: 0,
        transfer_data: {
          destination: coach.stripeAccountId,
        },
        metadata: {
          type: "coach_invoice",
          coachInvoiceId: args.coachInvoiceId,
          coachId: invoice.coachId,
          clientId: invoice.clientId,
        },
      },
      success_url: `${webUrl}/coaches/invoices/${args.coachInvoiceId}/success`,
      cancel_url: `${webUrl}/profile`,
      metadata: {
        type: "coach_invoice",
        coachInvoiceId: args.coachInvoiceId,
      },
    })

    await ctx.runMutation(internal.coachInvoices.updateWithCheckoutSession, {
      coachInvoiceId: args.coachInvoiceId,
      stripeCheckoutSessionId: checkoutSession.id,
      stripeCheckoutUrl: checkoutSession.url || "",
      stripePaymentIntentId: checkoutSession.payment_intent as string | undefined,
    })

    return { checkoutUrl: checkoutSession.url, coachInvoiceId: args.coachInvoiceId }
  },
})
