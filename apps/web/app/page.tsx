"use client"

import { useQuery } from "convex/react"
import { useMemo } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  CheckCircle2,
  Shield,
  Zap,
  ArrowRight,
  Award,
  Clock,
  Car,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { VehicleCard } from "@/components/vehicle-card"
import { api } from "@/lib/convex"

export default function HomePage() {
  // Fetch vehicles from Convex
  const vehiclesData = useQuery(api.vehicles.getAllWithOptimizedImages, { limit: 6 })

  // Map vehicles to the format expected by VehicleCard
  const featuredVehicles = useMemo(() => {
    if (!vehiclesData) return []
    return vehiclesData.slice(0, 6).map((vehicle) => {
      const primaryImage = vehicle.images?.find((img) => img.isPrimary) || vehicle.images?.[0]
      return {
        id: vehicle._id,
        image: primaryImage?.cardUrl || primaryImage?.imageUrl || "",
        name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        pricePerDay: vehicle.dailyRate,
        location: vehicle.track?.location || "",
        rating: 0, // TODO: Calculate from reviews
        reviews: 0, // TODO: Get from reviews
        horsepower: vehicle.horsepower,
        transmission: vehicle.transmission,
      }
    })
  }, [vehiclesData])

  const benefits = [
    "Instant booking confirmation",
    "Verified host vehicles",
    "Track insurance included",
    "24/7 customer support",
  ]

  return (
    <div className="space-y-24 pb-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-background" />
        <div className="container relative mx-auto px-4 pt-8 pb-16 md:pt-16 md:pb-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-8">
              <div className="space-y-6">
                <Badge className="px-4 py-1.5 text-sm font-semibold">
                  <Zap className="mr-2 inline size-4" />
                  Track Car Rentals
                </Badge>
                <h1 className="font-bold text-4xl leading-tight tracking-tight md:text-5xl lg:text-6xl xl:text-7xl">
                  Experience the{" "}
                  <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                    ultimate thrill
                  </span>{" "}
                  of racing
                </h1>
                <p className="max-w-xl text-muted-foreground text-lg md:text-xl">
                  Rent high-performance track cars from verified hosts. Book your dream car today
                  and feel the adrenaline rush on the world's best tracks.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {benefits.map((benefit) => (
                  <div
                    className="flex items-center gap-2 rounded-full border bg-card/50 backdrop-blur-sm px-4 py-2 text-sm shadow-sm"
                    key={benefit}
                  >
                    <CheckCircle2 className="size-4 text-primary" />
                    <span className="font-medium">{benefit}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Link href="/vehicles">
                  <Button className="w-full text-base sm:w-auto" size="lg">
                    <Car className="mr-2 size-5" />
                    Browse Vehicles
                  </Button>
                </Link>
                <Link href="/motorsports">
                  <Button className="w-full sm:w-auto" size="lg" variant="outline">
                    <Award className="mr-2 size-5" />
                    Motorsports
                  </Button>
                </Link>
              </div>

            </div>

            <div className="relative aspect-square overflow-hidden rounded-2xl shadow-2xl lg:aspect-video">
              <Image
                alt="Racing on track"
                className="object-cover transition-transform duration-700 hover:scale-110"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                src="https://images.unsplash.com/photo-1617654116429-5da33150a27d?w=1200"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Featured Vehicles */}
      <section className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <Badge className="mb-4 px-3 py-1 text-xs font-semibold" variant="secondary">
            FEATURED COLLECTION
          </Badge>
          <h2 className="mb-4 font-bold text-3xl md:text-4xl lg:text-5xl">
            Premium Track Vehicles
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground text-lg">
            Hand-picked selection of top-rated track cars from verified hosts
          </p>
        </div>
        {!vehiclesData ? (
          <div className="py-16 text-center">
            <div className="mb-4 inline-block size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Loading featured vehicles...</p>
          </div>
        ) : featuredVehicles.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">No vehicles available yet</p>
          </div>
        ) : (
          <div className="grid auto-rows-fr gap-8 md:grid-cols-2 lg:grid-cols-3">
            {featuredVehicles.slice(0, 3).map((vehicle) => (
              <VehicleCard key={vehicle.id} {...vehicle} />
            ))}
          </div>
        )}
        <div className="mt-12 text-center">
          <Link href="/vehicles">
            <Button size="lg" variant="outline" className="group">
              View All Vehicles
              <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </section>

      {/* About Section */}
      <section className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <Badge className="mb-4 px-3 py-1 text-xs font-semibold" variant="secondary">
            ABOUT RENEGADE RENTALS
          </Badge>
          <h2 className="mb-6 font-bold text-3xl md:text-4xl lg:text-5xl">
            Your Gateway to Track Day Excellence
          </h2>
          <div className="space-y-4 text-muted-foreground text-lg md:text-xl">
            <p>
              Renegade Rentals connects passionate drivers with high-performance track cars from
              verified hosts. Whether you're a seasoned racer looking to experience a new vehicle
              or a track enthusiast wanting to push your limits, we make it easy to find and rent the
              perfect track car for your next event.
            </p>
            <p>
              Our platform ensures every vehicle meets strict quality and safety standards, while our
              comprehensive insurance coverage gives you peace of mind on the track. Join our
              community of drivers and hosts who share a passion for motorsports and performance.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <Badge className="mb-4 px-3 py-1 text-xs font-semibold" variant="secondary">
            SIMPLE PROCESS
          </Badge>
          <h2 className="mb-4 font-bold text-3xl md:text-4xl lg:text-5xl">How It Works</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground text-lg">
            Get on the track in three simple steps
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          <div className="group relative space-y-4 rounded-2xl border bg-card p-8 transition-all hover:border-primary/50 hover:shadow-xl">
            <div className="absolute -top-4 -right-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-opacity group-hover:opacity-100">
              <ArrowRight className="size-6" />
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 font-bold text-2xl text-primary-foreground shadow-lg transition-transform group-hover:scale-110 group-hover:shadow-xl">
              1
            </div>
            <h3 className="font-bold text-xl">Search & Browse</h3>
            <p className="text-muted-foreground">
              Find your perfect track car from our extensive collection of verified vehicles. Filter
              by location, price, and specifications.
            </p>
          </div>
          <div className="group relative space-y-4 rounded-2xl border bg-card p-8 transition-all hover:border-primary/50 hover:shadow-xl">
            <div className="absolute -top-4 -right-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-opacity group-hover:opacity-100">
              <ArrowRight className="size-6" />
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 font-bold text-2xl text-primary-foreground shadow-lg transition-transform group-hover:scale-110 group-hover:shadow-xl">
              2
            </div>
            <h3 className="font-bold text-xl">Book Instantly</h3>
            <p className="text-muted-foreground">
              Secure your rental with instant confirmation and flexible dates that fit your
              schedule. All payments are secure and protected.
            </p>
          </div>
          <div className="group relative space-y-4 rounded-2xl border bg-card p-8 transition-all hover:border-primary/50 hover:shadow-xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 font-bold text-2xl text-primary-foreground shadow-lg transition-transform group-hover:scale-110 group-hover:shadow-xl">
              3
            </div>
            <h3 className="font-bold text-xl">Hit the Track</h3>
            <p className="text-muted-foreground">
              Pick up your vehicle and experience the ultimate track day with peace of mind. We
              provide full support throughout your rental.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-3xl border-2 bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-12 shadow-2xl md:p-20">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-20" />
          <div className="relative z-10 text-center text-primary-foreground">
            <div className="mb-6 flex justify-center">
              <div className="flex size-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <Car className="size-10" />
              </div>
            </div>
            <h2 className="mb-6 font-bold text-3xl md:text-4xl lg:text-5xl">
              Ready to Race?
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg md:text-xl opacity-95">
              Join thousands of drivers who have experienced the thrill of track car rentals.
              Start your journey today.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link href="/vehicles">
                <Button className="w-full sm:w-auto" size="lg" variant="secondary">
                  <Car className="mr-2 size-5" />
                  Browse Available Vehicles
                </Button>
              </Link>
              <Link href="/host/dashboard">
                <Button
                  className="w-full border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 sm:w-auto"
                  size="lg"
                  variant="outline"
                >
                  <Zap className="mr-2 size-5" />
                  Become a Host
                </Button>
              </Link>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 opacity-10">
            <div className="text-[12rem]">🏁</div>
          </div>
          <div className="absolute -left-8 -top-8 opacity-10">
            <div className="text-[8rem]">🏎️</div>
          </div>
        </div>
      </section>
    </div>
  )
}
