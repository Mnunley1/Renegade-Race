"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { useMutation, useQuery } from "convex/react"
import { format, formatDistanceToNow } from "date-fns"
import {
  Ban,
  Calendar,
  Car,
  CheckCircle,
  DollarSign,
  ExternalLink,
  Eye,
  Gauge,
  MapPin,
  Settings,
  Shield,
  Star,
  User,
  XCircle,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { DetailPageLayout } from "@/components/detail-page-layout"
import { LoadingState } from "@/components/loading-state"
import { StatusBadge } from "@/components/status-badge"
import { UserAvatar } from "@/components/user-avatar"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100)

function formatBooleanSetting(
  value: boolean | undefined | null,
  trueLabel: string,
  falseLabel: string
): string | null {
  if (value == null) return null
  return value ? trueLabel : falseLabel
}

type VehicleData = NonNullable<ReturnType<typeof useQuery<typeof api.vehicles.getById>>>

type ReservationItem = {
  _id: string
  status: string
  totalAmount: number
  totalDays: number
  startDate: string
  endDate: string
  dailyRate: number
  renter?: { name?: string; email?: string } | null
}

type ReviewItem = {
  _id: string
  rating: number
  title?: string
  review?: string
  reviewType?: string
  createdAt: number
  reviewer?: { name?: string } | null
}

function getVehicleStatus(vehicle: VehicleData): string {
  if (vehicle.isSuspended) return "suspended"
  if (vehicle.isApproved === true) return "approved"
  if (vehicle.isApproved === false) return "rejected"
  return "pending"
}

function computeAverageRating(reviews: ReviewItem[]): number {
  if (reviews.length === 0) return 0
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
}

function SummaryCards({
  vehicle,
  reservations,
  reviews,
}: {
  vehicle: VehicleData
  reservations: ReservationItem[] | undefined
  reviews: ReviewItem[] | undefined
}) {
  const confirmedReservations =
    reservations?.filter((r) => r.status === "confirmed" || r.status === "completed") ?? []
  const totalRevenue = confirmedReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
  const averageRating = reviews ? computeAverageRating(reviews) : 0

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <p className="font-medium text-muted-foreground text-sm">Daily Rate</p>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
              <DollarSign className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            </div>
          </div>
          <p className="mt-3 font-bold text-2xl tracking-tight">
            {formatCurrency(vehicle.dailyRate)}
          </p>
          <p className="mt-1 text-muted-foreground text-xs">per day</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <p className="font-medium text-muted-foreground text-sm">Reservations</p>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <Calendar className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            </div>
          </div>
          <p className="mt-3 font-bold text-2xl tracking-tight">{reservations?.length ?? 0}</p>
          <p className="mt-1 text-muted-foreground text-xs">
            {confirmedReservations.length} confirmed
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <p className="font-medium text-muted-foreground text-sm">Total Revenue</p>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/50">
              <DollarSign className="h-4 w-4 text-purple-700 dark:text-purple-400" />
            </div>
          </div>
          <p className="mt-3 font-bold text-2xl tracking-tight">{formatCurrency(totalRevenue)}</p>
          <p className="mt-1 text-muted-foreground text-xs">
            from {confirmedReservations.length} bookings
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <p className="font-medium text-muted-foreground text-sm">Rating</p>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
              <Star className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <p className="font-bold text-2xl tracking-tight">
              {averageRating > 0 ? averageRating.toFixed(1) : "--"}
            </p>
            {averageRating > 0 && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
          </div>
          <p className="mt-1 text-muted-foreground text-xs">
            {reviews?.length ?? 0} {reviews?.length === 1 ? "review" : "reviews"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function ImageGallery({ vehicle }: { vehicle: VehicleData }) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  if (!vehicle.images || vehicle.images.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <Car className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No images uploaded</p>
        </CardContent>
      </Card>
    )
  }

  const images = vehicle.images as Array<{
    _id: string
    isPrimary: boolean
    detailUrl?: string
    cardUrl?: string
    heroUrl?: string
    imageUrl?: string
    r2Key?: string
  }>
  const selectedImage = images[selectedIndex]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-4 w-4" />
          Photos ({images.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative overflow-hidden rounded-lg">
          <img
            alt={`${vehicle.make} ${vehicle.model}`}
            className="h-64 w-full object-cover"
            src={
              selectedImage?.heroUrl ||
              selectedImage?.detailUrl ||
              selectedImage?.cardUrl ||
              selectedImage?.imageUrl
            }
          />
          {selectedImage?.isPrimary && (
            <Badge className="absolute top-3 left-3 bg-black/60 text-white">Primary</Badge>
          )}
        </div>
        {images.length > 1 && (
          <div className="grid grid-cols-5 gap-2">
            {images.map((image, idx) => (
              <button
                className={`relative overflow-hidden rounded-md border-2 transition-all ${
                  idx === selectedIndex
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
                key={image._id}
                onClick={() => setSelectedIndex(idx)}
                type="button"
              >
                <img
                  alt={`${vehicle.make} ${vehicle.model} - ${idx + 1}`}
                  className="h-16 w-full object-cover"
                  src={image.cardUrl || image.imageUrl}
                />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function VehicleDetailsCard({ vehicle }: { vehicle: VehicleData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Car className="h-4 w-4" />
          Vehicle Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Make &amp; Model
            </p>
            <p className="mt-2 font-semibold">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Daily Rate
            </p>
            <p className="mt-2 font-semibold">{formatCurrency(vehicle.dailyRate)}</p>
          </div>
        </div>
        {vehicle.description && (
          <>
            <Separator />
            <div>
              <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Description
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{vehicle.description}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function SpecificationsCard({ vehicle }: { vehicle: VehicleData }) {
  const specs = [
    { label: "Horsepower", value: vehicle.horsepower ? `${vehicle.horsepower} HP` : null },
    { label: "Transmission", value: vehicle.transmission },
    { label: "Drivetrain", value: vehicle.drivetrain },
    { label: "Engine", value: vehicle.engineType },
    {
      label: "Mileage",
      value: vehicle.mileage ? `${vehicle.mileage.toLocaleString()} miles` : null,
    },
    { label: "Tire Type", value: vehicle.tireType },
    {
      label: "Experience Level",
      value: vehicle.experienceLevel
        ? vehicle.experienceLevel.charAt(0).toUpperCase() + vehicle.experienceLevel.slice(1)
        : null,
    },
  ].filter((s) => s.value != null)

  if (specs.length === 0 && (!vehicle.amenities || vehicle.amenities.length === 0)) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4" />
          Specifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {specs.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {specs.map((spec) => (
              <div className="flex justify-between text-sm" key={spec.label}>
                <span className="text-muted-foreground">{spec.label}</span>
                <span className="font-medium">{spec.value}</span>
              </div>
            ))}
          </div>
        )}
        {vehicle.amenities && vehicle.amenities.length > 0 && (
          <>
            {specs.length > 0 && <Separator />}
            <div>
              <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Amenities &amp; Features
              </p>
              <div className="flex flex-wrap gap-2">
                {vehicle.amenities.map((amenity: string) => (
                  <Badge key={amenity} variant="outline">
                    {amenity}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function BookingSettingsCard({ vehicle }: { vehicle: VehicleData }) {
  const settings = [
    { label: "Advance Notice", value: vehicle.advanceNotice },
    { label: "Min Trip Duration", value: vehicle.minTripDuration },
    { label: "Max Trip Duration", value: vehicle.maxTripDuration },
    {
      label: "Cancellation Policy",
      value: vehicle.cancellationPolicy
        ? vehicle.cancellationPolicy.charAt(0).toUpperCase() + vehicle.cancellationPolicy.slice(1)
        : null,
    },
    {
      label: "Delivery Available",
      value: formatBooleanSetting(vehicle.deliveryAvailable, "Yes", "No"),
    },
    {
      label: "Weekend Minimum",
      value: formatBooleanSetting(vehicle.requireWeekendMin, "Required", "Not required"),
    },
  ].filter((s) => s.value != null)

  const hasAddOns = vehicle.addOns && vehicle.addOns.length > 0

  if (settings.length === 0 && !hasAddOns) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          Booking Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings.length > 0 && (
          <div className="space-y-3">
            {settings.map((setting) => (
              <div className="flex justify-between text-sm" key={setting.label}>
                <span className="text-muted-foreground">{setting.label}</span>
                <span className="font-medium">{setting.value}</span>
              </div>
            ))}
          </div>
        )}
        {hasAddOns && (
          <>
            {settings.length > 0 && <Separator />}
            <div>
              <p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Add-ons
              </p>
              <div className="space-y-2">
                {vehicle.addOns.map((addon) => (
                  <div
                    className="flex items-start justify-between rounded-lg border p-3"
                    key={addon.name}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{addon.name}</p>
                      {addon.description && (
                        <p className="mt-0.5 text-muted-foreground text-xs">{addon.description}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-sm">{formatCurrency(addon.price)}</p>
                      <p className="text-muted-foreground text-xs">
                        {addon.priceType === "daily" ? "/day" : "one-time"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function TrackLocationCard({ vehicle }: { vehicle: VehicleData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" />
          Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {vehicle.track && (
          <div>
            <p className="font-semibold">{vehicle.track.name}</p>
            {vehicle.track.location && (
              <p className="mt-0.5 text-muted-foreground text-sm">{vehicle.track.location}</p>
            )}
          </div>
        )}
        {vehicle.address && (
          <>
            {vehicle.track && <Separator />}
            <div className="space-y-1 text-sm">
              {vehicle.address.street && (
                <p className="text-muted-foreground">{vehicle.address.street}</p>
              )}
              <p className="text-muted-foreground">
                {[vehicle.address.city, vehicle.address.state, vehicle.address.zipCode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          </>
        )}
        {!(vehicle.track || vehicle.address) && (
          <p className="text-muted-foreground text-sm">No location set</p>
        )}
      </CardContent>
    </Card>
  )
}

function OwnerCard({ vehicle }: { vehicle: VehicleData }) {
  const router = useRouter()
  const owner = vehicle.owner

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4" />
          Owner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <UserAvatar email={owner?.email} name={owner?.name} />
          <Badge className="ml-auto px-1.5 py-0 text-[10px]" variant="outline">
            host
          </Badge>
        </div>
        {owner?.phone && <p className="text-muted-foreground text-sm">{owner.phone}</p>}
        {owner?.rating && (
          <div className="flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="font-medium">{owner.rating}</span>
            <span className="text-muted-foreground">rating</span>
          </div>
        )}
        {owner?.externalId && (
          <Button
            className="w-full"
            onClick={() => router.push(`/users/${owner.externalId}`)}
            size="sm"
            variant="outline"
          >
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            View Profile
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function VehicleStatusCard({ vehicle }: { vehicle: VehicleData }) {
  const status = getVehicleStatus(vehicle)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          Status &amp; Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Approval</span>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Listing</span>
          <StatusBadge status={vehicle.isActive ? "active" : "inactive"} />
        </div>
        <Separator />
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created</span>
            <span className="font-medium">{format(vehicle.createdAt, "MMM d, yyyy")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Updated</span>
            <span className="font-medium">
              {formatDistanceToNow(vehicle.updatedAt, { addSuffix: true })}
            </span>
          </div>
          {vehicle.viewCount != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Views</span>
              <span className="font-medium">{vehicle.viewCount.toLocaleString()}</span>
            </div>
          )}
          {vehicle.shareCount != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shares</span>
              <span className="font-medium">{vehicle.shareCount.toLocaleString()}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ReservationsSection({ reservations }: { reservations: ReservationItem[] | undefined }) {
  const router = useRouter()

  if (!reservations || reservations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Recent Reservations
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-8 text-center">
          <Calendar className="mb-3 h-10 w-10 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground text-sm">No reservations yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Recent Reservations ({reservations.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {reservations.slice(0, 10).map((reservation) => (
            <ReservationRow key={reservation._id} reservation={reservation} router={router} />
          ))}
          {reservations.length > 10 && (
            <p className="pt-2 text-center text-muted-foreground text-xs">
              Showing 10 of {reservations.length} reservations
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ReservationRow({
  reservation,
  router,
}: {
  reservation: ReservationItem
  router: ReturnType<typeof useRouter>
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50">
      <div className="flex items-center gap-3">
        <StatusBadge status={reservation.status} />
        <div className="min-w-0">
          <p className="truncate font-medium text-sm">
            {reservation.renter?.name || "Unknown renter"}
          </p>
          <p className="text-muted-foreground text-xs">
            {format(new Date(reservation.startDate), "MMM d")} -{" "}
            {format(new Date(reservation.endDate), "MMM d, yyyy")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="font-semibold text-sm">{formatCurrency(reservation.totalAmount)}</p>
          <p className="text-muted-foreground text-xs">
            {reservation.totalDays} {reservation.totalDays === 1 ? "day" : "days"}
          </p>
        </div>
        <Button
          onClick={() => router.push(`/reservations/${reservation._id}`)}
          size="sm"
          variant="ghost"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function ReviewsSection({ reviews }: { reviews: ReviewItem[] | undefined }) {
  if (!reviews || reviews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4" />
            Reviews
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-8 text-center">
          <Star className="mb-3 h-10 w-10 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground text-sm">No reviews yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4" />
          Reviews ({reviews.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reviews.slice(0, 5).map((review) => (
            <ReviewRow key={review._id} review={review} />
          ))}
          {reviews.length > 5 && (
            <p className="pt-1 text-center text-muted-foreground text-xs">
              Showing 5 of {reviews.length} reviews
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ReviewRow({ review }: { review: ReviewItem }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  className={`h-3.5 w-3.5 ${
                    star <= review.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"
                  }`}
                  key={star}
                />
              ))}
            </div>
            <span className="font-medium text-sm">{review.rating}</span>
          </div>
          {review.title && <p className="mt-1 font-medium text-sm">{review.title}</p>}
        </div>
        <Badge variant="outline">
          {review.reviewType === "renter_to_owner" ? "Renter" : "Owner"}
        </Badge>
      </div>
      {review.review && (
        <p className="mt-2 line-clamp-2 text-muted-foreground text-sm">{review.review}</p>
      )}
      <div className="mt-2 flex items-center gap-3 text-muted-foreground text-xs">
        <span>{review.reviewer?.name || "Unknown"}</span>
        <span>{format(review.createdAt, "MMM d, yyyy")}</span>
      </div>
    </div>
  )
}

export default function VehicleDetailPage() {
  const params = useParams()
  const vehicleId = params.id as Id<"vehicles">
  const vehicle = useQuery(api.vehicles.getById, { id: vehicleId })
  const reservations = useQuery(api.admin.getVehicleReservations, {
    vehicleId,
    limit: 50,
  })
  const reviews = useQuery(api.reviews.getByVehicle, { vehicleId })
  const suspendVehicle = useMutation(api.admin.suspendVehicle)
  const approveVehicle = useMutation(api.vehicles.approveVehicle)
  const rejectVehicle = useMutation(api.vehicles.rejectVehicle)

  const [isProcessing, setIsProcessing] = useState(false)
  const [suspendConfirm, setSuspendConfirm] = useState(false)
  const [approveConfirm, setApproveConfirm] = useState(false)
  const [rejectConfirm, setRejectConfirm] = useState(false)

  const handleSuspend = async () => {
    setIsProcessing(true)
    try {
      const newState = !vehicle?.isSuspended
      await suspendVehicle({ vehicleId, isSuspended: newState })
      toast.success(`Vehicle ${newState ? "suspended" : "activated"} successfully`)
      setSuspendConfirm(false)
    } catch (error) {
      handleErrorWithContext(error, { action: "suspend vehicle", entity: "vehicle" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleApprove = async () => {
    setIsProcessing(true)
    try {
      await approveVehicle({ vehicleId })
      toast.success("Vehicle approved successfully")
      setApproveConfirm(false)
    } catch (error) {
      handleErrorWithContext(error, { action: "approve vehicle", entity: "vehicle" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    setIsProcessing(true)
    try {
      await rejectVehicle({ vehicleId })
      toast.success("Vehicle rejected")
      setRejectConfirm(false)
    } catch (error) {
      handleErrorWithContext(error, { action: "reject vehicle", entity: "vehicle" })
    } finally {
      setIsProcessing(false)
    }
  }

  if (vehicle === undefined || reservations === undefined || reviews === undefined) {
    return <LoadingState message="Loading vehicle details..." />
  }

  if (vehicle === null) {
    return (
      <DetailPageLayout title="Vehicle Not Found">
        <p className="text-muted-foreground">This vehicle could not be found.</p>
      </DetailPageLayout>
    )
  }

  const status = getVehicleStatus(vehicle)
  const isPending = vehicle.isApproved === undefined || vehicle.isApproved === null
  const isApproved = vehicle.isApproved === true

  return (
    <DetailPageLayout
      actions={
        <VehicleActions
          isApproved={isApproved}
          isPending={isPending}
          isSuspended={vehicle.isSuspended}
          onApprove={() => setApproveConfirm(true)}
          onReject={() => setRejectConfirm(true)}
          onSuspend={() => setSuspendConfirm(true)}
        />
      }
      badges={
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {!vehicle.isActive && <StatusBadge status="inactive" />}
        </div>
      }
      title={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
    >
      <SummaryCards reservations={reservations} reviews={reviews} vehicle={vehicle} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ImageGallery vehicle={vehicle} />
          <VehicleDetailsCard vehicle={vehicle} />
          <SpecificationsCard vehicle={vehicle} />
          <BookingSettingsCard vehicle={vehicle} />
          <ReservationsSection reservations={reservations} />
          <ReviewsSection reviews={reviews} />
        </div>

        <div className="space-y-6">
          <OwnerCard vehicle={vehicle} />
          <TrackLocationCard vehicle={vehicle} />
          <VehicleStatusCard vehicle={vehicle} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vehicle ID</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="break-all font-mono text-muted-foreground text-xs">{vehicle._id}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        confirmLabel={vehicle.isSuspended ? "Activate Vehicle" : "Suspend Vehicle"}
        description={
          vehicle.isSuspended
            ? "This will reactivate the vehicle listing, making it visible to renters again."
            : "This will suspend the vehicle listing, hiding it from renters. The owner will not be able to receive new bookings."
        }
        isLoading={isProcessing}
        onConfirm={handleSuspend}
        onOpenChange={setSuspendConfirm}
        open={suspendConfirm}
        title={vehicle.isSuspended ? "Activate Vehicle" : "Suspend Vehicle"}
        variant={vehicle.isSuspended ? "default" : "destructive"}
      />
      <ConfirmDialog
        confirmLabel="Approve Vehicle"
        description="This will approve the vehicle listing, making it visible to renters. Ensure the listing meets platform standards."
        isLoading={isProcessing}
        onConfirm={handleApprove}
        onOpenChange={setApproveConfirm}
        open={approveConfirm}
        title="Approve Vehicle"
      />
      <ConfirmDialog
        confirmLabel="Reject Vehicle"
        description="This will reject the vehicle listing. The owner will be notified and can resubmit after making changes."
        isLoading={isProcessing}
        onConfirm={handleReject}
        onOpenChange={setRejectConfirm}
        open={rejectConfirm}
        title="Reject Vehicle"
        variant="destructive"
      />
    </DetailPageLayout>
  )
}

function VehicleActions({
  isPending,
  isApproved,
  isSuspended,
  onApprove,
  onReject,
  onSuspend,
}: {
  isPending: boolean
  isApproved: boolean
  isSuspended?: boolean
  onApprove: () => void
  onReject: () => void
  onSuspend: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      {isPending && (
        <>
          <Button onClick={onApprove} size="sm">
            <CheckCircle className="mr-2 h-4 w-4" />
            Approve
          </Button>
          <Button onClick={onReject} size="sm" variant="destructive">
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
        </>
      )}
      {isApproved && (
        <Button onClick={onSuspend} size="sm" variant={isSuspended ? "default" : "destructive"}>
          {isSuspended ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Activate
            </>
          ) : (
            <>
              <Ban className="mr-2 h-4 w-4" />
              Suspend
            </>
          )}
        </Button>
      )}
    </div>
  )
}
