import { v } from "convex/values"
import Stripe from "stripe"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server"
import { checkAdmin } from "./admin"
import { calculateDaysBetween } from "./dateUtils"
import { ErrorCode, throwError } from "./errors"
import { getWebUrl } from "./helpers"
import { logError } from "./logger"
import { buildDestinationChargeAmounts } from "./pricing"
import { rateLimiter } from "./rateLimiter"

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throwError(
      ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
      "STRIPE_SECRET_KEY environment variable is not set"
    )
  }
  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
  })
}

const MAX_AMOUNT_CENTS = 1_000_000 // $10,000
const MIN_AMOUNT_CENTS = 100 // $1

function recalcTotal(
  profile: { hourlyRate?: number; halfDayRate?: number; fullDayRate?: number },
  booking: {
    sessionType: "hourly" | "half_day" | "full_day"
    hours?: number
    startDate: string
    endDate: string
  }
): { expected: number; rate: number } {
  const rate =
    booking.sessionType === "hourly"
      ? profile.hourlyRate
      : booking.sessionType === "half_day"
        ? profile.halfDayRate
        : profile.fullDayRate
  if (rate === undefined) {
    throwError(ErrorCode.PRICE_CHANGED, `Coach no longer offers ${booking.sessionType} rate`)
  }
  if (booking.sessionType === "hourly") {
    const hours = booking.hours ?? 0
    return { expected: Math.round(rate * hours), rate }
  }
  const days = calculateDaysBetween(booking.startDate, booking.endDate)
  return { expected: Math.round(rate * days), rate }
}

export const createCheckoutSession = action({
  args: {
    bookingId: v.id("coachingBookings"),
  },
  handler: async (ctx, args): Promise<{ sessionId: string; url: string | null }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    await rateLimiter.limit(ctx, "processPayment", { key: identity.subject, throws: true })

    const booking = await ctx.runQuery(api.coachingBookings.getById, {
      id: args.bookingId,
    })
    if (!booking) {
      throwError(ErrorCode.NOT_FOUND, "Coaching booking not found")
    }
    if (booking.renterId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized to pay for this booking")
    }
    if (booking.status !== "approved") {
      throwError(ErrorCode.INVALID_STATUS, "Booking must be approved before payment")
    }

    // Fail fast if another booking has already confirmed these dates. The
    // authoritative guard is in handlePaymentSuccess (which refunds), but this
    // avoids charging the renter only to refund moments later.
    const availability = await ctx.runQuery(api.coachAvailability.checkAvailability, {
      coachProfileId: booking.coachProfileId,
      startDate: booking.startDate,
      endDate: booking.endDate,
    })
    if (availability.conflictingBookings.length > 0) {
      throwError(
        ErrorCode.DATES_CONFLICT,
        "These dates were just booked by someone else. Please request different dates."
      )
    }

    // Re-validate price against the current coach profile
    if (!booking.coachProfile) {
      throwError(ErrorCode.NOT_FOUND, "Coach profile no longer exists")
    }
    const { expected } = recalcTotal(booking.coachProfile, {
      sessionType: booking.sessionType,
      hours: booking.hours,
      startDate: booking.startDate,
      endDate: booking.endDate,
    })
    if (expected !== booking.totalAmount) {
      throwError(
        ErrorCode.PRICE_CHANGED,
        `Coach's rates have changed (expected ${expected} cents, booking has ${booking.totalAmount}). Please request a new booking.`
      )
    }

    if (booking.totalAmount < MIN_AMOUNT_CENTS || booking.totalAmount > MAX_AMOUNT_CENTS) {
      throwError(ErrorCode.INVALID_AMOUNT, "Booking amount out of allowed range")
    }

    // Verify coach's Stripe Connect account is ready
    const coach = await ctx.runQuery(api.users.getByExternalId, {
      externalId: booking.coachUserId,
    })
    if (!coach?.stripeAccountId) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
        "Coach hasn't finished setting up payouts. Try again later or message the coach."
      )
    }

    const stripe = getStripe()
    const connectAccount = await stripe.accounts.retrieve(coach.stripeAccountId)
    if (!connectAccount.details_submitted) {
      throwError(ErrorCode.STRIPE_ACCOUNT_INCOMPLETE, "Coach's payout setup isn't complete yet")
    }
    if (!connectAccount.charges_enabled) {
      throwError(ErrorCode.STRIPE_ACCOUNT_DISABLED, "Coach's payouts are temporarily disabled")
    }
    const capabilities = connectAccount.capabilities as Record<string, string> | undefined
    const transfersEnabled =
      capabilities?.transfers === "active" || capabilities?.legacy_payments === "active"
    if (!transfersEnabled) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
        "Coach's payout setup isn't complete (transfers not enabled)"
      )
    }

    const { platformFee } = await ctx.runMutation(api.stripe.calculatePlatformFee, {
      amount: booking.totalAmount,
      providerExternalId: booking.coachUserId,
    })
    const { chargeAmountCents, processingFeeCents, applicationFeeCents } =
      buildDestinationChargeAmounts({
        listingAmountCents: booking.totalAmount,
        platformFeeCents: platformFee,
      })

    // Get or create Stripe customer for the renter (no component, direct Stripe API)
    const renter = await ctx.runQuery(api.users.getByExternalId, {
      externalId: identity.subject,
    })
    let customerId = renter?.stripeCustomerId
    if (!customerId) {
      const created = await stripe.customers.create({
        email: identity.email || undefined,
        name: identity.name || undefined,
        metadata: { userId: identity.subject },
      })
      customerId = created.id
      await ctx.runMutation(api.users.setStripeCustomerId, {
        userId: identity.subject,
        stripeCustomerId: customerId,
      })
    }

    const webUrl = getWebUrl()
    const coachName = booking.coach?.name || "Coach"
    const sessionLabel =
      booking.sessionType === "hourly"
        ? `${booking.hours}-hour coaching session`
        : booking.sessionType === "half_day"
          ? "Half-day coaching session"
          : "Full-day coaching session"

    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${sessionLabel} with ${coachName}`,
              },
              unit_amount: booking.totalAmount,
            },
            quantity: 1,
          },
          ...(processingFeeCents > 0
            ? [
                {
                  price_data: {
                    currency: "usd",
                    product_data: {
                      name: "Card processing fee",
                      description: "Passed through at Stripe's standard US card rate",
                    },
                    unit_amount: processingFeeCents,
                  },
                  quantity: 1,
                },
              ]
            : []),
        ],
        payment_intent_data: {
          application_fee_amount: applicationFeeCents,
          transfer_data: {
            destination: coach.stripeAccountId,
          },
          metadata: {
            type: "coaching_booking",
            coachingBookingId: args.bookingId,
            renterId: booking.renterId,
            coachUserId: booking.coachUserId,
            coachProfileId: booking.coachProfileId,
            platformFee: platformFee.toString(),
            processingFee: processingFeeCents.toString(),
            chargeAmount: chargeAmountCents.toString(),
          },
        },
        success_url: `${webUrl}/checkout/success?coachingBookingId=${args.bookingId}`,
        cancel_url: `${webUrl}/coaches/${booking.coachProfileId}`,
        metadata: {
          type: "coaching_booking",
          coachingBookingId: args.bookingId,
          renterId: booking.renterId,
          coachUserId: booking.coachUserId,
        },
      },
      {
        idempotencyKey: `cs_coaching_${args.bookingId}`,
      }
    )

    await ctx.runMutation(internal.coachingPayments.recordCheckoutSession, {
      bookingId: args.bookingId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id,
    })

    return {
      sessionId: session.id,
      url: session.url,
    }
  },
})

export const recordCheckoutSession = internalMutation({
  args: {
    bookingId: v.id("coachingBookings"),
    stripeCheckoutSessionId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) return
    await ctx.db.patch(args.bookingId, {
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      stripePaymentIntentId: args.stripePaymentIntentId,
      paymentStatus: "pending",
      updatedAt: Date.now(),
    })
  },
})

export const findByPaymentIntent = internalQuery({
  args: { stripePaymentIntentId: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("coachingBookings")
      .withIndex("by_stripe_payment_intent", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .first(),
})

export const handlePaymentSuccess = internalMutation({
  args: {
    bookingId: v.id("coachingBookings"),
    stripePaymentIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) return
    if (booking.status === "confirmed") return // already handled

    const now = Date.now()

    // The booking must still be awaiting payment, and no other booking may have
    // confirmed these dates in the meantime. Both can happen via a stale Stripe
    // checkout (e.g. the coach declined this booking, or approved/confirmed a
    // different one, after the renter opened checkout). In either case we must
    // NOT confirm — refund the payment instead.
    const conflict = await ctx.db
      .query("coachingBookings")
      .withIndex("by_coach_profile", (q) => q.eq("coachProfileId", booking.coachProfileId))
      .filter((q) =>
        q.and(
          q.neq(q.field("_id"), args.bookingId),
          q.eq(q.field("status"), "confirmed"),
          q.lte(q.field("startDate"), booking.endDate),
          q.gte(q.field("endDate"), booking.startDate)
        )
      )
      .first()

    if (booking.status !== "approved" || conflict) {
      await ctx.db.patch(args.bookingId, {
        paymentStatus: "paid",
        stripePaymentIntentId: args.stripePaymentIntentId,
        updatedAt: now,
      })
      await ctx.scheduler.runAfter(0, internal.coachingPayments.refundCoachingBooking, {
        bookingId: args.bookingId,
        reason: conflict
          ? "These dates were already booked — payment refunded in full."
          : "This session was no longer available — payment refunded in full.",
      })
      await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
        userId: booking.renterId,
        type: "coaching_cancelled",
        title: "Coaching payment refunded",
        message: conflict
          ? "Those dates were already booked by someone else, so your payment is being refunded in full."
          : "That session was no longer available, so your payment is being refunded in full.",
        link: "/coaches",
        metadata: { bookingId: args.bookingId },
      })
      return
    }

    await ctx.db.patch(args.bookingId, {
      status: "confirmed",
      paymentStatus: "paid",
      stripePaymentIntentId: args.stripePaymentIntentId,
      confirmedAt: now,
      updatedAt: now,
    })

    // Notify renter
    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: booking.renterId,
      type: "payment_success",
      title: "Coaching session confirmed",
      message: `Your payment of $${(booking.totalAmount / 100).toFixed(2)} succeeded. The coach has been notified.`,
      link: "/trips",
      metadata: {
        bookingId: args.bookingId,
      },
    })

    // Notify coach
    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: booking.coachUserId,
      type: "coaching_approved",
      title: "New confirmed coaching session",
      message: "A renter has paid for their session — it's now on your calendar.",
      link: "/coach/dashboard",
      metadata: {
        bookingId: args.bookingId,
      },
    })
  },
})

export const handlePaymentFailure = internalMutation({
  args: {
    bookingId: v.id("coachingBookings"),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) return
    await ctx.db.patch(args.bookingId, {
      paymentStatus: "failed",
      updatedAt: Date.now(),
    })

    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: booking.renterId,
      type: "payment_failed",
      title: "Coaching payment failed",
      message: args.failureReason || "Your payment did not go through. Please try again.",
      link: `/checkout/pay-coaching?bookingId=${args.bookingId}`,
      metadata: {
        bookingId: args.bookingId,
      },
    })
  },
})

// Full refund for a booking that was paid but can't be honored (dates already
// taken, or the booking was no longer payable). Reverses the Connect transfer
// and the platform fee since this isn't the renter's fault.
export const refundCoachingBooking = internalAction({
  args: {
    bookingId: v.id("coachingBookings"),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const booking = await ctx.runQuery(api.coachingBookings.getById, {
      id: args.bookingId,
    })
    if (!booking?.stripePaymentIntentId) return
    if (booking.paymentStatus === "refunded") return

    const stripe = getStripe()
    try {
      await stripe.refunds.create(
        {
          payment_intent: booking.stripePaymentIntentId,
          reverse_transfer: true,
          refund_application_fee: true,
          reason: "requested_by_customer",
        },
        { idempotencyKey: `rf_coaching_${args.bookingId}` }
      )
    } catch (error) {
      // Leave paymentStatus as "paid" so this surfaces for manual follow-up
      // rather than being silently marked refunded.
      logError(error, "Failed to refund coaching booking")
      return
    }

    await ctx.runMutation(internal.coachingPayments.markRefunded, {
      bookingId: args.bookingId,
      reason: args.reason,
    })
  },
})

export const markRefunded = internalMutation({
  args: {
    bookingId: v.id("coachingBookings"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) return
    await ctx.db.patch(args.bookingId, {
      status: "cancelled",
      paymentStatus: "refunded",
      cancellationReason: args.reason,
      updatedAt: Date.now(),
    })
  },
})

// Admin-initiated full refund for a paid coaching booking (dispute resolution).
// Reuses the same refund path as the automatic conflict refund.
export const adminRefundCoachingBooking = action({
  args: {
    bookingId: v.id("coachingBookings"),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await checkAdmin(ctx)

    const booking = await ctx.runQuery(api.coachingBookings.getById, { id: args.bookingId })
    if (!booking) {
      throwError(ErrorCode.NOT_FOUND, "Coaching booking not found")
    }
    if (!booking.stripePaymentIntentId || booking.paymentStatus !== "paid") {
      throwError(ErrorCode.INVALID_STATUS, "Booking has no captured payment to refund")
    }

    await ctx.runAction(internal.coachingPayments.refundCoachingBooking, {
      bookingId: args.bookingId,
      reason: args.reason,
    })

    await ctx.runMutation(internal.auditLog.create, {
      entityType: "coaching_booking",
      entityId: args.bookingId,
      action: "admin_refund_coaching_booking",
      userId: identity.subject,
      previousState: { paymentStatus: booking.paymentStatus, status: booking.status },
      newState: { paymentStatus: "refunded", status: "cancelled" },
      metadata: { reason: args.reason, amount: booking.totalAmount },
    })

    await ctx.runMutation(internal.notifications.createNotification, {
      userId: booking.renterId,
      type: "coaching_cancelled",
      title: "Coaching payment refunded",
      message: `Your payment of $${(booking.totalAmount / 100).toFixed(2)} has been refunded in full.`,
      link: "/trips",
      metadata: { bookingId: args.bookingId },
    })
  },
})

// Public query the checkout page can use to get just enough info to display a summary
export const getBookingForCheckout = action({
  args: { bookingId: v.id("coachingBookings") },
  handler: async (
    ctx,
    args
  ): Promise<{
    bookingId: Id<"coachingBookings">
    coachName: string
    coachProfileId: Id<"coachProfiles">
    sessionLabel: string
    startDate: string
    endDate: string
    startTime?: string
    totalAmount: number
    eventName?: string
  } | null> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const booking = await ctx.runQuery(api.coachingBookings.getById, { id: args.bookingId })
    if (!booking) return null
    if (booking.renterId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized to view this booking")
    }

    const sessionLabel =
      booking.sessionType === "hourly"
        ? `${booking.hours}-hour session`
        : booking.sessionType === "half_day"
          ? "Half-day"
          : "Full-day"

    return {
      bookingId: booking._id,
      coachName: booking.coach?.name || "Coach",
      coachProfileId: booking.coachProfileId,
      sessionLabel,
      startDate: booking.startDate,
      endDate: booking.endDate,
      startTime: booking.startTime,
      totalAmount: booking.totalAmount,
      eventName: booking.eventName,
    }
  },
})
