import type { QueryCtx } from "./_generated/server"

/** Financial history stays intact; only live obligations prevent provider deletion. */
export async function additionalDeletionBlockers(ctx: QueryCtx, subject: string) {
  const reasons: string[] = []
  const operations = await ctx.db
    .query("accountOperations")
    .withIndex("by_subject", (q) => q.eq("subject", subject))
    .collect()
  if (operations.some((op) => op.status === "active"))
    reasons.push(
      "An account or payment operation is still unconfirmed. Contact support before deleting your account."
    )
  const invoices = [
    ...(await ctx.db
      .query("invoices")
      .withIndex("by_sender", (q) => q.eq("senderId", subject))
      .collect()),
    ...(await ctx.db
      .query("invoices")
      .withIndex("by_recipient", (q) => q.eq("recipientId", subject))
      .collect()),
  ]
  if (
    invoices.some(
      (i) =>
        ["sent", "viewed", "payment_pending", "processing", "overdue"].includes(i.status) ||
        ["pending", "held", "partially_refunded"].includes(i.depositStatus ?? "") ||
        (i.depositRefundPendingAmount ?? 0) > 0
    )
  )
    reasons.push("Outstanding invoices or deposits must be resolved before deleting your account.")
  for (const invoice of invoices) {
    const reserved = await ctx.db
      .query("invoiceDepositRefundRequests")
      .withIndex("by_invoice_state", (q) => q.eq("invoiceId", invoice._id).eq("state", "reserved"))
      .first()
    if (reserved) {
      reasons.push("A deposit refund is still being submitted. Please wait for it to resolve.")
      break
    }
  }
  const payments = [
    ...(await ctx.db
      .query("payments")
      .withIndex("by_renter", (q) => q.eq("renterId", subject))
      .collect()),
    ...(await ctx.db
      .query("payments")
      .withIndex("by_owner", (q) => q.eq("ownerId", subject))
      .collect()),
  ]
  for (const payment of payments) {
    const observations = await ctx.db
      .query("rentalSettlementObservations")
      .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
      .order("desc")
      .collect()
    const seen = new Set<string>()
    if (
      observations.some(({ observation }) => {
        if (seen.has(observation.refundId)) return false
        seen.add(observation.refundId)
        return !["succeeded", "failed", "canceled"].includes(observation.status)
      })
    ) {
      reasons.push("A rental refund is still pending. Please wait for its final outcome.")
      break
    }
  }
  const coaching = [
    ...(await ctx.db
      .query("coachingBookings")
      .withIndex("by_coach_user", (q) => q.eq("coachUserId", subject))
      .collect()),
    ...(await ctx.db
      .query("coachingBookings")
      .withIndex("by_renter", (q) => q.eq("renterId", subject))
      .collect()),
  ]
  if (
    coaching.some(
      (b) =>
        ["pending", "approved", "confirmed"].includes(b.status) ||
        b.paymentStatus === "pending" ||
        b.disputeStatus === "open"
    )
  )
    reasons.push(
      "Active coaching bookings, payments, or disputes must be resolved before deleting your account."
    )
  const seats = [
    ...(await ctx.db
      .query("seatBookings")
      .withIndex("by_host", (q) => q.eq("hostUserId", subject))
      .collect()),
    ...(await ctx.db
      .query("seatBookings")
      .withIndex("by_driver", (q) => q.eq("driverId", subject))
      .collect()),
  ]
  if (
    seats.some(
      (b) =>
        ["pending", "waitlisted", "approved", "deposit_paid", "confirmed"].includes(b.status) ||
        b.depositPaymentStatus === "pending" ||
        b.balancePaymentStatus === "pending"
    )
  )
    reasons.push("Active seat bookings or payments must be resolved before deleting your account.")
  const damage = [
    ...(await ctx.db
      .query("damageInvoices")
      .withIndex("by_owner", (q) => q.eq("ownerId", subject))
      .collect()),
    ...(await ctx.db
      .query("damageInvoices")
      .withIndex("by_renter", (q) => q.eq("renterId", subject))
      .collect()),
  ]
  if (damage.some((i) => ["pending_review", "payment_pending"].includes(i.status)))
    reasons.push("Outstanding damage claims must be resolved before deleting your account.")
  const disputes = [
    ...(await ctx.db
      .query("disputes")
      .withIndex("by_owner", (q) => q.eq("ownerId", subject))
      .collect()),
    ...(await ctx.db
      .query("disputes")
      .withIndex("by_renter", (q) => q.eq("renterId", subject))
      .collect()),
  ]
  if (disputes.some((d) => d.status === "open"))
    reasons.push("Open rental disputes must be resolved before deleting your account.")
  const completions = [
    ...(await ctx.db
      .query("rentalCompletions")
      .withIndex("by_owner", (q) => q.eq("ownerId", subject))
      .collect()),
    ...(await ctx.db
      .query("rentalCompletions")
      .withIndex("by_renter", (q) => q.eq("renterId", subject))
      .collect()),
  ]
  if (completions.some((c) => c.status !== "completed"))
    reasons.push("Rental returns must be resolved before deleting your account.")
  return reasons
}
