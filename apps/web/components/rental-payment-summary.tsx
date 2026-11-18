"use client"

import { useUser } from "@clerk/nextjs"
import { api } from "@renegade/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { formatRentalUsd } from "@/lib/rental-checkout"

// Use the existing self-scoped ledger query. Never infer a captured charge from
// a reservation status, or expose payment rows through public reservation reads.
export function useRentalPayment({
  reservationId,
  paymentId,
  renterId,
}: {
  reservationId: string
  paymentId?: string
  renterId?: string
}) {
  const { user } = useUser()
  const payments = useQuery(
    api.stripe.getUserPayments,
    user && user.id === renterId && paymentId ? { userId: user.id } : "skip"
  )
  if (!user || user.id !== renterId || !paymentId) return
  return payments?.find(
    (payment) =>
      payment._id === paymentId &&
      payment.reservationId === reservationId &&
      payment.renterId === user.id
  )
}

export function RentalPaymentSummary({
  reservationId,
  paymentId,
  renterId,
}: {
  reservationId: string
  paymentId?: string
  renterId?: string
}) {
  const payment = useRentalPayment({ reservationId, paymentId, renterId })
  if (
    !payment ||
    payment.currency !== "usd" ||
    !["succeeded", "partially_refunded", "refunded"].includes(payment.status)
  )
    return null

  return (
    <dl className="space-y-1 text-sm">
      <div className="flex justify-between gap-4">
        <dt>Paid rental subtotal</dt>
        <dd>{formatRentalUsd(payment.amount)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Card processing fee</dt>
        <dd>{formatRentalUsd(payment.processingFee ?? 0)}</dd>
      </div>
      <div className="flex justify-between gap-4 font-medium">
        <dt>Total charged</dt>
        <dd>
          {formatRentalUsd(payment.capturedAmount ?? payment.amount + (payment.processingFee ?? 0))}
        </dd>
      </div>
      {(payment.refundAmount ?? 0) > 0 && (
        <div className="flex justify-between gap-4">
          <dt>Total refunded</dt>
          <dd>{formatRentalUsd(payment.refundAmount ?? 0)}</dd>
        </div>
      )}
    </dl>
  )
}
