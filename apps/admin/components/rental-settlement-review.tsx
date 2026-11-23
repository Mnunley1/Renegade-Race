"use client"

import { useAuth } from "@clerk/nextjs"
import { api } from "@renegade/backend/convex/_generated/api"
import type { Id } from "@renegade/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useAction, useConvexAuth, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import Link from "next/link"
import { type ReactNode, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"

const TRANSFER_SEPARATOR = /[\s,]+/
const TRANSFER_ID = /^tr_[A-Za-z0-9]+$/

type Review = FunctionReturnType<typeof api.rentalSettlement.getByPayment>["reviews"][number]

function AdminReviewBoundary({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const convex = useConvexAuth()
  if (
    !(
      auth.isLoaded &&
      auth.isSignedIn &&
      auth.userId &&
      auth.sessionId &&
      convex.isAuthenticated
    ) ||
    convex.isLoading
  ) {
    return <output className="text-muted-foreground text-sm">Loading settlement reviews…</output>
  }
  return <div key={`${auth.userId}:${auth.sessionId}`}>{children}</div>
}

export function RentalSettlementQueue() {
  return (
    <AdminReviewBoundary>
      <SettlementQueue />
    </AdminReviewBoundary>
  )
}

function SettlementQueue() {
  const { userId } = useAuth()
  const reviews = useQuery(api.rentalSettlement.listHeld, { viewerId: userId ?? undefined })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settlement reviews</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Failed-refund allocation reviews are separate from successful customer refund history.
          Payment status does not establish host settlement.
        </p>
        {reviews === undefined ? (
          <output>Loading settlement reviews…</output>
        ) : reviews.length === 0 ? (
          <p className="text-sm">No settlement reviews are currently on hold.</p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((review) => (
              <li className="rounded-lg border p-3 text-sm" key={review._id}>
                <Link
                  className="font-medium underline underline-offset-4"
                  href={`/payments/${review.paymentId}`}
                >
                  Review payment {review.paymentId}
                </Link>
                <p className="break-all text-muted-foreground">
                  Refund {review.refundId} · Customer refund: {review.customerRefundStatus}
                </p>
                <p>Settlement review pending</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function RentalSettlementReview({ paymentId }: { paymentId: Id<"payments"> }) {
  return (
    <AdminReviewBoundary>
      <SettlementReviewContent key={paymentId} paymentId={paymentId} />
    </AdminReviewBoundary>
  )
}

function SettlementReviewContent({ paymentId }: { paymentId: Id<"payments"> }) {
  const { userId } = useAuth()
  const result = useQuery(api.rentalSettlement.getByPayment, {
    paymentId,
    viewerId: userId ?? undefined,
  })
  const refresh = useAction(api.rentalSettlement.refresh)
  const [refreshing, setRefreshing] = useState(false)
  const active = useRef(true)
  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const refreshEvidence = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await refresh({ paymentId })
      if (active.current) toast.success("Settlement evidence refreshed")
    } catch {
      if (active.current) toast.error("Unable to refresh settlement evidence. Please retry.")
    } finally {
      if (active.current) setRefreshing(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Refund settlement review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          These are provider-ledger allocations, not completed bank payouts. A failed customer
          refund can leave host settlement unresolved even when the payment is paid.
        </p>
        <Button disabled={refreshing} onClick={refreshEvidence} type="button" variant="outline">
          {refreshing ? "Refreshing evidence…" : "Refresh provider evidence"}
        </Button>
        {result === undefined ? (
          <output>Loading settlement review…</output>
        ) : result.reviews.length === 0 ? (
          <p className="text-sm">
            No failed-refund settlement review is recorded for this payment.
          </p>
        ) : (
          result.reviews.map((review) => <ReviewDetails key={review._id} review={review} />)
        )}
      </CardContent>
    </Card>
  )
}

function allocation(value: number | null | undefined, currency: string) {
  if (value == null || !Number.isFinite(value)) return "Unavailable"
  return `${(value / 100).toFixed(2)} ${currency.toUpperCase()}`
}

function ReviewDetails({ review }: { review: Review }) {
  const evidence = review.evidence
  return (
    <section
      aria-label={`Settlement review for refund ${review.refundId}`}
      className="space-y-4 rounded-lg border p-4"
    >
      <div>
        <h3 className="font-semibold">
          {review.status === "held" ? "Settlement review pending" : "Settlement review resolved"}
        </h3>
        <p className="text-sm">Customer refund: {review.customerRefundStatus}</p>
        <p className="break-all font-mono text-xs">Refund {review.refundId}</p>
        {review.status === "held" && (
          <p className="mt-2 text-sm">
            New refund requests are paused until the settlement review is resolved.
          </p>
        )}
      </div>
      {evidence ? (
        <div className="space-y-3 text-sm">
          <dl className="space-y-2">
            <div>
              <dt>Expected host allocation</dt>
              <dd>{allocation(evidence.expectedHostAllocation, evidence.currency)}</dd>
            </div>
            <div>
              <dt>Observed host allocation</dt>
              <dd>{allocation(evidence.currentHostAllocation, evidence.currency)}</dd>
            </div>
            <div>
              <dt>Unresolved allocation difference</dt>
              <dd>{allocation(evidence.differenceCents, evidence.currency)}</dd>
            </div>
            <div>
              <dt>Evidence observed</dt>
              <dd>{new Date(evidence.observedAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Binding verified</dt>
              <dd>{evidence.bindingVerified ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Allocation verifiable</dt>
              <dd>{evidence.allocationVerifiable ? "Yes" : "No"}</dd>
            </div>
          </dl>
          {evidence.verificationError && <p role="alert">{evidence.verificationError}</p>}
          <h4 className="font-medium">Provider references</h4>
          <dl className="space-y-2 break-all">
            <div>
              <dt>Charge</dt>
              <dd className="font-mono text-xs">{evidence.stripeChargeId}</dd>
            </div>
            <div>
              <dt>Payment intent</dt>
              <dd className="font-mono text-xs">{evidence.stripePaymentIntentId}</dd>
            </div>
            <div>
              <dt>Transfer</dt>
              <dd className="font-mono text-xs">{evidence.stripeTransferId || "Unavailable"}</dd>
            </div>
            <div>
              <dt>Application fee</dt>
              <dd className="font-mono text-xs">{evidence.applicationFeeId || "Unavailable"}</dd>
            </div>
            <div>
              <dt>Destination</dt>
              <dd className="font-mono text-xs">
                {evidence.destinationAccountId || "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Failure balance transaction</dt>
              <dd className="font-mono text-xs">
                {evidence.failureBalanceTransactionId || "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Transfer reversals</dt>
              <dd className="font-mono text-xs">
                {evidence.transferReversalIds.join(", ") || "None recorded"}
              </dd>
            </div>
            <div>
              <dt>Fee refunds</dt>
              <dd className="font-mono text-xs">
                {evidence.feeRefundIds.join(", ") || "None recorded"}
              </dd>
            </div>
          </dl>
          <details>
            <summary>Allocation ledger references</summary>
            <ul className="mt-2 space-y-2">
              {evidence.references.map((reference, index) => (
                <li className="break-all" key={`${reference.kind}:${reference.id}:${index}`}>
                  {reference.kind}: <span className="font-mono text-xs">{reference.id}</span>
                  {reference.amount != null && (
                    <span>
                      {" "}
                      · {allocation(reference.amount, reference.currency || evidence.currency)}
                    </span>
                  )}
                  {reference.status && <span> · {reference.status}</span>}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : (
        <p className="text-sm">
          Provider allocation evidence is unavailable. Refresh before recording a resolution.
        </p>
      )}
      {review.resolution && (
        <div className="space-y-1 break-words text-sm">
          <p>
            {review.status === "held" ? "Previous resolution recorded" : "Resolved"} by{" "}
            {review.resolution.operatorId} on{" "}
            {new Date(review.resolution.resolvedAt).toLocaleString()}
          </p>
          <p>Reference: {review.resolution.reference}</p>
          <p>{review.resolution.notes}</p>
        </div>
      )}
      {review.status === "held" && (
        <ResolutionForm
          key={`${review._id}:${review.latestEvidenceId || "unavailable"}`}
          review={review}
        />
      )}
    </section>
  )
}

function ResolutionForm({ review }: { review: Review }) {
  const resolve = useAction(api.rentalSettlement.resolve)
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [transfers, setTransfers] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const active = useRef(true)
  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const record = async () => {
    if (busy || !confirmed || !reference.trim() || !notes.trim() || !review.latestEvidenceId) return
    const ids = transfers
      .split(TRANSFER_SEPARATOR)
      .map((id) => id.trim())
      .filter(Boolean)
    if (ids.some((id) => !TRANSFER_ID.test(id))) {
      toast.error("Use existing Stripe transfer IDs, separated by a new line or comma.")
      return
    }
    setBusy(true)
    try {
      await resolve({
        reviewId: review._id,
        expectedEvidenceId: review.latestEvidenceId,
        reference: reference.trim(),
        notes: notes.trim(),
        compensatingTransferIds: [...new Set(ids)],
      })
      if (active.current) toast.success("Verified settlement resolution recorded")
    } catch {
      if (active.current)
        toast.error(
          "Resolution was not verified. The review remains on hold; refresh evidence and retry."
        )
    } finally {
      if (active.current) setBusy(false)
    }
  }
  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-sm">
        A review closes only after fresh provider evidence confirms the expected host allocation.
        This records a completed resolution and does not send funds.
      </p>
      <div className="space-y-1">
        <Label htmlFor={`reference-${review._id}`}>Resolution reference</Label>
        <Input
          disabled={busy}
          id={`reference-${review._id}`}
          maxLength={500}
          onChange={(event) => setReference(event.target.value)}
          value={reference}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`notes-${review._id}`}>Operator notes</Label>
        <Textarea
          disabled={busy}
          id={`notes-${review._id}`}
          maxLength={4000}
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`transfers-${review._id}`}>
          Existing compensating transfer IDs (optional)
        </Label>
        <Textarea
          disabled={busy}
          id={`transfers-${review._id}`}
          onChange={(event) => setTransfers(event.target.value)}
          placeholder="tr_…"
          value={transfers}
        />
      </div>
      <Label className="flex items-start gap-2">
        <input
          checked={confirmed}
          disabled={busy}
          onChange={(event) => setConfirmed(event.target.checked)}
          type="checkbox"
        />
        I reviewed the provider references and am recording an existing settlement resolution.
      </Label>
      <Button
        disabled={
          busy || !confirmed || !reference.trim() || !notes.trim() || !review.latestEvidenceId
        }
        onClick={record}
        type="button"
      >
        {busy ? "Verifying resolution…" : "Record verified resolution"}
      </Button>
    </div>
  )
}
