import { type Infer, v } from "convex/values"

export const refundObservation = v.object({
  refundId: v.string(),
  status: v.string(),
  amount: v.number(),
  currency: v.string(),
  chargeId: v.string(),
  paymentIntentId: v.optional(v.string()),
  balanceTransactionId: v.optional(v.string()),
  failureBalanceTransactionId: v.optional(v.string()),
  failureReason: v.optional(v.string()),
  transferReversalId: v.optional(v.string()),
  sourceTransferReversalId: v.optional(v.string()),
})
export type RefundObservation = Infer<typeof refundObservation>

export const settlementReference = v.object({
  kind: v.string(),
  id: v.string(),
  amount: v.optional(v.number()),
  currency: v.optional(v.string()),
  sourceId: v.optional(v.string()),
  accountId: v.optional(v.string()),
  status: v.optional(v.string()),
  relatedId: v.optional(v.string()),
  net: v.optional(v.number()),
  fee: v.optional(v.number()),
  availableOn: v.optional(v.number()),
})
export const settlementEvidence = v.object({
  observedAt: v.number(),
  stripeChargeId: v.string(),
  stripePaymentIntentId: v.string(),
  stripeTransferId: v.optional(v.string()),
  applicationFeeId: v.optional(v.string()),
  destinationAccountId: v.optional(v.string()),
  currency: v.string(),
  capturedAmount: v.number(),
  refundAmount: v.number(),
  failureBalanceTransactionId: v.optional(v.string()),
  transferReversalIds: v.array(v.string()),
  feeRefundIds: v.array(v.string()),
  bindingVerified: v.boolean(),
  allocationVerifiable: v.boolean(),
  expectedHostAllocation: v.union(v.number(), v.null()),
  currentHostAllocation: v.union(v.number(), v.null()),
  differenceCents: v.union(v.number(), v.null()),
  verificationError: v.optional(v.string()),
  references: v.array(settlementReference),
  compensatingTransferIds: v.array(v.string()),
  refunds: v.array(refundObservation),
})
export type SettlementEvidence = Infer<typeof settlementEvidence>
