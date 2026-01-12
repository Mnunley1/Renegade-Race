"use client"

import { useUser } from "@clerk/nextjs"
import { Image } from "@imagekit/next"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Dialog, DialogContent } from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { Car, Heart, LogIn, MapPin, UserPlus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ComponentProps } from "react"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

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
  raceCarClass?: string
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
  raceCarClass,
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
      // If authentication error, show login dialog
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

  return (
    <Link className="block h-full" href={`/vehicles/${id}`}>
      <Card
        className={cn(
          "group relative flex h-full cursor-pointer flex-col overflow-hidden border-2 transition-all duration-300 hover:shadow-xl",
          className
        )}
        {...props}
      >
        <div className="relative h-64 w-full shrink-0 overflow-hidden bg-muted">
          {image ? (
            <Image
              alt={name}
              className="object-cover"
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              src={image}
              urlEndpoint="https://ik.imagekit.io/renegaderace"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-muted">
              <Car className="size-16 text-muted-foreground" />
            </div>
          )}

          {/* Favorite Button */}
          <Button
            className="!bg-white/90 absolute top-3 right-3 z-10 !hover:bg-white/90 !hover:text-inherit backdrop-blur-sm"
            onClick={handleFavoriteClick}
            size="icon"
            variant="ghost"
          >
            <Heart
              className={cn(
                "size-5 transition-colors",
                isFavorite === true
                  ? "fill-red-500 text-red-500"
                  : "text-muted-foreground group-hover:text-red-500"
              )}
            />
          </Button>
        </div>

        <CardContent className="flex flex-1 flex-col p-6">
          <div className="flex flex-1 flex-col">
            <h3 className="mb-3 min-h-[3rem] font-bold text-xl leading-tight">
              {year} {make} {model}
            </h3>
            <div className="mb-auto flex items-center gap-1.5 text-muted-foreground text-sm">
              <MapPin className="size-3.5 shrink-0" />
              <span>{location}</span>
            </div>
          </div>

          <div className="mt-4 border-t pt-4">
            <div className="flex items-baseline gap-1">
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text font-bold text-3xl text-transparent">
                ${pricePerDay}
              </span>
              <span className="text-muted-foreground text-sm">/day</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Login Dialog */}
      <Dialog onOpenChange={setShowLoginDialog} open={showLoginDialog}>
        <DialogContent className="border-0 bg-white/95 p-0 shadow-2xl backdrop-blur sm:max-w-md dark:bg-gray-900/95">
          <Card className="border-0 shadow-none">
            <CardContent className="p-8">
              {/* Header */}
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

              {/* Action buttons */}
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

              {/* Additional info */}
              <div className="mt-6 text-center">
                <p className="text-muted-foreground text-sm">
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
