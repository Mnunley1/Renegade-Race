"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { useQuery } from "convex/react"
import { Calendar, CheckCircle2, Clock, MapPin } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Image from "@/components/public-image"
import { RentalPaymentSummary } from "@/components/rental-payment-summary"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { formatDateForDisplay } from "@/lib/date-utils"
import { r2Url } from "@/lib/r2-url"
import { formatRentalUsd } from "@/lib/rental-checkout"

function CoachingSuccessCard({ bookingId }: { bookingId: Id<"coachingBookings"> }) {
  const booking = useQuery(api.coachingBookings.getById, { id: bookingId })

  if (!booking) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading booking details...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const sessionLabel =
    booking.sessionType === "hourly"
      ? `${booking.hours}-hour session`
      : booking.sessionType === "half_day"
        ? "Half-day session"
        : "Full-day session"

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardContent className="py-12">
          <div className="mx-auto max-w-xl text-center">
            <CheckCircle2 className="mx-auto mb-4 size-16 text-green-500" />
            <h1 className="mb-2 font-bold text-4xl">Session Confirmed!</h1>
            <p className="mb-8 text-lg text-muted-foreground">
              Your payment went through. {booking.coach?.name || "Your coach"} has been notified.
            </p>

            <div className="mb-8 rounded-lg border bg-muted/50 p-6 text-left">
              <div className="mb-4 flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <span className="font-medium">
                  {new Date(`${booking.startDate}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {booking.startTime ? ` · ${booking.startTime}` : ""}
                </span>
              </div>
              <div className="mb-4 flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <span>{sessionLabel}</span>
              </div>
              {booking.eventName && (
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" />
                  <span>{booking.eventName}</span>
                </div>
              )}
              <Separator className="my-4" />
              <div className="flex justify-between font-semibold">
                <span>Total paid</span>
                <span>{formatRentalUsd(booking.totalAmount)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild>
                <Link href="/trips">View my trips</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/coaches/${booking.coachProfileId}`}>Back to coach</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function rentalPaymentNotice(reservation: { status: string; paymentStatus?: string } | null): {
  title: string
  message: string
  canRetry?: boolean
  needsReview?: boolean
} {
  if (!reservation) {
    return {
      title: "Reservation unavailable",
      message: "We could not find this reservation. Check your trips for its current status.",
    }
  }
  if (reservation.paymentStatus === "refunded") {
    return {
      title: "Payment refunded",
      message:
        "This payment has been refunded. Check your trips for the reservation's current status.",
    }
  }
  if (
    reservation.status === "approved" &&
    (reservation.paymentStatus === "paid" || reservation.paymentStatus === "partially_refunded")
  ) {
    return {
      title: "Payment received; booking needs review",
      message:
        "Your payment was received, but your booking could not be confirmed. Contact support to resolve the booking. Do not submit another payment.",
      needsReview: true,
    }
  }
  if (reservation.status === "pending") {
    return {
      title: "Awaiting host approval",
      message: "Your host must approve this request before you can pay.",
    }
  }
  if (reservation.status === "approved" && reservation.paymentStatus === "failed") {
    return {
      title: "Payment failed",
      message:
        "Your payment did not complete. Your reservation is not confirmed. You can try again.",
      canRetry: true,
    }
  }
  if (reservation.status === "approved" || reservation.status === "confirmed") {
    return {
      title: "Awaiting payment confirmation",
      message:
        "Your reservation is not confirmed yet. This page will update when payment confirmation arrives. Check your trips before trying another payment.",
    }
  }
  return {
    title: "Reservation not confirmed",
    message:
      "This reservation is no longer awaiting payment. Check your trips for its current status.",
  }
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams()
  const reservationId = searchParams.get("reservationId")
  const coachingBookingId = searchParams.get("coachingBookingId")

  const reservation = useQuery(
    api.reservations.getById,
    reservationId ? { id: reservationId as Id<"reservations"> } : "skip"
  )

  if (coachingBookingId) {
    return <CoachingSuccessCard bookingId={coachingBookingId as Id<"coachingBookings">} />
  }

  if (!reservationId) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="mb-2 font-bold text-2xl">Invalid Reservation</h2>
            <p className="mb-6 text-muted-foreground">Reservation ID is missing</p>
            <Button asChild>
              <Link href="/vehicles">Browse Vehicles</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (reservation === undefined) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading reservation details...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (
    !reservation ||
    reservation.status !== "confirmed" ||
    (reservation.paymentStatus !== "paid" && reservation.paymentStatus !== "partially_refunded")
  ) {
    const { title, message, canRetry, needsReview } = rentalPaymentNotice(reservation)

    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent aria-live="polite" className="py-12 text-center">
            <h1 className="mb-2 font-bold text-2xl">{title}</h1>
            <p className="mb-6 text-muted-foreground">{message}</p>
            {reservation && (
              <div className="mx-auto mb-6 max-w-md text-left">
                <RentalPaymentSummary
                  paymentId={reservation.paymentId}
                  renterId={reservation.renterId}
                  reservationId={reservation._id}
                />
              </div>
            )}
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              {needsReview && (
                <Button asChild>
                  <Link href="/contact">Contact Support</Link>
                </Button>
              )}
              {canRetry && (
                <Button asChild>
                  <Link href={`/checkout/pay?reservationId=${reservationId}`}>
                    Try Payment Again
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/trips">View My Trips</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const vehicle = reservation.vehicle
  const vehicleImages = (vehicle as any)?.images as
    | Array<{ isPrimary: boolean; imageUrl?: string; r2Key?: string }>
    | undefined
  const primaryImageData = vehicleImages?.find((img) => img.isPrimary) || vehicleImages?.[0]
  const primaryImage = (r2Url(primaryImageData?.r2Key) ?? primaryImageData?.imageUrl) || ""

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Card>
        <CardContent className="py-12">
          <div className="mx-auto max-w-2xl text-center">
            <CheckCircle2 className="mx-auto mb-4 size-16 text-green-500" />
            <h1 className="mb-2 font-bold text-4xl">Reservation Confirmed!</h1>
            <p className="mb-8 text-lg text-muted-foreground">
              Your payment has been processed successfully. Your reservation details are below.
            </p>

            <div className="mb-8 rounded-lg border bg-muted/50 p-6 text-left">
              {vehicle && (
                <div className="mb-6 flex gap-4">
                  {primaryImage && primaryImage.trim() !== "" ? (
                    <div className="relative h-32 w-48 shrink-0 overflow-hidden rounded-lg">
                      <Image
                        alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                        className="object-cover"
                        fill
                        sizes="192px"
                        src={primaryImage}
                      />
                    </div>
                  ) : null}
                  <div className="flex-1">
                    <h2 className="mb-2 font-bold text-2xl">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h2>
                    {vehicle.address && (
                      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                        <MapPin className="size-4" />
                        <span>
                          {vehicle.address.street}, {vehicle.address.city}, {vehicle.address.state}{" "}
                          {vehicle.address.zipCode}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator className="mb-6" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-5 text-muted-foreground" />
                    <span className="font-medium">Rental Period</span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatDateForDisplay(reservation.startDate)} -{" "}
                      {formatDateForDisplay(reservation.endDate)}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {reservation.totalDays} {reservation.totalDays === 1 ? "day" : "days"}
                    </p>
                  </div>
                </div>

                {reservation.pickupTime && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="size-5 text-muted-foreground" />
                      <span className="font-medium">Pickup Time</span>
                    </div>
                    <span>{reservation.pickupTime}</span>
                  </div>
                )}

                {reservation.dropoffTime && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="size-5 text-muted-foreground" />
                      <span className="font-medium">Dropoff Time</span>
                    </div>
                    <span>{reservation.dropoffTime}</span>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="font-medium">Rental subtotal</span>
                  <span className="font-bold text-2xl">
                    {formatRentalUsd(reservation.totalAmount || 0)}
                  </span>
                </div>
                <RentalPaymentSummary
                  paymentId={reservation.paymentId}
                  renterId={reservation.renterId}
                  reservationId={reservation._id}
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link href="/trips">View My Trips</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/vehicles">Browse More Vehicles</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  )
}
