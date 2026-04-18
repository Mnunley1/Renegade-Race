"use client"

import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { useAction, useQuery } from "convex/react"
import {
  ArrowDownUp,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FlagTriangleRight,
  GraduationCap,
  Search,
  Send,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { TripCard } from "@/components/trip-card"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

type Trip = {
  reservationId: Id<"reservations">
  vehicleId: Id<"vehicles">
  vehicleName: string
  vehicleImage: string
  vehicleYear: number
  vehicleMake: string
  vehicleModel: string
  location: string
  startDate: string
  endDate: string
  pickupTime?: string
  dropoffTime?: string
  totalDays: number
  dailyRate: number
  totalAmount: number
  status: "pending" | "approved" | "confirmed" | "cancelled" | "completed" | "declined"
  addOns?: Array<{ name: string; price: number; description?: string }>
}

function mapReservation(res: any): Trip | null {
  const vehicle = res.vehicle
  if (!vehicle) {
    return null
  }
  const primaryImage = vehicle.images?.find((img: any) => img.isPrimary) || vehicle.images?.[0]
  return {
    reservationId: res._id,
    vehicleId: vehicle._id,
    vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehicleImage: primaryImage?.cardUrl ?? "",
    vehicleYear: vehicle.year,
    vehicleMake: vehicle.make,
    vehicleModel: vehicle.model,
    location: vehicle.track?.location || vehicle.track?.name || "Location TBD",
    startDate: res.startDate,
    endDate: res.endDate,
    pickupTime: res.pickupTime,
    dropoffTime: res.dropoffTime,
    totalDays: res.totalDays,
    dailyRate: res.dailyRate,
    totalAmount: res.totalAmount,
    status: res.status,
    addOns: res.addOns,
  }
}

function SkeletonCard() {
  return (
    <Card className="flex h-64 overflow-hidden md:flex-row">
      <div className="h-48 w-full shrink-0 animate-pulse bg-muted md:h-auto md:w-2/5" />
      <CardContent className="flex flex-1 flex-col gap-4 p-6">
        <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-20 w-full animate-pulse rounded bg-muted" />
        <div className="mt-auto h-10 w-full animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
  showBrowse = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  showBrowse?: boolean
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center py-16 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
          <Icon className="size-7 text-muted-foreground" />
        </div>
        <p className="mb-1 font-semibold text-lg">{title}</p>
        <p className="mb-6 max-w-sm text-muted-foreground text-sm">{description}</p>
        {showBrowse && (
          <Link href="/vehicles">
            <Button>Browse Vehicles</Button>
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-5 text-primary" />
      </div>
      <div>
        <p className="font-bold text-2xl leading-none">{value}</p>
        <p className="mt-0.5 text-muted-foreground text-xs">{label}</p>
      </div>
    </div>
  )
}

function TripList({
  trips,
  searchQuery,
  sortDirection,
}: {
  trips: Trip[]
  searchQuery: string
  sortDirection: "asc" | "desc"
}) {
  const filtered = useMemo(() => {
    let result = trips
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((t) => t.vehicleName.toLowerCase().includes(q))
    }
    return result.sort((a, b) =>
      sortDirection === "asc"
        ? a.startDate.localeCompare(b.startDate)
        : b.startDate.localeCompare(a.startDate)
    )
  }, [trips, searchQuery, sortDirection])

  if (filtered.length === 0 && searchQuery.trim()) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        No trips match &ldquo;{searchQuery}&rdquo;
      </p>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {filtered.map((trip) => (
        <TripCard key={trip.reservationId} {...trip} />
      ))}
    </div>
  )
}

export default function TripsPage() {
  const { user } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
  const [requestsSort, setRequestsSort] = useState<"asc" | "desc">("desc")
  const [upcomingSort, setUpcomingSort] = useState<"asc" | "desc">("asc")
  const [pastSort, setPastSort] = useState<"asc" | "desc">("desc")
  const [cancelledSort, setCancelledSort] = useState<"asc" | "desc">("desc")
  const [payingCoachId, setPayingCoachId] = useState<Id<"coachBookings"> | null>(null)

  const reservationsData = useQuery(
    api.reservations.getByUser,
    user?.id ? { userId: user.id, role: "renter" as const } : "skip"
  )

  const coachBookings = useQuery(
    api.coachBookings.getByUser,
    user?.id ? { userId: user.id, role: "client" as const } : "skip"
  )
  const createCoachCheckout = useAction(api.stripe.createCoachBookingCheckoutSession)

  const coachAwaitingPayment = useMemo(() => {
    if (!coachBookings) return []
    return coachBookings.filter(
      (b) => b.status === "approved" && b.paymentStatus !== "paid"
    )
  }, [coachBookings])

  const payCoachBooking = async (bookingId: Id<"coachBookings">) => {
    setPayingCoachId(bookingId)
    try {
      const { url } = await createCoachCheckout({ coachBookingId: bookingId })
      if (url) {
        window.location.href = url
      }
    } catch (e) {
      handleErrorWithContext(e, { action: "pay for coaching" })
    } finally {
      setPayingCoachId(null)
    }
  }

  const { pendingRequests, awaitingPayment, upcoming, past, cancelled } = useMemo(() => {
    if (!reservationsData) {
      return { pendingRequests: [], awaitingPayment: [], upcoming: [], past: [], cancelled: [] }
    }
    const today = new Date().toISOString().split("T")[0]
    const all = reservationsData.map(mapReservation).filter(Boolean) as Trip[]

    return {
      pendingRequests: all.filter((t) => t.status === "pending"),
      awaitingPayment: all.filter((t) => t.status === "approved"),
      upcoming: all.filter((t) => t.status === "confirmed" && t.endDate >= (today ?? "")),
      past: all.filter(
        (t) => t.status === "completed" || (t.endDate < (today ?? "") && t.status === "confirmed")
      ),
      cancelled: all.filter((t) => t.status === "cancelled" || t.status === "declined"),
    }
  }, [reservationsData])

  const isLoading = reservationsData === undefined
  const totalTrips =
    pendingRequests.length +
    awaitingPayment.length +
    upcoming.length +
    past.length +
    cancelled.length

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-1 font-bold text-3xl tracking-tight">My Trips</h1>
        <p className="text-muted-foreground">
          {isLoading
            ? "Loading your trips..."
            : totalTrips === 0
              ? "Manage your reservations and review past experiences"
              : `${pendingRequests.length + awaitingPayment.length > 0 ? `${pendingRequests.length + awaitingPayment.length} pending, ` : ""}${upcoming.length} upcoming, ${past.length} past`}
        </p>
      </div>

      {coachBookings !== undefined && coachAwaitingPayment.length > 0 && (
        <Card className="mb-8 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 font-medium">
              <GraduationCap className="size-5" />
              Coaching — payment due
            </div>
            <ul className="space-y-2">
              {coachAwaitingPayment.map(
                (b: {
                  _id: Id<"coachBookings">
                  totalAmount: number
                  coachService?: { title?: string } | null
                }) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    key={b._id}
                  >
                    <span>
                      {b.coachService?.title ?? "Coaching"} · $
                      {(b.totalAmount / 100).toFixed(2)}
                    </span>
                    <Button
                      disabled={payingCoachId === b._id}
                      onClick={() => payCoachBooking(b._id)}
                      size="sm"
                    >
                      {payingCoachId === b._id ? "Redirecting…" : "Pay now"}
                    </Button>
                  </li>
                )
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {!isLoading && totalTrips > 0 && (
        <div className="mb-8 grid grid-cols-3 gap-3">
          <StatCard icon={FlagTriangleRight} label="Total Trips" value={totalTrips} />
          <StatCard icon={Clock} label="Upcoming" value={upcoming.length} />
          <StatCard icon={CheckCircle2} label="Completed" value={past.length} />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <Tabs
          className="space-y-6"
          defaultValue={
            pendingRequests.length + awaitingPayment.length > 0 ? "requests" : "upcoming"
          }
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              {(pendingRequests.length > 0 || awaitingPayment.length > 0) && (
                <TabsTrigger value="requests">
                  Requests
                  {pendingRequests.length + awaitingPayment.length > 0 &&
                    ` (${pendingRequests.length + awaitingPayment.length})`}
                </TabsTrigger>
              )}
              <TabsTrigger value="upcoming">
                Upcoming{upcoming.length > 0 && ` (${upcoming.length})`}
              </TabsTrigger>
              <TabsTrigger value="past">Past{past.length > 0 && ` (${past.length})`}</TabsTrigger>
              <TabsTrigger value="cancelled">
                Cancelled
                {cancelled.length > 0 && ` (${cancelled.length})`}
              </TabsTrigger>
            </TabsList>

            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by vehicle..."
                value={searchQuery}
              />
            </div>
          </div>

          {/* Requests (pending + approved) */}
          <TabsContent value="requests">
            {awaitingPayment.length > 0 && (
              <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/50">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-5 text-green-600 dark:text-green-400" />
                  <p className="font-medium text-green-900 dark:text-green-100">
                    {awaitingPayment.length} approved{" "}
                    {awaitingPayment.length === 1 ? "request" : "requests"} awaiting payment
                  </p>
                </div>
                <p className="mt-1 text-green-800 text-sm dark:text-green-200">
                  Complete payment within 48 hours to confirm your booking.
                </p>
              </div>
            )}
            {[...awaitingPayment, ...pendingRequests].length > 0 && (
              <div className="mb-4 flex justify-end">
                <Button
                  className="text-muted-foreground text-xs"
                  onClick={() => setRequestsSort((s) => (s === "asc" ? "desc" : "asc"))}
                  size="sm"
                  variant="ghost"
                >
                  <ArrowDownUp className="mr-1.5 size-3.5" />
                  {requestsSort === "desc" ? "Most recent first" : "Oldest first"}
                </Button>
              </div>
            )}
            {[...awaitingPayment, ...pendingRequests].length === 0 && !searchQuery.trim() ? (
              <EmptyState
                description="When you request a rental, it will appear here until the host responds."
                icon={Send}
                title="No pending requests"
              />
            ) : (
              <TripList
                searchQuery={searchQuery}
                sortDirection={requestsSort}
                trips={[...awaitingPayment, ...pendingRequests]}
              />
            )}
          </TabsContent>

          {/* Upcoming */}
          <TabsContent value="upcoming">
            {upcoming.length > 0 && (
              <div className="mb-4 flex justify-end">
                <Button
                  className="text-muted-foreground text-xs"
                  onClick={() => setUpcomingSort((s) => (s === "asc" ? "desc" : "asc"))}
                  size="sm"
                  variant="ghost"
                >
                  <ArrowDownUp className="mr-1.5 size-3.5" />
                  {upcomingSort === "asc" ? "Soonest first" : "Latest first"}
                </Button>
              </div>
            )}
            {upcoming.length === 0 && !searchQuery.trim() ? (
              <EmptyState
                description="Time to book your next track day! Browse our lineup of high-performance vehicles."
                icon={Calendar}
                showBrowse
                title="No upcoming trips"
              />
            ) : (
              <TripList searchQuery={searchQuery} sortDirection={upcomingSort} trips={upcoming} />
            )}
          </TabsContent>

          {/* Past */}
          <TabsContent value="past">
            {past.length > 0 && (
              <div className="mb-4 flex justify-end">
                <Button
                  className="text-muted-foreground text-xs"
                  onClick={() => setPastSort((s) => (s === "asc" ? "desc" : "asc"))}
                  size="sm"
                  variant="ghost"
                >
                  <ArrowDownUp className="mr-1.5 size-3.5" />
                  {pastSort === "desc" ? "Most recent first" : "Oldest first"}
                </Button>
              </div>
            )}
            {past.length === 0 && !searchQuery.trim() ? (
              <EmptyState
                description="Once you complete your first track day rental, it will show up here."
                icon={CheckCircle2}
                title="No completed trips yet"
              />
            ) : (
              <TripList searchQuery={searchQuery} sortDirection={pastSort} trips={past} />
            )}
          </TabsContent>

          {/* Cancelled */}
          <TabsContent value="cancelled">
            {cancelled.length > 0 && (
              <div className="mb-4 flex justify-end">
                <Button
                  className="text-muted-foreground text-xs"
                  onClick={() => setCancelledSort((s) => (s === "asc" ? "desc" : "asc"))}
                  size="sm"
                  variant="ghost"
                >
                  <ArrowDownUp className="mr-1.5 size-3.5" />
                  {cancelledSort === "desc" ? "Most recent first" : "Oldest first"}
                </Button>
              </div>
            )}
            {cancelled.length === 0 && !searchQuery.trim() ? (
              <EmptyState
                description="Any cancelled or declined reservations will appear here."
                icon={XCircle}
                title="No cancelled trips"
              />
            ) : (
              <TripList searchQuery={searchQuery} sortDirection={cancelledSort} trips={cancelled} />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
