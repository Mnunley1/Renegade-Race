"use client"

import { api } from "@renegade/backend/convex/_generated/api"
import type { Id } from "@renegade/backend/convex/_generated/dataModel"
import { useQuery } from "convex/react"
import Link from "next/link"
import { useAccountAuth } from "@/hooks/useAccountAuth"

type Props = {
  reservationId: string
  participantId?: string
  participantRole: "renter" | "host"
}

export function RentalSettlementNotice(props: Props) {
  const auth = useAccountAuth()
  if (!auth.isReady || auth.user?.id !== props.participantId) return null
  return <SettlementNotice {...props} key={`${auth.accountKey}:${props.reservationId}`} />
}

function SettlementNotice({ reservationId, participantRole }: Props) {
  const review = useQuery(api.rentalSettlement.participantStatus, {
    reservationId: reservationId as Id<"reservations">,
  })
  if (review === undefined)
    return <output className="text-muted-foreground text-sm">Checking settlement review…</output>
  if (!(review && ["held", "resolved"].includes(review.status))) return null
  const held = review.status === "held"
  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm" role="status">
      <p className="font-medium">
        {held ? "Settlement review pending" : "Settlement review completed"}
      </p>
      {review.customerRefundStatus === "failed" && (
        <p>
          {participantRole === "renter" ? "Your refund failed." : "The customer refund failed."}
        </p>
      )}
      {review.customerRefundStatus !== "failed" && (
        <p>
          {participantRole === "renter" ? "Your refund status" : "Customer refund status"}:{" "}
          {review.customerRefundStatus.replaceAll("_", " ")}
        </p>
      )}
      <p>{review.message}</p>
      {held && (
        <p className="text-muted-foreground">
          {participantRole === "host"
            ? "A paid payment status does not confirm that your settlement allocation has been restored."
            : "Your refund outcome and the host’s settlement review are tracked separately."}
        </p>
      )}
      {held && (
        <Link className="underline underline-offset-4" href="/contact">
          Contact support
        </Link>
      )}
    </div>
  )
}
