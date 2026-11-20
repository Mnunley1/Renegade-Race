"use client"

import { api } from "@renegade/backend/convex/_generated/api"
import type { Id } from "@renegade/backend/convex/_generated/dataModel"
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
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import {
  AlertTriangle,
  Calendar,
  Car,
  ChevronRight,
  Clock,
  CreditCard,
  MapPin,
  XCircle,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type { ComponentProps } from "react"
import { useState } from "react"
import { toast } from "sonner"
import { RentalPaymentSummary, useRentalPayment } from "@/components/rental-payment-summary"
import { StatusBadge } from "@/components/status-badge"
import { formatDateForDisplay } from "@/lib/date-utils"
import { formatRentalUsd } from "@/lib/rental-checkout"

interface TripCardProps extends ComponentProps<"div"> {
  paymentStatus?: string
  paymentId?: string
  renterId?: string
  cancellationPolicy?: "flexible" | "moderate" | "strict"
  reservationId: string
  vehicleId: string
  vehicleName: string
  vehicleImage: string
  vehicleYear: number
  vehicleMake: string
  vehicleModel: string
  location: string
  startDate: string
  endDate: string
  pickupTime?: string
  dropoffTime?: string
  totalDays: number
  dailyRate: number
  totalAmount: number
  status: "pending" | "approved" | "confirmed" | "cancelled" | "completed" | "declined"
  addOns?: Array<{ name: string; price: number; description?: string }>
}

function formatDate(dateString: string): string {
  return formatDateForDisplay(dateString)
}

function formatTime(timeString?: string): string {
  if (!timeString) return ""
  const [hours, minutes] = timeString.split(":")
  const hour = Number.parseInt(hours ?? "0", 10)
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${minutes} ${period}`
}

// Presentation estimate only. Settlement and pending/prior refunds are checked
// authoritatively by the server when cancellation is processed.
function refundPercentage(startDate: string, policy: "flexible" | "moderate" | "strict") {
  const now = new Date()
  const start = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) return 0
  now.setHours(0, 0, 0, 0)
  start.setHours(0, 0, 0, 0)
  const days = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (policy === "flexible") return days >= 1 ? 100 : 50
  if (policy === "strict") return days >= 14 ? 100 : days >= 7 ? 50 : 0
  return days >= 7 ? 100 : days >= 2 ? 50 : 0
}

export function TripCard({
  paymentStatus,
  paymentId,
  renterId,
  cancellationPolicy = "moderate",
  reservationId,
  vehicleId,
  vehicleName,
  vehicleImage,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  location,
  startDate,
  endDate,
  pickupTime,
  dropoffTime,
  totalDays,
  dailyRate,
  totalAmount,
  status,
  addOns,
  className,
  ...props
}: TripCardProps) {
  const [isCancelling, setIsCancelling] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const cancelReservation = useMutation(api.reservations.cancel)

  // Query damage invoices for completed reservations
  const damageInvoices = useQuery(
    api.damageInvoices.getByReservation,
    status === "completed" ? { reservationId: reservationId as Id<"reservations"> } : "skip"
  )

  // Find the most relevant damage invoice to display
  const activeDamageInvoice = damageInvoices?.find(
    (inv: any) =>
      inv.status === "pending_review" || inv.status === "payment_pending" || inv.status === "paid"
  )

  const needsReview =
    status === "approved" && (paymentStatus === "paid" || paymentStatus === "partially_refunded")
  const canCancel =
    !needsReview && (status === "pending" || status === "approved" || status === "confirmed")
  const payment = useRentalPayment({ reservationId, paymentId, renterId })
  const refundablePayment =
    payment?.currency === "usd" &&
    ["succeeded", "partially_refunded", "refunded"].includes(payment.status)
      ? payment
      : null
  const refundEstimate = refundablePayment
    ? Math.max(
        0,
        Math.round(
          (refundablePayment.amount * refundPercentage(startDate, cancellationPolicy)) / 100
        ) - (refundablePayment.refundAmount ?? 0)
      )
    : null

  const handleCancel = async () => {
    if (!canCancel) return

    setIsCancelling(true)
    try {
      await cancelReservation({
        reservationId: reservationId as Id<"reservations">,
        cancellationReason: "Cancelled by renter",
      })
      toast.success("Reservation cancelled successfully")
      setIsDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel reservation")
    } finally {
      setIsCancelling(false)
    }
  }

  const vehicleUrl = `/vehicles/${vehicleId}`
  const isPastOrClosed = status === "completed" || status === "cancelled" || status === "declined"

  return (
    <Card
      className={cn(
        "group overflow-hidden border bg-card transition-all duration-300 hover:border-foreground/15 hover:shadow-[0_14px_32px_-16px_rgba(0,0,0,0.22)]",
        className
      )}
      {...props}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Vehicle Image */}
        <div className="relative h-44 w-full shrink-0 overflow-hidden bg-muted sm:h-auto sm:w-60 md:w-72">
          {vehicleImage ? (
            <Image
              alt={vehicleName}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              fill
              sizes="(max-width: 640px) 100vw, 288px"
              src={vehicleImage}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-muted">
              <Car className="size-14 text-muted-foreground/50" />
            </div>
          )}
          {/* Status Badge */}
          <div className="absolute top-3 left-3 z-10">
            {needsReview ? (
              <Badge>Needs review</Badge>
            ) : (
              <StatusBadge
                className="border border-white/15 bg-black/55 text-white backdrop-blur-md"
                status={status}
              />
            )}
          </div>
        </div>

        <CardContent className="flex flex-1 flex-col gap-3 p-5">
          {/* Title + price */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-lg tracking-tight transition-colors group-hover:text-primary">
                {vehicleYear} {vehicleMake} {vehicleModel}
              </h3>
              <div className="mt-1 flex items-center gap-1.5 text-muted-foreground text-sm">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-muted-foreground text-xs">Rental subtotal</div>
              <div className="font-bold text-foreground text-lg tracking-tight">
                {formatRentalUsd(totalAmount)}
              </div>
              <div className="text-muted-foreground text-xs">
                {formatRentalUsd(dailyRate)}/day · {totalDays}d
              </div>
            </div>
          </div>

          {/* Dates + times inline */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5 shrink-0 text-primary" />
              {formatDate(startDate)} – {formatDate(endDate)} · {totalDays}{" "}
              {totalDays === 1 ? "day" : "days"}
            </span>
            {(pickupTime || dropoffTime) && (
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 shrink-0 text-primary" />
                {pickupTime ? formatTime(pickupTime) : "—"}
                {dropoffTime ? ` – ${formatTime(dropoffTime)}` : ""}
              </span>
            )}
          </div>

          {/* Add-ons as quiet chips */}
          {addOns && addOns.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {addOns.slice(0, 3).map((addOn, index) => (
                <Badge
                  className="border-transparent bg-muted font-normal text-muted-foreground"
                  key={index}
                  variant="secondary"
                >
                  {addOn.name}
                </Badge>
              ))}
              {addOns.length > 3 && (
                <Badge
                  className="border-transparent bg-muted font-normal text-muted-foreground"
                  variant="secondary"
                >
                  +{addOns.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Damage invoice status (completed only) */}
          {status === "completed" && activeDamageInvoice && (
            <div className="rounded-lg border p-3">
              {activeDamageInvoice.status === "pending_review" && (
                <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span className="font-medium">Damage claim filed</span>
                  <span className="ml-auto text-muted-foreground">
                    {formatRentalUsd(activeDamageInvoice.amount)}
                  </span>
                </div>
              )}
              {activeDamageInvoice.status === "payment_pending" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-orange-700 text-sm dark:text-orange-400">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span className="font-medium">Damage payment required</span>
                    <span className="ml-auto font-bold">
                      {formatRentalUsd(activeDamageInvoice.amount)}
                    </span>
                  </div>
                  {activeDamageInvoice.stripeCheckoutUrl && (
                    <Button asChild className="w-full" size="sm" variant="destructive">
                      <a href={activeDamageInvoice.stripeCheckoutUrl}>
                        <CreditCard className="mr-2 size-4" />
                        Pay now
                      </a>
                    </Button>
                  )}
                </div>
              )}
              {activeDamageInvoice.status === "paid" && (
                <div className="flex items-center gap-2 text-green-700 text-sm dark:text-green-400">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span className="font-medium">Damage charge paid</span>
                  <span className="ml-auto text-muted-foreground">
                    {formatRentalUsd(activeDamageInvoice.amount)}
                  </span>
                </div>
              )}
            </div>
          )}

          <RentalPaymentSummary
            paymentId={paymentId}
            renterId={renterId}
            reservationId={reservationId}
          />

          {needsReview && (
            <p className="text-sm">
              Payment received; booking needs review. Contact support to resolve the booking. Do not
              submit another payment.
            </p>
          )}

          {/* Actions */}
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-4">
            {needsReview && (
              <Button asChild size="sm">
                <Link href="/contact">Contact Support</Link>
              </Button>
            )}
            {status === "approved" && !needsReview && (
              <Button asChild size="sm">
                <Link href={`/checkout/pay?reservationId=${reservationId}`}>
                  <CreditCard className="mr-2 size-4" />
                  Pay now
                </Link>
              </Button>
            )}
            {status === "completed" && (
              <Button asChild size="sm">
                <Link href={`/trips/review/${reservationId}`}>Write a review</Link>
              </Button>
            )}
            {status === "confirmed" && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/trips/return/${reservationId}`}>Return vehicle</Link>
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <Link href={vehicleUrl}>
                {isPastOrClosed ? "Book again" : "View details"}
                <ChevronRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            {status === "completed" && (
              <Button asChild className="text-muted-foreground" size="sm" variant="ghost">
                <Link href={`/trips/dispute/${reservationId}`}>File dispute</Link>
              </Button>
            )}

            {/* Cancel — quiet, with refund-aware confirmation */}
            {canCancel && (
              <AlertDialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    className="ml-auto text-destructive hover:text-destructive"
                    size="sm"
                    variant="ghost"
                  >
                    <XCircle className="mr-1.5 size-4" />
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Reservation?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-4">
                        <p>
                          Are you sure you want to cancel your reservation for{" "}
                          <span className="font-medium text-foreground">
                            {vehicleYear} {vehicleMake} {vehicleModel}
                          </span>
                          ?
                        </p>

                        {status === "confirmed" && (
                          <div className="rounded-lg border bg-muted/50 p-4">
                            <div className="font-medium text-foreground text-sm">
                              Estimated rental refund
                            </div>
                            <p className="mt-2 text-sm">
                              {refundEstimate === null
                                ? "Refund estimate unavailable."
                                : formatRentalUsd(refundEstimate)}
                            </p>
                            <p className="mt-1 text-muted-foreground text-xs">
                              Based on the {cancellationPolicy} cancellation policy and paid rental
                              subtotal. Card processing fees are excluded. Prior refunds reduce this
                              estimate; the final refund is confirmed after cancellation and
                              settlement.
                            </p>
                          </div>
                        )}

                        <p className="text-muted-foreground text-xs">
                          This action cannot be undone.
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isCancelling}>Keep Reservation</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isCancelling}
                      onClick={handleCancel}
                    >
                      {isCancelling ? "Cancelling..." : "Yes, Cancel Reservation"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  )
}
