import type Stripe from "stripe"
import type { Doc } from "./_generated/dataModel"
import { ErrorCode, throwError } from "./errors"
import { getRentalCharge, readRefunds } from "./rentalRefunds"
import type { RefundObservation, SettlementEvidence } from "./rentalSettlementValidators"

function id(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id
}
function requireBinding(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
export function refundObservations(
  refunds: Stripe.Refund[],
  charge: Stripe.Charge
): RefundObservation[] {
  return refunds
    .map((refund) => {
      if (
        id(refund.charge) !== charge.id ||
        refund.currency !== charge.currency ||
        !Number.isSafeInteger(refund.amount) ||
        refund.amount <= 0 ||
        refund.amount > charge.amount_captured ||
        (id(refund.payment_intent) && id(refund.payment_intent) !== id(charge.payment_intent))
      )
        throwError(ErrorCode.CONFLICT, "Stripe refund does not match the rental charge")
      return {
        refundId: refund.id,
        status: refund.status ?? "unknown",
        amount: refund.amount,
        currency: refund.currency,
        chargeId: charge.id,
        paymentIntentId: id(charge.payment_intent),
        balanceTransactionId: id(refund.balance_transaction),
        failureBalanceTransactionId: id(refund.failure_balance_transaction),
        failureReason: refund.failure_reason ?? undefined,
        transferReversalId: id(refund.transfer_reversal),
        sourceTransferReversalId: id(refund.source_transfer_reversal),
      }
    })
    .sort((a, b) => a.refundId.localeCompare(b.refundId))
}

/** Provider GETs only. No guessed fee allocation and no money-movement APIs. */
export async function readSettlementEvidence(
  stripe: Stripe,
  payment: Doc<"payments">,
  refundId: string,
  compensatingTransferIds: string[] = []
): Promise<SettlementEvidence> {
  const charge = await getRentalCharge(stripe, payment)
  const refunds = refundObservations(await readRefunds(stripe, charge.id), charge)
  const refund = refunds.find((r) => r.refundId === refundId)
  if (!refund) throwError(ErrorCode.NOT_FOUND, "Refund is missing from the verified charge")
  const evidence: SettlementEvidence = {
    observedAt: Date.now(),
    stripeChargeId: charge.id,
    stripePaymentIntentId: id(charge.payment_intent) ?? "",
    stripeTransferId: id(charge.transfer),
    applicationFeeId: id(charge.application_fee),
    destinationAccountId: id(charge.transfer_data?.destination),
    currency: charge.currency,
    capturedAmount: charge.amount_captured,
    refundAmount: refund.amount,
    failureBalanceTransactionId: refund.failureBalanceTransactionId,
    transferReversalIds: [],
    feeRefundIds: [],
    bindingVerified: false,
    allocationVerifiable: false,
    expectedHostAllocation: null,
    currentHostAllocation: null,
    differenceCents: null,
    references: [],
    compensatingTransferIds: [...compensatingTransferIds].sort(),
    refunds,
  }
  const refs = evidence.references
  function reference(
    kind: string,
    object: { id: string; amount?: number; currency?: string },
    extra: Partial<(typeof refs)[number]> = {}
  ) {
    refs.push({
      kind,
      id: object.id,
      ...(object.amount !== undefined ? { amount: object.amount } : {}),
      ...(object.currency ? { currency: object.currency } : {}),
      ...extra,
    })
  }
  async function balance(
    kind: string,
    transactionId: string | undefined,
    sourceId: string,
    { amount, accountId }: { amount: number; accountId?: string }
  ) {
    requireBinding(transactionId, `Missing ${kind} balance transaction`)
    const transaction = await stripe.balanceTransactions.retrieve(
      transactionId,
      accountId ? { stripeAccount: accountId } : undefined
    )
    requireBinding(
      transaction.id === transactionId &&
        transaction.currency === payment.currency &&
        id(transaction.source) === sourceId &&
        transaction.amount === amount,
      `Mismatched ${kind} balance transaction`
    )
    reference(kind, transaction, {
      sourceId,
      accountId,
      status: transaction.status,
      net: transaction.net,
      fee: transaction.fee,
      availableOn: transaction.available_on,
    })
    return transaction
  }
  try {
    requireBinding(
      compensatingTransferIds.length <= 20 &&
        new Set(compensatingTransferIds).size === compensatingTransferIds.length,
      "Provide distinct compensation transfer references"
    )
    requireBinding(
      evidence.destinationAccountId && evidence.destinationAccountId === payment.stripeAccountId,
      "Destination account is not bound to the payment"
    )
    requireBinding(
      evidence.stripeTransferId && evidence.applicationFeeId,
      "Missing destination transfer or application fee reference"
    )
    reference("charge", charge, {
      sourceId: evidence.stripePaymentIntentId,
      relatedId: evidence.stripeTransferId,
    })
    await balance("charge_balance", id(charge.balance_transaction), charge.id, {
      amount: charge.amount_captured,
    })
    const transfer = await stripe.transfers.retrieve(evidence.stripeTransferId)
    requireBinding(
      transfer.id === evidence.stripeTransferId &&
        id(transfer.source_transaction) === charge.id &&
        id(transfer.destination) === evidence.destinationAccountId &&
        transfer.currency === charge.currency &&
        transfer.amount === charge.amount_captured &&
        (!payment.stripeTransferId || transfer.id === payment.stripeTransferId),
      "Destination transfer does not match charge"
    )
    reference("transfer", transfer, {
      sourceId: charge.id,
      accountId: evidence.destinationAccountId,
      relatedId: id(transfer.destination_payment),
    })
    await balance("transfer_balance", id(transfer.balance_transaction), transfer.id, {
      amount: -transfer.amount,
    })
    const fee = await stripe.applicationFees.retrieve(evidence.applicationFeeId)
    requireBinding(
      fee.id === evidence.applicationFeeId &&
        id(fee.originating_transaction) === charge.id &&
        id(fee.charge) === id(transfer.destination_payment) &&
        id(fee.account) === evidence.destinationAccountId &&
        fee.currency === charge.currency &&
        fee.amount === payment.platformFee + (payment.processingFee ?? 0) &&
        transfer.amount - fee.amount === payment.ownerAmount,
      "Application fee does not match destination charge"
    )
    reference("application_fee", fee, {
      sourceId: charge.id,
      relatedId: id(fee.charge),
      accountId: evidence.destinationAccountId,
    })
    await balance("fee_balance", id(fee.balance_transaction), fee.id, { amount: fee.amount })
    const destinationChargeId = id(transfer.destination_payment)
    requireBinding(destinationChargeId, "Missing destination charge")
    const destinationCharge = await stripe.charges.retrieve(destinationChargeId, {
      stripeAccount: evidence.destinationAccountId,
    })
    requireBinding(
      destinationCharge.id === destinationChargeId &&
        destinationCharge.amount === transfer.amount &&
        destinationCharge.currency === charge.currency &&
        id(destinationCharge.application_fee) === fee.id,
      "Destination charge mismatch"
    )
    reference("destination_charge", destinationCharge, {
      accountId: evidence.destinationAccountId,
      relatedId: fee.id,
    })
    const initialDestinationBalance = await balance(
      "destination_charge_balance",
      id(destinationCharge.balance_transaction),
      destinationCharge.id,
      { amount: destinationCharge.amount, accountId: evidence.destinationAccountId }
    )
    requireBinding(
      initialDestinationBalance.net === payment.ownerAmount &&
        initialDestinationBalance.fee === fee.amount,
      "Unexpected initial destination allocation"
    )
    const reversals: Stripe.TransferReversal[] = []
    for await (const reversal of stripe.transfers.listReversals(transfer.id, { limit: 100 }))
      reversals.push(reversal)
    let reversed = 0
    for (const reversal of reversals.sort((a, b) => a.id.localeCompare(b.id))) {
      const sourceRefundId = id(reversal.source_refund)
      requireBinding(
        id(reversal.transfer) === transfer.id &&
          reversal.currency === charge.currency &&
          sourceRefundId &&
          refunds.some(
            (r) =>
              r.refundId === sourceRefundId &&
              (r.transferReversalId === reversal.id || r.sourceTransferReversalId === reversal.id)
          ),
        "Unbound transfer reversal"
      )
      reversed += reversal.amount
      evidence.transferReversalIds.push(reversal.id)
      reference("transfer_reversal", reversal, { sourceId: sourceRefundId, relatedId: transfer.id })
      await balance("transfer_reversal_balance", id(reversal.balance_transaction), transfer.id, {
        amount: reversal.amount,
      })
      const destinationRefundId = id(reversal.destination_payment_refund)
      requireBinding(destinationRefundId, "Missing destination refund reference")
      let destinationDebit = 0
      for await (const transaction of stripe.balanceTransactions.list(
        { source: destinationRefundId, limit: 100 },
        { stripeAccount: evidence.destinationAccountId }
      )) {
        requireBinding(
          id(transaction.source) === destinationRefundId &&
            transaction.currency === charge.currency &&
            transaction.amount < 0 &&
            transaction.fee === 0 &&
            transaction.net === transaction.amount,
          "Unexpected destination reversal ledger"
        )
        destinationDebit += transaction.amount
        reference("destination_refund_balance", transaction, {
          sourceId: destinationRefundId,
          accountId: evidence.destinationAccountId,
          net: transaction.net,
          fee: transaction.fee,
          status: transaction.status,
          availableOn: transaction.available_on,
        })
      }
      requireBinding(
        destinationDebit === -reversal.amount,
        "Destination reversal ledger coverage is incomplete"
      )
    }
    requireBinding(
      reversed === transfer.amount_reversed,
      "Transfer reversal pagination is incomplete"
    )
    for (const r of refunds) {
      reference(
        "refund",
        { id: r.refundId, amount: r.amount, currency: r.currency },
        {
          sourceId: charge.id,
          status: r.status,
          relatedId: r.transferReversalId ?? r.sourceTransferReversalId,
        }
      )
      // Failed refunds can have both the original debit and the platform failure credit.
      if (r.balanceTransactionId)
        await balance("refund_balance", r.balanceTransactionId, r.refundId, { amount: -r.amount })
      if (r.status === "failed")
        await balance("refund_failure_credit", r.failureBalanceTransactionId, r.refundId, {
          amount: r.amount,
        })
      if (r.transferReversalId)
        requireBinding(
          evidence.transferReversalIds.includes(r.transferReversalId),
          "Refund reversal is missing"
        )
    }
    let feeReturned = 0
    for await (const feeRefund of stripe.applicationFees.listRefunds(fee.id, { limit: 100 })) {
      requireBinding(
        id(feeRefund.fee) === fee.id && feeRefund.currency === charge.currency,
        "Unbound application fee refund"
      )
      feeReturned += feeRefund.amount
      evidence.feeRefundIds.push(feeRefund.id)
      reference("application_fee_refund", feeRefund, { relatedId: fee.id })
      await balance("fee_refund_balance", id(feeRefund.balance_transaction), fee.id, {
        amount: -feeRefund.amount,
      })
    }
    evidence.feeRefundIds.sort()
    requireBinding(
      feeReturned === fee.amount_refunded,
      "Application fee refund pagination is incomplete"
    )
    let destinationFeeCredit = 0,
      initialSeen = false
    for await (const transaction of stripe.balanceTransactions.list(
      { source: destinationChargeId, limit: 100 },
      { stripeAccount: evidence.destinationAccountId }
    )) {
      requireBinding(
        id(transaction.source) === destinationChargeId && transaction.currency === charge.currency,
        "Unexpected destination adjustment source"
      )
      if (transaction.id === initialDestinationBalance.id) {
        initialSeen = true
        continue
      }
      requireBinding(
        transaction.type === "adjustment" &&
          transaction.amount > 0 &&
          transaction.fee === 0 &&
          transaction.net === transaction.amount,
        "Unexplained destination allocation adjustment"
      )
      destinationFeeCredit += transaction.net
      reference("destination_fee_credit", transaction, {
        sourceId: destinationChargeId,
        accountId: evidence.destinationAccountId,
        net: transaction.net,
        fee: transaction.fee,
        status: transaction.status,
        availableOn: transaction.available_on,
      })
    }
    requireBinding(
      initialSeen && destinationFeeCredit === feeReturned,
      "Destination fee return ledger coverage is incomplete"
    )
    let compensation = 0
    for (const transferId of evidence.compensatingTransferIds) {
      const adjustment = await stripe.transfers.retrieve(transferId)
      requireBinding(
        adjustment.id === transferId &&
          transferId !== transfer.id &&
          adjustment.metadata.rentalSettlementPaymentId === payment._id &&
          refunds.some((r) => r.refundId === adjustment.metadata.rentalSettlementRefundId) &&
          adjustment.metadata.rentalSettlementOwnerId === payment.ownerId &&
          id(adjustment.destination) === evidence.destinationAccountId &&
          adjustment.currency === charge.currency &&
          adjustment.amount > 0 &&
          adjustment.amount_reversed === 0,
        "Compensation transfer is not bound to this payment/refund/owner"
      )
      reference("compensating_transfer", adjustment, {
        accountId: evidence.destinationAccountId,
        relatedId: adjustment.metadata.rentalSettlementRefundId,
      })
      await balance(
        "compensating_transfer_balance",
        id(adjustment.balance_transaction),
        adjustment.id,
        { amount: -adjustment.amount }
      )
      const destinationId = id(adjustment.destination_payment)
      requireBinding(destinationId, "Compensation has no destination payment")
      const destination = await stripe.charges.retrieve(destinationId, {
        stripeAccount: evidence.destinationAccountId,
      })
      requireBinding(
        destination.id === destinationId &&
          destination.amount === adjustment.amount &&
          destination.currency === charge.currency &&
          destination.amount_refunded === 0 &&
          !destination.application_fee,
        "Compensation destination payment is adjusted"
      )
      const destinationBalance = await balance(
        "compensating_destination_balance",
        id(destination.balance_transaction),
        destination.id,
        { amount: adjustment.amount, accountId: evidence.destinationAccountId }
      )
      requireBinding(
        destinationBalance.fee === 0 && destinationBalance.net === adjustment.amount,
        "Compensation destination net allocation mismatch"
      )
      compensation += adjustment.amount
    }
    evidence.bindingVerified = true
    evidence.currentHostAllocation =
      transfer.amount - fee.amount - reversed + feeReturned + compensation
    const allSucceeded = refunds.every((r) => r.status === "succeeded")
    const allFailed = refunds.every((r) => r.status === "failed" || r.status === "canceled")
    if (!(allSucceeded || allFailed))
      throw new Error(
        "Mixed or pending refund fee attribution is unverifiable; independent provider evidence is required"
      )
    evidence.expectedHostAllocation = allFailed
      ? payment.ownerAmount
      : transfer.amount - fee.amount - reversed + feeReturned
    evidence.differenceCents = evidence.expectedHostAllocation - evidence.currentHostAllocation
    evidence.allocationVerifiable = true
    // Re-read terminal refund identity/status after ledger reads. A concurrent transition requires refresh.
    const finalRefunds = refundObservations(await readRefunds(stripe, charge.id), charge)
    requireBinding(
      JSON.stringify(finalRefunds) === JSON.stringify(refunds),
      "Provider refund state changed while reading settlement"
    )
  } catch (error) {
    evidence.allocationVerifiable = false
    evidence.expectedHostAllocation = null
    evidence.differenceCents = null
    evidence.verificationError =
      error instanceof Error ? error.message : "Provider evidence unavailable"
  }
  refs.sort((a, b) => (a.kind + a.id).localeCompare(b.kind + b.id))
  return evidence
}
