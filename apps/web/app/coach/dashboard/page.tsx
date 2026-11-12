"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useAction, useMutation, useQuery } from "convex/react"
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  User,
  X,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CoachCancelDialog } from "@/components/coach-cancel-dialog"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function formatDateRange(start: string, end: string) {
  if (start === end) {
    return new Date(`${start}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }
  const s = new Date(`${start}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
  const e = new Date(`${end}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return `${s} – ${e}`
}

function sessionLabel(sessionType: "hourly" | "half_day" | "full_day", hours?: number) {
  if (sessionType === "hourly") return `${hours ?? 0}-hour session`
  if (sessionType === "half_day") return "Half-day"
  return "Full-day"
}

export default function CoachDashboardPage() {
  const router = useRouter()
  const { user, isSignedIn, isLoaded } = useUser()

  const profile = useQuery(api.coachProfiles.getByUser)
  const platformFee = useQuery(api.users.getMyPlatformFee, user?.id ? {} : "skip")
  const pending = useQuery(
    api.coachingBookings.getPendingForCoach,
    user?.id ? { coachUserId: user.id } : "skip"
  )
  const upcoming = useQuery(
    api.coachingBookings.getUpcomingForCoach,
    user?.id ? { coachUserId: user.id } : "skip"
  )

  const approve = useMutation(api.coachingBookings.approve)
  const decline = useMutation(api.coachingBookings.decline)

  // biome-ignore lint/suspicious/noExplicitAny: enriched booking shape from Convex
  const [cancelBooking, setCancelBooking] = useState<any | null>(null)

  const fetchConnectStatus = useAction(api.stripe.getConnectAccountStatus)
  const startOnboarding = useAction(api.stripe.createConnectAccount)
  const createDashboardLink = useAction(api.stripe.createConnectLoginLink)

  const [connectStatus, setConnectStatus] = useState<{
    hasAccount: boolean
    isComplete: boolean
    chargesEnabled?: boolean
    payoutsEnabled?: boolean
  } | null>(null)
  const [stripeBusy, setStripeBusy] = useState(false)
  const [actingOnId, setActingOnId] = useState<string | null>(null)

  // Redirect to onboarding if no profile yet
  useEffect(() => {
    if (isLoaded && isSignedIn && profile === null) {
      router.push("/coach/onboarding")
    }
  }, [isLoaded, isSignedIn, profile, router])

  // Load Stripe status
  useEffect(() => {
    if (!user?.id) return
    fetchConnectStatus({ ownerId: user.id })
      .then(setConnectStatus)
      .catch(() => {
        // best-effort
      })
  }, [user?.id, fetchConnectStatus])

  if (!isLoaded || profile === undefined) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-16 text-center">
        <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-bold text-2xl">Sign in to view your coach dashboard</h1>
        <Button asChild className="mt-6">
          <Link href="/sign-in?redirect_url=/coach/dashboard">Sign in</Link>
        </Button>
      </div>
    )
  }

  if (profile === null) {
    // Effect will redirect; render nothing meanwhile.
    return null
  }

  const handleStartStripe = async () => {
    if (!user?.id) return
    setStripeBusy(true)
    try {
      const returnUrlBase = typeof window !== "undefined" ? window.location.origin : undefined
      const result = await startOnboarding({ ownerId: user.id, returnUrlBase })
      if (result.onboardingUrl) {
        window.location.href = result.onboardingUrl
        return
      }
      const status = await fetchConnectStatus({ ownerId: user.id })
      setConnectStatus(status)
    } catch (err) {
      handleErrorWithContext(err, { action: "start Stripe onboarding" })
    } finally {
      setStripeBusy(false)
    }
  }

  const handleOpenStripe = async () => {
    if (!user?.id) return
    setStripeBusy(true)
    try {
      const link = await createDashboardLink({ ownerId: user.id })
      if (link.url) window.location.href = link.url
    } catch (err) {
      handleErrorWithContext(err, { action: "open Stripe dashboard" })
    } finally {
      setStripeBusy(false)
    }
  }

  const handleApprove = async (bookingId: string) => {
    setActingOnId(bookingId)
    try {
      await approve({ bookingId: bookingId as any })
      toast.success("Booking approved — renter will be notified to complete payment")
    } catch (err) {
      handleErrorWithContext(err, { action: "approve booking" })
    } finally {
      setActingOnId(null)
    }
  }

  const handleDecline = async (bookingId: string) => {
    setActingOnId(bookingId)
    try {
      await decline({ bookingId: bookingId as any })
      toast.success("Booking declined")
    } catch (err) {
      handleErrorWithContext(err, { action: "decline booking" })
    } finally {
      setActingOnId(null)
    }
  }

  const earnings = (upcoming ?? []).reduce((sum: number, b: any) => sum + b.totalAmount, 0)

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Coach dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your coaching profile, availability, and bookings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/coaches/${profile._id}`}>
              <Eye className="mr-2 size-4" />
              View public profile
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/coach/onboarding">
              <Edit className="mr-2 size-4" />
              Edit profile
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/coach/availability">
              <CalendarClock className="mr-2 size-4" />
              Availability
            </Link>
          </Button>
        </div>
      </div>

      {platformFee?.isEarlyAdopter && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <p className="font-medium text-emerald-900 text-sm dark:text-emerald-100">
            Early adopter
          </p>
          <p className="mt-0.5 text-emerald-800 text-sm dark:text-emerald-200">
            Your platform fee is capped at {platformFee.platformFeeCapPercentage ?? 3}%. You
            currently pay {platformFee.effectiveFeePercentage}% (never higher than your cap; lower
            if the global rate drops).
          </p>
        </div>
      )}

      {/* Stripe Connect banner */}
      {connectStatus && !connectStatus.isComplete && (
        <Card className="mb-6 border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <CardTitle className="text-amber-900 dark:text-amber-100">
                    Set up payouts to start receiving bookings
                  </CardTitle>
                  <CardDescription className="mt-1.5 text-amber-800 dark:text-amber-200">
                    {connectStatus.hasAccount
                      ? "Your Stripe account isn't fully set up. Renters can request you, but you can't be paid until onboarding is complete."
                      : "Connect a Stripe account so renters can pay you for sessions. This only takes a few minutes."}
                  </CardDescription>
                </div>
              </div>
              <Button disabled={stripeBusy} onClick={handleStartStripe} size="sm">
                {stripeBusy ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 size-4" />
                )}
                {connectStatus.hasAccount ? "Continue setup" : "Set up payouts"}
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {connectStatus?.isComplete && (
        <Card className="mb-6 border-green-200 bg-green-50/80 dark:border-green-900/50 dark:bg-green-950/30">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
                <div>
                  <CardTitle className="text-green-900 text-sm dark:text-green-100">
                    Payouts enabled
                  </CardTitle>
                  <CardDescription className="text-green-800 text-xs dark:text-green-200">
                    Your Stripe account is connected and ready.
                  </CardDescription>
                </div>
              </div>
              <Button disabled={stripeBusy} onClick={handleOpenStripe} size="sm" variant="outline">
                {stripeBusy ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 size-4" />
                )}
                Open Stripe dashboard
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Summary cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Pending requests</CardDescription>
            <CardTitle className="text-3xl">{pending?.length ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Upcoming sessions</CardDescription>
            <CardTitle className="text-3xl">{upcoming?.length ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Upcoming earnings</CardDescription>
            <CardTitle className="text-3xl">
              {upcoming === undefined ? "—" : formatCents(earnings)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Pending requests */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Pending requests</CardTitle>
          <CardDescription>
            Approve to send the renter to checkout, or decline to free up the dates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending === undefined ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : pending.length === 0 ? (
            <p className="text-muted-foreground text-sm">No pending requests right now.</p>
          ) : (
            <div className="space-y-3">
              {pending.map((b: any) => (
                <div
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
                  key={b._id}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{b.renter?.name || "Unknown renter"}</span>
                      <Badge variant="outline">{sessionLabel(b.sessionType, b.hours)}</Badge>
                      <Badge variant="secondary">{formatCents(b.totalAmount)}</Badge>
                    </div>
                    <p className="flex items-center gap-1 text-muted-foreground text-sm">
                      <Clock className="size-3" />
                      {formatDateRange(b.startDate, b.endDate)}
                      {b.startTime && ` · ${b.startTime}`}
                    </p>
                    {b.eventName && (
                      <p className="flex items-center gap-1 text-muted-foreground text-sm">
                        <MapPin className="size-3" />
                        {b.eventName}
                      </p>
                    )}
                    {b.renterMessage && (
                      <p className="mt-2 rounded bg-muted/50 p-2 text-sm">"{b.renterMessage}"</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      disabled={actingOnId === b._id}
                      onClick={() => handleApprove(b._id)}
                      size="sm"
                    >
                      {actingOnId === b._id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 size-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      disabled={actingOnId === b._id}
                      onClick={() => handleDecline(b._id)}
                      size="sm"
                      variant="outline"
                    >
                      <X className="mr-2 size-4" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming sessions</CardTitle>
          <CardDescription>Confirmed coaching sessions on your calendar.</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming === undefined ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : upcoming.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Plus className="mx-auto mb-2 size-6 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">
                No confirmed sessions yet. Once renters pay, they'll show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((b: any) => (
                <div
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={b._id}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <User className="size-4 text-muted-foreground" />
                      <span className="font-semibold">{b.renter?.name || "Renter"}</span>
                      <Badge variant="outline">{sessionLabel(b.sessionType, b.hours)}</Badge>
                    </div>
                    <p className="flex items-center gap-1 text-muted-foreground text-sm">
                      <Clock className="size-3" />
                      {formatDateRange(b.startDate, b.endDate)}
                      {b.startTime && ` · ${b.startTime}`}
                    </p>
                    {b.eventName && <p className="text-muted-foreground text-sm">{b.eventName}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatCents(b.totalAmount)}</span>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/messages">
                        <MessageSquare className="mr-2 size-4" />
                        Message
                      </Link>
                    </Button>
                    <Button onClick={() => setCancelBooking(b)} size="sm" variant="ghost">
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {cancelBooking && (
        <CoachCancelDialog
          actorRole="coach"
          bookingId={cancelBooking._id}
          onOpenChange={(o) => !o && setCancelBooking(null)}
          open={true}
          paymentStatus={cancelBooking.paymentStatus}
          startDate={cancelBooking.startDate}
          startTime={cancelBooking.startTime}
          status={cancelBooking.status}
          totalAmount={cancelBooking.totalAmount}
        />
      )}
    </div>
  )
}
