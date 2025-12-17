"use client"

import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { Heart, Loader2 } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useMemo } from "react"
import { VehicleCard } from "@/components/vehicle-card"
import { api } from "@/lib/convex"

export default function FavoritesPage() {
  const { user, isSignedIn, isLoaded: userLoaded } = useUser()
  const router = useRouter()
  const pathname = usePathname()

  // Fetch user's favorites from Convex
  const favoritesData = useQuery(api.favorites.getUserFavorites, isSignedIn ? {} : "skip")

  // Map favorites to the format expected by VehicleCard
  const favorites = useMemo(() => {
    if (!(favoritesData && favoritesData.length)) return []
    return favoritesData
      .map((fav) => {
        const vehicle = fav.vehicle
        if (!vehicle) return null
        const primaryImage = vehicle.images?.find((img) => img.isPrimary) || vehicle.images?.[0]
        return {
          id: vehicle._id,
          image: primaryImage?.cardUrl ?? "",
          name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          pricePerDay: vehicle.dailyRate,
          location: vehicle.track?.location || "",
          track: vehicle.track?.name || "",
          rating: 0, // TODO: Calculate from reviews
          reviews: 0, // TODO: Get from reviews
          horsepower: vehicle.horsepower,
          transmission: vehicle.transmission || "",
        }
      })
      .filter(Boolean) as Array<{
      id: string
      image: string
      name: string
      year: number
      make: string
      model: string
      pricePerDay: number
      location: string
      track?: string
      rating: number
      reviews: number
      horsepower?: number
      transmission?: string
    }>
  }, [favoritesData])

  // Show loading state while checking auth or loading favorites
  if (!userLoaded || (isSignedIn && favoritesData === undefined)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading favorites...</p>
          </div>
        </div>
      </div>
    )
  }

  // If user is not signed in, show message to sign in
  if (!isSignedIn) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="mb-4 inline-flex items-center justify-center rounded-full bg-primary/10 p-3 text-primary">
              <Heart className="size-8" />
            </div>
            <h2 className="mb-2 font-semibold text-2xl">Sign in to view favorites</h2>
            <p className="mb-6 max-w-md text-muted-foreground">
              Create an account or sign in to save your favorite vehicles and access them anytime.
            </p>
            <Button
              onClick={() =>
                router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname || "/")}`)
              }
              size="lg"
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 font-bold text-3xl">Favorites</h1>
        <p className="text-muted-foreground">
          {favorites.length === 0 ? "No favorites yet" : `${favorites.length} saved vehicles`}
        </p>
      </div>

      {favorites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="mb-4 inline-flex items-center justify-center rounded-full bg-primary/10 p-3 text-primary">
              <Heart className="size-8" />
            </div>
            <h2 className="mb-2 font-semibold text-2xl">No favorites yet</h2>
            <p className="mb-6 max-w-md text-muted-foreground">
              Start exploring our track cars and save your favorites for easy access later.
            </p>
            <Link href="/vehicles">
              <Button size="lg">Browse Vehicles</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {favorites.map((vehicle) => (
            <VehicleCard
              horsepower={vehicle.horsepower}
              id={vehicle.id}
              image={vehicle.image}
              key={vehicle.id}
              location={vehicle.location}
              make={vehicle.make}
              model={vehicle.model}
              name={vehicle.name}
              pricePerDay={vehicle.pricePerDay}
              rating={vehicle.rating}
              reviews={vehicle.reviews}
              track={vehicle.track}
              transmission={vehicle.transmission}
              year={vehicle.year}
            />
          ))}
        </div>
      )}
    </div>
  )
}
