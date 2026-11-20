"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Dialog, DialogContent } from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import type { LucideIcon } from "lucide-react"
import { Car, Cog, Gauge, Heart, LogIn, MapPin, Star, UserPlus } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import type { ComponentProps } from "react"
import { useState } from "react"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"
import { r2Url } from "@/lib/r2-url"
import { formatRentalUsd } from "@/lib/rental-checkout"
import { vehicleRequestState } from "@/lib/vehicle-request-state"

interface VehicleCardProps extends ComponentProps<"div"> {
  id: string
  image: string
  imageKey?: string
  name: string
  year: number
  make: string
  model: string
  /** Daily rental rate in integer cents. */
  pricePerDay: number
  location?: string
  track?: string
  rating?: number
  reviews?: number
  horsepower?: number
  transmission?: string
  drivetrain?: string
  datesSelected?: boolean
  bookingCount?: number
  hostStripeReady?: boolean
  layout?: "grid" | "list"
}

export function VehicleCard({
  id,
  image,
  imageKey,
  name,
  year,
  make,
  model,
  pricePerDay,
  location,
  track,
  rating,
  reviews,
  horsepower,
  transmission,
  drivetrain,
  datesSelected: _datesSelected,
  bookingCount,
  hostStripeReady,
  layout = "grid",
  className,
  ...props
}: VehicleCardProps) {
  const { isSignedIn, user } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  const vehicleUrl =
    startDate && endDate
      ? `/vehicles/${id}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
      : `/vehicles/${id}`

  const isFavorite = useQuery(
    api.favorites.isVehicleFavorited,
    isSignedIn && id ? { vehicleId: id as Id<"vehicles"> } : "skip"
  )

  const toggleFavorite = useMutation(api.favorites.toggleFavorite)

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isSignedIn) {
      setShowLoginDialog(true)
      return
    }

    if (isFavorite === undefined) {
      return
    }

    if (!user?.id) {
      setShowLoginDialog(true)
      return
    }

    try {
      await toggleFavorite({ vehicleId: id as Id<"vehicles"> })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes("Not authenticated") || errorMessage.includes("authentication")) {
        setShowLoginDialog(true)
      } else {
        handleErrorWithContext(error, {
          action: "update favorites",
          customMessages: {
            generic: "Failed to update favorites. Please try again.",
          },
        })
      }
    }
  }

  const handleLogin = () => {
    setShowLoginDialog(false)
    router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`)
  }

  const requestState = vehicleRequestState(hostStripeReady)

  const weekendPrice = Math.round(pricePerDay * 2.5)

  // Performance spec strip (Turo-style icon + value units)
  const specs: { icon: LucideIcon; label: string }[] = []
  if (horsepower && horsepower > 0) specs.push({ icon: Gauge, label: `${horsepower} HP` })
  if (transmission) specs.push({ icon: Cog, label: transmission })
  if (drivetrain) specs.push({ icon: Car, label: drivetrain })

  // Shared image block (photo + gradients + badges + favorite)
  const mediaInner = (
    <>
      {imageKey || image ? (
        <Image
          alt={name}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          fill
          quality={80}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          src={imageKey ? r2Url(imageKey) : image}
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-muted">
          <Car className="size-16 text-muted-foreground/50" />
        </div>
      )}

      {/* Legibility gradients */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

      {/* Top Badges */}
      <div className="absolute top-3 right-14 left-3 z-10 flex flex-wrap gap-2">
        {track && (
          <Badge className="border border-white/15 bg-black/55 text-white text-xs backdrop-blur-md hover:bg-black/55">
            {track}
          </Badge>
        )}
        {hostStripeReady !== undefined && (
          <Badge className="border border-white/15 bg-black/55 text-white text-xs backdrop-blur-md hover:bg-black/55">
            {requestState.label}
          </Badge>
        )}
        {bookingCount !== undefined && bookingCount > 0 && (
          <Badge className="border border-white/15 bg-amber-600/90 text-white text-xs backdrop-blur-md hover:bg-amber-600/90">
            Booked {bookingCount}x
          </Badge>
        )}
      </div>

      {/* Favorite Button */}
      <Button
        className="absolute top-3 right-3 z-20 size-9 rounded-full border border-white/20 bg-black/30 backdrop-blur-md transition-colors hover:bg-black/50"
        onClick={handleFavoriteClick}
        size="icon"
        variant="ghost"
      >
        <Heart
          className={cn(
            "size-5 transition-all",
            isFavorite === true
              ? "scale-110 fill-red-500 text-red-500"
              : "text-white group-hover:text-red-400"
          )}
        />
      </Button>
    </>
  )

  // Shared rating element
  const ratingEl =
    rating !== undefined && rating > 0 ? (
      <div className="flex shrink-0 items-center gap-1 pt-0.5">
        <Star className="size-4 fill-amber-400 text-amber-400" />
        <span className="font-medium text-sm">{rating.toFixed(1)}</span>
        {reviews !== undefined && reviews > 0 && (
          <span className="text-muted-foreground text-xs">({reviews})</span>
        )}
      </div>
    ) : null

  // Shared spec items
  const specItems = specs.map((spec, i) => (
    <div
      className={cn("flex items-center gap-1.5", i > 0 && "border-border border-l pl-3")}
      key={spec.label}
    >
      <spec.icon className="size-4 shrink-0 text-primary/70" />
      <span className="font-medium text-foreground text-xs">{spec.label}</span>
    </div>
  ))

  const cardBody =
    layout === "list" ? (
      <Card
        className={cn(
          "group relative flex cursor-pointer flex-row overflow-hidden border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_16px_32px_-12px_rgba(0,0,0,0.3)]",
          className
        )}
        {...props}
      >
        <div className="relative w-32 shrink-0 overflow-hidden bg-muted sm:w-56 lg:w-64">
          {mediaInner}
        </div>
        <CardContent className="flex flex-1 flex-col justify-between gap-3 p-4 sm:p-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="line-clamp-1 font-semibold text-base tracking-tight transition-colors group-hover:text-primary sm:text-lg">
                {year} {make} {model}
              </h3>
              {ratingEl}
            </div>
            {location && (
              <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate text-sm">{location}</span>
              </div>
            )}
          </div>
          <div className="flex items-end justify-between gap-4 border-t pt-3">
            <div className="flex flex-wrap items-center gap-3">{specItems}</div>
            <div className="shrink-0 text-right">
              <div className="flex items-baseline justify-end gap-1">
                <span className="font-bold text-xl tracking-tight">
                  {formatRentalUsd(pricePerDay)}
                </span>
                <span className="text-muted-foreground text-sm">/day</span>
              </div>
              <p className="text-muted-foreground text-xs">
                Est. weekend {formatRentalUsd(weekendPrice)}
              </p>
              <p className="mt-2 font-medium text-primary text-sm">View details</p>
            </div>
          </div>
        </CardContent>
      </Card>
    ) : (
      <Card
        className={cn(
          "group relative flex h-full cursor-pointer flex-col overflow-hidden border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/50 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.35)]",
          className
        )}
        {...props}
      >
        {/* Racing-stripe accent — sweeps in on hover */}
        <div className="absolute top-0 right-0 left-0 z-20 h-1 origin-left scale-x-0 bg-gradient-to-r from-primary to-primary/40 transition-transform duration-300 group-hover:scale-x-100" />

        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
          {mediaInner}
          {/* Price Tag */}
          <div className="absolute right-3 bottom-3 left-3 z-20 flex items-end justify-between">
            <div className="flex items-baseline gap-1.5 rounded-lg border border-white/10 bg-black/55 px-3 py-2 backdrop-blur-md">
              <span className="font-bold text-lg text-white tracking-tight">
                {formatRentalUsd(pricePerDay)}
              </span>
              <span className="text-white/70 text-xs">/day</span>
              <span className="text-white/40 text-xs">
                · Est. weekend {formatRentalUsd(weekendPrice)}
              </span>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <CardContent className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 font-semibold text-base leading-snug tracking-tight transition-colors group-hover:text-primary sm:text-lg">
              {year} {make} {model}
            </h3>
            {ratingEl}
          </div>

          {location && (
            <div className="mt-2 flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate text-sm">{location}</span>
            </div>
          )}

          {specs.length > 0 && (
            <div className="mt-auto flex items-center gap-3 border-t pt-3.5">{specItems}</div>
          )}
          <p className="mt-3 font-medium text-primary text-sm">View details</p>
        </CardContent>
      </Card>
    )

  return (
    <>
      <Link className={cn("block", layout === "grid" && "h-full")} href={vehicleUrl}>
        {cardBody}
      </Link>

      {/* Login Dialog - Outside Link to fix nesting bug */}
      <Dialog onOpenChange={setShowLoginDialog} open={showLoginDialog}>
        <DialogContent className="border border-border bg-background p-0 sm:max-w-md">
          <Card className="border-0 shadow-none">
            <CardContent className="p-8">
              <div className="mb-6 text-center">
                <div className="mb-4 flex items-center justify-center gap-2">
                  <Car className="size-8 text-[#EF1C25]" />
                  <span className="font-bold text-2xl text-foreground">Renegade Rentals</span>
                </div>
                <h2 className="mb-2 font-bold text-2xl text-foreground">Sign In Required</h2>
                <p className="text-muted-foreground">
                  Please sign in to save your favorite vehicles and access them anytime.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full bg-[#EF1C25] text-white hover:bg-[#EF1C25]/90"
                  onClick={handleLogin}
                  size="lg"
                >
                  <LogIn className="mr-2 size-4" />
                  Sign In
                </Button>

                <Button
                  className="w-full border-border hover:bg-muted"
                  onClick={() => {
                    setShowLoginDialog(false)
                    router.push("/sign-up")
                  }}
                  size="lg"
                  variant="outline"
                >
                  <UserPlus className="mr-2 size-4" />
                  Create Account
                </Button>
              </div>

              <div className="mt-6 text-center">
                <p className="text-muted-foreground text-sm">
                  Join a community of racing enthusiasts
                </p>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  )
}
