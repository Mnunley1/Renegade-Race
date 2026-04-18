"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { CheckCircle2, Loader2 } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"

function SuccessInner() {
  const searchParams = useSearchParams()
  const coachBookingId = searchParams.get("coachBookingId") as Id<"coachBookings"> | null

  const booking = useQuery(
    api.coachBookings.getById,
    coachBookingId ? { id: coachBookingId } : "skip"
  )

  return (
    <div className="mx-auto max-w-lg px-4 py-20">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="size-8" />
            <CardTitle>Payment successful</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {booking === undefined ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Loading booking…
            </div>
          ) : booking === null ? (
            <p className="text-muted-foreground text-sm">
              Thanks — your payment is processing. You will see this booking under Trips soon.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Your coaching booking with {booking.coachService?.title ?? "your coach"} is confirmed
              for {booking.startDate} – {booking.endDate}.
            </p>
          )}
          <Button asChild className="w-full" variant="default">
            <Link href="/trips">View trips</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function CoachBookingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin" />
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  )
}
