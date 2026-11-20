"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { useMutation, useQuery } from "convex/react"
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  MessageSquare,
  XCircle,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { RentalQuoteSummary } from "@/components/rental-quote-summary"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"
import { r2Url } from "@/lib/r2-url"
import { formatRentalUsd, getRentalQuoteError } from "@/lib/rental-checkout"

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400"

function getStatusBadge(status: string) {
  switch (status) {
    case "confirmed":
      return (
        <Badge className="gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400">
          <CheckCircle2 className="size-3" />
          Confirmed
        </Badge>
      )
    case "pending":
      return (
        <Badge className="gap-1.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
          <Clock className="size-3" />
          Pending
        </Badge>
      )
    case "approved":
      return (
        <Badge className="gap-1.5 bg-purple-500/10 text-purple-700 dark:text-purple-400">
          <CreditCard className="size-3" />
          Awaiting payment
        </Badge>
      )
    case "completed":
      return (
        <Badge className="gap-1.5 bg-blue-500/10 text-blue-700 dark:text-blue-400">
          <CheckCircle2 className="size-3" />
          Completed
        </Badge>
      )
    case "cancelled":
      return (
        <Badge className="gap-1.5 bg-red-500/10 text-red-700 dark:text-red-400">
          <XCircle className="size-3" />
          Cancelled
        </Badge>
      )
    default:
      return null
  }
}

function formatDate(dateString: string | number) {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// Shared thumbnail + name + meta header used by every reservation row.
function VehicleThumb({ imageKey, alt }: { imageKey?: string | null; alt: string }) {
  return (
    <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-32 sm:w-48">
      <Image
        alt={alt}
        className="object-cover"
        fill
        quality={75}
        sizes="192px"
        src={imageKey ? r2Url(imageKey) : FALLBACK_IMAGE}
      />
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Calendar
  title: string
  subtitle: string
}) {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <Icon className="mx-auto mb-4 size-12 text-muted-foreground" />
        <p className="mb-2 font-semibold text-lg">{title}</p>
        <p className="text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

// One compact, calm row used across all reservation tabs.
function ReservationRow({
  reservation,
  isReturnPending,
  onApprove,
  onDecline,
}: {
  reservation: any
  isReturnPending: boolean
  onApprove: (id: string) => void
  onDecline: (id: string) => void
}) {
  const vehicle = reservation.vehicle
  const name = `${vehicle?.year ?? ""} ${vehicle?.make ?? ""} ${vehicle?.model ?? ""}`.trim()
  const imageKey =
    vehicle?.images?.find((img: { isPrimary: boolean }) => img.isPrimary)?.r2Key ||
    vehicle?.images?.[0]?.r2Key
  const renterName = reservation.renter?.name || "Unknown renter"
  const amount = formatRentalUsd(reservation.totalAmount || 0)
  const status = reservation.status
  const needsReview =
    status === "approved" &&
    (reservation.paymentStatus === "paid" || reservation.paymentStatus === "partially_refunded")

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <VehicleThumb alt={name} imageKey={imageKey} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-semibold">{name}</h2>
              {needsReview ? <Badge>Needs review</Badge> : getStatusBadge(status)}
              {isReturnPending && (
                <Badge className="gap-1.5 bg-orange-500/10 text-orange-700 dark:text-orange-400">
                  <Clock className="size-3" />
                  Return to review
                </Badge>
              )}
            </div>
            <p className="mt-1 truncate text-muted-foreground text-sm">
              {renterName} • {formatDate(reservation.startDate)} – {formatDate(reservation.endDate)}
            </p>
            {reservation.renterMessage && (
              <p className="mt-1 truncate text-muted-foreground text-sm italic">
                "{reservation.renterMessage}"
              </p>
            )}
          </div>
          <div className="hidden text-right sm:block">
            <p className="font-semibold text-primary">{amount}</p>
            <p className="text-muted-foreground text-xs">Rental subtotal</p>
          </div>
        </div>

        {(status === "pending" || status === "approved") && (
          <div className="mt-4 rounded-lg border p-3">
            <RentalQuoteSummary quote={reservation} />
          </div>
        )}

        {needsReview && (
          <p className="mt-4 text-sm">
            Payment received; booking needs review. Contact support to resolve the booking before
            confirming plans with the renter.
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {needsReview && (
            <Button asChild size="sm">
              <Link href="/contact">Contact Support</Link>
            </Button>
          )}
          <p className="mr-auto font-semibold text-primary text-sm sm:hidden">{amount}</p>
          {status === "pending" && (
            <>
              <Button onClick={() => onApprove(reservation._id)} size="sm">
                Approve
              </Button>
              <Button onClick={() => onDecline(reservation._id)} size="sm" variant="outline">
                Decline
              </Button>
            </>
          )}
          {status === "confirmed" && isReturnPending && (
            <Link href={`/host/returns/${reservation._id}`}>
              <Button size="sm">Review return</Button>
            </Link>
          )}
          {status === "completed" && (
            <>
              <Link href={`/host/returns/${reservation._id}`}>
                <Button size="sm" variant="outline">
                  Review return
                </Button>
              </Link>
              <Link href={`/host/damage-claim/${reservation._id}`}>
                <Button size="sm" variant="outline">
                  <AlertTriangle className="mr-2 size-4" />
                  Report damage
                </Button>
              </Link>
            </>
          )}
          {(status === "pending" || status === "approved" || status === "confirmed") && (
            <Link href={`/messages?conversation=${reservation._id}`}>
              <Button size="sm" variant="ghost">
                <MessageSquare className="mr-2 size-4" />
                Message
              </Button>
            </Link>
          )}
          <Link href={`/host/vehicles/${reservation.vehicleId}`}>
            <Button size="sm" variant="ghost">
              View vehicle
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default function HostReservationsPage() {
  const { user } = useUser()
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>("all")

  // Fetch reservations from Convex
  const pendingReservations = useQuery(
    api.reservations.getPendingForOwner,
    user?.id ? { ownerId: user.id } : "skip"
  )
  const confirmedReservations = useQuery(
    api.reservations.getConfirmedForOwner,
    user?.id ? { ownerId: user.id } : "skip"
  )
  const allReservationsData = useQuery(
    api.reservations.getByUser,
    user?.id ? { userId: user.id, role: "owner" as const } : "skip"
  )

  // Fetch pending completions (returns awaiting review)
  const pendingCompletions = useQuery(
    api.rentalCompletions.getPendingCompletions,
    user?.id ? { userId: user.id } : "skip"
  )

  // Create a map of reservation IDs to completion status
  const completionStatusMap = useMemo(() => {
    if (!pendingCompletions) return new Map()
    const map = new Map()
    pendingCompletions.forEach((completion: any) => {
      if (completion.status === "pending_owner") {
        map.set(completion.reservationId, completion)
      }
    })
    return map
  }, [pendingCompletions])

  // Count pending returns
  const pendingReturnsCount = useMemo(() => {
    if (!pendingCompletions) return 0
    return pendingCompletions.filter(
      (c: any) => c.status === "pending_owner" && c.ownerId === user?.id
    ).length
  }, [pendingCompletions, user?.id])

  // Combine all reservations
  const allReservations = useMemo(() => {
    if (!allReservationsData) return []
    return allReservationsData
  }, [allReservationsData])

  // Mutations
  const approveReservation = useMutation(api.reservations.approve)
  const declineReservation = useMutation(api.reservations.decline)

  // Show loading state
  if (
    pendingReservations === undefined ||
    confirmedReservations === undefined ||
    allReservationsData === undefined ||
    pendingCompletions === undefined
  ) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading reservations...</p>
          </div>
        </div>
      </div>
    )
  }

  // Get counts for each status
  const pendingCount = pendingReservations?.length || 0
  const approvedReservations = allReservations.filter((res: any) => res.status === "approved")
  const approvedCount = approvedReservations.length
  const confirmedCount = confirmedReservations?.length || 0
  const completedReservations = allReservations.filter((res: any) => res.status === "completed")
  const completedCount = completedReservations.length

  const filteredReservations =
    selectedStatus === "all"
      ? allReservations
      : allReservations.filter((res: any) => res.status === selectedStatus)

  const handleApprove = async (reservationId: string) => {
    setApprovalError(null)
    try {
      await approveReservation({
        reservationId: reservationId as Id<"reservations">,
      })
    } catch (error) {
      const quoteError = getRentalQuoteError(error)
      if (quoteError) {
        setApprovalError(
          "This booking's quote cannot be verified. Ask the renter to submit a new request for approval; this booking has not been repriced."
        )
        return
      }
      handleErrorWithContext(error, {
        action: "approve reservation",
        customMessages: {
          generic: "Failed to approve reservation. Please try again.",
        },
      })
    }
  }

  const handleDecline = async (reservationId: string) => {
    try {
      await declineReservation({
        reservationId: reservationId as Id<"reservations">,
      })
    } catch (error) {
      handleErrorWithContext(error, {
        action: "decline reservation",
        customMessages: {
          generic: "Failed to decline reservation. Please try again.",
        },
      })
    }
  }

  const renderList = (
    items: any[],
    empty: { icon: typeof Calendar; title: string; subtitle: string }
  ) =>
    items.length === 0 ? (
      <EmptyState icon={empty.icon} subtitle={empty.subtitle} title={empty.title} />
    ) : (
      <div className="space-y-3">
        {items.map((reservation: any) => (
          <ReservationRow
            isReturnPending={completionStatusMap.has(reservation._id)}
            key={reservation._id}
            onApprove={handleApprove}
            onDecline={handleDecline}
            reservation={reservation}
          />
        ))}
      </div>
    )

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-bold text-3xl tracking-tight">Reservations</h1>
        <p className="mt-1.5 text-muted-foreground">
          Manage booking requests and confirmed reservations
        </p>
      </div>

      {approvalError && (
        <div
          className="mb-6 rounded-lg border border-destructive p-4 text-destructive text-sm"
          role="alert"
        >
          {approvalError}
        </div>
      )}

      {pendingReturnsCount > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-orange-900/50 dark:bg-orange-950/20">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 size-5 shrink-0 text-orange-600 dark:text-orange-400" />
            <p className="text-orange-900 text-sm dark:text-orange-100">
              <span className="font-semibold">
                {pendingReturnsCount} return{pendingReturnsCount !== 1 ? "s" : ""} pending review.
              </span>{" "}
              Review the forms submitted by your renters.
            </p>
          </div>
          <Button
            className="shrink-0"
            onClick={() => setSelectedStatus("pending_returns")}
            size="sm"
            variant="outline"
          >
            View returns
          </Button>
        </div>
      )}

      <Tabs className="w-full" defaultValue="all">
        <div className="mb-6 overflow-x-auto">
          <TabsList>
            <TabsTrigger onClick={() => setSelectedStatus("all")} value="all">
              All ({allReservations.length})
            </TabsTrigger>
            <TabsTrigger onClick={() => setSelectedStatus("pending")} value="pending">
              Pending ({pendingCount})
            </TabsTrigger>
            {approvedCount > 0 && (
              <TabsTrigger onClick={() => setSelectedStatus("approved")} value="approved">
                Approved ({approvedCount})
              </TabsTrigger>
            )}
            <TabsTrigger onClick={() => setSelectedStatus("confirmed")} value="confirmed">
              Confirmed ({confirmedCount})
            </TabsTrigger>
            <TabsTrigger onClick={() => setSelectedStatus("completed")} value="completed">
              Completed ({completedCount})
            </TabsTrigger>
            {pendingReturnsCount > 0 && (
              <TabsTrigger
                onClick={() => setSelectedStatus("pending_returns")}
                value="pending_returns"
              >
                Returns ({pendingReturnsCount})
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="all">
          {renderList(filteredReservations, {
            icon: Calendar,
            title: "No reservations found",
            subtitle: "Reservations will appear here when renters book your vehicles",
          })}
        </TabsContent>

        <TabsContent value="pending">
          {renderList(pendingReservations, {
            icon: Clock,
            title: "No pending reservations",
            subtitle: "You're all caught up!",
          })}
        </TabsContent>

        <TabsContent value="approved">
          {renderList(approvedReservations, {
            icon: CreditCard,
            title: "No approved reservations",
            subtitle: "Approved reservations awaiting renter payment will appear here",
          })}
        </TabsContent>

        <TabsContent value="confirmed">
          {renderList(confirmedReservations, {
            icon: CheckCircle2,
            title: "No confirmed reservations",
            subtitle: "Upcoming bookings will appear here",
          })}
        </TabsContent>

        <TabsContent value="completed">
          {renderList(completedReservations, {
            icon: CheckCircle2,
            title: "No completed reservations",
            subtitle: "Completed bookings will appear here",
          })}
        </TabsContent>

        <TabsContent value="pending_returns">
          {pendingReturnsCount === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              subtitle="All returns have been reviewed"
              title="No pending returns"
            />
          ) : (
            <div className="space-y-3">
              {pendingCompletions
                ?.filter((c: any) => c.status === "pending_owner" && c.ownerId === user?.id)
                .map((completion: any) => {
                  const reservation = completion.reservation
                  if (!reservation) return null

                  const name =
                    `${completion.vehicle?.year ?? ""} ${completion.vehicle?.make ?? ""} ${completion.vehicle?.model ?? ""}`.trim()
                  const imageKey =
                    completion.vehicle?.images?.find((img: any) => img.isPrimary)?.r2Key ||
                    completion.vehicle?.images?.[0]?.r2Key

                  return (
                    <Card key={completion._id}>
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <VehicleThumb alt={name} imageKey={imageKey} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="truncate font-semibold">{name}</h2>
                              <Badge className="gap-1.5 bg-orange-500/10 text-orange-700 dark:text-orange-400">
                                <Clock className="size-3" />
                                Return to review
                              </Badge>
                            </div>
                            <p className="mt-1 truncate text-muted-foreground text-sm">
                              {completion.renter?.name || "Unknown renter"} •{" "}
                              {formatDate(reservation.startDate)} –{" "}
                              {formatDate(reservation.endDate)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Link href={`/host/returns/${reservation._id}`}>
                            <Button size="sm">Review return</Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
