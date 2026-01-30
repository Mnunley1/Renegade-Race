"use client"

import { useUser } from "@clerk/nextjs"
import { Image, ImageKitProvider } from "@imagekit/next"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Dialog, DialogContent } from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { Car, Gauge, Heart, LogIn, MapPin, Star, UserPlus } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import type { ComponentProps } from "react"
import { useState } from "react"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

interface VehicleCardProps extends ComponentProps<"div"> {
  id: string
  image: string
  imageKey?: string
  name: string
  year: number
  make: string
  model: string
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
  datesSelected,
  bookingCount,
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
    isSignedIn && id ? { vehicleId: id as any } : "skip"
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
      await toggleFavorite({ vehicleId: id as any })
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

  const weekendPrice = Math.round(pricePerDay * 2.5)

  return (
    <>
      <Link className="block h-full" href={vehicleUrl}>
        <Card
          className={cn(
            "group relative flex h-full cursor-pointer flex-col overflow-hidden border border-border bg-card transition-colors duration-200 hover:border-primary/40",
            className
          )}
          {...props}
        >
          {/* Image Section */}
          <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
            {imageKey || image ? (
              <ImageKitProvider
                urlEndpoint={
                  process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ||
                  "https://ik.imagekit.io/renegaderace"
                }
              >
                <Image
                  alt={name}
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  src={imageKey ? `/${imageKey}` : image}
                  transformation={imageKey ? [{ width: 600, height: 400, quality: 80 }] : undefined}
                />
              </ImageKitProvider>
            ) : (
              <div className="flex h-full items-center justify-center bg-muted">
                <Car className="size-16 text-muted-foreground/50" />
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 bg-black/20" />

            {/* Top Badges */}
            <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
              {track && (
                <Badge className="border-0 bg-black/70 text-white text-xs hover:bg-black/70">
                  {track}
                </Badge>
              )}
              {horsepower && horsepower > 0 && (
                <Badge
                  className="border-0 bg-primary/90 text-primary-foreground text-xs hover:bg-primary/90"
                  variant="secondary"
                >
                  <Gauge className="mr-1 size-3" />
                  {horsepower} HP
                </Badge>
              )}
              {datesSelected && (
                <Badge className="border-0 bg-green-600 text-white text-xs hover:bg-green-600">
                  Available
                </Badge>
              )}
              {bookingCount !== undefined && bookingCount > 0 && (
                <Badge className="border-0 bg-amber-600/90 text-white text-xs hover:bg-amber-600/90">
                  Booked {bookingCount}x
                </Badge>
              )}
            </div>

            {/* Favorite Button */}
            <Button
              className="absolute top-3 right-3 z-10 size-9 rounded-full bg-white/90 transition-colors hover:bg-white"
              onClick={handleFavoriteClick}
              size="icon"
              variant="ghost"
            >
              <Heart
                className={cn(
                  "size-5 transition-all",
                  isFavorite === true
                    ? "scale-110 fill-red-500 text-red-500"
                    : "text-gray-600 group-hover:text-red-500"
                )}
              />
            </Button>

            {/* Price Tag */}
            <div className="absolute bottom-3 left-3 z-10">
              <div className="flex items-baseline gap-1 rounded-md bg-white/95 px-3 py-1.5">
                <span className="font-bold text-gray-900 text-lg">${pricePerDay}</span>
                <span className="text-gray-600 text-xs">/day</span>
                <span className="ml-1 text-gray-400 text-xs">· ${weekendPrice}/wknd</span>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <CardContent className="flex flex-1 flex-col p-4">
            <h3 className="mb-2 line-clamp-2 font-semibold text-base leading-snug tracking-tight sm:text-lg">
              {year} {make} {model}
            </h3>

            <div className="mt-auto flex items-center justify-between gap-2">
              {location && (
                <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="truncate text-sm">{location}</span>
                </div>
              )}

              {rating !== undefined && rating > 0 && (
                <div className="flex shrink-0 items-center gap-1">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <span className="font-medium text-sm">{rating.toFixed(1)}</span>
                  {reviews !== undefined && reviews > 0 && (
                    <span className="text-muted-foreground text-xs">({reviews})</span>
                  )}
                </div>
              )}
            </div>

            {(transmission || drivetrain) && (
              <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                {transmission && (
                  <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground text-xs">
                    {transmission}
                  </span>
                )}
                {drivetrain && (
                  <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground text-xs">
                    {drivetrain}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
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
                  Join thousands of racing enthusiasts
                </p>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  )
}
