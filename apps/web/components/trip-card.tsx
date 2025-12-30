"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { Calendar, Car, ChevronRight, Clock, MapPin } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type { ComponentProps } from "react"

interface TripCardProps extends ComponentProps<"div"> {
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
  status: "pending" | "confirmed" | "cancelled" | "completed" | "declined"
  addOns?: Array<{ name: string; price: number; description?: string }>
}

const statusConfig = {
  pending: {
    label: "Pending",
    variant: "outline" as const,
    className: "border-yellow-500 text-yellow-700 dark:text-yellow-500",
  },
  confirmed: {
    label: "Confirmed",
    variant: "default" as const,
    className: "border-green-500 text-green-700 dark:text-green-500",
  },
  cancelled: { label: "Cancelled", variant: "destructive" as const, className: "" },
  completed: {
    label: "Completed",
    variant: "secondary" as const,
    className: "border-gray-500 text-gray-700 dark:text-gray-400",
  },
  declined: { label: "Declined", variant: "destructive" as const, className: "" },
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00")
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(timeString?: string): string {
  if (!timeString) return ""
  const [hours, minutes] = timeString.split(":")
  const hour = Number.parseInt(hours, 10)
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${minutes} ${period}`
}

export function TripCard({
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
  const statusInfo = statusConfig[status]

  return (
    <Card
      className={cn(
        "group relative flex h-full flex-col overflow-hidden border-2 transition-all duration-300 hover:border-primary/50 hover:shadow-xl md:flex-row",
        className
      )}
      {...props}
    >
      {/* Vehicle Image */}
      <div className="relative h-48 w-full shrink-0 overflow-hidden bg-muted md:h-auto md:w-2/5 lg:w-2/5">
        {vehicleImage ? (
          <Image
            alt={vehicleName}
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            fill
            sizes="(max-width: 768px) 100vw, 40vw"
            src={vehicleImage}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted">
            <Car className="size-16 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100 md:bg-gradient-to-r md:from-black/80 md:via-black/40 md:to-transparent" />

        {/* Status Badge */}
        <div className="absolute top-3 left-3 z-10">
          <Badge
            className={cn("bg-background/90 backdrop-blur-sm", statusInfo.className)}
            variant={statusInfo.variant}
          >
            {statusInfo.label}
          </Badge>
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col p-6 md:p-6">
        <div className="flex flex-1 flex-col space-y-4">
          {/* Vehicle Name */}
          <div>
            <h3 className="font-bold text-xl transition-colors group-hover:text-primary">
              {vehicleYear} {vehicleMake} {vehicleModel}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-muted-foreground text-sm">
              <MapPin className="size-3" />
              <span>{location}</span>
            </div>
          </div>

          {/* Trip Dates */}
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="flex-1">
                <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Trip Dates
                </div>
                <div className="mt-1 font-semibold">
                  {formatDate(startDate)} - {formatDate(endDate)}
                </div>
                <div className="mt-1 text-muted-foreground text-sm">
                  {totalDays} {totalDays === 1 ? "day" : "days"}
                </div>
              </div>
            </div>

            {(pickupTime || dropoffTime) && (
              <div className="flex items-start gap-3 border-t pt-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="flex-1 space-y-1">
                  {pickupTime && (
                    <div className="text-sm">
                      <span className="font-medium">Pickup:</span>{" "}
                      <span className="text-muted-foreground">{formatTime(pickupTime)}</span>
                    </div>
                  )}
                  {dropoffTime && (
                    <div className="text-sm">
                      <span className="font-medium">Dropoff:</span>{" "}
                      <span className="text-muted-foreground">{formatTime(dropoffTime)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Add-ons */}
          {addOns && addOns.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Add-ons
              </div>
              <div className="space-y-1">
                {addOns.map((addOn, index) => (
                  <div className="flex items-center justify-between text-sm" key={index}>
                    <span>{addOn.name}</span>
                    <span className="font-medium">${addOn.price}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing */}
          <div className="mt-auto flex items-center justify-between border-t pt-4">
            <div>
              <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Total Amount
              </div>
              <div className="flex items-baseline gap-1">
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text font-bold text-2xl text-transparent">
                  ${totalAmount.toLocaleString()}
                </span>
              </div>
              <div className="mt-1 text-muted-foreground text-xs">
                ${dailyRate.toLocaleString()}/day
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button asChild className="w-full" onClick={(e) => e.stopPropagation()}>
              <Link href={`/vehicles/${vehicleId}`}>
                <Car className="mr-2 size-4" />
                View Vehicle Details
                <ChevronRight className="ml-2 size-4" />
              </Link>
            </Button>
            {status === "confirmed" && (
              <Button
                asChild
                className="w-full"
                onClick={(e) => e.stopPropagation()}
                variant="outline"
              >
                <Link href={`/trips/return/${reservationId}`}>Return Vehicle</Link>
              </Button>
            )}
            {status === "completed" && (
              <div className="flex gap-2">
                <Button
                  asChild
                  className="flex-1"
                  onClick={(e) => e.stopPropagation()}
                  size="sm"
                  variant="outline"
                >
                  <Link href={`/trips/review/${reservationId}`}>Write Review</Link>
                </Button>
                <Button
                  asChild
                  className="flex-1"
                  onClick={(e) => e.stopPropagation()}
                  size="sm"
                  variant="outline"
                >
                  <Link href={`/trips/dispute/${reservationId}`}>File Dispute</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
