import { StripeSubscriptions } from "@convex-dev/stripe"
import type { UserIdentity } from "convex/server"
import { ConvexError, v } from "convex/values"
import Stripe from "stripe"
import { api, components, internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server"
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server"
import { checkAdmin } from "./admin"
import { parseLocalDate } from "./dateUtils"
import {
  getPaymentFailedEmailTemplate,
  getPaymentSucceededEmailTemplate,
  sendTransactionalEmail,
} from "./emails"
import { ErrorCode, throwError } from "./errors"
import { getWebUrl } from "./helpers"
import { verifyPayableInvoice } from "./invoices"
import {
  buildDestinationChargeAmounts,
  calculatePlatformFeeAmount,
  resolvePlatformFeePercentage,
} from "./pricing"
import { rateLimiter } from "./rateLimiter"
import { assertRentalDatesAvailable, getRentalConflicts } from "./rentalAvailability"
import { validateRentalQuote } from "./rentalQuote"
import { issueRentalRefund, syncRentalRefunds } from "./rentalRefunds"
import {
  billingCustomerId,
  EXPRESS_SIGN_IN_URL,
  retrieveLinkedConnectAccount,
  retrieveOwnedCustomer,
  verifiedPaymentDestination,
} from "./stripeOwnership"
import { publicUserProfile } from "./userProfile"

// ============================================================================
// Cancellation Policy - Tiered Refund Calculation
// ============================================================================

/**
 * Calculate refund percentage based on cancellation policy.
 *
 * Flexible Policy:
 * - 1+ days before start: 100% refund (full)
 * - <24 hours before start: 50% refund (partial)
 *
 * Moderate Policy (default):
 * - 7+ days before start: 100% refund (full)
 * - 2-7 days before start: 50% refund (partial)
 * - <48 hours before start: 0% refund (none)
 *
 * Strict Policy:
 * - 14+ days before start: 100% refund (full)
 * - 7-14 days before start: 50% refund (partial)
 * - <7 days before start: 0% refund (none)
 *
 * @param startDate - Rental start date in YYYY-MM-DD format
 * @param policyType - Cancellation policy type
 * @param cancellationDate - Date of cancellation (defaults to now)
 * @returns Object with refund percentage and policy tier
 */
export function calculateRefundTier(
  startDate: string,
  policyType: "flexible" | "moderate" | "strict" = "moderate",
  cancellationDate?: Date
): { percentage: number; policy: "full" | "partial" | "none" } {
  const now = cancellationDate || new Date()
  const start = parseLocalDate(startDate)

  if (!start) {
    // If we can't parse the date, default to no refund for safety
    return { percentage: 0, policy: "none" }
  }

  // Set both dates to start of day for accurate comparison
  now.setHours(0, 0, 0, 0)
  start.setHours(0, 0, 0, 0)

  // Calculate days until start
  const diffTime = start.getTime() - now.getTime()
  const daysUntilStart = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  // Apply policy-specific rules
  if (policyType === "flexible") {
    if (daysUntilStart >= 1) {
      return { percentage: 100, policy: "full" }
    }
    return { percentage: 50, policy: "partial" }
  }

  if (policyType === "strict") {
    if (daysUntilStart >= 14) {
      return { percentage: 100, policy: "full" }
    }
    if (daysUntilStart >= 7) {
      return { percentage: 50, policy: "partial" }
    }
    return { percentage: 0, policy: "none" }
  }

  // Default: moderate policy
  if (daysUntilStart >= 7) {
    return { percentage: 100, policy: "full" }
  }
  if (daysUntilStart >= 2) {
    return { percentage: 50, policy: "partial" }
  }
  return { percentage: 0, policy: "none" }
}

// Initialize Stripe client from component
const stripeClient = new StripeSubscriptions(components.stripe, {})

function rentalBillingCustomer(ctx: ActionCtx, stripe: Stripe, identity: UserIdentity) {
  return billingCustomerId(ctx, stripe, identity, () =>
    stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email || "",
      name: identity.name || "",
    })
  )
}

// Helper function to get Stripe instance (for Connect operations)
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

// ============================================================================
// Platform Fee Calculation (Keep your existing logic)
// ============================================================================

export const calculatePlatformFee = mutation({
  args: {
    amount: v.number(), // Amount in cents
    providerExternalId: v.string(), // Provider who pays the fee (owner, coach, etc.)
  },
  handler: async (ctx, args) => {
    // Validate amount
    if (args.amount <= 0) {
      throwError(ErrorCode.STRIPE_ACCOUNT_INCOMPLETE, "Amount must be positive")
    }

    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first()

    const globalFeePercentage = settings?.platformFeePercentage ?? 5

    if (globalFeePercentage < 0 || globalFeePercentage > 100) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
        "Platform fee percentage must be between 0 and 100"
      )
    }

    const provider = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.providerExternalId))
      .first()

    const feePercentage = resolvePlatformFeePercentage(
      globalFeePercentage,
      provider?.platformFeeCapPercentage
    )

    return calculatePlatformFeeAmount(args.amount, feePercentage)
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
      earlyAdopterFeeCapPercentage: 3,
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
    await checkAdmin(ctx)

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
    earlyAdopterPromoStartsAt: v.optional(v.union(v.number(), v.null())),
    earlyAdopterPromoEndsAt: v.optional(v.union(v.number(), v.null())),
    earlyAdopterFeeCapPercentage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await checkAdmin(ctx)

    // Validate inputs
    if (args.platformFeePercentage < 0 || args.platformFeePercentage > 100) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
        "Platform fee percentage must be between 0 and 100"
      )
    }

    if (
      args.earlyAdopterFeeCapPercentage !== undefined &&
      (args.earlyAdopterFeeCapPercentage < 0 || args.earlyAdopterFeeCapPercentage > 100)
    ) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
        "Early adopter fee cap must be between 0 and 100"
      )
    }

    const oldSettings = await ctx.db
      .query("platformSettings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first()

    const nextPromoStartsAt =
      args.earlyAdopterPromoStartsAt === undefined
        ? oldSettings?.earlyAdopterPromoStartsAt
        : args.earlyAdopterPromoStartsAt === null
          ? undefined
          : args.earlyAdopterPromoStartsAt
    const nextPromoEndsAt =
      args.earlyAdopterPromoEndsAt === undefined
        ? oldSettings?.earlyAdopterPromoEndsAt
        : args.earlyAdopterPromoEndsAt === null
          ? undefined
          : args.earlyAdopterPromoEndsAt

    if (
      nextPromoStartsAt != null &&
      nextPromoEndsAt != null &&
      nextPromoEndsAt < nextPromoStartsAt
    ) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
        "Early adopter promo end must be on or after the start"
      )
    }

    if (oldSettings) {
      await ctx.db.patch(oldSettings._id, {
        isActive: false,
        updatedAt: Date.now(),
      })
    }

    const earlyAdopterFeeCapPercentage =
      args.earlyAdopterFeeCapPercentage ?? oldSettings?.earlyAdopterFeeCapPercentage ?? 3

    // Create new active settings (preserve promo fields / stripe account from prior row)
    const newSettingsId = await ctx.db.insert("platformSettings", {
      platformFeePercentage: args.platformFeePercentage,
      earlyAdopterPromoStartsAt: nextPromoStartsAt,
      earlyAdopterPromoEndsAt: nextPromoEndsAt,
      earlyAdopterFeeCapPercentage,
      stripeAccountId: oldSettings?.stripeAccountId,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Audit log for platform settings change
    await ctx.runMutation(internal.auditLog.create, {
      entityType: "payment",
      entityId: newSettingsId,
      action: "update_platform_settings",
      userId: identity.subject,
      previousState: oldSettings
        ? {
            platformFeePercentage: oldSettings.platformFeePercentage,
            earlyAdopterPromoStartsAt: oldSettings.earlyAdopterPromoStartsAt,
            earlyAdopterPromoEndsAt: oldSettings.earlyAdopterPromoEndsAt,
            earlyAdopterFeeCapPercentage: oldSettings.earlyAdopterFeeCapPercentage,
          }
        : undefined,
      newState: {
        platformFeePercentage: args.platformFeePercentage,
        earlyAdopterPromoStartsAt: nextPromoStartsAt,
        earlyAdopterPromoEndsAt: nextPromoEndsAt,
        earlyAdopterFeeCapPercentage,
      },
      metadata: {
        oldSettingsId: oldSettings?._id,
        newSettingsId,
      },
    })

    return newSettingsId
  },
})

// ============================================================================
// Stripe Connect - Account Management
// ============================================================================

// Old versions created a new Express account on every incomplete onboarding attempt.
async function canRestartUnusedOnboarding(
  ctx: ActionCtx,
  stripe: Stripe,
  account: Stripe.Account,
  owner: Doc<"users">
) {
  if (
    owner.stripeAccountStatus !== "pending" ||
    account.details_submitted ||
    account.charges_enabled ||
    account.payouts_enabled ||
    !account.external_accounts ||
    account.external_accounts.data.length ||
    account.external_accounts.has_more ||
    Object.keys(account.metadata ?? {}).length ||
    (await ctx.runQuery(internal.users.hasPayoutHistoryForOnboarding, { userId: owner.externalId }))
  )
    return false
  const options = { stripeAccount: account.id }
  const [balance, transactions, transfers] = await Promise.all([
    stripe.balance.retrieve({}, options),
    stripe.balanceTransactions.list({ limit: 1 }, options),
    stripe.transfers.list({ destination: account.id, limit: 1 }),
  ])
  return (
    transactions.data.length === 0 &&
    transfers.data.length === 0 &&
    [
      ...balance.available,
      ...balance.pending,
      ...(balance.connect_reserved ?? []),
      ...(balance.instant_available ?? []),
      ...(balance.issuing?.available ?? []),
      ...(balance.refund_and_dispute_prefunding?.available ?? []),
      ...(balance.refund_and_dispute_prefunding?.pending ?? []),
    ].every((row) => row.amount === 0)
  )
}

// Create Stripe Connect account for vehicle owners
export const createConnectAccount = action({
  args: {
    ownerId: v.string(),
    returnUrlBase: v.optional(v.string()), // Allow client to specify the base URL for redirects
  },
  handler: async (
    ctx,
    args
  ): Promise<{ accountId: string; onboardingUrl: string | null; isComplete: boolean }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity || identity.subject !== args.ownerId) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized")
    }

    // Check if user already has a Connect account
    const user = await ctx.runQuery(internal.users.getByExternalIdInternal, {
      externalId: args.ownerId,
    })

    if (!user) throwError(ErrorCode.NOT_FOUND, "User not found")
    const stripe = getStripe()
    let account: Stripe.Account | undefined
    let replaceUnusedAccount: string | undefined
    if (user.stripeAccountId) {
      const linked = await retrieveLinkedConnectAccount(
        ctx,
        stripe,
        user.stripeAccountId,
        identity.subject
      )
      if (linked.details_submitted) {
        return { accountId: linked.id, onboardingUrl: null, isComplete: true }
      }
      if (linked.metadata?.renegadeUserId === identity.subject) {
        account = linked
      } else if (await canRestartUnusedOnboarding(ctx, stripe, linked, user)) {
        replaceUnusedAccount = linked.id
      } else {
        throwError(
          ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
          "Contact support to verify your existing Stripe account and resume onboarding."
        )
      }
    }
    if (!account) {
      account = await stripe.accounts.create(
        {
          type: "express",
          country: "US",
          email: identity.email || undefined,
          metadata: { renegadeUserId: identity.subject },
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        },
        { idempotencyKey: `renegade_connect_${identity.subject}_${replaceUnusedAccount ?? "new"}` }
      )
      await ctx.runMutation(internal.users.setStripeAccountId, {
        userId: identity.subject,
        stripeAccountId: account.id,
        replaceUnusedAccount,
      })
    }

    // Mark payoutSetup step as complete in onboarding (account created, even if not fully onboarded)
    await ctx.runMutation(api.users.updateHostOnboardingStep, {
      step: "payoutSetup",
      completed: true,
    })

    const configuredOrigin = new URL(getWebUrl()).origin
    const permittedOrigins = [
      configuredOrigin,
      "https://renegaderace.com",
      "https://www.renegaderace.com",
    ]
    const baseUrl =
      args.returnUrlBase && permittedOrigins.includes(args.returnUrlBase)
        ? args.returnUrlBase
        : configuredOrigin

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create(
      {
        account: account.id,
        refresh_url: `${baseUrl}/host/dashboard?stripe_refresh=true`,
        return_url: `${baseUrl}/host/dashboard?stripe_return=true`,
        type: "account_onboarding",
      },
      {
        idempotencyKey: `account_link_${account.id}_${Date.now()}`,
      }
    )

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
  handler: async (
    ctx,
    args
  ): Promise<{
    hasAccount: boolean
    isComplete: boolean
    chargesEnabled?: boolean
    payoutsEnabled?: boolean
    accountId?: string
  }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity || identity.subject !== args.ownerId)
      throwError(ErrorCode.FORBIDDEN, "Not authorized")
    const user = await ctx.runQuery(internal.users.getByExternalIdInternal, {
      externalId: args.ownerId,
    })

    if (!user?.stripeAccountId) {
      return {
        hasAccount: false,
        isComplete: false,
      }
    }

    const stripe = getStripe()
    const account = await retrieveLinkedConnectAccount(
      ctx,
      stripe,
      user.stripeAccountId,
      identity.subject
    )

    return {
      hasAccount: true,
      isComplete: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      accountId: account.id,
    }
  },
})

// Refresh Connect account status (sync with Stripe)
// Call this to update the database status based on current Stripe account state
export const refreshConnectAccountStatus = action({
  args: {
    ownerId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean
    reason?: string
    status?: "pending" | "enabled" | "restricted" | "disabled"
    chargesEnabled?: boolean
    payoutsEnabled?: boolean
    detailsSubmitted?: boolean
  }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity || identity.subject !== args.ownerId)
      throwError(ErrorCode.FORBIDDEN, "Not authorized")
    const user = await ctx.runQuery(internal.users.getByExternalIdInternal, {
      externalId: args.ownerId,
    })

    if (!user?.stripeAccountId) {
      return {
        success: false,
        reason: "No Stripe Connect account found",
      }
    }

    const stripe = getStripe()
    const account = await retrieveLinkedConnectAccount(
      ctx,
      stripe,
      user.stripeAccountId,
      identity.subject
    )

    // Determine account status based on Stripe account state
    // Same logic as the webhook handler
    let status: "pending" | "enabled" | "restricted" | "disabled"

    if (account.details_submitted === false || !account.charges_enabled) {
      status = "pending"
    } else if (account.payouts_enabled === false) {
      status = "pending"
    } else if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
      // Check for blocking restrictions (currently_due, past_due, or disabled_reason)
      // Note: eventually_due requirements are normal and don't block functionality
      const hasBlockingRestrictions =
        (account.requirements?.currently_due && account.requirements.currently_due.length > 0) ||
        (account.requirements?.past_due && account.requirements.past_due.length > 0) ||
        (account.requirements?.disabled_reason !== null &&
          account.requirements?.disabled_reason !== undefined)

      if (hasBlockingRestrictions) {
        status = "restricted"
      } else {
        status = "enabled"
      }
    } else {
      status = "pending"
    }

    // Update the status in Convex
    await ctx.runMutation(internal.users.updateStripeAccountStatus, {
      stripeAccountId: user.stripeAccountId,
      status,
    })

    return {
      success: true,
      status,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    }
  },
})

// Create login link for Connect account dashboard
export const createConnectLoginLink = action({
  args: {
    ownerId: v.string(),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity || identity.subject !== args.ownerId) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized")
    }

    const user = await ctx.runQuery(internal.users.getByExternalIdInternal, {
      externalId: args.ownerId,
    })

    if (!user?.stripeAccountId) {
      throwError(ErrorCode.STRIPE_ACCOUNT_INCOMPLETE, "No Stripe Connect account found")
    }

    const stripe = getStripe()
    const account = await retrieveLinkedConnectAccount(
      ctx,
      stripe,
      user.stripeAccountId,
      identity.subject
    )
    if (account.metadata?.renegadeUserId !== identity.subject) return { url: EXPRESS_SIGN_IN_URL }
    const loginLink = await stripe.accounts.createLoginLink(account.id)

    return {
      url: loginLink.url,
    }
  },
})

// ============================================================================
// Payment Creation with Stripe Connect
// ============================================================================

function assertRentalAwaitingPayment(
  reservation: Pick<Doc<"reservations">, "status" | "paymentStatus">
) {
  if (
    reservation.status !== "approved" ||
    (reservation.paymentStatus && !["pending", "failed"].includes(reservation.paymentStatus))
  ) {
    throwError(ErrorCode.INVALID_STATUS, "Reservation is not awaiting payment")
  }
}

export const assertRentalPaymentAvailable = internalQuery({
  args: { reservationId: v.id("reservations"), renterId: v.string() },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId)
    if (!reservation || reservation.renterId !== args.renterId) {
      throwError(ErrorCode.FORBIDDEN, "Payment reservation does not match the renter")
    }
    assertRentalAwaitingPayment(reservation)
    await assertRentalDatesAvailable(ctx, {
      vehicleId: reservation.vehicleId,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      excludeReservationId: reservation._id,
    })
  },
})

// Create checkout session for one-time payment (using component + Connect)
export const createCheckoutSession = action({
  args: {
    reservationId: v.id("reservations"),
    amount: v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ paymentId: any; sessionId: string; url: string | null }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const reservation = await ctx.runQuery(api.reservations.getById, {
      id: args.reservationId,
    })
    if (!reservation) {
      throwError(ErrorCode.NOT_FOUND, "Reservation not found")
    }

    if (reservation.renterId !== identity.subject) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
        "Not authorized to create payment for this reservation"
      )
    }

    assertRentalAwaitingPayment(reservation)

    await ctx.runQuery(internal.stripe.assertRentalPaymentAvailable, {
      reservationId: reservation._id,
      renterId: identity.subject,
    })

    // Trusted request snapshots keep their approved prices after listing edits.
    // Historical quotes are payable only when every stored amount/cadence matches.
    const vehicle = await ctx.runQuery(api.vehicles.getById, {
      id: reservation.vehicleId,
    })
    if (!vehicle) throwError(ErrorCode.NOT_FOUND, "Vehicle not found")
    const quote = validateRentalQuote(reservation, vehicle)
    if (!Number.isSafeInteger(args.amount) || args.amount !== quote.totalAmount) {
      throw new ConvexError({
        code: ErrorCode.PRICE_CHANGED,
        message: `Payment amount mismatch: expected ${quote.totalAmount} cents from the approved rental quote`,
      })
    }

    // Get owner's Stripe Connect account
    const owner = await ctx.runQuery(internal.users.getByExternalIdInternal, {
      externalId: reservation.ownerId,
    })

    if (!owner?.stripeAccountId) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
        "Owner must complete Stripe onboarding before accepting payments"
      )
    }

    // Verify Connect account is ready
    const stripe = getStripe()
    const connectAccount = await verifiedPaymentDestination(
      ctx,
      stripe,
      owner.stripeAccountId,
      owner.externalId
    )

    if (!connectAccount.details_submitted) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
        "Owner account onboarding is not complete. Please complete Stripe onboarding."
      )
    }

    if (!connectAccount.charges_enabled) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_DISABLED,
        "Owner account cannot accept charges yet. Please complete Stripe onboarding."
      )
    }

    // Check if transfers capability is enabled (required for destination payments)
    const capabilities = connectAccount.capabilities as Record<string, string> | undefined
    const transfersEnabled =
      capabilities?.transfers === "active" || capabilities?.legacy_payments === "active"

    if (!transfersEnabled) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
        "Owner account does not have transfers enabled. Please complete Stripe onboarding to enable transfers capability."
      )
    }

    // Calculate Renegade platform fee on the listing amount; renter covers card processing.
    const { platformFee, ownerAmount } = await ctx.runMutation(api.stripe.calculatePlatformFee, {
      amount: args.amount,
      providerExternalId: reservation.ownerId,
    })
    const { chargeAmountCents, processingFeeCents, applicationFeeCents } =
      buildDestinationChargeAmounts({
        listingAmountCents: args.amount,
        platformFeeCents: platformFee,
      })

    // Get or create Stripe customer (component handles this)
    const customerId = await rentalBillingCustomer(ctx, stripe, identity)

    const webUrl = getWebUrl()

    // Create checkout session using Stripe directly (component doesn't support Connect)
    // but we use the component's customer management
    const checkoutSession = await stripe.checkout.sessions.create(
      {
        customer: customerId,
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
          // Includes Renegade fee + processing so the provider nets ownerAmount
          application_fee_amount: applicationFeeCents,
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
            processingFee: processingFeeCents.toString(),
            chargeAmount: chargeAmountCents.toString(),
          },
        },
        success_url: `${webUrl}/checkout/success?reservationId=${args.reservationId}`,
        cancel_url: `${webUrl}/checkout?reservationId=${args.reservationId}`,
        metadata: {
          reservationId: args.reservationId,
          renterId: reservation.renterId,
          ownerId: reservation.ownerId,
        },
      },
      {
        idempotencyKey: `cs_create_${args.reservationId}`,
      }
    )

    // Create payment record
    const paymentId = await ctx.runMutation(internal.stripe.createPaymentRecord, {
      reservationId: args.reservationId,
      renterId: reservation.renterId,
      ownerId: reservation.ownerId,
      amount: args.amount,
      platformFee,
      ownerAmount,
      processingFee: processingFeeCents,
      stripeCustomerId: customerId,
      stripeCheckoutSessionId: checkoutSession.id,
      stripeAccountId: owner.stripeAccountId,
      metadata: {
        vehicleId: reservation.vehicleId,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        totalDays: reservation.totalDays,
      },
    })

    // Cancellation may race the external Stripe request. Do not expose its URL
    // after the booking stops being payable; retain the linked financial record.
    await ctx.runQuery(internal.stripe.assertRentalPaymentAvailable, {
      reservationId: reservation._id,
      renterId: identity.subject,
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
  handler: async (
    ctx,
    args
  ): Promise<{
    paymentId: Id<"payments">
    clientSecret: string
    amount: number
    processingFee: number
    chargeAmount: number
    platformFee: number
    ownerAmount: number
  }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    // Rate limit: 20 payment operations per hour per user
    await rateLimiter.limit(ctx, "processPayment", {
      key: identity.subject,
      throws: true,
    })

    const reservation = await ctx.runQuery(api.reservations.getById, {
      id: args.reservationId,
    })
    if (!reservation) {
      throwError(ErrorCode.NOT_FOUND, "Reservation not found")
    }

    if (reservation.renterId !== identity.subject) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
        "Not authorized to create payment for this reservation"
      )
    }

    assertRentalAwaitingPayment(reservation)

    await ctx.runQuery(internal.stripe.assertRentalPaymentAvailable, {
      reservationId: reservation._id,
      renterId: identity.subject,
    })

    // Trusted request snapshots keep their approved prices after listing edits.
    // Historical quotes are payable only when every stored amount/cadence matches.
    const vehicle = await ctx.runQuery(api.vehicles.getById, {
      id: reservation.vehicleId,
    })
    if (!vehicle) throwError(ErrorCode.NOT_FOUND, "Vehicle not found")
    const quote = validateRentalQuote(reservation, vehicle)
    if (!Number.isSafeInteger(args.amount) || args.amount !== quote.totalAmount) {
      throw new ConvexError({
        code: ErrorCode.PRICE_CHANGED,
        message: `Payment amount mismatch: expected ${quote.totalAmount} cents from the approved rental quote`,
      })
    }

    // Get owner's Stripe Connect account
    const owner = await ctx.runQuery(internal.users.getByExternalIdInternal, {
      externalId: reservation.ownerId,
    })

    if (!owner?.stripeAccountId) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
        "Owner must complete Stripe onboarding before accepting payments"
      )
    }

    // Verify Connect account is ready and has required capabilities
    const stripe = getStripe()
    const connectAccount = await verifiedPaymentDestination(
      ctx,
      stripe,
      owner.stripeAccountId,
      owner.externalId
    )

    if (!connectAccount.details_submitted) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
        "Owner account onboarding is not complete. Please complete Stripe onboarding."
      )
    }

    if (!connectAccount.charges_enabled) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_DISABLED,
        "Owner account cannot accept charges yet. Please complete Stripe onboarding."
      )
    }

    // Check if transfers capability is enabled (required for destination payments)
    const capabilities = connectAccount.capabilities as Record<string, string> | undefined
    const transfersEnabled =
      capabilities?.transfers === "active" || capabilities?.legacy_payments === "active"

    if (!transfersEnabled) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
        "Owner account does not have transfers enabled. Please complete Stripe onboarding to enable transfers capability."
      )
    }

    // Calculate Renegade platform fee on the listing amount; renter covers card processing.
    const { platformFee, ownerAmount } = await ctx.runMutation(api.stripe.calculatePlatformFee, {
      amount: args.amount,
      providerExternalId: reservation.ownerId,
    })
    const { chargeAmountCents, processingFeeCents, applicationFeeCents } =
      buildDestinationChargeAmounts({
        listingAmountCents: args.amount,
        platformFeeCents: platformFee,
      })

    // Get or create Stripe customer (component handles this)
    const customerId = await rentalBillingCustomer(ctx, stripe, identity)

    // Create Stripe Payment Intent with Connect
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: chargeAmountCents,
        currency: "usd",
        customer: customerId,
        // Includes Renegade fee + processing so the provider nets ownerAmount
        application_fee_amount: applicationFeeCents,
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
          processingFee: processingFeeCents.toString(),
          chargeAmount: chargeAmountCents.toString(),
        },
        automatic_payment_methods: {
          enabled: true,
        },
      },
      {
        idempotencyKey: `pi_create_${args.reservationId}`,
      }
    )

    // Create payment record
    const paymentId = await ctx.runMutation(internal.stripe.createPaymentRecord, {
      reservationId: args.reservationId,
      renterId: reservation.renterId,
      ownerId: reservation.ownerId,
      amount: args.amount,
      platformFee,
      ownerAmount,
      processingFee: processingFeeCents,
      stripePaymentIntentId: paymentIntent.id,
      stripeCustomerId: customerId,
      stripeAccountId: owner.stripeAccountId,
      metadata: {
        vehicleId: reservation.vehicleId,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        totalDays: reservation.totalDays,
      },
    })

    // A previously issued secret can outlive a cancellation. Recheck before
    // returning it; signed success events separately guard final confirmation.
    await ctx.runQuery(internal.stripe.assertRentalPaymentAvailable, {
      reservationId: reservation._id,
      renterId: identity.subject,
    })

    return {
      paymentId,
      clientSecret: paymentIntent.client_secret as string,
      amount: args.amount,
      processingFee: processingFeeCents,
      chargeAmount: chargeAmountCents,
      platformFee,
      ownerAmount,
    }
  },
})

// ============================================================================
// Payment Record Management
// ============================================================================

export const createPaymentRecord = internalMutation({
  args: {
    reservationId: v.id("reservations"),
    renterId: v.string(),
    ownerId: v.string(),
    amount: v.number(),
    platformFee: v.number(),
    ownerAmount: v.number(),
    processingFee: v.optional(v.number()),
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
    const reservation = await ctx.db.get(args.reservationId)
    if (
      !reservation ||
      reservation.renterId !== args.renterId ||
      reservation.ownerId !== args.ownerId
    ) {
      throwError(ErrorCode.CONFLICT, "Payment participants do not match the reservation")
    }

    await assertRentalDatesAvailable(ctx, {
      vehicleId: reservation.vehicleId,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      excludeReservationId: reservation._id,
    })

    const existing = args.stripePaymentIntentId
      ? await paymentForIntent(ctx, args.stripePaymentIntentId)
      : args.stripeCheckoutSessionId
        ? await paymentForSession(ctx, args.stripeCheckoutSessionId)
        : null
    if (existing) {
      if (
        existing.reservationId !== args.reservationId ||
        existing.amount !== args.amount ||
        existing.renterId !== args.renterId ||
        existing.ownerId !== args.ownerId
      ) {
        throwError(ErrorCode.CONFLICT, "Stripe payment is linked to a different booking or amount")
      }
      return existing._id
    }
    if (!(args.stripePaymentIntentId || args.stripeCheckoutSessionId)) {
      throwError(ErrorCode.INVALID_INPUT, "A Stripe payment intent or checkout session is required")
    }
    assertRentalAwaitingPayment(reservation)

    const paymentId = await ctx.db.insert("payments", {
      reservationId: args.reservationId,
      renterId: args.renterId,
      ownerId: args.ownerId,
      amount: args.amount,
      platformFee: args.platformFee,
      ownerAmount: args.ownerAmount,
      processingFee: args.processingFee,
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

// Older checkout retries could create multiple rows for one Stripe object.
async function linkedPayment(
  ctx: QueryCtx,
  candidates: Doc<"payments">[],
  reservationId?: Id<"reservations">
) {
  const payments = reservationId
    ? candidates.filter((p) => p.reservationId === reservationId)
    : candidates
  if (payments.length < 2) return payments[0] ?? null
  for (const payment of payments) {
    if ((await ctx.db.get(payment.reservationId))?.paymentId === payment._id) return payment
  }
  return payments[0] ?? null
}

async function paymentForIntent(
  ctx: QueryCtx,
  intentId: string,
  reservationId?: Id<"reservations">
) {
  return linkedPayment(
    ctx,
    await ctx.db
      .query("payments")
      .withIndex("by_stripe_payment_intent", (q) => q.eq("stripePaymentIntentId", intentId))
      .collect(),
    reservationId
  )
}

async function paymentForSession(
  ctx: QueryCtx,
  sessionId: string,
  reservationId?: Id<"reservations">
) {
  return linkedPayment(
    ctx,
    await ctx.db
      .query("payments")
      .withIndex("by_stripe_checkout_session", (q) => q.eq("stripeCheckoutSessionId", sessionId))
      .collect(),
    reservationId
  )
}

const rentalEventFields = {
  reservationId: v.string(),
  renterId: v.string(),
  ownerId: v.string(),
  currency: v.string(),
  amount: v.number(),
}

type RentalEventFields = {
  reservationId: string
  renterId: string
  ownerId: string
  currency: string
  amount: number
}

// These fields come from the signed Stripe event. Local rows created before the
// authorization fix are insufficient evidence of which reservation was paid.
function verifyRentalPayment(
  payment: Doc<"payments"> | null,
  reservation: Doc<"reservations">,
  evidence: RentalEventFields
): asserts payment is Doc<"payments"> {
  if (
    !payment ||
    payment.reservationId !== reservation._id ||
    reservation._id !== evidence.reservationId ||
    reservation.renterId !== evidence.renterId ||
    reservation.ownerId !== evidence.ownerId ||
    payment.renterId !== evidence.renterId ||
    payment.ownerId !== evidence.ownerId ||
    payment.currency !== evidence.currency ||
    payment.amount + (payment.processingFee ?? 0) !== evidence.amount
  ) {
    throw new Error("Stripe event does not match the rental payment")
  }
}

async function getRentalReservation(ctx: MutationCtx, reservationId: string) {
  const id = ctx.db.normalizeId("reservations", reservationId)
  const reservation = id && (await ctx.db.get(id))
  if (!reservation) throw new Error("Rental reservation does not exist")
  return reservation
}

export const bindRentalCheckoutIntent = internalMutation({
  args: {
    ...rentalEventFields,
    stripeCheckoutSessionId: v.string(),
    stripePaymentIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    const reservation = await getRentalReservation(ctx, args.reservationId)
    const payment = await paymentForSession(ctx, args.stripeCheckoutSessionId, reservation._id)
    verifyRentalPayment(payment, reservation, args)
    if (
      payment.stripePaymentIntentId &&
      payment.stripePaymentIntentId !== args.stripePaymentIntentId
    ) {
      throw new Error("Stripe checkout session already bound to another payment intent")
    }
    if (!payment.stripePaymentIntentId) {
      await ctx.db.patch(payment._id, {
        stripePaymentIntentId: args.stripePaymentIntentId,
        updatedAt: Date.now(),
      })
    }
  },
})

async function notifyRentalPayment(
  ctx: MutationCtx,
  payment: Doc<"payments">,
  reservation: Doc<"reservations">,
  { succeeded, failureReason }: { succeeded: boolean; failureReason?: string }
) {
  const link = succeeded ? "/trips" : `/checkout/pay?reservationId=${reservation._id}`
  await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
    userId: payment.renterId,
    type: succeeded ? "payment_success" : "payment_failed",
    title: succeeded ? "Payment Successful" : "Payment Failed",
    message: succeeded
      ? `Your payment of $${(payment.amount / 100).toFixed(2)} was successful.`
      : "Your payment failed. Please try again or use a different payment method.",
    link,
    metadata: {
      paymentId: payment._id,
      reservationId: reservation._id,
      ...(failureReason && { failureReason }),
    },
  })

  const [vehicle, renter] = await Promise.all([
    ctx.db.get(reservation.vehicleId),
    ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", payment.renterId))
      .first(),
  ])
  if (vehicle && renter?.email) {
    const details = {
      renterName: renter.name || "Guest",
      vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      totalAmount: payment.amount,
      reservationUrl: `${getWebUrl()}${link}`,
    }
    const template = succeeded
      ? getPaymentSucceededEmailTemplate({ ...details, paymentDate: new Date().toISOString() })
      : getPaymentFailedEmailTemplate({ ...details, failureReason })
    await sendTransactionalEmail(ctx, renter.email, template)
  }
}

// Receipt, state transitions and notification enqueue share a transaction.
// If Stripe delivers Checkout's intent first, failure to find the mapping
// deliberately rolls back the receipt so Stripe can retry after the session event.
export const ingestRentalPaymentEvent = internalMutation({
  args: {
    ...rentalEventFields,
    stripePaymentIntentId: v.string(),
    stripeChargeId: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    eventId: v.string(),
    eventType: v.union(
      v.literal("payment_intent.succeeded"),
      v.literal("payment_intent.payment_failed"),
      v.literal("payment_intent.canceled")
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    if (
      await ctx.runQuery(internal.webhookIdempotency.checkWebhookEvent, {
        eventId: args.eventId,
        source: "stripe",
      })
    )
      return
    const reservation = await getRentalReservation(ctx, args.reservationId)
    const payment = await paymentForIntent(ctx, args.stripePaymentIntentId, reservation._id)
    verifyRentalPayment(payment, reservation, args)
    await ctx.runMutation(internal.webhookIdempotency.recordWebhookEvent, {
      eventId: args.eventId,
      source: "stripe",
      eventType: args.eventType,
    })
    const now = Date.now()
    if (args.eventType === "payment_intent.succeeded") {
      if (!args.stripeChargeId) throw new Error("Captured rental payment missing its Stripe charge")
      if (payment.stripeChargeId && payment.stripeChargeId !== args.stripeChargeId)
        throw new Error("Rental payment charge mismatch")
      const alreadyCaptured =
        payment.status === "succeeded" ||
        payment.status === "partially_refunded" ||
        payment.status === "refunded"
      if (!(alreadyCaptured && payment.stripeChargeId)) {
        await ctx.db.patch(payment._id, {
          status: alreadyCaptured ? payment.status : "succeeded",
          stripeChargeId: args.stripeChargeId,
          failureReason: undefined,
          updatedAt: now,
        })
      }
      if (payment.status === "refunded") return
      const settled =
        reservation.paymentStatus === "paid" ||
        reservation.paymentStatus === "partially_refunded" ||
        reservation.paymentStatus === "refunded"
      const canConfirm =
        reservation.status === "approved" &&
        (!settled || reservation.paymentId === payment._id) &&
        reservation.paymentStatus !== "refunded"
      const sameConfirmedRental =
        reservation.status === "confirmed" &&
        reservation.paymentId === payment._id &&
        reservation.paymentStatus !== "refunded"

      if (canConfirm) {
        // Stripe confirmation is outside Convex's transaction. A previously
        // issued checkout can capture after dates become blocked or reserved.
        const conflicts = await getRentalConflicts(ctx, {
          vehicleId: reservation.vehicleId,
          startDate: reservation.startDate,
          endDate: reservation.endDate,
          excludeReservationId: reservation._id,
        })
        const priorReview = await ctx.db
          .query("auditLogs")
          .withIndex("by_entity", (q) => q.eq("entityType", "payment").eq("entityId", payment._id))
          .filter((q) => q.eq(q.field("action"), "rental_capture_requires_reconciliation"))
          .first()
        if (!conflicts.isAvailable || priorReview) {
          // Preserve capture truth and stop new payment attempts, but do not
          // confirm a second booking or refund without an explicit resolution.
          await ctx.db.patch(reservation._id, {
            paymentId: payment._id,
            paymentStatus: payment.status === "partially_refunded" ? "partially_refunded" : "paid",
            updatedAt: now,
          })
          if (!priorReview) {
            await ctx.runMutation(internal.auditLog.create, {
              entityType: "payment",
              entityId: payment._id,
              action: "rental_capture_requires_reconciliation",
              metadata: {
                reservationId: reservation._id,
                reservationStatus: reservation.status,
                stripePaymentIntentId: args.stripePaymentIntentId,
                reason: "rental_dates_unavailable",
                blockedDates: conflicts.blockedDates.map((item) => item.date),
                conflictingReservationIds: conflicts.reservedReservations.map((item) => item._id),
              },
            })
            for (const userId of new Set([reservation.renterId, reservation.ownerId])) {
              await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
                userId,
                type: "system",
                title: "Rental payment needs review",
                message:
                  "Payment was received, but the rental dates conflict with another booking or a host block. The rental is not confirmed. Contact support to resolve it; do not submit another payment.",
                link: userId === reservation.renterId ? "/trips" : "/host/reservations",
                metadata: { reservationId: reservation._id, paymentId: payment._id },
              })
            }
          }
          return
        }
      }
      if (canConfirm || sameConfirmedRental) {
        const paymentStatus =
          payment.status === "partially_refunded" ? "partially_refunded" : "paid"
        if (
          reservation.paymentStatus === paymentStatus &&
          reservation.paymentId === payment._id &&
          reservation.status === "confirmed"
        )
          return
        await ctx.db.patch(reservation._id, {
          paymentId: payment._id,
          status: "confirmed",
          paymentStatus,
          updatedAt: now,
        })
        await notifyRentalPayment(ctx, payment, reservation, { succeeded: true })
      } else if (!alreadyCaptured) {
        // A real capture can arrive after cancellation or settlement by another intent.
        // Preserve the capture for reconciliation without reopening the booking.
        await ctx.runMutation(internal.auditLog.create, {
          entityType: "payment",
          entityId: payment._id,
          action: "rental_capture_requires_reconciliation",
          metadata: {
            reservationId: reservation._id,
            reservationStatus: reservation.status,
            stripePaymentIntentId: args.stripePaymentIntentId,
          },
        })
      }
      return
    }

    if (
      payment.status !== "pending" &&
      payment.status !== "processing" &&
      !(payment.status === "failed" && args.eventType === "payment_intent.canceled")
    )
      return
    const canceled = args.eventType === "payment_intent.canceled"
    await ctx.db.patch(payment._id, {
      status: canceled ? "cancelled" : "failed",
      failureReason: args.failureReason,
      updatedAt: now,
    })
    if (
      (reservation.paymentId == null || reservation.paymentId === payment._id) &&
      reservation.status === "approved" &&
      (reservation.paymentStatus === "pending" ||
        reservation.paymentStatus === "failed" ||
        !reservation.paymentStatus)
    ) {
      await ctx.db.patch(reservation._id, { paymentStatus: "failed", updatedAt: now })
      if (!canceled)
        await notifyRentalPayment(ctx, payment, reservation, {
          succeeded: false,
          failureReason: args.failureReason,
        })
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
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const stripe = getStripe()
    const customerId = await rentalBillingCustomer(ctx, stripe, identity)

    // The portal can expose a payment link for any payable invoice on the customer.
    for (const status of ["open", "uncollectible"] as const) {
      for await (const invoice of stripe.invoices.list({
        customer: customerId,
        status,
        limit: 100,
      })) {
        if (invoice.metadata?.type !== "custom_invoice") continue
        if (!invoice.id) throwError(ErrorCode.FORBIDDEN, "Missing Stripe invoice ID")
        const local = await ctx.runQuery(internal.invoices.findByStripeInvoiceId, {
          stripeInvoiceId: invoice.id,
        })
        if (!local || local.recipientId !== identity.subject) {
          throwError(ErrorCode.FORBIDDEN, "Invoice ownership could not be verified")
        }
        await verifyPayableInvoice(ctx, stripe, local, invoice)
      }
    }

    // Create portal session
    const session = await stripeClient.createCustomerPortalSession(ctx, {
      customerId,
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

// Internal reads allow scheduled cancellation work to run without a Clerk identity.
export const getRentalForRefund = internalQuery({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, { paymentId }) => {
    const payment = await ctx.db.get(paymentId)
    if (!payment) throwError(ErrorCode.NOT_FOUND, "Payment not found")
    const reservation = await ctx.db.get(payment.reservationId)
    if (
      !reservation ||
      reservation.ownerId !== payment.ownerId ||
      reservation.renterId !== payment.renterId
    ) {
      throwError(ErrorCode.CONFLICT, "Payment does not match the reservation")
    }
    if (reservation.paymentId && reservation.paymentId !== paymentId) {
      const linked = await ctx.db.get(reservation.paymentId)
      if (
        linked &&
        ((payment.stripeChargeId && linked.stripeChargeId === payment.stripeChargeId) ||
          (payment.stripePaymentIntentId &&
            linked.stripePaymentIntentId === payment.stripePaymentIntentId) ||
          (payment.stripeCheckoutSessionId &&
            linked.stripeCheckoutSessionId === payment.stripeCheckoutSessionId))
      )
        throwError(ErrorCode.CONFLICT, "Use the linked payment to refund this Stripe charge")
    }
    const vehicle = await ctx.db.get(reservation.vehicleId)
    return { payment, reservation, cancellationPolicy: vehicle?.cancellationPolicy }
  },
})

export const processRefundOnCancellation = internalAction({
  args: {
    paymentId: v.id("payments"),
    reservationId: v.id("reservations"),
    reason: v.string(),
    forceFullRefund: v.optional(v.boolean()),
    cancelledAt: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean
    refunded: boolean
    refundId?: string
    refundAmount?: number
    percentage: number
    policy: string
  }> => {
    const { payment, reservation, cancellationPolicy } = await ctx.runQuery(
      internal.stripe.getRentalForRefund,
      { paymentId: args.paymentId }
    )
    if (
      reservation._id !== args.reservationId ||
      reservation.status !== "cancelled" ||
      (reservation.paymentId && reservation.paymentId !== payment._id)
    ) {
      throwError(ErrorCode.INVALID_STATUS, "Refund requires the matching cancelled reservation")
    }
    const { percentage, policy } = args.forceFullRefund
      ? { percentage: 100, policy: "full" as const }
      : calculateRefundTier(
          reservation.startDate,
          cancellationPolicy,
          new Date(args.cancelledAt ?? reservation.updatedAt)
        )
    const refund = await issueRentalRefund(ctx, getStripe(), payment, {
      source: "cancellation",
      reason: args.reason,
      percentage,
      policy,
      forceFullRefund: args.forceFullRefund,
      requestId: reservation._id,
    })
    return {
      success: true,
      refunded: refund?.status === "succeeded",
      refundId: refund?.id,
      refundAmount: refund?.amount,
      percentage,
      policy,
    }
  },
})

export const processRefund: ReturnType<typeof action> = action({
  args: {
    paymentId: v.id("payments"),
    amount: v.optional(v.number()),
    reason: v.optional(v.string()),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    const { payment, reservation } = await ctx.runQuery(internal.stripe.getRentalForRefund, {
      paymentId: args.paymentId,
    })
    if (
      payment.ownerId !== identity.subject ||
      (reservation.paymentId && reservation.paymentId !== payment._id)
    ) {
      throwError(ErrorCode.FORBIDDEN, "Only the payment owner can refund the linked rental payment")
    }
    return await issueRentalRefund(ctx, getStripe(), payment, {
      source: "owner",
      amount: args.amount,
      reason: args.reason,
      requestId: args.requestId,
    })
  },
})

export const refundRentalAsAdmin = internalAction({
  args: {
    paymentId: v.id("payments"),
    amount: v.number(),
    reason: v.string(),
    adminId: v.string(),
    refundPolicy: v.optional(v.union(v.literal("full"), v.literal("partial"), v.literal("custom"))),
    requestId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    paymentId: Id<"payments">
    refundAmount: number
    refundId: string
    status: string | null
  }> => {
    const { payment } = await ctx.runQuery(internal.stripe.getRentalForRefund, {
      paymentId: args.paymentId,
    })
    const refund = await issueRentalRefund(ctx, getStripe(), payment, {
      source: "admin",
      amount: args.amount,
      reason: args.reason,
      adminId: args.adminId,
      policy: args.refundPolicy,
      requestId: args.requestId,
    })
    if (!refund) throwError(ErrorCode.INVALID_REFUND_AMOUNT, "No refundable balance")
    return {
      paymentId: payment._id,
      refundAmount: refund.amount,
      refundId: refund.id,
      status: refund.status,
    }
  },
})

// ============================================================================
// Helper Mutations
// ============================================================================

export const updateRefundStatus = internalMutation({
  args: {
    paymentId: v.id("payments"),
    capturedAmount: v.number(),
    refundAmount: v.number(),
    stripeChargeId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    expectedVersion: v.number(),
    cancelOnFull: v.boolean(),
    details: v.optional(
      v.object({
        reason: v.optional(v.string()),
        policy: v.optional(
          v.union(v.literal("full"), v.literal("partial"), v.literal("none"), v.literal("custom"))
        ),
        adminId: v.optional(v.string()),
        refundId: v.optional(v.string()),
        amount: v.optional(v.number()),
        stripeStatus: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args): Promise<number | null> => {
    const payment = await ctx.db.get(args.paymentId)
    if (!payment) throwError(ErrorCode.NOT_FOUND, "Payment not found")
    const version = payment.refundSyncVersion ?? 0
    if (version !== args.expectedVersion) return version
    const { capturedAmount, refundAmount, details } = args
    if (capturedAmount <= 0 || refundAmount < 0 || refundAmount > capturedAmount) {
      throwError(ErrorCode.INVALID_REFUND_AMOUNT, "Invalid Stripe refund totals")
    }
    const full = refundAmount === capturedAmount
    const status = full ? "refunded" : refundAmount > 0 ? "partially_refunded" : "succeeded"
    await ctx.db.patch(payment._id, {
      status,
      capturedAmount,
      refundAmount,
      stripeChargeId: args.stripeChargeId,
      ...(args.stripePaymentIntentId && { stripePaymentIntentId: args.stripePaymentIntentId }),
      refundPercentage: Math.round((100 * refundAmount) / capturedAmount),
      ...(details?.reason && { refundReason: details.reason }),
      ...(details?.policy && { refundPolicy: details.policy }),
      refundSyncVersion: version + 1,
      updatedAt: Date.now(),
    })
    const reservation = await ctx.db.get(payment.reservationId)
    if (
      reservation &&
      reservation.renterId === payment.renterId &&
      reservation.ownerId === payment.ownerId &&
      (!reservation.paymentId || reservation.paymentId === payment._id)
    ) {
      await ctx.db.patch(reservation._id, {
        paymentStatus: full ? "refunded" : refundAmount > 0 ? "partially_refunded" : "paid",
        ...(full && args.cancelOnFull && { status: "cancelled" as const }),
        ...(full && details?.adminId && details.reason && { cancellationReason: details.reason }),
        updatedAt: Date.now(),
      })
    }
    if (details?.adminId && details.refundId) {
      const previous = await ctx.db
        .query("auditLogs")
        .withIndex("by_entity", (q) => q.eq("entityType", "payment").eq("entityId", payment._id))
        .filter((q) =>
          q.and(
            q.or(
              q.eq(q.field("action"), "admin_refund_processed"),
              q.eq(q.field("action"), "admin_refund_requested")
            ),
            q.eq(q.field("metadata.refundId"), details.refundId)
          )
        )
        .first()
      if (!previous) {
        await ctx.db.insert("auditLogs", {
          entityType: "payment",
          entityId: payment._id,
          action:
            details.stripeStatus === "succeeded"
              ? "admin_refund_processed"
              : "admin_refund_requested",
          userId: details.adminId,
          previousState: { status: payment.status, refundAmount: payment.refundAmount },
          newState: { status, refundAmount },
          metadata: {
            reason: details.reason,
            amount: details.amount,
            refundId: details.refundId,
            stripeStatus: details.stripeStatus,
          },
          timestamp: Date.now(),
        })
      }
    }
    return null
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
    if ((await ctx.auth.getUserIdentity())?.subject !== args.userId) await checkAdmin(ctx)
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
          owner: publicUserProfile(owner),
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
    await checkAdmin(ctx)
    const payment = await ctx.db.get(args.paymentId)
    if (!payment) {
      return null
    }

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
  handler: async (
    ctx,
    args
  ): Promise<
    Array<{
      id: string
      type: string
      card: { brand: string; last4: string; expMonth: number; expYear: number } | null
      billingDetails: any
      created: number
    }>
  > => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    // Verify the customer belongs to the current user
    const user = await ctx.runQuery(internal.users.getByExternalIdInternal, {
      externalId: identity.subject,
    })

    if (!user || user.stripeCustomerId !== args.customerId) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized")
    }

    const stripe = getStripe()
    await retrieveOwnedCustomer(stripe, args.customerId, identity.subject)
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
  handler: async (
    ctx,
    args
  ): Promise<
    Array<{
      id: string
      number: string | null
      amount: number
      currency: string
      status: string | null
      created: number
      dueDate: number | null
      hostedInvoiceUrl: string | null
      invoicePdf: string | null
      description: string
    }>
  > => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    // Verify the customer belongs to the current user
    const user = await ctx.runQuery(internal.users.getByExternalIdInternal, {
      externalId: identity.subject,
    })

    if (!user || user.stripeCustomerId !== args.customerId) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized")
    }

    const stripe = getStripe()
    await retrieveOwnedCustomer(stripe, args.customerId, identity.subject)
    const invoices = await stripe.invoices.list({
      customer: args.customerId,
      limit: args.limit || 10,
    })

    return invoices.data.map((invoice) => {
      // A Stripe PDF can contain the same pay link as the hosted invoice.
      // Route unpaid custom invoices back through the recipient's guarded payment flow.
      const requiresPaymentCheck =
        invoice.metadata?.type === "custom_invoice" &&
        invoice.status !== "paid" &&
        invoice.status !== "void"
      const localId = invoice.metadata?.invoiceId
      return {
        id: invoice.id!,
        number: invoice.number,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        created: invoice.created,
        dueDate: invoice.due_date,
        hostedInvoiceUrl: requiresPaymentCheck
          ? localId
            ? `${getWebUrl()}/deals/invoices/${encodeURIComponent(localId)}`
            : null
          : (invoice.hosted_invoice_url ?? null),
        invoicePdf: requiresPaymentCheck ? null : (invoice.invoice_pdf ?? null),
        description: invoice.description || invoice.lines?.data[0]?.description || "Vehicle rental",
      }
    })
  },
})

// Get customer details including default payment method
export const getCustomerDetails = action({
  args: {
    customerId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    id: string
    email: string | null
    name: string | null
    phone: string | null
    address: any
    defaultSource: any
    invoiceSettings: any
  }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    // Verify the customer belongs to the current user
    const user = await ctx.runQuery(internal.users.getByExternalIdInternal, {
      externalId: identity.subject,
    })

    if (!user || user.stripeCustomerId !== args.customerId) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized")
    }

    const stripe = getStripe()
    const customer = await retrieveOwnedCustomer(stripe, args.customerId, identity.subject)

    return {
      id: customer.id,
      email: customer.email ?? null,
      name: customer.name ?? null,
      phone: customer.phone ?? null,
      address: customer.address,
      defaultSource: customer.default_source,
      invoiceSettings: customer.invoice_settings,
    }
  },
})

// ============================================================================
// Webhook Handler Mutations
// ============================================================================

export const findRentalCharge = internalQuery({
  args: {
    stripePaymentIntentId: v.string(),
    chargeId: v.optional(v.string()),
    reservationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = args.reservationId
      ? ctx.db.normalizeId("reservations", args.reservationId)
      : undefined
    if (id === null) return null
    const payment = await paymentForIntent(ctx, args.stripePaymentIntentId, id)
    if (payment) return payment
    if (args.chargeId) {
      const linked = await linkedPayment(
        ctx,
        await ctx.db
          .query("payments")
          .withIndex("by_stripe_charge", (q) => q.eq("stripeChargeId", args.chargeId))
          .collect(),
        id
      )
      if (linked) return linked
    }
    // Older Checkout rows may only carry the session ID. syncRentalRefunds
    // resolves that session's actual charge before it accepts the event.
    if (!id) return null
    const reservation = await ctx.db.get(id)
    if (!reservation?.paymentId) return null
    const legacy = await ctx.db.get(reservation.paymentId)
    return legacy?.stripeCheckoutSessionId &&
      !legacy.stripePaymentIntentId &&
      !legacy.stripeChargeId
      ? legacy
      : null
  },
})

export const syncChargeRefunds = internalAction({
  args: {
    stripePaymentIntentId: v.string(),
    chargeId: v.optional(v.string()),
    requireMatchingPayment: v.optional(v.boolean()),
    reservationId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const payment = await ctx.runQuery(internal.stripe.findRentalCharge, {
      stripePaymentIntentId: args.stripePaymentIntentId,
      chargeId: args.chargeId,
      reservationId: args.reservationId,
    })
    if (!payment) {
      if (args.requireMatchingPayment)
        throwError(
          ErrorCode.NOT_FOUND,
          "Rental payment is not available for refund reconciliation yet"
        )
      return
    }
    await syncRentalRefunds(ctx, getStripe(), payment, args.chargeId)
  },
})

// Handle transfer failed webhook event
export const handleTransferFailed = internalMutation({
  args: {
    stripeTransferId: v.string(),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    // Find payment by transfer ID
    const payments = await ctx.db.query("payments").collect()
    const payment = payments.find((p) => p.stripeTransferId === args.stripeTransferId)

    if (!payment) {
      return
    }

    await ctx.db.patch(payment._id, {
      failureReason: args.failureReason || "Transfer failed",
      updatedAt: Date.now(),
    })
  },
})

// Handle payout failed webhook event
export const handlePayoutFailed = internalMutation({
  args: {
    stripeAccountId: v.string(),
    payoutId: v.string(),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    // Find user by Stripe account ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_account", (q) => q.eq("stripeAccountId", args.stripeAccountId))
      .unique()

    if (user) {
      // TODO: handle payout failure notification
    }
  },
})

// Handle account deauthorized webhook event
export const handleAccountDeauthorized = internalMutation({
  args: {
    stripeAccountId: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // Find user by Stripe account ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_account", (q) => q.eq("stripeAccountId", args.stripeAccountId))
      .unique()

    if (!user) {
      return
    }

    // Update user's Stripe account status to disabled
    await ctx.db.patch(user._id, {
      stripeAccountStatus: "disabled",
    })
  },
})

// Handle charge dispute created webhook event
export const handleDisputeCreated = internalMutation({
  args: {
    stripePaymentIntentId: v.string(),
    disputeId: v.string(),
    disputeReason: v.optional(v.string()),
    disputeAmount: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_stripe_payment_intent", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .first()

    if (!payment) {
      return
    }

    // Could create a system notification or flag the reservation for review
    if (payment.reservationId) {
      const reservation = await ctx.db.get(payment.reservationId)
      if (reservation) {
        // TODO: flag reservation for review
      }
    }
  },
})

// Older deployments may have scheduled a retry between updating the payment
// and confirming its reservation. Reconcile against Stripe before repairing it.
export const retryReservationUpdate = internalAction({
  args: { paymentId: v.id("payments"), reservationId: v.id("reservations") },
  handler: async (ctx, args): Promise<void> => {
    const payment = await ctx.runQuery(internal.admin.getPaymentForRefund, {
      paymentId: args.paymentId,
    })
    if (!payment?.stripePaymentIntentId || payment.reservationId !== args.reservationId) return
    const intent = await getStripe().paymentIntents.retrieve(payment.stripePaymentIntentId)
    if (intent.status !== "succeeded") return
    if (
      intent.metadata.type ||
      !(intent.metadata.reservationId && intent.metadata.renterId && intent.metadata.ownerId)
    ) {
      throwError(ErrorCode.CONFLICT, "Stripe payment intent is missing rental metadata")
    }
    await ctx.runMutation(internal.stripe.ingestRentalPaymentEvent, {
      eventId: `legacy_retry_${args.paymentId}`,
      eventType: "payment_intent.succeeded",
      stripePaymentIntentId: intent.id,
      stripeChargeId:
        typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id,
      amount: intent.amount_received,
      currency: intent.currency,
      reservationId: intent.metadata.reservationId,
      renterId: intent.metadata.renterId,
      ownerId: intent.metadata.ownerId,
    })
  },
})
