"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import {
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare,
  User,
  Car,
  Filter,
} from "lucide-react"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { useState } from "react"

export default function HostReservationsPage() {
  const { user } = useUser()
  const [selectedStatus, setSelectedStatus] = useState<string>("all")

  // TODO: Replace with Convex queries
  // const pendingReservations = useQuery(api.reservations.getPendingForOwner, { ownerId: user?.id || "" })
  // const confirmedReservations = useQuery(api.reservations.getConfirmedForOwner, { ownerId: user?.id || "" })
  // const allReservations = useQuery(api.reservations.getByUser, { userId: user?.id || "", role: "owner" })

  // Mock data - will be replaced with Convex queries
  const pendingReservations = [
    {
      _id: "res1",
      vehicleId: "vehicle1",
      vehicle: {
        make: "Porsche",
        model: "911 GT3",
        year: 2023,
        images: [{ cardUrl: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400" }],
      },
      renter: {
        name: "John Smith",
        email: "john@example.com",
        profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
      },
      startDate: "2024-03-22",
      endDate: "2024-03-24",
      totalDays: 3,
      totalAmount: 2697,
      dailyRate: 899,
      status: "pending",
      renterMessage: "Looking forward to the track day! Would love to book this for the weekend.",
      createdAt: Date.now() - 2 * 60 * 60 * 1000,
    },
    {
      _id: "res2",
      vehicleId: "vehicle2",
      vehicle: {
        make: "Ferrari",
        model: "F8 Tributo",
        year: 2022,
        images: [{ cardUrl: "https://images.unsplash.com/photo-1549952891-fcf406dd2aa9?w=400" }],
      },
      renter: {
        name: "Sarah Johnson",
        email: "sarah@example.com",
        profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
      },
      startDate: "2024-04-01",
      endDate: "2024-04-03",
      totalDays: 3,
      totalAmount: 3597,
      dailyRate: 1199,
      status: "pending",
      renterMessage: "First time renting. Would appreciate any tips!",
      createdAt: Date.now() - 5 * 60 * 60 * 1000,
    },
  ]

  const confirmedReservations = [
    {
      _id: "res3",
      vehicleId: "vehicle1",
      vehicle: {
        make: "Porsche",
        model: "911 GT3",
        year: 2023,
        images: [{ cardUrl: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400" }],
      },
      renter: {
        name: "Mike Davis",
        email: "mike@example.com",
        profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
      },
      startDate: "2024-03-15",
      endDate: "2024-03-17",
      totalDays: 3,
      totalAmount: 2697,
      dailyRate: 899,
      status: "confirmed",
      renterMessage: "Can't wait to drive this on the track!",
      createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    },
  ]

  const completedReservations = [
    {
      _id: "res4",
      vehicleId: "vehicle1",
      vehicle: {
        make: "Porsche",
        model: "911 GT3",
        year: 2023,
        images: [{ cardUrl: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400" }],
      },
      renter: {
        name: "David Chen",
        email: "david@example.com",
        profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
      },
      startDate: "2024-02-10",
      endDate: "2024-02-12",
      totalDays: 3,
      totalAmount: 2697,
      dailyRate: 899,
      status: "completed",
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    },
  ]

  const allReservations = [
    ...pendingReservations,
    ...confirmedReservations,
    ...completedReservations,
  ]

  const filteredReservations =
    selectedStatus === "all"
      ? allReservations
      : allReservations.filter((res) => res.status === selectedStatus)

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
    // TODO: Replace with Convex mutation
    // await api.reservations.approve({ reservationId })
    console.log("Approve reservation:", reservationId)
  }

  const handleDecline = async (reservationId: string) => {
    // TODO: Replace with Convex mutation
    // await api.reservations.decline({ reservationId })
    console.log("Decline reservation:", reservationId)
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 font-bold text-3xl">Reservations</h1>
        <p className="text-muted-foreground">Manage booking requests and confirmed reservations</p>
      </div>

      <Tabs className="w-full" defaultValue="all">
        <div className="mb-6 flex items-center justify-between">
          <TabsList>
            <TabsTrigger onClick={() => setSelectedStatus("all")} value="all">
              All ({allReservations.length})
            </TabsTrigger>
            <TabsTrigger onClick={() => setSelectedStatus("pending")} value="pending">
              Pending ({pendingReservations.length})
            </TabsTrigger>
            <TabsTrigger onClick={() => setSelectedStatus("confirmed")} value="confirmed">
              Confirmed ({confirmedReservations.length})
            </TabsTrigger>
            <TabsTrigger onClick={() => setSelectedStatus("completed")} value="completed">
              Completed ({completedReservations.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all">
          {filteredReservations.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="mb-2 font-semibold text-lg">No reservations found</p>
                <p className="text-muted-foreground">Reservations will appear here when renters book your vehicles</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredReservations.map((reservation) => {
                const vehicleImage =
                  reservation.vehicle.images?.[0]?.cardUrl ||
                  "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400"

                return (
                  <Card key={reservation._id}>
                    <div className="flex flex-col md:flex-row">
                      {/* Vehicle Image */}
                      <div className="relative h-48 w-full md:h-auto md:w-64 shrink-0 overflow-hidden">
                        <img
                          alt={`${reservation.vehicle.year} ${reservation.vehicle.make} ${reservation.vehicle.model}`}
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
                                {reservation.vehicle.year} {reservation.vehicle.make}{" "}
                                {reservation.vehicle.model}
                              </h2>
                              {getStatusBadge(reservation.status)}
                            </div>
                            <div className="mb-3 flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <User className="size-4 text-muted-foreground" />
                                <span className="font-medium">{reservation.renter.name}</span>
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
                                {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
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
              {pendingReservations.map((reservation) => {
                const vehicleImage =
                  reservation.vehicle.images?.[0]?.cardUrl ||
                  "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400"

                return (
                  <Card key={reservation._id}>
                    <div className="flex flex-col md:flex-row">
                      <div className="relative h-48 w-full md:h-auto md:w-64 shrink-0 overflow-hidden">
                        <img
                          alt={`${reservation.vehicle.year} ${reservation.vehicle.make} ${reservation.vehicle.model}`}
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
                                {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
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
                            ${reservation.totalAmount.toLocaleString()}
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
              {confirmedReservations.map((reservation) => {
                const vehicleImage =
                  reservation.vehicle.images?.[0]?.cardUrl ||
                  "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400"

                return (
                  <Card key={reservation._id}>
                    <div className="flex flex-col md:flex-row">
                      <div className="relative h-48 w-full md:h-auto md:w-64 shrink-0 overflow-hidden">
                        <img
                          alt={`${reservation.vehicle.year} ${reservation.vehicle.make} ${reservation.vehicle.model}`}
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
                                {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
                              </span>
                            </div>
                          </div>
                          {getStatusBadge(reservation.status)}
                        </div>
                        <div className="mt-auto flex items-center justify-between">
                          <p className="font-bold text-primary">
                            ${reservation.totalAmount.toLocaleString()}
                          </p>
                          <Link href={`/messages?conversation=${reservation._id}`}>
                            <Button size="sm" variant="outline">
                              <MessageSquare className="mr-2 size-4" />
                              Message Renter
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
              {completedReservations.map((reservation) => {
                const vehicleImage =
                  reservation.vehicle.images?.[0]?.cardUrl ||
                  "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400"

                return (
                  <Card key={reservation._id}>
                    <div className="flex flex-col md:flex-row">
                      <div className="relative h-48 w-full md:h-auto md:w-64 shrink-0 overflow-hidden">
                        <img
                          alt={`${reservation.vehicle.year} ${reservation.vehicle.make} ${reservation.vehicle.model}`}
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
                                {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
                              </span>
                            </div>
                          </div>
                          {getStatusBadge(reservation.status)}
                        </div>
                        <div className="mt-auto flex items-center justify-between">
                          <p className="font-bold text-primary">
                            ${reservation.totalAmount.toLocaleString()}
                          </p>
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
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
