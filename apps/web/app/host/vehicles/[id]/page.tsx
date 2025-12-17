"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Car,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit,
  Eye,
  Gauge,
  Heart,
  Loader2,
  MapPin,
  Settings,
  Share2,
  Users,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { api } from "@/lib/convex"

export default function HostVehicleDetailPage() {
  const params = useParams()
  const { user } = useUser()
  const vehicleId = params.id as string

  // Fetch vehicle from Convex
  const vehicle = useQuery(api.vehicles.getById, vehicleId ? { id: vehicleId as any } : "skip")

  // Fetch reservations for this vehicle (as owner)
  const allReservations = useQuery(
    api.reservations.getByUser,
    user?.id ? { userId: user.id, role: "owner" as const } : "skip"
  )

  // Fetch analytics for this vehicle
  const analytics = useQuery(
    api.vehicleAnalytics.getVehicleAnalytics,
    vehicleId && user?.id ? { vehicleId: vehicleId as any } : "skip"
  )

  // Filter reservations for this vehicle
  const vehicleReservations = useMemo(() => {
    if (!(allReservations && vehicle)) return []
    return allReservations.filter((res) => res.vehicleId === vehicle._id)
  }, [allReservations, vehicle])

  // Calculate stats from reservations
  const stats = useMemo(() => {
    if (!(vehicleReservations && vehicle)) {
      return {
        totalBookings: 0,
        totalEarnings: 0,
        averageRating: 0,
        completedTrips: 0,
      }
    }

    const totalBookings = vehicleReservations.length
    const totalEarnings = vehicleReservations.reduce((sum, res) => sum + (res.totalAmount || 0), 0)
    const completedTrips = vehicleReservations.filter((res) => res.status === "completed").length

    // TODO: Calculate average rating from reviews if needed
    const averageRating = 0

    return {
      totalBookings,
      totalEarnings,
      averageRating,
      completedTrips,
    }
  }, [vehicleReservations, vehicle])

  // Show loading state
  if (vehicle === undefined || allReservations === undefined) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading vehicle details...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error if vehicle not found
  if (!vehicle) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <XCircle className="mx-auto mb-4 size-12 text-destructive" />
            <h2 className="mb-2 font-bold text-2xl">Vehicle Not Found</h2>
            <p className="mb-6 text-muted-foreground">
              The vehicle you're looking for doesn't exist or has been removed.
            </p>
            <Link href="/host/vehicles/list">
              <Button>Back to Vehicles</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const primaryImage =
    vehicle.images?.find((img) => img.isPrimary)?.heroUrl ||
    vehicle.images?.find((img) => img.isPrimary)?.detailUrl ||
    vehicle.images?.[0]?.heroUrl ||
    vehicle.images?.[0]?.detailUrl ||
    vehicle.images?.[0]?.cardUrl ||
    "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=1200"

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <Link href="/host/vehicles/list">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="mr-2 size-4" />
            Back to Vehicles
          </Button>
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="font-bold text-3xl">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h1>
            {vehicle.isActive && vehicle.isApproved ? (
              <Badge className="gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400">
                <CheckCircle2 className="size-3" />
                Active
              </Badge>
            ) : vehicle.isApproved === false ? (
              <Badge className="gap-1.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                <Clock className="size-3" />
                Pending Approval
              </Badge>
            ) : (
              <Badge className="gap-1.5 bg-gray-500/10 text-gray-700 dark:text-gray-400">
                <XCircle className="size-3" />
                Inactive
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{vehicle.track?.name || "Track TBD"}</p>
        </div>
        <Link href={`/host/vehicles/${vehicleId}/edit`}>
          <Button>
            <Edit className="mr-2 size-4" />
            Edit Vehicle
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Vehicle Image */}
          <Card className="overflow-hidden">
            <div className="relative h-96 w-full">
              <img
                alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                className="size-full object-cover"
                src={
                  primaryImage || "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=1200"
                }
              />
            </div>
          </Card>

          {/* Vehicle Details */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="mb-2 font-semibold text-lg">Description</h3>
                <p className="text-muted-foreground leading-relaxed">{vehicle.description}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Gauge className="mt-0.5 size-5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-sm">Horsepower</p>
                    <p className="font-semibold">{vehicle.horsepower} hp</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Car className="mt-0.5 size-5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-sm">Transmission</p>
                    <p className="font-semibold">{vehicle.transmission}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Settings className="mt-0.5 size-5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-sm">Drivetrain</p>
                    <p className="font-semibold">{vehicle.drivetrain}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Car className="mt-0.5 size-5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-sm">Engine Type</p>
                    <p className="font-semibold">{vehicle.engineType}</p>
                  </div>
                </div>
              </div>

              {vehicle.mileage && (
                <div>
                  <p className="text-muted-foreground text-sm">Mileage</p>
                  <p className="font-semibold">{vehicle.mileage.toLocaleString()} miles</p>
                </div>
              )}

              <div>
                <h3 className="mb-3 font-semibold text-lg">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {vehicle.amenities.map((amenity) => (
                    <Badge key={amenity} variant="secondary">
                      {amenity}
                    </Badge>
                  ))}
                </div>
              </div>

              {vehicle.addOns.length > 0 && (
                <div>
                  <h3 className="mb-3 font-semibold text-lg">Add-ons</h3>
                  <div className="space-y-2">
                    {vehicle.addOns.map((addOn, index) => (
                      <div
                        className="flex items-center justify-between rounded-lg border p-3"
                        key={index}
                      >
                        <div>
                          <p className="font-medium">{addOn.name}</p>
                          {addOn.description && (
                            <p className="text-muted-foreground text-sm">{addOn.description}</p>
                          )}
                        </div>
                        <p className="font-semibold text-primary">${addOn.price}/day</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">Total Bookings</p>
                  <Users className="size-4 text-muted-foreground" />
                </div>
                <p className="font-bold text-2xl">{stats.totalBookings}</p>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">Total Earnings</p>
                  <DollarSign className="size-4 text-muted-foreground" />
                </div>
                <p className="font-bold text-2xl">
                  ${Math.round(stats.totalEarnings / 100).toLocaleString()}
                </p>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">Average Rating</p>
                  <CheckCircle2 className="size-4 text-muted-foreground" />
                </div>
                <p className="font-bold text-2xl">
                  {stats.averageRating > 0 ? `${stats.averageRating}/5.0` : "N/A"}
                </p>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">Completed Trips</p>
                  <CheckCircle2 className="size-4 text-muted-foreground" />
                </div>
                <p className="font-bold text-2xl">{stats.completedTrips}</p>
              </div>
            </CardContent>
          </Card>

          {/* Analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">Total Views</p>
                  <Eye className="size-4 text-muted-foreground" />
                </div>
                <p className="font-bold text-2xl">{analytics?.totalViews.toLocaleString() || 0}</p>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">Shares</p>
                  <Share2 className="size-4 text-muted-foreground" />
                </div>
                <p className="font-bold text-2xl">{analytics?.totalShares.toLocaleString() || 0}</p>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">Favorites</p>
                  <Heart className="size-4 text-muted-foreground" />
                </div>
                <p className="font-bold text-2xl">
                  {analytics?.favoriteCount.toLocaleString() || 0}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Vehicle Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link className="block" href={`/host/vehicles/${vehicleId}/availability`}>
                <Button className="w-full justify-start" size="sm" variant="outline">
                  <CalendarIcon className="mr-2 size-4" />
                  Manage Availability
                </Button>
              </Link>
              <Link className="block" href="/host/reservations">
                <Button className="w-full justify-start" size="sm" variant="outline">
                  <Users className="mr-2 size-4" />
                  View All Reservations
                </Button>
              </Link>
              <Link className="block" href={`/vehicles/${vehicleId}`}>
                <Button className="w-full justify-start" size="sm" variant="outline">
                  <Eye className="mr-2 size-4" />
                  View Public Listing
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Track Info */}
          <Card>
            <CardHeader>
              <CardTitle>Track Location</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">{vehicle.track?.name || "Track TBD"}</p>
                  <p className="text-muted-foreground text-sm">{vehicle.track?.location || ""}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
