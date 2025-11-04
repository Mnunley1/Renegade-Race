"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import {
  AlertCircle,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  Plus,
  TrendingUp,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { api } from "@/lib/convex"

export default function HostDashboardPage() {
  const { user } = useUser()
  console.log("user", user)

  // Fetch data from Convex
  const vehicles = useQuery(api.vehicles.getByOwner, user?.id ? { ownerId: user.id } : "skip")
  const pendingReservations = useQuery(
    api.reservations.getPendingForOwner,
    user?.id ? { ownerId: user.id } : "skip"
  )
  const confirmedReservations = useQuery(
    api.reservations.getConfirmedForOwner,
    user?.id ? { ownerId: user.id } : "skip"
  )
  const reviewStats = useQuery(api.reviews.getUserStats, user?.id ? { userId: user.id } : "skip")

  // Calculate stats from real data
  const stats = useMemo(() => {
    const totalVehicles = vehicles?.length || 0
    const pendingBookings = pendingReservations?.length || 0
    const upcomingBookings = confirmedReservations?.length || 0

    // Calculate total earnings from confirmed reservations
    const totalEarnings =
      confirmedReservations?.reduce((sum, res) => sum + (res.totalAmount || 0), 0) || 0

    // Get average rating from review stats
    const averageRating = reviewStats?.averageRating || 0

    return {
      totalVehicles,
      pendingBookings,
      upcomingBookings,
      totalEarnings,
      averageRating,
    }
  }, [vehicles, pendingReservations, confirmedReservations, reviewStats])

  // Map recent vehicles from real data
  const recentVehicles = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return []

    return vehicles.slice(0, 3).map((vehicle) => {
      const primaryImage = vehicle.images?.find((img) => img.isPrimary) || vehicle.images?.[0]

      // Calculate bookings and earnings from reservations
      const vehicleReservations = [
        ...(pendingReservations || []),
        ...(confirmedReservations || []),
      ].filter((res) => res.vehicleId === vehicle._id)

      const bookings = vehicleReservations.length
      const earnings = vehicleReservations.reduce((sum, res) => sum + (res.totalAmount || 0), 0)

      const status = vehicle.isApproved ? "active" : vehicle.isActive ? "pending" : "inactive"

      return {
        id: vehicle._id,
        name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        status,
        bookings,
        earnings: Math.round(earnings / 100), // Convert cents to dollars
        image:
          primaryImage?.cardUrl ||
          primaryImage?.imageUrl ||
          "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400",
      }
    })
  }, [vehicles, pendingReservations, confirmedReservations])

  const recentActivity = [
    {
      id: "1",
      type: "booking_request",
      title: "New booking request",
      description: "John Smith wants to rent your Porsche 911 GT3",
      time: "2 hours ago",
      status: "pending",
    },
    {
      id: "2",
      type: "booking_confirmed",
      title: "Booking confirmed",
      description: "Sarah Johnson confirmed booking for Ferrari F8 Tributo",
      time: "5 hours ago",
      status: "confirmed",
    },
    {
      id: "3",
      type: "vehicle_approved",
      title: "Vehicle approved",
      description: "Your Lamborghini Huracán has been approved and is now live",
      time: "1 day ago",
      status: "approved",
    },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400">
            <CheckCircle2 className="size-3" />
            Active
          </Badge>
        )
      case "pending":
        return (
          <Badge className="gap-1.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
            <Clock className="size-3" />
            Pending
          </Badge>
        )
      case "inactive":
        return (
          <Badge className="gap-1.5 bg-gray-500/10 text-gray-700 dark:text-gray-400">
            <XCircle className="size-3" />
            Inactive
          </Badge>
        )
      default:
        return null
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "booking_request":
        return <AlertCircle className="size-4 text-blue-500" />
      case "booking_confirmed":
        return <CheckCircle2 className="size-4 text-green-500" />
      case "vehicle_approved":
        return <CheckCircle2 className="size-4 text-green-500" />
      default:
        return <Clock className="size-4 text-gray-500" />
    }
  }

  // Show loading state while data is being fetched
  const isLoading =
    vehicles === undefined ||
    pendingReservations === undefined ||
    confirmedReservations === undefined ||
    reviewStats === undefined

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-3xl">Host Dashboard</h1>
            <p className="mt-2 text-muted-foreground">
              Manage your vehicles, bookings, and earnings all in one place
            </p>
          </div>
          <Link href="/host/vehicles/new">
            <Button size="lg">
              <Plus className="mr-2 size-4" />
              List Your Vehicle
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">
              Total Vehicles
            </CardTitle>
            <Car className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.totalVehicles}</div>
            <p className="text-muted-foreground text-xs">
              {stats.totalVehicles === 1 ? "vehicle listed" : "vehicles listed"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">
              Pending Bookings
            </CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.pendingBookings}</div>
            <p className="text-muted-foreground text-xs">Awaiting your response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">
              Upcoming Bookings
            </CardTitle>
            <Calendar className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.upcomingBookings}</div>
            <p className="text-muted-foreground text-xs">Confirmed reservations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">
              Total Earnings
            </CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              ${Math.round(stats.totalEarnings / 100).toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">All-time earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">
              Average Rating
            </CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.averageRating}</div>
            <p className="text-muted-foreground text-xs">From renters</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Recent Vehicles */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Your Vehicles</CardTitle>
              <Link href="/host/vehicles/list">
                <Button size="sm" variant="outline">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentVehicles.length === 0 ? (
                <div className="py-12 text-center">
                  <Car className="mx-auto mb-4 size-12 text-muted-foreground" />
                  <p className="mb-2 font-semibold text-lg">No vehicles yet</p>
                  <p className="mb-6 text-muted-foreground">
                    List your first vehicle to start earning
                  </p>
                  <Link href="/host/vehicles/new">
                    <Button>
                      <Plus className="mr-2 size-4" />
                      List Your Vehicle
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentVehicles.map((vehicle) => (
                    <div
                      className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                      key={vehicle.id}
                    >
                      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg">
                        <img
                          alt={vehicle.name}
                          className="size-full object-cover"
                          src={vehicle.image}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="mb-2 flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">
                              {vehicle.year} {vehicle.make} {vehicle.model}
                            </h3>
                            <p className="text-muted-foreground text-sm">{vehicle.name}</p>
                          </div>
                          {getStatusBadge(vehicle.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">{vehicle.bookings} bookings</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="font-semibold">
                            ${vehicle.earnings.toLocaleString()} earned
                          </span>
                        </div>
                      </div>
                      <Link href={`/host/vehicles/${vehicle.id}`}>
                        <Button size="sm" variant="outline">
                          Manage
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div>
          {/* Quick Actions */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link className="block" href="/host/reservations">
                <Button className="w-full justify-start" size="sm" variant="outline">
                  <Calendar className="mr-2 size-4" />
                  View All Reservations
                </Button>
              </Link>
              <Link className="block" href="/host/vehicles/list">
                <Button className="w-full justify-start" size="sm" variant="outline">
                  <Car className="mr-2 size-4" />
                  Manage Vehicles
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="py-8 text-center">
                  <Clock className="mx-auto mb-4 size-8 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div className="flex gap-3" key={activity.id}>
                      <div className="mt-0.5 shrink-0">{getActivityIcon(activity.type)}</div>
                      <div className="flex-1 space-y-1">
                        <p className="font-medium text-sm">{activity.title}</p>
                        <p className="text-muted-foreground text-xs">{activity.description}</p>
                        <p className="text-muted-foreground text-xs">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
