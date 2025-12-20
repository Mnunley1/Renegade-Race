import { StripeSubscriptions } from "@convex-dev/stripe"
import { v } from "convex/values"
import Stripe from "stripe"
import { api, components } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { action, mutation, query } from "./_generated/server"
import {
  getPaymentFailedEmailTemplate,
  getPaymentSucceededEmailTemplate,
  sendTransactionalEmail,
} from "./emails"

// Initialize Stripe client from component
const stripeClient = new StripeSubscriptions(components.stripe, {})

// Helper function to get Stripe instance (for Connect operations)
function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set")
  }
  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
  })
}

// ============================================================================
// Platform Fee Calculation (Keep your existing logic)
// ============================================================================

export const calculatePlatformFee = mutation({
  args: {
    amount: v.number(), // Amount in cents
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first()

    if (!settings) {
      // Default platform settings if none exist
      const platformFee = Math.round(args.amount * 0.05) // 5% default fee
      return {
        platformFee,
        ownerAmount: args.amount - platformFee,
      }
    }

    const feePercentage = settings.platformFeePercentage
    const calculatedFee = Math.round((args.amount * feePercentage) / 100)

    const platformFee = Math.max(
      settings.minimumPlatformFee,
      Math.min(calculatedFee, settings.maximumPlatformFee || calculatedFee)
    )

    return {
      platformFee,
      ownerAmount: args.amount - platformFee,
    }
  },
})

export const initializePlatformSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const existingSettings = await ctx.db
      .query("platformSettings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first()

    if (existingSettings) {
      return existingSettings._id
    }

    const settingsId = await ctx.db.insert("platformSettings", {
      platformFeePercentage: 5, // 5% platform fee
      minimumPlatformFee: 100, // $1.00 minimum fee
      maximumPlatformFee: 5000, // $50.00 maximum fee
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    return settingsId
  },
})

// ============================================================================
// Admin API for Platform Settings
// ============================================================================

// Get current platform settings (admin only)
export const getPlatformSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    // Check if user is admin
    const role = (identity as unknown as { metadata?: { role?: string } }).metadata?.role
    if (role !== "admin") {
      throw new Error("Admin access required")
    }

    return await ctx.db
      .query("platformSettings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first()
  },
})

// Update platform settings (admin only)
export const updatePlatformSettings = mutation({
  args: {
    platformFeePercentage: v.number(),
    minimumPlatformFee: v.number(),
    maximumPlatformFee: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    // Check if user is admin
    const role = (identity as unknown as { metadata?: { role?: string } }).metadata?.role
    if (role !== "admin") {
      throw new Error("Admin access required")
    }

    // Validate inputs
    if (args.platformFeePercentage < 0 || args.platformFeePercentage > 100) {
      throw new Error("Platform fee percentage must be between 0 and 100")
    }

    if (args.minimumPlatformFee < 0) {
      throw new Error("Minimum platform fee must be positive")
    }

    if (
      args.maximumPlatformFee !== undefined &&
      args.maximumPlatformFee < args.minimumPlatformFee
    ) {
      throw new Error("Maximum platform fee must be greater than or equal to minimum fee")
    }

    // Deactivate old settings
    const oldSettings = await ctx.db
      .query("platformSettings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first()

    if (oldSettings) {
      await ctx.db.patch(oldSettings._id, {
        isActive: false,
        updatedAt: Date.now(),
      })
    }

    // Create new active settings
    const newSettingsId = await ctx.db.insert("platformSettings", {
      platformFeePercentage: args.platformFeePercentage,
      minimumPlatformFee: args.minimumPlatformFee,
      maximumPlatformFee: args.maximumPlatformFee,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    return newSettingsId
  },
})

// ============================================================================
// Stripe Connect - Account Management
// ============================================================================

// Create Stripe Connect account for vehicle owners
export const createConnectAccount = action({
  args: {
    ownerId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity || identity.subject !== args.ownerId) {
      throw new Error("Not authorized")
    }

    // Check if user already has a Connect account
    const user = await ctx.runQuery(api.users.getByExternalId, {
      externalId: args.ownerId,
    })

    if (user?.stripeAccountId) {
      // Check account status
      const stripe = getStripe()
      const account = await stripe.accounts.retrieve(user.stripeAccountId)

      if (account.details_submitted) {
        return {
          accountId: account.id,
          onboardingUrl: null,
          isComplete: true,
        }
      }
    }

    const stripe = getStripe()

    // Create a Connect Express account for the owner
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: user?.email || identity.email || "",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    })

    // Store the Connect account ID
    await ctx.runMutation(api.users.setStripeAccountId, {
      userId: args.ownerId,
      stripeAccountId: account.id,
    })

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.WEB_URL || "https://renegaderentals.com"}/host/onboarding/refresh`,
      return_url: `${process.env.WEB_URL || "https://renegaderentals.com"}/host/onboarding/complete`,
      type: "account_onboarding",
    })

    return {
      accountId: account.id,
      onboardingUrl: accountLink.url,
      isComplete: false,
    }
  },
})

// Get Connect account status
export const getConnectAccountStatus = action({
  args: {
    ownerId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.getByExternalId, {
      externalId: args.ownerId,
    })

    if (!user?.stripeAccountId) {
      return {
        hasAccount: false,
        isComplete: false,
      }
    }

    const stripe = getStripe()
    const account = await stripe.accounts.retrieve(user.stripeAccountId)

    return {
      hasAccount: true,
      isComplete: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      accountId: account.id,
    }
  },
})

// Create login link for Connect account dashboard
export const createConnectLoginLink = action({
  args: {
    ownerId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity || identity.subject !== args.ownerId) {
      throw new Error("Not authorized")
    }

    const user = await ctx.runQuery(api.users.getByExternalId, {
      externalId: args.ownerId,
    })

    if (!user?.stripeAccountId) {
      throw new Error("No Stripe Connect account found")
    }

    const stripe = getStripe()
    const loginLink = await stripe.accounts.createLoginLink(user.stripeAccountId)

    return {
      url: loginLink.url,
    }
  },
})

// ============================================================================
// Payment Creation with Stripe Connect
// ============================================================================

// Create checkout session for one-time payment (using component + Connect)
export const createCheckoutSession = action({
  args: {
    reservationId: v.id("reservations"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const reservation = await ctx.runQuery(api.reservations.getById, {
      id: args.reservationId,
    })
    if (!reservation) {
      throw new Error("Reservation not found")
    }

    if (reservation.renterId !== identity.subject) {
      throw new Error("Not authorized to create payment for this reservation")
    }

    if (reservation.status !== "pending") {
      throw new Error("Reservation must be pending to create payment")
    }

    // Get owner's Stripe Connect account
    const owner = await ctx.runQuery(api.users.getByExternalId, {
      externalId: reservation.ownerId,
    })

    if (!owner?.stripeAccountId) {
      throw new Error("Owner must complete Stripe onboarding before accepting payments")
    }

    // Verify Connect account is ready
    const stripe = getStripe()
    const connectAccount = await stripe.accounts.retrieve(owner.stripeAccountId)

    if (!(connectAccount.details_submitted && connectAccount.charges_enabled)) {
      throw new Error("Owner account is not fully set up")
    }

    // Calculate platform fee
    const { platformFee, ownerAmount } = await ctx.runMutation(api.stripe.calculatePlatformFee, {
      amount: args.amount,
    })

    // Get or create Stripe customer (component handles this)
    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email || "",
      name: identity.name || "",
    })

    // Store customer ID on user record if not already stored
    const user = await ctx.runQuery(api.users.getByExternalId, {
      externalId: identity.subject,
    })
    if (user && !user.stripeCustomerId) {
      await ctx.runMutation(api.users.setStripeCustomerId, {
        userId: identity.subject,
        stripeCustomerId: customer.customerId,
      })
    }

    const webUrl = process.env.WEB_URL || "https://renegaderentals.com"

    // Create checkout session using Stripe directly (component doesn't support Connect)
    // but we use the component's customer management
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customer.customerId,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Vehicle Rental - Reservation ${args.reservationId}`,
            },
            unit_amount: args.amount,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFee, // Your platform fee
        transfer_data: {
          destination: owner.stripeAccountId, // Owner's Connect account
        },
        metadata: {
          reservationId: args.reservationId,
          renterId: reservation.renterId,
          ownerId: reservation.ownerId,
          vehicleId: reservation.vehicleId,
          platformFee: platformFee.toString(),
          ownerAmount: ownerAmount.toString(),
        },
      },
      success_url: `${webUrl}/checkout/success?reservationId=${args.reservationId}`,
      cancel_url: `${webUrl}/checkout?reservationId=${args.reservationId}`,
      metadata: {
        reservationId: args.reservationId,
        renterId: reservation.renterId,
        ownerId: reservation.ownerId,
      },
    })

    // Create payment record
    const paymentId = await ctx.runMutation(api.stripe.createPaymentRecord, {
      reservationId: args.reservationId,
      renterId: reservation.renterId,
      ownerId: reservation.ownerId,
      amount: args.amount,
      platformFee,
      ownerAmount,
      stripeCustomerId: customer.customerId,
      stripeCheckoutSessionId: checkoutSession.id,
      stripeAccountId: owner.stripeAccountId,
      metadata: {
        vehicleId: reservation.vehicleId,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        totalDays: reservation.totalDays,
      },
    })

    return {
      paymentId,
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    }
  },
})

// Legacy: Create payment intent (for embedded payment form)
// This still works but uses Connect
export const createPaymentIntent = action({
  args: {
    reservationId: v.id("reservations"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const reservation = await ctx.runQuery(api.reservations.getById, {
      id: args.reservationId,
    })
    if (!reservation) {
      throw new Error("Reservation not found")
    }

    if (reservation.renterId !== identity.subject) {
      throw new Error("Not authorized to create payment for this reservation")
    }

    if (reservation.status !== "pending") {
      throw new Error("Reservation must be pending to create payment")
    }

    // Get owner's Stripe Connect account
    const owner = await ctx.runQuery(api.users.getByExternalId, {
      externalId: reservation.ownerId,
    })

    if (!owner?.stripeAccountId) {
      throw new Error("Owner must complete Stripe onboarding before accepting payments")
    }

    // Calculate platform fee
    const { platformFee, ownerAmount } = await ctx.runMutation(api.stripe.calculatePlatformFee, {
      amount: args.amount,
    })

    // Get or create Stripe customer (component handles this)
    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email || "",
      name: identity.name || "",
    })

    // Store customer ID on user record if not already stored
    const renter = await ctx.runQuery(api.users.getByExternalId, {
      externalId: identity.subject,
    })
    if (renter && !renter.stripeCustomerId) {
      await ctx.runMutation(api.users.setStripeCustomerId, {
        userId: identity.subject,
        stripeCustomerId: customer.customerId,
      })
    }

    // Create Stripe Payment Intent with Connect
    const stripe = getStripe()
    const paymentIntent = await stripe.paymentIntents.create({
      amount: args.amount,
      currency: "usd",
      customer: customer.customerId,
      application_fee_amount: platformFee, // Your platform fee
      transfer_data: {
        destination: owner.stripeAccountId, // Owner's Connect account
      },
      metadata: {
        reservationId: args.reservationId,
        renterId: reservation.renterId,
        ownerId: reservation.ownerId,
        vehicleId: reservation.vehicleId,
        platformFee: platformFee.toString(),
        ownerAmount: ownerAmount.toString(),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    })

    // Create payment record
    const paymentId = await ctx.runMutation(api.stripe.createPaymentRecord, {
      reservationId: args.reservationId,
      renterId: reservation.renterId,
      ownerId: reservation.ownerId,
      amount: args.amount,
      platformFee,
      ownerAmount,
      stripePaymentIntentId: paymentIntent.id,
      stripeCustomerId: customer.customerId,
      stripeAccountId: owner.stripeAccountId,
      metadata: {
        vehicleId: reservation.vehicleId,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        totalDays: reservation.totalDays,
      },
    })

    return {
      paymentId,
      clientSecret: paymentIntent.client_secret,
    }
  },
})

// ============================================================================
// Payment Record Management
// ============================================================================

export const createPaymentRecord = mutation({
  args: {
    reservationId: v.id("reservations"),
    renterId: v.string(),
    ownerId: v.string(),
    amount: v.number(),
    platformFee: v.number(),
    ownerAmount: v.number(),
    stripePaymentIntentId: v.optional(v.string()),
    stripeCheckoutSessionId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeAccountId: v.optional(v.string()),
    metadata: v.object({
      vehicleId: v.string(),
      startDate: v.string(),
      endDate: v.string(),
      totalDays: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const paymentId = await ctx.db.insert("payments", {
      reservationId: args.reservationId,
      renterId: args.renterId,
      ownerId: args.ownerId,
      amount: args.amount,
      platformFee: args.platformFee,
      ownerAmount: args.ownerAmount,
      currency: "usd",
      status: "pending",
      stripePaymentIntentId: args.stripePaymentIntentId,
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      stripeCustomerId: args.stripeCustomerId,
      stripeAccountId: args.stripeAccountId,
      metadata: args.metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    await ctx.db.patch(args.reservationId, {
      paymentId,
      paymentStatus: "pending",
      updatedAt: Date.now(),
    })

    return paymentId
  },
})

// Find payment by Stripe payment intent ID (for webhooks)
export const findPaymentByStripeIntent = query({
  args: {
    stripePaymentIntentId: v.string(),
  },
  handler: async (ctx, args) =>
    await ctx.db
      .query("payments")
      .withIndex("by_stripe_payment_intent", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .first(),
})

// Find payment by Stripe checkout session ID
export const findPaymentByCheckoutSession = query({
  args: {
    stripeCheckoutSessionId: v.string(),
  },
  handler: async (ctx, args) =>
    await ctx.db
      .query("payments")
      .withIndex("by_stripe_checkout_session", (q) =>
        q.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
      )
      .first(),
})

// Handle payment success (called from webhook)
export const handlePaymentSuccess = mutation({
  args: {
    paymentId: v.id("payments"),
    stripeChargeId: v.string(),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId)
    if (!payment) return

    await ctx.db.patch(args.paymentId, {
      status: "succeeded",
      stripeChargeId: args.stripeChargeId,
      updatedAt: Date.now(),
    })

    await ctx.db.patch(payment.reservationId, {
      status: "confirmed",
      paymentStatus: "paid",
      updatedAt: Date.now(),
    })

    // Send payment success email
    try {
      const [reservation, vehicle, renter] = await Promise.all([
        ctx.db.get(payment.reservationId),
        payment.metadata?.vehicleId
          ? ctx.db.get(payment.metadata.vehicleId as Id<"vehicles">)
          : null,
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", payment.renterId))
          .first(),
      ])

      if (reservation && vehicle && renter?.email) {
        const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        const webUrl = process.env.WEB_URL || "https://renegaderentals.com"

        const template = getPaymentSucceededEmailTemplate({
          renterName: renter.name || "Guest",
          vehicleName,
          totalAmount: payment.amount,
          paymentDate: new Date().toISOString(),
          reservationUrl: `${webUrl}/trips`,
        })
        await sendTransactionalEmail(ctx, renter.email, template)
      }
    } catch (error) {
      console.error("Failed to send payment success email:", error)
    }
  },
})

// Handle payment failure (called from webhook)
export const handlePaymentFailure = mutation({
  args: {
    paymentId: v.id("payments"),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId)
    if (!payment) return

    await ctx.db.patch(args.paymentId, {
      status: "failed",
      failureReason: args.failureReason,
      updatedAt: Date.now(),
    })

    // Send payment failure email
    try {
      const [reservation, vehicle, renter] = await Promise.all([
        ctx.db.get(payment.reservationId),
        payment.metadata?.vehicleId
          ? ctx.db.get(payment.metadata.vehicleId as Id<"vehicles">)
          : null,
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", payment.renterId))
          .first(),
      ])

      if (reservation && vehicle && renter?.email) {
        const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        const webUrl = process.env.WEB_URL || "https://renegaderentals.com"

        const template = getPaymentFailedEmailTemplate({
          renterName: renter.name || "Guest",
          vehicleName,
          totalAmount: payment.amount,
          failureReason: args.failureReason,
          reservationUrl: `${webUrl}/checkout?reservationId=${reservation._id}`,
        })
        await sendTransactionalEmail(ctx, renter.email, template)
      }
    } catch (error) {
      console.error("Failed to send payment failure email:", error)
    }
  },
})

// ============================================================================
// Customer Portal
// ============================================================================

export const createCustomerPortalSession = action({
  args: {
    returnUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    // Get or create customer
    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email || "",
      name: identity.name || "",
    })

    // Create portal session
    const session = await stripeClient.createCustomerPortalSession(ctx, {
      customerId: customer.customerId,
      returnUrl: args.returnUrl,
    })

    return {
      url: session.url,
    }
  },
})

// ============================================================================
// Refunds (with Connect support)
// ============================================================================

export const processRefund = action({
  args: {
    paymentId: v.id("payments"),
    amount: v.optional(v.number()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const payment = await ctx.runQuery(api.stripe.getPaymentById, {
      paymentId: args.paymentId,
    })
    if (!(payment && payment.stripeChargeId)) {
      throw new Error("Payment not found")
    }

    // Check authorization (owner or admin can refund)
    if (payment.ownerId !== identity.subject) {
      throw new Error("Not authorized to refund this payment")
    }

    const stripe = getStripe()

    // Refund with Connect - automatically reverses transfer
    const refundParams: Stripe.RefundCreateParams = {
      charge: payment.stripeChargeId,
      reverse_transfer: true, // Automatically reverse the transfer to owner
      refund_application_fee: true, // Refund your platform fee too
    }

    if (args.amount) refundParams.amount = args.amount
    if (args.reason) {
      refundParams.reason = args.reason as Stripe.RefundCreateParams.Reason
    }

    const refund = await stripe.refunds.create(refundParams)

    await ctx.runMutation(api.stripe.updateRefundStatus, {
      paymentId: args.paymentId,
      status: args.amount && args.amount < payment.amount ? "partially_refunded" : "refunded",
      refundAmount: refund.amount,
      refundReason: args.reason,
    })

    // Update reservation status if fully refunded
    if (!args.amount || args.amount >= payment.amount) {
      await ctx.runMutation(api.stripe.updateReservationStatus, {
        reservationId: payment.reservationId,
        status: "cancelled",
        paymentStatus: "refunded",
      })
    }

    return refund
  },
})

// ============================================================================
// Helper Mutations
// ============================================================================

export const updatePaymentStatus = mutation({
  args: {
    paymentId: v.id("payments"),
    status: v.string(),
    stripeChargeId: v.optional(v.string()),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.paymentId, {
      status: args.status as
        | "pending"
        | "cancelled"
        | "failed"
        | "refunded"
        | "processing"
        | "succeeded"
        | "partially_refunded",
      stripeChargeId: args.stripeChargeId,
      failureReason: args.failureReason,
      updatedAt: Date.now(),
    })
  },
})

export const updateReservationStatus = mutation({
  args: {
    reservationId: v.id("reservations"),
    status: v.string(),
    paymentStatus: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reservationId, {
      status: args.status as "pending" | "cancelled" | "confirmed" | "completed" | "declined",
      paymentStatus: args.paymentStatus as "pending" | "paid" | "failed" | "refunded",
      updatedAt: Date.now(),
    })
  },
})

export const updateRefundStatus = mutation({
  args: {
    paymentId: v.id("payments"),
    status: v.string(),
    refundAmount: v.optional(v.number()),
    refundReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.paymentId, {
      status: args.status as "pending" | "cancelled" | "failed" | "refunded" | "partially_refunded",
      refundAmount: args.refundAmount,
      refundReason: args.refundReason,
      updatedAt: Date.now(),
    })
  },
})

// ============================================================================
// Queries
// ============================================================================

export const getUserPayments = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_renter", (q) => q.eq("renterId", args.userId))
      .order("desc")
      .collect()

    const paymentsWithDetails = await Promise.all(
      payments.map(async (payment) => {
        const [reservation, vehicle, owner] = await Promise.all([
          ctx.db.get(payment.reservationId),
          payment.metadata?.vehicleId
            ? ctx.db.get(payment.metadata.vehicleId as Id<"vehicles">)
            : Promise.resolve(undefined),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", payment.ownerId))
            .first(),
        ])

        return {
          ...payment,
          reservation,
          vehicle,
          owner,
        }
      })
    )

    return paymentsWithDetails
  },
})

export const getPaymentById = query({
  args: {
    paymentId: v.id("payments"),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId)
    if (!payment) return null

    const [reservation, vehicle, renter, owner] = await Promise.all([
      ctx.db.get(payment.reservationId),
      payment.metadata?.vehicleId ? ctx.db.get(payment.metadata.vehicleId as Id<"vehicles">) : null,
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", payment.renterId))
        .first(),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", payment.ownerId))
        .first(),
    ])

    return {
      ...payment,
      reservation,
      vehicle,
      renter,
      owner,
    }
  },
})

// ============================================================================
// Customer Billing Data (for renters)
// ============================================================================

// Get payment methods for a customer
export const getCustomerPaymentMethods = action({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    // Verify the customer belongs to the current user
    const user = await ctx.runQuery(api.users.getByExternalId, {
      externalId: identity.subject,
    })

    if (!user || user.stripeCustomerId !== args.customerId) {
      throw new Error("Not authorized")
    }

    const stripe = getStripe()
    const paymentMethods = await stripe.paymentMethods.list({
      customer: args.customerId,
      type: "card",
    })

    return paymentMethods.data.map((pm) => ({
      id: pm.id,
      type: pm.type,
      card: pm.card
        ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          }
        : null,
      billingDetails: pm.billing_details,
      created: pm.created,
    }))
  },
})

// Get invoices for a customer
export const getCustomerInvoices = action({
  args: {
    customerId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    // Verify the customer belongs to the current user
    const user = await ctx.runQuery(api.users.getByExternalId, {
      externalId: identity.subject,
    })

    if (!user || user.stripeCustomerId !== args.customerId) {
      throw new Error("Not authorized")
    }

    const stripe = getStripe()
    const invoices = await stripe.invoices.list({
      customer: args.customerId,
      limit: args.limit || 10,
    })

    return invoices.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      created: invoice.created,
      dueDate: invoice.due_date,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      description: invoice.description || invoice.lines?.data[0]?.description || "Vehicle rental",
    }))
  },
})

// Get customer details including default payment method
export const getCustomerDetails = action({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    // Verify the customer belongs to the current user
    const user = await ctx.runQuery(api.users.getByExternalId, {
      externalId: identity.subject,
    })

    if (!user || user.stripeCustomerId !== args.customerId) {
      throw new Error("Not authorized")
    }

    const stripe = getStripe()
    const customer = await stripe.customers.retrieve(args.customerId)

    if (customer.deleted) {
      throw new Error("Customer not found")
    }

    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      defaultSource: customer.default_source,
      invoiceSettings: customer.invoice_settings,
    }
  },
})
