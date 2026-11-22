import { v } from "convex/values"
import Stripe from "stripe"
import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import {
  action,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
  query,
} from "./_generated/server"
import { checkAdmin } from "./admin"
import { ErrorCode, throwError } from "./errors"
import { syncRentalRefunds } from "./rentalRefunds"
import { readSettlementEvidence } from "./rentalSettlementProvider"
import {
  type RefundObservation,
  type SettlementEvidence,
  settlementEvidence,
} from "./rentalSettlementValidators"

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)])
    )
  return value
}
function same(a: unknown, b: unknown) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
}
function financialEvidence(evidence: SettlementEvidence) {
  const { observedAt: _time, references, ...rest } = evidence
  return {
    ...rest,
    references: references.map((reference) => {
      if (reference.net === undefined || reference.fee === undefined) return reference
      const { status: _status, availableOn: _availability, ...financial } = reference
      return financial
    }),
  }
}

/** Called atomically with customer refund totals. A failed refund never clears its own hold. */
export async function recordRefundObservations(
  ctx: MutationCtx,
  payment: Doc<"payments">,
  observations: RefundObservation[]
) {
  for (const observation of observations) {
    if (
      observation.chargeId !== payment.stripeChargeId ||
      observation.currency !== payment.currency ||
      !Number.isSafeInteger(observation.amount) ||
      observation.amount <= 0 ||
      (payment.stripePaymentIntentId &&
        observation.paymentIntentId !== payment.stripePaymentIntentId)
    )
      throwError(ErrorCode.CONFLICT, "Refund observation does not match payment")
    const previous = await ctx.db
      .query("rentalSettlementObservations")
      .withIndex("by_refund", (q) => q.eq("refundId", observation.refundId))
      .order("desc")
      .collect()
    if (
      previous.some(
        (p) =>
          p.paymentId !== payment._id ||
          p.observation.amount !== observation.amount ||
          p.observation.currency !== observation.currency ||
          p.observation.chargeId !== observation.chargeId
      )
    )
      throwError(ErrorCode.CONFLICT, "Refund identity changed")
    if (!(previous[0] && same(previous[0].observation, observation)))
      await ctx.db.insert("rentalSettlementObservations", {
        paymentId: payment._id,
        refundId: observation.refundId,
        observation,
        observedAt: Date.now(),
      })
    const review = await ctx.db
      .query("rentalSettlementReviews")
      .withIndex("by_refund", (q) => q.eq("refundId", observation.refundId))
      .unique()
    if (review && review.paymentId !== payment._id)
      throwError(ErrorCode.CONFLICT, "Refund review belongs to another payment")
    if (!(review || ["failed", "canceled"].includes(observation.status))) continue
    if (!review)
      await ctx.db.insert("rentalSettlementReviews", {
        paymentId: payment._id,
        reservationId: payment.reservationId,
        renterId: payment.renterId,
        ownerId: payment.ownerId,
        refundId: observation.refundId,
        status: "held",
        customerRefundStatus: observation.status,
        observation,
        revision: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    else if (!same(review.observation, observation))
      await ctx.db.patch(review._id, {
        status: "held",
        observation,
        customerRefundStatus: observation.status,
        revision: review.revision + 1,
        updatedAt: Date.now(),
      })
  }
  const reviews = await ctx.db
    .query("rentalSettlementReviews")
    .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
    .collect()
  if (reviews.length)
    await ctx.db.patch(payment._id, {
      settlementReviewStatus: reviews.some((r) => r.status === "held") ? "held" : "resolved",
    })
}

export const participantStatus = query({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    const reservation = await ctx.db.get(args.reservationId)
    if (!reservation) return null
    if (identity.subject !== reservation.renterId && identity.subject !== reservation.ownerId)
      await checkAdmin(ctx)
    const reviews = await ctx.db
      .query("rentalSettlementReviews")
      .withIndex("by_reservation", (q) => q.eq("reservationId", args.reservationId))
      .collect()
    const review =
      reviews.find((r) => r.status === "held") ??
      reviews.sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (!review) return null
    return {
      status: review.status,
      customerRefundStatus: review.customerRefundStatus,
      updatedAt: review.updatedAt,
      message:
        review.status === "held"
          ? "A refund outcome requires operator settlement review. Paid booking status does not confirm that host settlement was restored."
          : "An operator verified settlement allocation. This does not confirm a bank payout.",
    }
  },
})
async function enriched(ctx: { db: QueryCtx["db"] }, review: Doc<"rentalSettlementReviews">) {
  const snapshot = review.latestEvidenceId ? await ctx.db.get(review.latestEvidenceId) : null
  return { ...review, evidence: snapshot?.evidence }
}
export const listHeld = query({
  args: { viewerId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await checkAdmin(ctx)
    if (args.viewerId && args.viewerId !== actor.subject)
      throwError(ErrorCode.FORBIDDEN, "Account changed")
    const reviews = await ctx.db
      .query("rentalSettlementReviews")
      .withIndex("by_status", (q) => q.eq("status", "held"))
      .collect()
    return await Promise.all(reviews.map((r) => enriched(ctx, r)))
  },
})
export const getByPayment = query({
  args: { paymentId: v.id("payments"), viewerId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await checkAdmin(ctx)
    if (args.viewerId && args.viewerId !== actor.subject)
      throwError(ErrorCode.FORBIDDEN, "Account changed")
    return {
      reviews: await Promise.all(
        (
          await ctx.db
            .query("rentalSettlementReviews")
            .withIndex("by_payment", (q) => q.eq("paymentId", args.paymentId))
            .collect()
        ).map((r) => enriched(ctx, r))
      ),
    }
  },
})
export const load = internalQuery({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, args) => ({
    payment: await ctx.db.get(args.paymentId),
    reviews: await ctx.db
      .query("rentalSettlementReviews")
      .withIndex("by_payment", (q) => q.eq("paymentId", args.paymentId))
      .collect(),
  }),
})
export const loadReview = internalQuery({
  args: { reviewId: v.id("rentalSettlementReviews") },
  handler: async (ctx, args) => await ctx.db.get(args.reviewId),
})

export const persist = internalMutation({
  args: {
    reviewId: v.id("rentalSettlementReviews"),
    expectedRevision: v.number(),
    expectedRefundVersion: v.number(),
    operatorId: v.optional(v.string()),
    fingerprint: v.string(),
    evidence: settlementEvidence,
    resolution: v.optional(
      v.object({
        operatorId: v.string(),
        reference: v.string(),
        notes: v.string(),
        expectedEvidenceId: v.id("rentalSettlementEvidence"),
      })
    ),
  },
  handler: async (ctx, args) => {
    const actor = await checkAdmin(ctx)
    if (
      (args.operatorId && args.operatorId !== actor.subject) ||
      (args.resolution && args.resolution.operatorId !== actor.subject)
    )
      throwError(ErrorCode.FORBIDDEN, "Review actor mismatch")
    const review = await ctx.db.get(args.reviewId)
    if (!review) throwError(ErrorCode.NOT_FOUND, "Review not found")
    const payment = await ctx.db.get(review.paymentId)
    if (
      !payment ||
      review.revision !== args.expectedRevision ||
      (payment.refundSyncVersion ?? 0) !== args.expectedRefundVersion
    )
      throwError(ErrorCode.CONFLICT, "Refund state changed; refresh the review")
    const e = args.evidence
    if (
      e.stripeChargeId !== payment.stripeChargeId ||
      e.currency !== payment.currency ||
      e.stripePaymentIntentId !== payment.stripePaymentIntentId ||
      !e.refunds.some((r) => r.refundId === review.refundId && same(r, review.observation))
    )
      throwError(ErrorCode.CONFLICT, "Settlement evidence does not match review")
    const allObservations = await ctx.db
      .query("rentalSettlementObservations")
      .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
      .order("desc")
      .collect()
    const latest = new Map<string, RefundObservation>()
    for (const observation of allObservations)
      if (!latest.has(observation.refundId))
        latest.set(observation.refundId, observation.observation)
    if (
      e.refunds.length !== latest.size ||
      e.refunds.some((r) => !same(r, latest.get(r.refundId))) ||
      e.refunds.reduce((sum, r) => sum + (r.status === "succeeded" ? r.amount : 0), 0) !==
        (payment.refundAmount ?? 0)
    )
      throwError(ErrorCode.CONFLICT, "Provider refund state changed; refresh the review")
    if (args.resolution && args.resolution.expectedEvidenceId !== review.latestEvidenceId)
      throwError(ErrorCode.CONFLICT, "Settlement evidence changed; refresh the review")
    const snapshot = await ctx.db
      .query("rentalSettlementEvidence")
      .withIndex("by_fingerprint", (q) =>
        q.eq("reviewId", review._id).eq("fingerprint", args.fingerprint)
      )
      .unique()
    const evidenceId =
      snapshot?._id ??
      (await ctx.db.insert("rentalSettlementEvidence", {
        reviewId: review._id,
        paymentId: payment._id,
        refundId: review.refundId,
        fingerprint: args.fingerprint,
        evidence: e,
      }))
    const resolved = !!args.resolution
    if (
      resolved &&
      (!(e.bindingVerified && e.allocationVerifiable) ||
        e.differenceCents !== 0 ||
        !["failed", "canceled", "succeeded"].includes(review.customerRefundStatus))
    )
      throwError(
        ErrorCode.CONFLICT,
        "Provider evidence does not establish restored host allocation; hold remains"
      )
    // A later changed provider snapshot reopens a resolved review. Refresh never resolves a hold.
    const priorEvidence = review.latestEvidenceId ? await ctx.db.get(review.latestEvidenceId) : null
    const status = resolved
      ? "resolved"
      : review.status === "resolved" &&
          priorEvidence &&
          same(financialEvidence(priorEvidence.evidence), financialEvidence(e))
        ? "resolved"
        : "held"
    await ctx.db.patch(review._id, {
      latestEvidenceId: evidenceId,
      status,
      revision: review.revision + 1,
      updatedAt: Date.now(),
      ...(args.resolution
        ? {
            resolution: {
              operatorId: args.resolution.operatorId,
              reference: args.resolution.reference,
              notes: args.resolution.notes,
              resolvedAt: Date.now(),
              evidenceId,
              compensatingTransferIds: e.compensatingTransferIds,
            },
          }
        : {}),
    })
    const reviews = await ctx.db
      .query("rentalSettlementReviews")
      .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
      .collect()
    await ctx.db.patch(payment._id, {
      settlementReviewStatus: reviews.some((r) => r.status === "held") ? "held" : "resolved",
    })
    await ctx.db.insert("auditLogs", {
      entityType: "payment",
      entityId: payment._id,
      action: resolved ? "settlement_review_resolved" : "settlement_review_evidence",
      userId: actor.subject,
      metadata: {
        reviewId: review._id,
        evidenceId,
        reference: args.resolution?.reference,
        notes: args.resolution?.notes,
        compensatingTransferIds: e.compensatingTransferIds,
        providerObservedAt: e.observedAt,
        resolvedAt: resolved ? Date.now() : undefined,
      },
      timestamp: Date.now(),
    })
    return evidenceId
  },
})

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throwError(ErrorCode.CONFLICT, "Stripe is not configured")
  return new Stripe(key, { apiVersion: "2025-08-27.basil" })
}
async function fingerprint(evidence: SettlementEvidence) {
  const { observedAt: _time, ...stable } = evidence
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(stable))
  )
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("")
}
export const refresh = action({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, args): Promise<void> => {
    const actor = await checkAdmin(ctx)
    let state = await ctx.runQuery(internal.rentalSettlement.load, args)
    if (!state.payment) throwError(ErrorCode.NOT_FOUND, "Payment not found")
    const stripe = stripeClient()
    await syncRentalRefunds(ctx, stripe, state.payment)
    state = await ctx.runQuery(internal.rentalSettlement.load, args)
    if (!state.payment) throwError(ErrorCode.NOT_FOUND, "Payment not found")
    for (const review of state.reviews) {
      const evidence = await readSettlementEvidence(
        stripe,
        state.payment,
        review.refundId,
        review.resolution?.compensatingTransferIds ?? []
      )
      await ctx.runMutation(internal.rentalSettlement.persist, {
        reviewId: review._id,
        expectedRevision: review.revision,
        expectedRefundVersion: state.payment.refundSyncVersion ?? 0,
        operatorId: actor.subject,
        fingerprint: await fingerprint(evidence),
        evidence,
      })
    }
  },
})
export const resolve = action({
  args: {
    reviewId: v.id("rentalSettlementReviews"),
    expectedEvidenceId: v.id("rentalSettlementEvidence"),
    reference: v.string(),
    notes: v.string(),
    compensatingTransferIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<void> => {
    const actor = await checkAdmin(ctx)
    const reference = args.reference.trim(),
      notes = args.notes.trim()
    if (!(reference && notes) || reference.length > 500 || notes.length > 4000)
      throwError(ErrorCode.INVALID_INPUT, "Provide a review reference and notes")
    const review = await ctx.runQuery(internal.rentalSettlement.loadReview, {
      reviewId: args.reviewId,
    })
    if (!review || review.status !== "held" || review.latestEvidenceId !== args.expectedEvidenceId)
      throwError(ErrorCode.CONFLICT, "Refresh the held review before resolving")
    let state = await ctx.runQuery(internal.rentalSettlement.load, { paymentId: review.paymentId })
    if (!state.payment) throwError(ErrorCode.NOT_FOUND, "Payment not found")
    const stripe = stripeClient()
    await syncRentalRefunds(ctx, stripe, state.payment)
    state = await ctx.runQuery(internal.rentalSettlement.load, { paymentId: review.paymentId })
    if (
      !state.payment ||
      state.reviews.find((r) => r._id === review._id)?.revision !== review.revision
    )
      throwError(ErrorCode.CONFLICT, "Refund state changed; refresh the review")
    const evidence = await readSettlementEvidence(
      stripe,
      state.payment,
      review.refundId,
      args.compensatingTransferIds ?? []
    )
    // Fresh provider reads and atomic version/evidence checks; never accepts a caller's balance.
    await ctx.runMutation(internal.rentalSettlement.persist, {
      reviewId: review._id,
      expectedRevision: review.revision,
      expectedRefundVersion: state.payment.refundSyncVersion ?? 0,
      operatorId: actor.subject,
      fingerprint: await fingerprint(evidence),
      evidence,
      resolution: {
        operatorId: actor.subject,
        reference,
        notes,
        expectedEvidenceId: args.expectedEvidenceId,
      },
    })
  },
})
