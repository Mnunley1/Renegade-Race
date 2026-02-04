"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { useMutation, useQuery } from "convex/react"
import { ArrowLeft, Calendar, Car, DollarSign, Loader2, User, XCircle } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

export default function ReservationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const reservationId = params.id as Id<"reservations">
  const reservation = useQuery(api.reservations.getById, { id: reservationId })
  const cancelReservation = useMutation(api.admin.cancelReservationAsAdmin)
  const [isCancelling, setIsCancelling] = useState(false)

  const handleCancel = async () => {
    if (
      !confirm("Are you sure you want to cancel this reservation? This action cannot be undone.")
    ) {
      return
    }

    setIsCancelling(true)
    try {
      await cancelReservation({ reservationId })
      toast.success("Reservation cancelled successfully")
      router.push("/reservations")
    } catch (error) {
      handleErrorWithContext(error, { action: "cancel reservation", entity: "reservation" })
    } finally {
      setIsCancelling(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="default">Pending</Badge>
      case "confirmed":
        return (
          <Badge className="bg-green-600" variant="default">
            Confirmed
          </Badge>
        )
      case "completed":
        return <Badge variant="secondary">Completed</Badge>
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>
      case "declined":
        return <Badge variant="destructive">Declined</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount / 100)

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })

  if (reservation === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading reservation...</div>
      </div>
    )
  }

  if (reservation === null) {
    return (
      <div className="space-y-6">
        <Link href="/reservations">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 size-4" />
            Back to Reservations
          </Button>
        </Link>
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Reservation not found
          </CardContent>
        </Card>
      </div>
    )
  }

  const canCancel = reservation.status !== "cancelled" && reservation.status !== "completed"
  const vehicleWithImages = reservation.vehicle as
    | (typeof reservation.vehicle & {
        images?: Array<{ isPrimary: boolean; cardUrl?: string; imageUrl?: string }>
        track?: { name: string }
      })
    | null
  const primaryImage =
    vehicleWithImages?.images?.find((img) => img.isPrimary) || vehicleWithImages?.images?.[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/reservations">
            <Button className="mb-4" variant="ghost">
              <ArrowLeft className="mr-2 size-4" />
              Back to Reservations
            </Button>
          </Link>
          <h1 className="font-bold text-3xl">Reservation Details</h1>
          <p className="mt-2 text-muted-foreground">Reservation ID: {reservation._id}</p>
        </div>
        <div className="flex items-center gap-4">
          {getStatusBadge(reservation.status)}
          {canCancel && (
            <Button disabled={isCancelling} onClick={handleCancel} variant="destructive">
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 size-4" />
                  Cancel Reservation
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Vehicle Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Car className="size-5" />
              <CardTitle>Vehicle Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {primaryImage && (
              <img
                alt={`${reservation.vehicle?.make} ${reservation.vehicle?.model}`}
                className="h-48 w-full rounded-lg object-cover"
                src={primaryImage.cardUrl || primaryImage.imageUrl}
              />
            )}
            <div>
              <p className="font-semibold text-lg">
                {reservation.vehicle?.year} {reservation.vehicle?.make} {reservation.vehicle?.model}
              </p>
              {vehicleWithImages?.track && (
                <p className="text-muted-foreground text-sm">
                  Track: {vehicleWithImages.track.name}
                </p>
              )}
            </div>
            {reservation.vehicle?.description && (
              <p className="text-muted-foreground text-sm">{reservation.vehicle.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Reservation Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="size-5" />
              <CardTitle>Reservation Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-muted-foreground text-sm">Status</p>
              <div className="mt-1">{getStatusBadge(reservation.status)}</div>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Start Date</p>
              <p className="font-medium">{formatDate(reservation.startDate)}</p>
              {reservation.pickupTime && (
                <p className="text-muted-foreground text-sm">
                  Pickup Time: {reservation.pickupTime}
                </p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-sm">End Date</p>
              <p className="font-medium">{formatDate(reservation.endDate)}</p>
              {reservation.dropoffTime && (
                <p className="text-muted-foreground text-sm">
                  Dropoff Time: {reservation.dropoffTime}
                </p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Duration</p>
              <p className="font-medium">{reservation.totalDays} day(s)</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Created</p>
              <p className="font-medium">{new Date(reservation.createdAt).toLocaleString()}</p>
            </div>
            {reservation.updatedAt && (
              <div>
                <p className="text-muted-foreground text-sm">Last Updated</p>
                <p className="font-medium">{new Date(reservation.updatedAt).toLocaleString()}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Renter Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-5" />
              <CardTitle>Renter Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium">{reservation.renter?.name || "Unknown"}</p>
              <p className="text-muted-foreground text-sm">{reservation.renter?.email || "N/A"}</p>
              {reservation.renter?.phone && (
                <p className="text-muted-foreground text-sm">Phone: {reservation.renter.phone}</p>
              )}
            </div>
            {reservation.renter?.rating && (
              <div>
                <p className="text-muted-foreground text-sm">Rating</p>
                <p className="font-medium">{reservation.renter.rating}/5</p>
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
              <p className="font-medium">{reservation.owner?.name || "Unknown"}</p>
              <p className="text-muted-foreground text-sm">{reservation.owner?.email || "N/A"}</p>
              {reservation.owner?.phone && (
                <p className="text-muted-foreground text-sm">Phone: {reservation.owner.phone}</p>
              )}
            </div>
            {reservation.owner?.rating && (
              <div>
                <p className="text-muted-foreground text-sm">Rating</p>
                <p className="font-medium">{reservation.owner.rating}/5</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="size-5" />
            <CardTitle>Payment Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-sm">Daily Rate</p>
              <p className="font-semibold text-lg">{formatCurrency(reservation.dailyRate)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Total Days</p>
              <p className="font-semibold text-lg">{reservation.totalDays}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Total Amount</p>
              <p className="font-semibold text-lg">{formatCurrency(reservation.totalAmount)}</p>
            </div>
          </div>

          {reservation.addOns && reservation.addOns.length > 0 && (
            <div>
              <p className="mb-2 text-muted-foreground text-sm">Add-ons</p>
              <div className="space-y-2">
                {reservation.addOns.map((addon: any, index: number) => (
                  <div
                    className="flex items-center justify-between rounded-lg border p-3"
                    key={index}
                  >
                    <div>
                      <p className="font-medium">{addon.name}</p>
                      {addon.description && (
                        <p className="text-muted-foreground text-sm">{addon.description}</p>
                      )}
                    </div>
                    <p className="font-semibold">{formatCurrency(addon.price)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
