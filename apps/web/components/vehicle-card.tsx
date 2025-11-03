"use client"

import { Card, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ComponentProps } from "react"
import { MapPin, Star, Heart, Zap, Gauge, Car, LogIn, UserPlus } from "lucide-react"
import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { useUser } from "@clerk/nextjs"
import { api } from "@/lib/convex"

interface VehicleCardProps extends ComponentProps<"div"> {
  id: string
  image: string
  name: string
  year: number
  make: string
  model: string
  pricePerDay: number
  location: string
  track?: string
  rating?: number
  reviews?: number
  horsepower?: number
  transmission?: string
  drivetrain?: string
}

export function VehicleCard({
  id,
  image,
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
  className,
  ...props
}: VehicleCardProps) {
  const { isSignedIn, user } = useUser()
  const router = useRouter()
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  // Check if vehicle is favorited
  const isFavorite = useQuery(
    api.favorites.isVehicleFavorited,
    isSignedIn && id ? { vehicleId: id as any } : "skip"
  )

  // Toggle favorite mutation
  const toggleFavorite = useMutation(api.favorites.toggleFavorite)

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // If not signed in, show login dialog
    if (!isSignedIn) {
      setShowLoginDialog(true)
      return
    }

    // If vehicle is not loaded yet, wait
    if (isFavorite === undefined) {
      return
    }

    // Don't proceed if we're not sure about auth state
    if (!user?.id) {
      setShowLoginDialog(true)
      return
    }

    try {
      await toggleFavorite({ vehicleId: id as any })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to toggle favorite"
      console.error("Error toggling favorite:", error)
      
      // If authentication error, show login dialog
      if (errorMessage.includes("Not authenticated") || errorMessage.includes("authentication")) {
        setShowLoginDialog(true)
      }
    }
  }

  const handleLogin = () => {
    setShowLoginDialog(false)
    router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`)
  }

  return (
    <Link href={`/vehicles/${id}`} className="block h-full">
      <Card
        className={cn(
          "group relative flex h-full flex-col overflow-hidden border-2 transition-all duration-300 hover:scale-[1.02] hover:border-primary/50 hover:shadow-xl cursor-pointer",
          className
        )}
        {...props}
      >
        <div className="relative h-64 w-full shrink-0 overflow-hidden bg-muted">
          <Image
            alt={name}
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            src={image}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

          {/* Favorite Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 z-10 bg-white/90 backdrop-blur-sm hover:bg-white"
            onClick={handleFavoriteClick}
          >
            <Heart
              className={cn(
                "size-5 transition-colors",
                isFavorite === true ? "fill-red-500 text-red-500" : "text-muted-foreground"
              )}
            />
          </Button>

          {/* Quick Specs on Hover */}
          {(horsepower || transmission) && (
            <div className="absolute bottom-0 left-0 right-0 z-10 translate-y-full bg-black/80 p-4 text-white transition-transform group-hover:translate-y-0">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {horsepower && (
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-primary" />
                    <span className="font-semibold">{horsepower} HP</span>
                  </div>
                )}
                {transmission && (
                  <div className="flex items-center gap-2">
                    <Gauge className="size-4 text-primary" />
                    <span>{transmission}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col p-6">
          <div className="flex flex-1 flex-col space-y-3">
            <div>
              <h3 className="font-bold text-xl transition-colors group-hover:text-primary">
                {year} {make} {model}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-3" />
                <span>{location}</span>
              </div>
              <div className="mt-2 min-h-[20px]">
                {rating && (
                  <div className="flex items-center gap-1">
                    <Star className="size-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-semibold">{rating}</span>
                    {reviews && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({reviews} review{reviews !== 1 ? "s" : ""})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-auto flex items-center justify-between border-t pt-3">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-3xl font-bold text-transparent">
                    ${pricePerDay}
                  </span>
                  <span className="text-sm text-muted-foreground">/day</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Login Dialog */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur p-0">
          <Card className="border-0 shadow-none">
            <CardContent className="p-8">
              {/* Header */}
              <div className="mb-6 text-center">
                <div className="mb-4 flex items-center justify-center gap-2">
                  <Car className="size-8 text-[#EF1C25]" />
                  <span className="text-2xl font-bold text-foreground">Renegade Rentals</span>
                </div>
                <h2 className="mb-2 text-2xl font-bold text-foreground">Sign In Required</h2>
                <p className="text-muted-foreground">
                  Please sign in to save your favorite vehicles and access them anytime.
                </p>
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleLogin}
                  className="w-full bg-[#EF1C25] hover:bg-[#EF1C25]/90 text-white"
                  size="lg"
                >
                  <LogIn className="mr-2 size-4" />
                  Sign In
                </Button>

                <Button
                  onClick={() => {
                    setShowLoginDialog(false)
                    router.push("/sign-up")
                  }}
                  variant="outline"
                  className="w-full border-border hover:bg-muted"
                  size="lg"
                >
                  <UserPlus className="mr-2 size-4" />
                  Create Account
                </Button>
              </div>

              {/* Additional info */}
              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Join thousands of racing enthusiasts
                </p>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </Link>
  )
}
