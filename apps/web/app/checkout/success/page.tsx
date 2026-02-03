"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { useQuery } from "convex/react"
import { Calendar, CheckCircle2, Clock, MapPin } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { api } from "@/lib/convex"
import { formatDateForDisplay } from "@/lib/date-utils"

function CheckoutSuccessContent() {
  const searchParams = useSearchParams()
  const reservationId = searchParams.get("reservationId")

  const reservation = useQuery(
    api.reservations.getById,
    reservationId ? { id: reservationId as any } : "skip"
  )

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

  if (!reservation) {
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

  const vehicle = reservation.vehicle
  const primaryImage =
    (vehicle as any)?.images?.find((img: { isPrimary: boolean; cardUrl?: string }) => img.isPrimary)
      ?.cardUrl ||
    (vehicle as any)?.images?.[0]?.cardUrl ||
    ""

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
                    {(vehicle as any).location && (
                      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                        <MapPin className="size-4" />
                        <span>{(vehicle as any).location}</span>
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
                  <span className="font-medium">Total Amount</span>
                  <span className="font-bold text-2xl">
                    ${((reservation.totalAmount || 0) / 100).toLocaleString()}
                  </span>
                </div>
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
