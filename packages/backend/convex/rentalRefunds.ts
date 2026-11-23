import { withAccountOperation } from "./accountOperations"
import type Stripe from "stripe"
import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import type { ActionCtx } from "./_generated/server"
import { ErrorCode, throwError } from "./errors"
import { calculateRefundAmount } from "./pricing"
import { refundObservations } from "./rentalSettlementProvider"

type RefundPolicy = "full" | "partial" | "custom" | "none"

type RefundDetails = {
  reason?: string
  policy?: RefundPolicy
  adminId?: string
  refundId?: string
  stripeStatus?: string
  amount?: number
}

type RefundRequest = {
  source: "admin" | "owner" | "cancellation"
  amount?: number
  percentage?: number
  forceFullRefund?: boolean
  reason?: string
  policy?: RefundPolicy
  adminId?: string
  requestId?: string
}

function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id
}

export async function getRentalCharge(stripe: Stripe, payment: Doc<"payments">, chargeId?: string) {
  let id = payment.stripeChargeId || (payment.stripePaymentIntentId && chargeId)
  if (!id) {
    let intentId = payment.stripePaymentIntentId
    if (!intentId && payment.stripeCheckoutSessionId) {
      const session = await stripe.checkout.sessions.retrieve(payment.stripeCheckoutSessionId)
      intentId = stripeId(session.payment_intent)
    }
    if (!intentId) throwError(ErrorCode.NOT_FOUND, "Missing Stripe payment reference")
    const intent = await stripe.paymentIntents.retrieve(intentId)
    id = stripeId(intent.latest_charge)
  }
  if (!id) throwError(ErrorCode.NOT_FOUND, "Missing Stripe charge")

  const charge = await stripe.charges.retrieve(id)
  const metadata = charge.metadata
  if (
    (chargeId && chargeId !== charge.id) ||
    !!metadata.type ||
    !charge.paid ||
    charge.amount_captured <= 0 ||
    charge.currency !== payment.currency ||
    charge.amount_captured !== payment.amount + (payment.processingFee ?? 0) ||
    metadata.reservationId !== payment.reservationId ||
    metadata.ownerId !== payment.ownerId ||
    metadata.renterId !== payment.renterId ||
    (payment.stripePaymentIntentId &&
      stripeId(charge.payment_intent) !== payment.stripePaymentIntentId) ||
    (payment.stripeChargeId && charge.id !== payment.stripeChargeId) ||
    (payment.stripeAccountId &&
      stripeId(charge.transfer_data?.destination ?? null) !== payment.stripeAccountId) ||
    (payment.stripeTransferId && stripeId(charge.transfer) !== payment.stripeTransferId)
  ) {
    throwError(ErrorCode.CONFLICT, "Stripe charge does not match this rental payment")
  }
  return charge
}

export async function readRefunds(stripe: Stripe, chargeId: string) {
  const refunds: Stripe.Refund[] = []
  for await (const refund of stripe.refunds.list({ charge: chargeId, limit: 100 })) {
    refunds.push(refund)
  }
  return refunds
}

// Read Stripe again if another reconciliation committed during this one. A delayed
// event can then correct a failed refund without overwriting newer activity.
async function reconcileRentalRefunds(
  ctx: ActionCtx,
  stripe: Stripe,
  payment: Doc<"payments">,
  { charge, details }: { charge: Stripe.Charge; details?: RefundDetails }
): Promise<void> {
  let version = payment.refundSyncVersion ?? 0
  for (;;) {
    const refunds = await readRefunds(stripe, charge.id)
    const refundAmount = refunds.reduce(
      (sum, refund) => sum + (refund.status === "succeeded" ? refund.amount : 0),
      0
    )
    const result: number | null = await ctx.runMutation(internal.stripe.updateRefundStatus, {
      paymentId: payment._id,
      expectedVersion: version,
      stripeChargeId: charge.id,
      stripePaymentIntentId: stripeId(charge.payment_intent),
      capturedAmount: charge.amount_captured,
      refundAmount,
      cancelOnFull: refunds.some(
        (refund) => refund.status === "succeeded" && !!refund.metadata?.rentalRefundRequest
      ),
      details,
      observations: refundObservations(refunds, charge),
    })
    if (result === null) return
    version = result
  }
}

export async function syncRentalRefunds(
  ctx: ActionCtx,
  stripe: Stripe,
  payment: Doc<"payments">,
  chargeId?: string
) {
  const charge = await getRentalCharge(stripe, payment, chargeId)
  await reconcileRentalRefunds(ctx, stripe, payment, { charge })
}

async function digest(input: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("")
}

function rentalRefundAmount(
  refunds: Stripe.Refund[],
  capturedAmount: number,
  listingAmount: number,
  request: RefundRequest
) {
  // Pending refunds also reserve part of the charge. They become ledger
  // credits only when Stripe reports that they succeeded.
  const committed = refunds.reduce(
    (sum, item) => sum + (item.status === "failed" || item.status === "canceled" ? 0 : item.amount),
    0
  )
  const remaining = capturedAmount - committed
  const amount =
    request.percentage === undefined
      ? (request.amount ?? remaining)
      : Math.max(
          0,
          calculateRefundAmount(
            request.forceFullRefund ? capturedAmount : listingAmount,
            request.percentage
          ) - committed
        )
  if (amount <= 0 && request.source === "cancellation") return { amount: 0, remaining }
  if (amount <= 0 || amount > remaining) {
    throwError(
      ErrorCode.INVALID_REFUND_AMOUNT,
      "Refund amount exceeds the remaining captured balance"
    )
  }
  return { amount, remaining }
}

export function issueRentalRefund(
  ctx: ActionCtx,
  stripe: Stripe,
  payment: Doc<"payments">,
  request: RefundRequest
): Promise<Stripe.Refund | null> {
  if (!["succeeded", "partially_refunded", "refunded"].includes(payment.status)) {
    throwError(ErrorCode.INVALID_STATUS, "Only a captured payment can be refunded")
  }
  if (
    request.amount !== undefined &&
    (!Number.isSafeInteger(request.amount) || request.amount <= 0)
  ) {
    throwError(
      ErrorCode.INVALID_REFUND_AMOUNT,
      "Refund amount must be a positive whole number of cents"
    )
  }

  return withAccountOperation(
    ctx,
    `rental-refund:${payment._id}`,
    [payment.renterId, payment.ownerId, ...(request.adminId ? [request.adminId] : [])],
    async (beforeProviderMutation) => {
      const charge = await getRentalCharge(stripe, payment)
      const refunds = await readRefunds(stripe, charge.id)
      if (
        payment.settlementReviewStatus === "held" ||
        refunds.some((r) => r.status === "failed" || r.status === "canceled")
      ) {
        await reconcileRentalRefunds(ctx, stripe, payment, { charge })
        const current = await ctx.runQuery(internal.rentalSettlement.load, {
          paymentId: payment._id,
        })
        if (current.payment?.settlementReviewStatus !== "resolved")
          throwError(
            ErrorCode.CONFLICT,
            "Refund settlement review is required before another refund"
          )
      }
      const fingerprint = await digest(
        JSON.stringify([
          request.source,
          request.adminId,
          request.amount,
          request.percentage,
          request.reason,
          request.policy,
        ])
      )
      const requestKey = await digest(
        JSON.stringify([payment._id, request.source, request.requestId ?? fingerprint])
      )
      // Stripe expires idempotency keys. The request reference on the refund also
      // identifies completed requests after that window and after a lost response.
      let refund = refunds.find((item) => item.metadata?.rentalRefundRequest === requestKey)
      if (
        refund &&
        request.source !== "cancellation" &&
        refund.metadata?.rentalRefundFingerprint !== fingerprint
      ) {
        throwError(
          ErrorCode.CONFLICT,
          "This refund request ID was already used with different details"
        )
      }
      if (!refund) {
        const { amount, remaining } = rentalRefundAmount(
          refunds,
          charge.amount_captured,
          payment.amount,
          request
        )
        if (amount === 0) {
          await reconcileRentalRefunds(ctx, stripe, payment, {
            charge,
            details: { reason: request.reason, policy: request.policy },
          })
          return null
        }
        const refundFee =
          request.source === "owner" ||
          (request.percentage !== undefined ? request.percentage === 100 : amount === remaining)
        const stripeReason =
          request.source === "owner"
            ? (request.reason as Stripe.RefundCreateParams.Reason | undefined)
            : "requested_by_customer"
        beforeProviderMutation()
        refund = await stripe.refunds.create(
          {
            charge: charge.id,
            amount,
            reason: stripeReason,
            ...(charge.transfer_data?.destination
              ? { reverse_transfer: true, refund_application_fee: refundFee }
              : {}),
            metadata: { rentalRefundRequest: requestKey, rentalRefundFingerprint: fingerprint },
          },
          { idempotencyKey: `rental-refund-${requestKey}` }
        )
      }
      await reconcileRentalRefunds(ctx, stripe, payment, {
        charge,
        details: {
          reason: request.reason,
          policy: request.policy,
          adminId: request.adminId,
          refundId: refund.id,
          stripeStatus: refund.status ?? undefined,
          amount: refund.amount,
        },
      })
      if (refund.status === "failed" || refund.status === "canceled") {
        throwError(ErrorCode.INVALID_STATUS, "Stripe did not complete this refund")
      }
      return refund
    }
  )
}
