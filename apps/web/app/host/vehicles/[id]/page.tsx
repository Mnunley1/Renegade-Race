"use client"

import { useUser } from "@clerk/nextjs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { useMutation, useQuery } from "convex/react"
import {
  ArrowLeft,
  ArrowRight,
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
  Settings,
  Share2,
  Trash2,
  Users,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { VehicleGallery } from "@/components/vehicle-gallery"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

export default function HostVehicleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const vehicleId = params.id as string
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch vehicle from Convex
  const vehicle = useQuery(
    api.vehicles.getById,
    vehicleId ? { id: vehicleId as Id<"vehicles"> } : "skip"
  )

  // Check if vehicle can be deleted
  const canDeleteResult = useQuery(
    api.vehicles.canDelete,
    vehicleId ? { id: vehicleId as Id<"vehicles"> } : "skip"
  )

  // Delete mutation
  const deleteVehicle = useMutation(api.vehicles.remove)

  // Fetch reservations for this vehicle (as owner)
  const allReservations = useQuery(
    api.reservations.getByUser,
    user?.id ? { userId: user.id, role: "owner" as const } : "skip"
  )

  // Fetch analytics for this vehicle
  const analytics = useQuery(
    api.vehicleAnalytics.getVehicleAnalytics,
    vehicleId && user?.id ? { vehicleId: vehicleId as Id<"vehicles"> } : "skip"
  )

  // Filter reservations for this vehicle
  const vehicleReservations = useMemo(() => {
    if (!(allReservations && vehicle)) return []
    return allReservations.filter((res: any) => res.vehicleId === vehicle._id)
  }, [allReservations, vehicle])

  // Separate reservations by status
  const pendingReservations = useMemo(
    () => vehicleReservations.filter((res: any) => res.status === "pending"),
    [vehicleReservations]
  )

  const confirmedReservations = useMemo(
    () => vehicleReservations.filter((res: any) => res.status === "confirmed"),
    [vehicleReservations]
  )

  const upcomingReservations = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    return confirmedReservations.filter((res: any) => res.startDate >= (today ?? "")).slice(0, 3)
  }, [confirmedReservations])

  // Calculate stats from reservations
  const stats = useMemo(() => {
    if (!(vehicleReservations && vehicle)) {
      return {
        totalBookings: 0,
        totalEarnings: 0,
        completedTrips: 0,
        pendingCount: 0,
        upcomingCount: 0,
      }
    }

    const totalBookings = vehicleReservations.length
    const totalEarnings = vehicleReservations.reduce(
      (sum: number, res: any) => sum + (res.totalAmount || 0),
      0
    )
    const completedTrips = vehicleReservations.filter(
      (res: any) => res.status === "completed"
    ).length
    const pendingCount = pendingReservations.length
    const upcomingCount = upcomingReservations.length

    return {
      totalBookings,
      totalEarnings: Math.round(totalEarnings / 100), // Convert cents to dollars
      completedTrips,
      pendingCount,
      upcomingCount,
    }
  }, [vehicleReservations, vehicle, pendingReservations, upcomingReservations])

  // Extract r2Keys for the gallery - sort by order field set in edit page
  const galleryImages = useMemo(() => {
    if (!vehicle?.images || vehicle.images.length === 0) return []

    // Sort images by order field (set via drag-and-drop in edit page)
    const sortedImages = [...vehicle.images].sort((a, b) => {
      // Use order field as primary sort
      const orderA = a.order ?? Number.MAX_SAFE_INTEGER
      const orderB = b.order ?? Number.MAX_SAFE_INTEGER
      return orderA - orderB
    })

    // Extract r2Keys, filtering out any without valid keys
    return sortedImages
      .filter((img) => img.r2Key && img.r2Key.trim() !== "")
      .map((img) => `/${img.r2Key}`)
  }, [vehicle?.images])

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

  const getStatusBadge = () => {
    if (vehicle.isActive && vehicle.isApproved) {
      return (
        <Badge className="gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400">
          <CheckCircle2 className="size-3" />
          Active
        </Badge>
      )
    }
    if (vehicle.isApproved === false) {
      return (
        <Badge className="gap-1.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
          <Clock className="size-3" />
          Pending Approval
        </Badge>
      )
    }
    return (
      <Badge className="gap-1.5 bg-gray-500/10 text-gray-700 dark:text-gray-400">
        <XCircle className="size-3" />
        Inactive
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const handleDeleteVehicle = async () => {
    setIsDeleting(true)
    try {
      await deleteVehicle({ id: vehicleId as Id<"vehicles"> })
      toast.success("Vehicle deleted successfully")
      router.push("/host/vehicles/list")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "delete vehicle",
        entity: "vehicle",
        customMessages: {
          generic: "Failed to delete vehicle. Please try again.",
        },
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/host/dashboard">
          <Button className="mb-4" variant="ghost">
            <ArrowLeft className="mr-2 size-4" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <h1 className="font-bold text-3xl sm:text-4xl">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h1>
              {getStatusBadge()}
            </div>
            <p className="text-muted-foreground">
              {vehicle.track?.name || "Track TBD"} • ${vehicle.dailyRate.toLocaleString()}/day
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/vehicles/${vehicleId}`}>
              <Button size="sm" variant="outline">
                <Eye className="mr-2 size-4" />
                View Listing
              </Button>
            </Link>
            <Link href={`/host/vehicles/${vehicleId}/edit`}>
              <Button size="sm">
                <Edit className="mr-2 size-4" />
                Edit
              </Button>
            </Link>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-medium text-muted-foreground text-sm">
                Total Earnings
              </CardTitle>
              <DollarSign className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">${stats.totalEarnings.toLocaleString()}</div>
              <p className="mt-1 text-muted-foreground text-xs">All-time revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-medium text-muted-foreground text-sm">
                Total Bookings
              </CardTitle>
              <Users className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">{stats.totalBookings}</div>
              <p className="mt-1 text-muted-foreground text-xs">All reservations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-medium text-muted-foreground text-sm">
                Pending Requests
              </CardTitle>
              <Clock className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">{stats.pendingCount}</div>
              <p className="mt-1 text-muted-foreground text-xs">Awaiting response</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-medium text-muted-foreground text-sm">
                Upcoming Trips
              </CardTitle>
              <CalendarIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">{stats.upcomingCount}</div>
              <p className="mt-1 text-muted-foreground text-xs">Confirmed bookings</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Pending Reservations - Priority */}
          {stats.pendingCount > 0 && (
            <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="size-5 text-yellow-600 dark:text-yellow-400" />
                      Action Required
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {stats.pendingCount} booking{" "}
                      {stats.pendingCount === 1 ? "request" : "requests"} waiting for your response
                    </CardDescription>
                  </div>
                  <Link href={`/host/reservations?status=pending&vehicleId=${vehicleId}`}>
                    <Button size="sm" variant="outline">
                      View All
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingReservations.slice(0, 3).map((reservation: any) => {
                    const renterName = reservation.renter?.name || "Guest"
                    return (
                      <Link href={`/host/reservations/${reservation._id}`} key={reservation._id}>
                        <div className="flex items-center justify-between rounded-lg border bg-background p-4 transition-colors hover:bg-muted/50">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm">{renterName}</p>
                            <p className="text-muted-foreground text-xs">
                              {formatDate(reservation.startDate)} -{" "}
                              {formatDate(reservation.endDate)}
                            </p>
                            <p className="mt-1 font-semibold text-sm">
                              ${Math.round((reservation.totalAmount || 0) / 100).toLocaleString()}
                            </p>
                          </div>
                          <Button size="sm">Review</Button>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Reservations */}
          {stats.upcomingCount > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Upcoming Reservations</CardTitle>
                    <CardDescription className="mt-1">
                      Next {stats.upcomingCount} confirmed{" "}
                      {stats.upcomingCount === 1 ? "booking" : "bookings"}
                    </CardDescription>
                  </div>
                  <Link href={`/host/reservations?vehicleId=${vehicleId}`}>
                    <Button size="sm" variant="outline">
                      View All
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingReservations.map((reservation: any) => {
                    const renterName = reservation.renter?.name || "Guest"
                    return (
                      <Link href={`/host/reservations/${reservation._id}`} key={reservation._id}>
                        <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm">{renterName}</p>
                            <p className="text-muted-foreground text-xs">
                              {formatDate(reservation.startDate)} -{" "}
                              {formatDate(reservation.endDate)}
                            </p>
                            <p className="mt-1 text-sm">
                              {reservation.totalDays} {reservation.totalDays === 1 ? "day" : "days"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm">
                              ${Math.round((reservation.totalAmount || 0) / 100).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Vehicle Gallery */}
          <VehicleGallery
            images={galleryImages}
            vehicleName={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          />

          {/* Vehicle Details */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Information</CardTitle>
              <CardDescription className="mt-1">Specifications and details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="mb-4 font-semibold text-lg">Specifications</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {vehicle.horsepower && (
                    <div className="flex items-start gap-3">
                      <Gauge className="mt-0.5 size-5 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground text-sm">Horsepower</p>
                        <p className="font-semibold">{vehicle.horsepower} hp</p>
                      </div>
                    </div>
                  )}
                  {vehicle.transmission && (
                    <div className="flex items-start gap-3">
                      <Car className="mt-0.5 size-5 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground text-sm">Transmission</p>
                        <p className="font-semibold">{vehicle.transmission}</p>
                      </div>
                    </div>
                  )}
                  {vehicle.drivetrain && (
                    <div className="flex items-start gap-3">
                      <Settings className="mt-0.5 size-5 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground text-sm">Drivetrain</p>
                        <p className="font-semibold">{vehicle.drivetrain}</p>
                      </div>
                    </div>
                  )}
                  {vehicle.engineType && (
                    <div className="flex items-start gap-3">
                      <Car className="mt-0.5 size-5 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground text-sm">Engine Type</p>
                        <p className="font-semibold">{vehicle.engineType}</p>
                      </div>
                    </div>
                  )}
                  {vehicle.mileage && (
                    <div className="flex items-start gap-3">
                      <Gauge className="mt-0.5 size-5 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground text-sm">Mileage</p>
                        <p className="font-semibold">{vehicle.mileage.toLocaleString()} miles</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="mb-2 font-semibold text-lg">Description</h3>
                <p className="text-muted-foreground leading-relaxed">{vehicle.description}</p>
              </div>

              {vehicle.amenities && vehicle.amenities.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="mb-3 font-semibold text-lg">Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {vehicle.amenities.map((amenity: string) => (
                        <Badge key={amenity} variant="secondary">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {vehicle.addOns && vehicle.addOns.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="mb-3 font-semibold text-lg">Add-ons</h3>
                    <div className="space-y-2">
                      {vehicle.addOns.map((addOn: any, index: number) => (
                        <div
                          className="flex items-center justify-between rounded-lg border p-3"
                          key={index}
                        >
                          <div>
                            <p className="font-medium">{addOn.name}</p>
                            {addOn.description && (
                              <p className="text-muted-foreground text-sm">{addOn.description}</p>
                            )}
                            {addOn.isRequired && (
                              <Badge className="mt-1" variant="secondary">
                                Required
                              </Badge>
                            )}
                          </div>
                          <p className="font-semibold text-primary">
                            ${Math.round(addOn.price / 100)}/day
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link className="block" href={`/host/vehicles/${vehicleId}/availability`}>
                <Button className="w-full justify-start" size="sm" variant="outline">
                  <CalendarIcon className="mr-2 size-4" />
                  Manage Availability
                </Button>
              </Link>
              <Link className="block" href={`/host/reservations?vehicleId=${vehicleId}`}>
                <Button className="w-full justify-start" size="sm" variant="outline">
                  <Users className="mr-2 size-4" />
                  View Reservations
                  {stats.pendingCount > 0 && (
                    <Badge className="ml-auto" variant="destructive">
                      {stats.pendingCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">Views</span>
                </div>
                <span className="font-semibold">{analytics?.totalViews.toLocaleString() || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Share2 className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">Shares</span>
                </div>
                <span className="font-semibold">
                  {analytics?.totalShares.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">Favorites</span>
                </div>
                <span className="font-semibold">
                  {analytics?.favoriteCount.toLocaleString() || 0}
                </span>
              </div>
              {stats.completedTrips > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground text-sm">Completed</span>
                  </div>
                  <span className="font-semibold">{stats.completedTrips}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="w-full justify-start"
                    disabled={!canDeleteResult?.canDelete || isDeleting}
                    size="sm"
                    variant="destructive"
                  >
                    <Trash2 className="mr-2 size-4" />
                    {isDeleting ? "Deleting..." : "Delete Vehicle"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete{" "}
                      <span className="font-semibold">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </span>
                      ? This will hide the vehicle from search results and prevent new bookings.
                      Existing completed reservations and reviews will be preserved.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleDeleteVehicle}
                    >
                      Delete Vehicle
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {canDeleteResult && !canDeleteResult.canDelete && (
                <p className="mt-2 text-muted-foreground text-xs">{canDeleteResult.reason}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
