"use client"

import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { useAction } from "convex/react"
import { ArrowLeft, Calendar, Clock, Loader2, MapPin, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { toast } from "sonner"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function PayCoachingInner() {
  const searchParams = useSearchParams()
  const bookingIdParam = searchParams.get("bookingId")
  const router = useRouter()
  const { isLoaded, isSignedIn } = useUser()

  const fetchBooking = useAction(api.coachingPayments.getBookingForCheckout)
  const createCheckout = useAction(api.coachingPayments.createCheckoutSession)

  const [summary, setSummary] = useState<{
    coachName: string
    coachProfileId: Id<"coachProfiles">
    sessionLabel: string
    startDate: string
    endDate: string
    startTime?: string
    totalAmount: number
    eventName?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push(
        `/sign-in?redirect_url=${encodeURIComponent(`/checkout/pay-coaching?bookingId=${bookingIdParam}`)}`
      )
      return
    }
    if (!bookingIdParam) {
      setError("Missing booking ID")
      setLoading(false)
      return
    }
    fetchBooking({ bookingId: bookingIdParam as Id<"coachingBookings"> })
      .then((res) => {
        if (res) {
          setSummary(res)
        } else {
          setError("This booking couldn't be loaded")
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load booking")
      })
      .finally(() => setLoading(false))
  }, [bookingIdParam, fetchBooking, isLoaded, isSignedIn, router])

  const handlePay = async () => {
    if (!bookingIdParam) return
    setRedirecting(true)
    try {
      const result = await createCheckout({
        bookingId: bookingIdParam as Id<"coachingBookings">,
      })
      if (result.url) {
        window.location.href = result.url
        return
      }
      toast.error("Stripe didn't return a checkout URL")
      setRedirecting(false)
    } catch (err) {
      handleErrorWithContext(err, { action: "start coaching payment" })
      setRedirecting(false)
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-bold text-2xl">Couldn't load this booking</h1>
        <p className="mt-2 text-muted-foreground">{error || "Booking not found"}</p>
        <Button asChild className="mt-6">
          <Link href="/trips">Back to trips</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Link className="mb-4 inline-block" href={`/coaches/${summary.coachProfileId}`}>
        <Button size="sm" variant="ghost">
          <ArrowLeft className="mr-2 size-4" />
          Back to coach
        </Button>
      </Link>

      <h1 className="mb-2 font-bold text-3xl tracking-tight">Complete your booking</h1>
      <p className="mb-6 text-muted-foreground">
        Pay now to confirm your session with {summary.coachName}.
      </p>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Session details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span>
              {summary.startDate === summary.endDate
                ? new Date(`${summary.startDate}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : `${summary.startDate} – ${summary.endDate}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <span>
              {summary.sessionLabel}
              {summary.startTime ? ` · starts ${summary.startTime}` : ""}
            </span>
          </div>
          {summary.eventName && (
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" />
              <span>{summary.eventName}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Total due</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline justify-between border-b pb-3">
            <span className="text-muted-foreground">Coaching with {summary.coachName}</span>
            <span className="font-semibold">{formatCents(summary.totalAmount)}</span>
          </div>
          <div className="flex items-baseline justify-between pt-3">
            <span className="font-semibold">Session total</span>
            <span className="font-bold text-2xl">{formatCents(summary.totalAmount)}</span>
          </div>
          <p className="mt-3 text-muted-foreground text-xs">
            A card processing fee (~2.9% + $0.30) is added on the Stripe checkout page and paid by
            you, not the coach.
          </p>
        </CardContent>
      </Card>

      <Button className="w-full" disabled={redirecting} onClick={handlePay} size="lg">
        {redirecting ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <ShieldCheck className="mr-2 size-4" />
        )}
        Continue to payment
      </Button>
      <p className="mt-3 text-center text-muted-foreground text-xs">
        Secure payment powered by Stripe. Your card isn&apos;t charged until you complete checkout.
      </p>
    </div>
  )
}

export default function PayCoachingPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PayCoachingInner />
    </Suspense>
  )
}
