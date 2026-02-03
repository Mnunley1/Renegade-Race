"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { useMutation, useQuery } from "convex/react"
import {
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  MessageSquare,
  User,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

export default function HostReservationsPage() {
  const { user } = useUser()
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
  const confirmedCount = confirmedReservations?.length || 0
  const completedReservations = allReservations.filter((res: any) => res.status === "completed")
  const completedCount = completedReservations.length
  const cancelledCount = allReservations.filter((res: any) => res.status === "cancelled").length

  const filteredReservations =
    selectedStatus === "all"
      ? allReservations
      : allReservations.filter((res: any) => res.status === selectedStatus)

  const getStatusBadge = (status: string) => {
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds} seconds ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} minutes ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hours ago`
    const days = Math.floor(hours / 24)
    return `${days} days ago`
  }

  const handleApprove = async (reservationId: string) => {
    try {
      await approveReservation({
        reservationId: reservationId as any,
      })
    } catch (error) {
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
        reservationId: reservationId as any,
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

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 font-bold text-3xl">Reservations</h1>
        <p className="text-muted-foreground">Manage booking requests and confirmed reservations</p>
      </div>

      {pendingReturnsCount > 0 && (
        <Card className="mb-6 border-orange-500/50 bg-orange-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="size-5 text-orange-600 dark:text-orange-400" />
                <div>
                  <p className="font-semibold text-orange-700 dark:text-orange-400">
                    {pendingReturnsCount} Return{pendingReturnsCount !== 1 ? "s" : ""} Pending
                    Review
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Review the return forms submitted by renters
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setSelectedStatus("pending_returns")}
                size="sm"
                variant="outline"
              >
                View Pending Returns
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs className="w-full" defaultValue="all">
        <div className="mb-6 flex items-center justify-between">
          <TabsList>
            <TabsTrigger onClick={() => setSelectedStatus("all")} value="all">
              All ({allReservations.length})
            </TabsTrigger>
            <TabsTrigger onClick={() => setSelectedStatus("pending")} value="pending">
              Pending ({pendingCount})
            </TabsTrigger>
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
                Pending Returns ({pendingReturnsCount})
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="all">
          {filteredReservations.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="mb-2 font-semibold text-lg">No reservations found</p>
                <p className="text-muted-foreground">
                  Reservations will appear here when renters book your vehicles
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredReservations.map((reservation: any) => {
                const vehicleImage =
                  reservation.vehicle?.images?.[0]?.cardUrl ||
                  reservation.vehicle?.images?.[0]?.cardUrl ||
                  "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400"

                return (
                  <Card key={reservation._id}>
                    <div className="flex flex-col md:flex-row">
                      {/* Vehicle Image */}
                      <div className="relative h-48 w-full shrink-0 overflow-hidden md:h-auto md:w-64">
                        <img
                          alt={`${reservation.vehicle?.year} ${reservation.vehicle?.make} ${reservation.vehicle?.model}`}
                          className="size-full object-cover"
                          src={vehicleImage}
                        />
                      </div>

                      {/* Reservation Details */}
                      <div className="flex flex-1 flex-col p-6">
                        <div className="mb-4 flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-2 flex items-center gap-3">
                              <h2 className="font-bold text-xl">
                                {reservation.vehicle?.year} {reservation.vehicle?.make}{" "}
                                {reservation.vehicle?.model}
                              </h2>
                              {getStatusBadge(reservation.status)}
                              {completionStatusMap.has(reservation._id) && (
                                <Badge className="gap-1.5 bg-orange-500/10 text-orange-700 dark:text-orange-400">
                                  <Clock className="size-3" />
                                  Return Pending Review
                                </Badge>
                              )}
                            </div>
                            <div className="mb-3 flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <User className="size-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {reservation.renter?.name || "Unknown Renter"}
                                </span>
                              </div>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground text-sm">
                                {reservation.renter.email}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mb-4 grid gap-4 md:grid-cols-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="size-4 text-muted-foreground" />
                            <div>
                              <p className="text-muted-foreground text-xs">Dates</p>
                              <p className="font-medium">
                                {formatDate(reservation.startDate)} -{" "}
                                {formatDate(reservation.endDate)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Car className="size-4 text-muted-foreground" />
                            <div>
                              <p className="text-muted-foreground text-xs">Duration</p>
                              <p className="font-medium">{reservation.totalDays} days</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="size-4 text-muted-foreground" />
                            <div>
                              <p className="text-muted-foreground text-xs">Total Amount</p>
                              <p className="font-bold text-primary">
                                ${reservation.totalAmount.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>

                        {reservation.renterMessage && (
                          <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                            <div className="mb-1 flex items-center gap-2">
                              <MessageSquare className="size-4 text-muted-foreground" />
                              <p className="font-medium text-sm">Renter Message</p>
                            </div>
                            <p className="text-muted-foreground text-sm">
                              "{reservation.renterMessage}"
                            </p>
                          </div>
                        )}

                        <div className="mt-auto flex items-center justify-between">
                          <p className="text-muted-foreground text-xs">
                            Requested {formatTimeAgo(reservation.createdAt)}
                          </p>
                          <div className="flex gap-2">
                            {reservation.status === "pending" && (
                              <>
                                <Button onClick={() => handleApprove(reservation._id)} size="sm">
                                  Approve
                                </Button>
                                <Button
                                  onClick={() => handleDecline(reservation._id)}
                                  size="sm"
                                  variant="outline"
                                >
                                  Decline
                                </Button>
                              </>
                            )}
                            {reservation.status === "confirmed" &&
                              completionStatusMap.has(reservation._id) && (
                                <Link href={`/host/returns/${reservation._id}`}>
                                  <Button size="sm" variant="default">
                                    Review Return
                                  </Button>
                                </Link>
                              )}
                            {reservation.status === "confirmed" && (
                              <Link href={`/messages?conversation=${reservation._id}`}>
                                <Button size="sm" variant="outline">
                                  <MessageSquare className="mr-2 size-4" />
                                  Message
                                </Button>
                              </Link>
                            )}
                            <Link href={`/host/vehicles/${reservation.vehicleId}`}>
                              <Button size="sm" variant="outline">
                                View Vehicle
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending">
          {pendingReservations.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Clock className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="mb-2 font-semibold text-lg">No pending reservations</p>
                <p className="text-muted-foreground">You're all caught up!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingReservations.map((reservation: any) => {
                const vehicleImage =
                  reservation.vehicle?.images?.[0]?.cardUrl ||
                  reservation.vehicle?.images?.[0]?.cardUrl ||
                  "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400"

                return (
                  <Card key={reservation._id}>
                    <div className="flex flex-col md:flex-row">
                      <div className="relative h-48 w-full shrink-0 overflow-hidden md:h-auto md:w-64">
                        <img
                          alt={`${reservation.vehicle?.year} ${reservation.vehicle?.make} ${reservation.vehicle?.model}`}
                          className="size-full object-cover"
                          src={vehicleImage}
                        />
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <div className="mb-4 flex items-start justify-between">
                          <div className="flex-1">
                            <h2 className="mb-2 font-bold text-xl">
                              {reservation.vehicle?.year} {reservation.vehicle?.make}{" "}
                              {reservation.vehicle?.model}
                            </h2>
                            <div className="mb-3 flex items-center gap-3">
                              <span className="font-medium">
                                {reservation.renter?.name || "Unknown Renter"}
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground text-sm">
                                {formatDate(reservation.startDate)} -{" "}
                                {formatDate(reservation.endDate)}
                              </span>
                            </div>
                          </div>
                          {getStatusBadge(reservation.status)}
                        </div>
                        {reservation.renterMessage && (
                          <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                            <p className="text-muted-foreground text-sm">
                              "{reservation.renterMessage}"
                            </p>
                          </div>
                        )}
                        <div className="mt-auto flex items-center justify-between">
                          <p className="font-bold text-primary">
                            ${Math.round((reservation.totalAmount || 0) / 100).toLocaleString()}
                          </p>
                          <div className="flex gap-2">
                            <Button onClick={() => handleApprove(reservation._id)} size="sm">
                              Approve
                            </Button>
                            <Button
                              onClick={() => handleDecline(reservation._id)}
                              size="sm"
                              variant="outline"
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="confirmed">
          {confirmedReservations.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="mb-2 font-semibold text-lg">No confirmed reservations</p>
                <p className="text-muted-foreground">Upcoming bookings will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {confirmedReservations.map((reservation: any) => {
                const vehicleImage =
                  reservation.vehicle.images?.[0]?.cardUrl ||
                  "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400"

                return (
                  <Card key={reservation._id}>
                    <div className="flex flex-col md:flex-row">
                      <div className="relative h-48 w-full shrink-0 overflow-hidden md:h-auto md:w-64">
                        <img
                          alt={`${reservation.vehicle?.year} ${reservation.vehicle?.make} ${reservation.vehicle?.model}`}
                          className="size-full object-cover"
                          src={vehicleImage}
                        />
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <div className="mb-4 flex items-start justify-between">
                          <div className="flex-1">
                            <h2 className="mb-2 font-bold text-xl">
                              {reservation.vehicle.year} {reservation.vehicle.make}{" "}
                              {reservation.vehicle.model}
                            </h2>
                            <div className="mb-3 flex items-center gap-3">
                              <span className="font-medium">{reservation.renter.name}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground text-sm">
                                {formatDate(reservation.startDate)} -{" "}
                                {formatDate(reservation.endDate)}
                              </span>
                            </div>
                          </div>
                          {getStatusBadge(reservation.status)}
                        </div>
                        <div className="mt-auto flex items-center justify-between">
                          <p className="font-bold text-primary">
                            ${Math.round((reservation.totalAmount || 0) / 100).toLocaleString()}
                          </p>
                          <div className="flex gap-2">
                            {reservation.status === "confirmed" &&
                              completionStatusMap.has(reservation._id) && (
                                <Link href={`/host/returns/${reservation._id}`}>
                                  <Button size="sm" variant="default">
                                    Review Return
                                  </Button>
                                </Link>
                              )}
                            <Link href={`/messages?conversation=${reservation._id}`}>
                              <Button size="sm" variant="outline">
                                <MessageSquare className="mr-2 size-4" />
                                Message Renter
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completedReservations.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="mb-2 font-semibold text-lg">No completed reservations</p>
                <p className="text-muted-foreground">Completed bookings will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {completedReservations.map((reservation: any) => {
                const vehicleImage =
                  reservation.vehicle?.images?.[0]?.cardUrl ||
                  "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400"

                return (
                  <Card key={reservation._id}>
                    <div className="flex flex-col md:flex-row">
                      <div className="relative h-48 w-full shrink-0 overflow-hidden md:h-auto md:w-64">
                        <img
                          alt={`${reservation.vehicle?.year} ${reservation.vehicle?.make} ${reservation.vehicle?.model}`}
                          className="size-full object-cover"
                          src={vehicleImage}
                        />
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <div className="mb-4 flex items-start justify-between">
                          <div className="flex-1">
                            <h2 className="mb-2 font-bold text-xl">
                              {reservation.vehicle?.year} {reservation.vehicle?.make}{" "}
                              {reservation.vehicle?.model}
                            </h2>
                            <div className="mb-3 flex items-center gap-3">
                              <span className="font-medium">
                                {reservation.renter?.name || "Unknown Renter"}
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground text-sm">
                                {formatDate(reservation.startDate)} -{" "}
                                {formatDate(reservation.endDate)}
                              </span>
                            </div>
                          </div>
                          {getStatusBadge(reservation.status)}
                        </div>
                        <div className="mt-auto flex items-center justify-between">
                          <p className="font-bold text-primary">
                            ${Math.round((reservation.totalAmount || 0) / 100).toLocaleString()}
                          </p>
                          <div className="flex gap-2">
                            {reservation.status === "completed" && (
                              <Link href={`/host/returns/${reservation._id}`}>
                                <Button size="sm" variant="outline">
                                  Review Return
                                </Button>
                              </Link>
                            )}
                            <Button size="sm" variant="outline">
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending_returns">
          {pendingReturnsCount === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="mb-2 font-semibold text-lg">No Pending Returns</p>
                <p className="text-muted-foreground">All returns have been reviewed</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingCompletions
                ?.filter((c: any) => c.status === "pending_owner" && c.ownerId === user?.id)
                .map((completion: any) => {
                  const reservation = completion.reservation
                  if (!reservation) return null

                  const vehicleImage =
                    completion.vehicle?.images?.[0]?.cardUrl ||
                    completion.vehicle?.images?.[0]?.cardUrl ||
                    "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400"

                  return (
                    <Card className="border-orange-500/50" key={completion._id}>
                      <div className="flex flex-col md:flex-row">
                        <div className="relative h-48 w-full shrink-0 overflow-hidden md:h-auto md:w-64">
                          <img
                            alt={`${completion.vehicle?.year} ${completion.vehicle?.make} ${completion.vehicle?.model}`}
                            className="size-full object-cover"
                            src={vehicleImage}
                          />
                        </div>
                        <div className="flex flex-1 flex-col p-6">
                          <div className="mb-4 flex items-start justify-between">
                            <div className="flex-1">
                              <div className="mb-2 flex items-center gap-3">
                                <h2 className="font-bold text-xl">
                                  {completion.vehicle?.year} {completion.vehicle?.make}{" "}
                                  {completion.vehicle?.model}
                                </h2>
                                <Badge className="gap-1.5 bg-orange-500/10 text-orange-700 dark:text-orange-400">
                                  <Clock className="size-3" />
                                  Return Pending Review
                                </Badge>
                              </div>
                              <div className="mb-3 flex items-center gap-3">
                                <span className="font-medium">
                                  {completion.renter?.name || "Unknown Renter"}
                                </span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground text-sm">
                                  {formatDate(reservation.startDate)} -{" "}
                                  {formatDate(reservation.endDate)}
                                </span>
                              </div>
                              {completion.renterReturnForm && (
                                <div className="mb-3 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
                                  <p className="mb-1 font-semibold text-orange-700 text-sm dark:text-orange-400">
                                    Return Form Submitted
                                  </p>
                                  <p className="text-muted-foreground text-xs">
                                    Submitted{" "}
                                    {formatTimeAgo(completion.renterReturnForm.submittedAt)}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-auto flex items-center justify-between">
                            <p className="text-muted-foreground text-xs">
                              Action Required: Review the return form
                            </p>
                            <Link href={`/host/returns/${reservation._id}`}>
                              <Button size="sm" variant="default">
                                Review Return
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
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
