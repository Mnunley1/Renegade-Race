"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { ArrowDownUp, Car, DollarSign, Heart, Search, Star } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { VehicleCard } from "@/components/vehicle-card"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"

type SortOption = "newest" | "price-asc" | "price-desc" | "rating"

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low-High" },
  { value: "price-desc", label: "Price: High-Low" },
  { value: "rating", label: "Top Rated" },
]

export default function FavoritesPage() {
  const { isSignedIn, isLoaded: userLoaded } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const [sortBy, setSortBy] = useState<SortOption>("newest")

  // Fetch user's favorites from Convex
  const favoritesData = useQuery(api.favorites.getUserFavorites, isSignedIn ? {} : "skip")

  // Fetch vehicle stats for favorited vehicles
  const favoriteVehicleIds = useMemo(() => {
    if (!favoritesData) {
      return []
    }
    return favoritesData
      .map((fav) => fav?.vehicle?._id as Id<"vehicles"> | undefined)
      .filter((id: Id<"vehicles"> | undefined): id is Id<"vehicles"> => Boolean(id))
  }, [favoritesData])

  const favoriteVehicleStats = useQuery(
    api.reviews.getVehicleStatsBatch,
    favoriteVehicleIds.length > 0 ? { vehicleIds: favoriteVehicleIds } : "skip"
  )

  // Map favorites to the format expected by VehicleCard
  const favorites = useMemo(() => {
    if (!favoritesData?.length) {
      return []
    }
    return favoritesData
      .map((fav) => {
        const vehicle = fav?.vehicle
        if (!vehicle) {
          return null
        }
        const primaryImage =
          vehicle.images?.find((img: { isPrimary: boolean }) => img.isPrimary) ||
          vehicle.images?.[0]
        const stats = favoriteVehicleStats?.[vehicle._id]
        return {
          id: vehicle._id,
          image: primaryImage?.imageUrl ?? primaryImage?.r2Key ?? "",
          name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          pricePerDay: vehicle.dailyRate,
          location: vehicle.track?.location || "",
          track: vehicle.track?.name || "",
          rating: stats?.averageRating || 0,
          reviews: stats?.totalReviews || 0,
          horsepower: vehicle.horsepower,
          transmission: vehicle.transmission || "",
          favoritedAt: fav?._creationTime ?? 0,
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
      favoritedAt?: number
    }>
  }, [favoritesData, favoriteVehicleStats])

  // Sort favorites client-side
  const sortedFavorites = useMemo(() => {
    const sorted = [...favorites]
    switch (sortBy) {
      case "newest":
        return sorted.sort((a, b) => (b.favoritedAt ?? 0) - (a.favoritedAt ?? 0))
      case "price-asc":
        return sorted.sort((a, b) => a.pricePerDay - b.pricePerDay)
      case "price-desc":
        return sorted.sort((a, b) => b.pricePerDay - a.pricePerDay)
      case "rating":
        return sorted.sort((a, b) => b.rating - a.rating)
      default:
        return sorted
    }
  }, [favorites, sortBy])

  // Stats calculations
  const stats = useMemo(() => {
    if (favorites.length === 0) {
      return null
    }
    const prices = favorites.map((v) => v.pricePerDay)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const avgRating = favorites.reduce((sum, v) => sum + v.rating, 0) / favorites.length
    return { minPrice, maxPrice, avgRating, count: favorites.length }
  }, [favorites])

  // Loading skeleton
  if (!userLoaded || (isSignedIn && favoritesData === undefined)) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="mb-2 h-9 w-64 animate-pulse rounded-lg bg-muted" />
          <div className="h-5 w-48 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="mb-6 h-10 w-full animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="animate-pulse overflow-hidden rounded-xl border bg-card" key={i}>
              <div className="aspect-[16/10] bg-muted" />
              <div className="space-y-3 p-4">
                <div className="h-5 w-3/4 rounded bg-muted" />
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="flex justify-between">
                  <div className="h-4 w-1/3 rounded bg-muted" />
                  <div className="h-4 w-1/4 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Not signed in
  if (!isSignedIn) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-16 text-center">
            <div className="mb-6 inline-flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Heart className="size-8" />
            </div>
            <h2 className="mb-2 font-semibold text-2xl tracking-tight">
              Sign in to view favorites
            </h2>
            <p className="mb-8 max-w-sm text-muted-foreground">
              Create an account or sign in to save your favorite track cars and access them anytime.
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
    <div className="container mx-auto px-4 py-12">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-3xl tracking-tight">Favorites</h1>
          {stats && (
            <Badge className="text-sm" variant="secondary">
              {stats.count} saved
            </Badge>
          )}
        </div>
        <p className="mt-1 text-muted-foreground">Your collection of track-ready machines</p>
      </div>

      {favorites.length === 0 ? (
        /* Empty State */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-16 text-center">
            <div className="mb-6 inline-flex size-20 items-center justify-center rounded-full bg-muted">
              <Heart className="size-10 text-muted-foreground" />
            </div>
            <h2 className="mb-2 font-semibold text-2xl tracking-tight">No favorites yet</h2>
            <p className="mb-8 max-w-sm text-muted-foreground">
              Browse our collection of high-performance track cars and tap the heart icon to save
              the ones you love.
            </p>
            <Link href="/vehicles">
              <Button className="gap-2" size="lg">
                <Search className="size-4" />
                Browse Vehicles
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Bar */}
          {stats && (
            <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border bg-card px-5 py-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Car className="size-4" />
                <span>
                  <span className="font-medium text-foreground">{stats.count}</span> vehicle
                  {stats.count !== 1 ? "s" : ""}
                </span>
              </div>
              <span className="text-border">|</span>
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="size-4" />
                <span>
                  <span className="font-medium text-foreground">${stats.minPrice}</span>
                  {stats.minPrice !== stats.maxPrice && (
                    <>
                      {" - "}
                      <span className="font-medium text-foreground">${stats.maxPrice}</span>
                    </>
                  )}
                  /day
                </span>
              </div>
              {stats.avgRating > 0 && (
                <>
                  <span className="text-border">|</span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Star className="size-4 fill-amber-400 text-amber-400" />
                    <span>
                      <span className="font-medium text-foreground">
                        {stats.avgRating.toFixed(1)}
                      </span>{" "}
                      avg rating
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Sort Controls */}
          <div className="mb-6 flex items-center gap-2">
            <ArrowDownUp className="size-4 text-muted-foreground" />
            <div className="flex flex-wrap gap-2">
              {sortOptions.map((option) => (
                <Button
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                  size="sm"
                  variant={sortBy === option.value ? "default" : "outline"}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Vehicle Grid */}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {sortedFavorites.map((vehicle) => (
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
        </>
      )}
    </div>
  )
}
