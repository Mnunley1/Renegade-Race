import { v } from "convex/values"
import Stripe from "stripe"
import { api, internal } from "./_generated/api"

import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server"
import { checkAdmin } from "./admin"
import {
  getDamageClaimSubmittedEmailTemplate,
  getDamageInvoicePaymentEmailTemplate,
  getDamagePaymentReceivedEmailTemplate,
  sendTransactionalEmail,
} from "./emails"
import { ErrorCode, throwError } from "./errors"
import { getWebUrl } from "./helpers"

// ============================================================================
// Queries
// ============================================================================

export const getById = query({
  args: { id: v.id("damageInvoices") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const invoice = await ctx.db.get(args.id)
    if (!invoice) return null

    // Only allow renter, owner, or admin to view
    const isAdmin = (() => {
      const metadata = identity as any
      const role = metadata.metadata?.role || metadata.publicMetadata?.role || metadata.orgRole
      return role === "admin"
    })()

    if (
      invoice.renterId !== identity.subject &&
      invoice.ownerId !== identity.subject &&
      !isAdmin
    ) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized to view this damage invoice")
    }

    const [reservation, vehicle, renter, owner] = await Promise.all([
      ctx.db.get(invoice.reservationId),
      ctx.db.get(invoice.vehicleId),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", invoice.renterId))
        .first(),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", invoice.ownerId))
        .first(),
    ])

    return {
      ...invoice,
      reservation,
      vehicle,
      renter,
      owner,
    }
  },
})

export const getByReservation = query({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const invoices = await ctx.db
      .query("damageInvoices")
      .withIndex("by_reservation", (q) => q.eq("reservationId", args.reservationId))
      .collect()

    return invoices
  },
})

export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity || identity.subject !== args.userId) {
      return []
    }

    const [asRenter, asOwner] = await Promise.all([
      ctx.db
        .query("damageInvoices")
        .withIndex("by_renter", (q) => q.eq("renterId", args.userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("damageInvoices")
        .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
        .order("desc")
        .collect(),
    ])

    // Merge and deduplicate
    const seen = new Set<string>()
    const all = [...asRenter, ...asOwner].filter((inv) => {
      if (seen.has(inv._id)) return false
      seen.add(inv._id)
      return true
    })

    return all.sort((a, b) => b.createdAt - a.createdAt)
  },
})

// Internal queries for webhook lookups
export const findByCheckoutSession = internalQuery({
  args: { stripeCheckoutSessionId: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("damageInvoices")
      .withIndex("by_stripe_checkout_session", (q) =>
        q.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
      )
      .first(),
})

export const findByPaymentIntent = internalQuery({
  args: { stripePaymentIntentId: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("damageInvoices")
      .withIndex("by_stripe_payment_intent", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .first(),
})

// ============================================================================
// Mutations
// ============================================================================

export const create = mutation({
  args: {
    reservationId: v.id("reservations"),
    amount: v.number(), // cents
    description: v.string(),
    photos: v.array(v.string()),
    disputeId: v.optional(v.id("disputes")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    // Get reservation
    const reservation = await ctx.db.get(args.reservationId)
    if (!reservation) {
      throwError(ErrorCode.NOT_FOUND, "Reservation not found")
    }

    // Must be the vehicle owner
    if (reservation.ownerId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Only the vehicle owner can file a damage claim")
    }

    // Reservation must be completed
    if (reservation.status !== "completed") {
      throwError(ErrorCode.INVALID_STATUS, "Reservation must be completed to file a damage claim")
    }

    // Validate amount: $1 - $25,000
    if (args.amount < 100 || args.amount > 2_500_000) {
      throwError(ErrorCode.INVALID_AMOUNT, "Damage claim amount must be between $1.00 and $25,000.00")
    }

    // Must have at least 1 photo
    if (args.photos.length === 0) {
      throwError(ErrorCode.INVALID_INPUT, "At least one photo is required for a damage claim")
    }

    // Check for existing open invoice on this reservation
    const existingInvoice = await ctx.db
      .query("damageInvoices")
      .withIndex("by_reservation", (q) => q.eq("reservationId", args.reservationId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending_review"),
          q.eq(q.field("status"), "payment_pending")
        )
      )
      .first()

    if (existingInvoice) {
      throwError(
        ErrorCode.DAMAGE_INVOICE_ALREADY_EXISTS,
        "An open damage claim already exists for this reservation"
      )
    }

    // Get the rental completion record
    const completion = await ctx.db
      .query("rentalCompletions")
      .withIndex("by_reservation", (q) => q.eq("reservationId", args.reservationId))
      .first()

    if (!completion) {
      throwError(ErrorCode.NOT_FOUND, "Rental completion record not found")
    }

    const now = Date.now()
    const invoiceId = await ctx.db.insert("damageInvoices", {
      reservationId: args.reservationId,
      completionId: completion._id,
      vehicleId: reservation.vehicleId,
      renterId: reservation.renterId,
      ownerId: reservation.ownerId,
      amount: args.amount,
      description: args.description,
      photos: args.photos,
      status: "pending_review",
      disputeId: args.disputeId,
      createdAt: now,
      updatedAt: now,
    })

    // Get vehicle name for notifications
    const vehicle = await ctx.db.get(reservation.vehicleId)
    const vehicleName = vehicle
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
      : "Vehicle"

    // Notify renter
    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: reservation.renterId,
      type: "damage_invoice",
      title: "Damage Claim Filed",
      message: `A damage claim of $${(args.amount / 100).toFixed(2)} has been filed for your rental of ${vehicleName}.`,
      link: "/trips",
    })

    // Notify admin
    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: "admin",
      type: "system",
      title: "New Damage Claim",
      message: `A damage claim of $${(args.amount / 100).toFixed(2)} has been submitted for ${vehicleName}. Review required.`,
      link: `/damage-invoices/${invoiceId}`,
    })

    // Send email to renter
    const renter = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", reservation.renterId))
      .first()

    if (renter?.email) {
      const template = getDamageClaimSubmittedEmailTemplate({
        renterName: renter.name || "Renter",
        vehicleName,
        amount: args.amount,
      })
      await sendTransactionalEmail(ctx, renter.email, template)
    }

    return invoiceId
  },
})

export const adminReject = mutation({
  args: {
    damageInvoiceId: v.id("damageInvoices"),
    adminNotes: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await checkAdmin(ctx)

    const invoice = await ctx.db.get(args.damageInvoiceId)
    if (!invoice) {
      throwError(ErrorCode.DAMAGE_INVOICE_NOT_FOUND, "Damage invoice not found")
    }

    if (invoice.status !== "pending_review") {
      throwError(
        ErrorCode.DAMAGE_INVOICE_INVALID_STATUS,
        "Only pending_review invoices can be rejected"
      )
    }

    const now = Date.now()
    await ctx.db.patch(args.damageInvoiceId, {
      status: "rejected",
      adminReviewedBy: identity.subject,
      adminReviewedAt: now,
      adminNotes: args.adminNotes,
      updatedAt: now,
    })

    // Get vehicle name
    const vehicle = await ctx.db.get(invoice.vehicleId)
    const vehicleName = vehicle
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
      : "Vehicle"

    // Notify renter
    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: invoice.renterId,
      type: "damage_invoice",
      title: "Damage Claim Dismissed",
      message: `The damage claim for ${vehicleName} has been reviewed and dismissed.`,
      link: "/trips",
    })

    // Notify owner
    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: invoice.ownerId,
      type: "damage_invoice",
      title: "Damage Claim Rejected",
      message: `Your damage claim for ${vehicleName} has been reviewed and rejected. Reason: ${args.adminNotes}`,
      link: "/host/reservations",
    })

    // Audit log
    await ctx.runMutation(internal.auditLog.create, {
      entityType: "damage_invoice",
      entityId: args.damageInvoiceId,
      action: "reject_damage_invoice",
      userId: identity.subject,
      previousState: { status: "pending_review" },
      newState: { status: "rejected" },
      metadata: { adminNotes: args.adminNotes },
    })

    return args.damageInvoiceId
  },
})

export const handlePaymentSuccess = internalMutation({
  args: {
    damageInvoiceId: v.id("damageInvoices"),
    stripeChargeId: v.string(),
    stripePaymentIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.damageInvoiceId)
    if (!invoice) return

    if (invoice.status !== "payment_pending") return

    const now = Date.now()
    await ctx.db.patch(args.damageInvoiceId, {
      status: "paid",
      stripeChargeId: args.stripeChargeId,
      stripePaymentIntentId: args.stripePaymentIntentId,
      paidAt: now,
      updatedAt: now,
    })

    // Get vehicle name
    const vehicle = await ctx.db.get(invoice.vehicleId)
    const vehicleName = vehicle
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
      : "Vehicle"

    // Notify owner (payment received)
    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: invoice.ownerId,
      type: "damage_invoice",
      title: "Damage Payment Received",
      message: `Payment of $${(invoice.amount / 100).toFixed(2)} for the damage claim on ${vehicleName} has been received.`,
      link: "/host/reservations",
    })

    // Notify renter (payment confirmed)
    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: invoice.renterId,
      type: "damage_invoice",
      title: "Damage Payment Confirmed",
      message: `Your payment of $${(invoice.amount / 100).toFixed(2)} for the damage claim on ${vehicleName} has been confirmed.`,
      link: "/trips",
    })

    // Send email to owner
    const owner = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", invoice.ownerId))
      .first()

    if (owner?.email) {
      const template = getDamagePaymentReceivedEmailTemplate({
        ownerName: owner.name || "Owner",
        vehicleName,
        amount: invoice.amount,
      })
      await sendTransactionalEmail(ctx, owner.email, template)
    }

    // Audit log
    await ctx.runMutation(internal.auditLog.create, {
      entityType: "damage_invoice",
      entityId: args.damageInvoiceId,
      action: "damage_invoice_paid",
      previousState: { status: "payment_pending" },
      newState: { status: "paid" },
      metadata: {
        stripeChargeId: args.stripeChargeId,
        stripePaymentIntentId: args.stripePaymentIntentId,
        amount: invoice.amount,
      },
    })
  },
})

export const cancel = mutation({
  args: {
    damageInvoiceId: v.id("damageInvoices"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const invoice = await ctx.db.get(args.damageInvoiceId)
    if (!invoice) {
      throwError(ErrorCode.DAMAGE_INVOICE_NOT_FOUND, "Damage invoice not found")
    }

    // Only owner can cancel their own claim
    if (invoice.ownerId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Only the claim owner can cancel this damage claim")
    }

    if (invoice.status !== "pending_review") {
      throwError(
        ErrorCode.DAMAGE_INVOICE_INVALID_STATUS,
        "Only pending_review claims can be cancelled"
      )
    }

    await ctx.db.patch(args.damageInvoiceId, {
      status: "cancelled",
      updatedAt: Date.now(),
    })

    return args.damageInvoiceId
  },
})

// Internal mutation to update invoice after Stripe checkout session is created
export const updateWithCheckoutSession = internalMutation({
  args: {
    damageInvoiceId: v.id("damageInvoices"),
    stripeCheckoutSessionId: v.string(),
    stripeCheckoutUrl: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    adminReviewedBy: v.string(),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    await ctx.db.patch(args.damageInvoiceId, {
      status: "payment_pending",
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      stripeCheckoutUrl: args.stripeCheckoutUrl,
      stripePaymentIntentId: args.stripePaymentIntentId,
      adminReviewedBy: args.adminReviewedBy,
      adminReviewedAt: now,
      adminNotes: args.adminNotes,
      updatedAt: now,
    })
  },
})

// ============================================================================
// Action - Admin Approve (creates Stripe Checkout Session)
// ============================================================================

export const adminApprove: ReturnType<typeof action> = action({
  args: {
    damageInvoiceId: v.id("damageInvoices"),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify admin access
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const role = (identity as any).metadata?.role
    if (role !== "admin") {
      throwError(ErrorCode.ADMIN_REQUIRED, "Admin access required")
    }

    // Get the invoice
    const invoice = await ctx.runQuery(api.damageInvoices.getById, {
      id: args.damageInvoiceId,
    })

    if (!invoice) {
      throwError(ErrorCode.DAMAGE_INVOICE_NOT_FOUND, "Damage invoice not found")
    }

    if (invoice.status !== "pending_review") {
      throwError(
        ErrorCode.DAMAGE_INVOICE_INVALID_STATUS,
        "Only pending_review invoices can be approved"
      )
    }

    // Get owner's Connect account
    const owner = await ctx.runQuery(api.users.getByExternalId, {
      externalId: invoice.ownerId,
    })

    if (!owner?.stripeAccountId) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
        "Owner must complete Stripe onboarding before receiving damage payments"
      )
    }

    // Verify Connect account is ready
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throwError(ErrorCode.STRIPE_ERROR, "STRIPE_SECRET_KEY environment variable is not set")
    }
    const stripe = new Stripe(secretKey, {
      apiVersion: "2025-08-27.basil",
    })

    const connectAccount = await stripe.accounts.retrieve(owner.stripeAccountId)
    if (!connectAccount.charges_enabled) {
      throwError(
        ErrorCode.STRIPE_ACCOUNT_DISABLED,
        "Owner account cannot accept charges. Please complete Stripe onboarding."
      )
    }

    const webUrl = getWebUrl()

    // Create Stripe Checkout Session with 0% platform fee
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Damage Charge - ${invoice.vehicle ? `${invoice.vehicle.year} ${invoice.vehicle.make} ${invoice.vehicle.model}` : "Vehicle"}`,
              description: invoice.description,
            },
            unit_amount: invoice.amount,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: 0, // 0% platform fee on damage charges
        transfer_data: {
          destination: owner.stripeAccountId,
        },
        metadata: {
          type: "damage_invoice",
          damageInvoiceId: args.damageInvoiceId,
          reservationId: invoice.reservationId as string,
          renterId: invoice.renterId,
          ownerId: invoice.ownerId,
          vehicleId: invoice.vehicleId as string,
        },
      },
      success_url: `${webUrl}/damage-payment/success?damageInvoiceId=${args.damageInvoiceId}`,
      cancel_url: `${webUrl}/trips`,
      metadata: {
        type: "damage_invoice",
        damageInvoiceId: args.damageInvoiceId,
      },
    })

    // Update the invoice with checkout session details
    await ctx.runMutation(internal.damageInvoices.updateWithCheckoutSession, {
      damageInvoiceId: args.damageInvoiceId,
      stripeCheckoutSessionId: checkoutSession.id,
      stripeCheckoutUrl: checkoutSession.url || "",
      stripePaymentIntentId: checkoutSession.payment_intent as string | undefined,
      adminReviewedBy: identity.subject,
      adminNotes: args.adminNotes,
    })

    // Get vehicle name for notifications/emails
    const vehicleName = invoice.vehicle
      ? `${invoice.vehicle.year} ${invoice.vehicle.make} ${invoice.vehicle.model}`
      : "Vehicle"

    // Send email to renter with payment link
    const renter = await ctx.runQuery(api.users.getByExternalId, {
      externalId: invoice.renterId,
    })

    if (renter?.email) {
      const template = getDamageInvoicePaymentEmailTemplate({
        renterName: renter.name || "Renter",
        vehicleName,
        amount: invoice.amount,
        paymentUrl: checkoutSession.url || "",
      })
      await ctx.runMutation(internal.damageInvoices.sendDamageEmail, {
        to: renter.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      })
    }

    // Notify owner that claim was approved
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: invoice.ownerId,
      type: "damage_invoice",
      title: "Damage Claim Approved",
      message: `Your damage claim of $${(invoice.amount / 100).toFixed(2)} for ${vehicleName} has been approved. The renter has been sent a payment link.`,
      link: "/host/reservations",
    })

    // Notify renter about payment
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: invoice.renterId,
      type: "damage_invoice",
      title: "Damage Payment Required",
      message: `A damage charge of $${(invoice.amount / 100).toFixed(2)} for ${vehicleName} has been approved. Please complete payment.`,
      link: "/trips",
    })

    // Audit log
    await ctx.runMutation(internal.auditLog.create, {
      entityType: "damage_invoice",
      entityId: args.damageInvoiceId,
      action: "approve_damage_invoice",
      userId: identity.subject,
      previousState: { status: "pending_review" },
      newState: { status: "payment_pending" },
      metadata: {
        adminNotes: args.adminNotes,
        stripeCheckoutSessionId: checkoutSession.id,
        amount: invoice.amount,
      },
    })

    return {
      damageInvoiceId: args.damageInvoiceId,
      checkoutUrl: checkoutSession.url,
    }
  },
})

// Internal mutation to send email (needed because actions can't call sendTransactionalEmail directly)
export const sendDamageEmail = internalMutation({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await sendTransactionalEmail(ctx, args.to, {
      subject: args.subject,
      html: args.html,
      text: args.text,
    })
  },
})
