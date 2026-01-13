"use client"

import { useQuery, useMutation } from "convex/react"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { api } from "@/lib/convex"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import {
  ArrowLeft,
  Ban,
  CheckCircle,
  Loader2,
  Car,
  Calendar,
  Star,
  MapPin,
  DollarSign,
  User,
} from "lucide-react"
import { toast } from "sonner"
import type { Id } from "@/lib/convex"

export default function VehicleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const vehicleId = params.id as Id<"vehicles">
  const vehicle = useQuery(api.vehicles.getById, { id: vehicleId })
  const reservations = useQuery(api.admin.getVehicleReservations, {
    vehicleId,
    limit: 50,
  })
  const reviews = useQuery(api.reviews.getByVehicle, { vehicleId })
  const suspendVehicle = useMutation(api.admin.suspendVehicle)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSuspend = async (isActive: boolean) => {
    setIsProcessing(true)
    try {
      await suspendVehicle({ vehicleId, isActive: !isActive })
      toast.success(`Vehicle ${!isActive ? "activated" : "suspended"} successfully`)
    } catch (error) {
      console.error("Failed to suspend vehicle:", error)
      toast.error("An error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusBadge = (status: string, isActive?: boolean) => {
    if (isActive === false) {
      return <Badge variant="destructive">Suspended</Badge>
    }
    switch (status) {
      case "pending":
        return <Badge variant="default">Pending</Badge>
      case "approved":
        return <Badge variant="default" className="bg-green-600">Approved</Badge>
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`size-4 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        ))}
        <span className="ml-1 text-sm font-medium">{rating}</span>
      </div>
    )
  }

  if (vehicle === undefined || reservations === undefined || reviews === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading vehicle...</div>
      </div>
    )
  }

  if (vehicle === null) {
    return (
      <div className="space-y-6">
        <Link href="/vehicles">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 size-4" />
            Back to Vehicles
          </Button>
        </Link>
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Vehicle not found
          </CardContent>
        </Card>
      </div>
    )
  }

  const primaryImage = vehicle.images?.find((img) => img.isPrimary) || vehicle.images?.[0]
  const averageRating =
    reviews && reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/vehicles">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 size-4" />
              Back to Vehicles
            </Button>
          </Link>
          <h1 className="font-bold text-3xl">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h1>
          <p className="text-muted-foreground mt-2">Vehicle ID: {vehicle._id}</p>
        </div>
        <div className="flex items-center gap-4">
          {getStatusBadge(vehicle.status, vehicle.isActive)}
          {vehicle.status === "approved" && (
            <Button
              onClick={() => handleSuspend(vehicle.isActive !== false)}
              disabled={isProcessing}
              variant={vehicle.isActive === false ? "default" : "destructive"}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Processing...
                </>
              ) : vehicle.isActive === false ? (
                <>
                  <CheckCircle className="mr-2 size-4" />
                  Activate
                </>
              ) : (
                <>
                  <Ban className="mr-2 size-4" />
                  Suspend
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Vehicle Images */}
      {vehicle.images && vehicle.images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {vehicle.images.map((image, idx) => (
                <div key={image._id} className="relative">
                  <img
                    src={image.detailUrl || image.cardUrl || image.imageUrl}
                    alt={`${vehicle.make} ${vehicle.model} - Image ${idx + 1}`}
                    className="h-48 w-full rounded-lg object-cover"
                  />
                  {image.isPrimary && (
                    <Badge className="absolute top-2 right-2">Primary</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="reservations">
            Reservations ({reservations?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({reviews?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Car className="size-5" />
                  <CardTitle>Basic Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-muted-foreground text-sm">Make & Model</p>
                  <p className="font-medium">
                    {vehicle.make} {vehicle.model} {vehicle.year}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Daily Rate</p>
                  <p className="font-semibold text-lg">{formatCurrency(vehicle.dailyRate)}</p>
                </div>
                {vehicle.track && (
                  <div>
                    <p className="text-muted-foreground text-sm">Track</p>
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4" />
                      <p className="font-medium">{vehicle.track.name}</p>
                    </div>
                    <p className="text-muted-foreground text-sm">{vehicle.track.location}</p>
                  </div>
                )}
                {vehicle.description && (
                  <div>
                    <p className="text-muted-foreground text-sm">Description</p>
                    <p className="mt-1">{vehicle.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Specifications */}
            <Card>
              <CardHeader>
                <CardTitle>Specifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {vehicle.horsepower && (
                    <div>
                      <p className="text-muted-foreground text-sm">Horsepower</p>
                      <p className="font-medium">{vehicle.horsepower} HP</p>
                    </div>
                  )}
                  {vehicle.transmission && (
                    <div>
                      <p className="text-muted-foreground text-sm">Transmission</p>
                      <p className="font-medium">{vehicle.transmission}</p>
                    </div>
                  )}
                  {vehicle.drivetrain && (
                    <div>
                      <p className="text-muted-foreground text-sm">Drivetrain</p>
                      <p className="font-medium">{vehicle.drivetrain}</p>
                    </div>
                  )}
                  {vehicle.engineType && (
                    <div>
                      <p className="text-muted-foreground text-sm">Engine</p>
                      <p className="font-medium">{vehicle.engineType}</p>
                    </div>
                  )}
                  {vehicle.mileage && (
                    <div>
                      <p className="text-muted-foreground text-sm">Mileage</p>
                      <p className="font-medium">{vehicle.mileage.toLocaleString()} miles</p>
                    </div>
                  )}
                </div>
                {vehicle.amenities && vehicle.amenities.length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-2">Amenities</p>
                    <div className="flex flex-wrap gap-2">
                      {vehicle.amenities.map((amenity, idx) => (
                        <Badge key={idx} variant="outline">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Owner Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="size-5" />
                  <CardTitle>Owner Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium">{vehicle.owner?.name || "Unknown"}</p>
                  <p className="text-muted-foreground text-sm">
                    {vehicle.owner?.email || "N/A"}
                  </p>
                  {vehicle.owner?.phone && (
                    <p className="text-muted-foreground text-sm">
                      Phone: {vehicle.owner.phone}
                    </p>
                  )}
                </div>
                {vehicle.owner?.rating && (
                  <div>
                    <p className="text-muted-foreground text-sm">Rating</p>
                    {renderStars(vehicle.owner.rating)}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-muted-foreground text-sm">Total Reservations</p>
                  <p className="font-semibold text-lg">{reservations?.length || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Total Reviews</p>
                  <p className="font-semibold text-lg">{reviews?.length || 0}</p>
                </div>
                {reviews && reviews.length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-sm">Average Rating</p>
                    <div className="mt-1">{renderStars(Math.round(averageRating * 10) / 10)}</div>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-sm">Created</p>
                  <p className="font-medium">
                    {new Date(vehicle.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reservations" className="space-y-4">
          {reservations && reservations.length > 0 ? (
            <div className="space-y-4">
              {reservations.map((reservation) => (
                <Card key={reservation._id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(reservation.status)}
                          <Link href={`/reservations/${reservation._id}`}>
                            <Button variant="link" className="h-auto p-0">
                              View Reservation
                            </Button>
                          </Link>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">
                              <strong>Renter:</strong> {reservation.renter?.name || "Unknown"}
                            </p>
                            <p className="text-muted-foreground">
                              <strong>Dates:</strong> {formatDate(reservation.startDate)} -{" "}
                              {formatDate(reservation.endDate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">
                              <strong>Total:</strong> {formatCurrency(reservation.totalAmount)}
                            </p>
                            <p className="text-muted-foreground">
                              <strong>Days:</strong> {reservation.totalDays}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Calendar className="mx-auto mb-4 size-12 opacity-50" />
                <p>No reservations found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          {reviews && reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <Card key={review._id}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{review.title}</h4>
                          <div className="mt-1">{renderStars(review.rating)}</div>
                        </div>
                        <Badge variant="outline">
                          {review.reviewType === "renter_to_owner"
                            ? "Renter → Owner"
                            : "Owner → Renter"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">{review.review}</p>
                      <div className="flex items-center gap-4 text-muted-foreground text-xs">
                        <span>
                          <strong>By:</strong> {review.reviewer?.name || "Unknown"}
                        </span>
                        <span>
                          <strong>Date:</strong>{" "}
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Star className="mx-auto mb-4 size-12 opacity-50" />
                <p>No reviews found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
