"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { ArrowRight, Car, CheckCircle2, CreditCard, Search, Zap } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { VehicleCard } from "@/components/vehicle-card"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"

export default function HomePage() {
  // Track video load error for hero section
  const [heroVideoFailed, setHeroVideoFailed] = useState(false)
  // Track video load error for about section
  const [videoError, setVideoError] = useState(false)

  // Fetch vehicles from Convex
  const vehiclesData = useQuery(api.vehicles.getAllWithOptimizedImages, { limit: 6 })

  // Map vehicles to the format expected by VehicleCard
  // Fetch vehicle stats for featured vehicles
  const featuredVehicleIds = useMemo(() => {
    if (!vehiclesData) return []
    return vehiclesData.slice(0, 6).map((v: any) => v._id as Id<"vehicles">)
  }, [vehiclesData])

  const featuredVehicleStats = useQuery(
    api.reviews.getVehicleStatsBatch,
    featuredVehicleIds.length > 0 ? { vehicleIds: featuredVehicleIds } : "skip"
  )

  const featuredVehicles = useMemo(() => {
    if (!vehiclesData) return []
    return vehiclesData.slice(0, 6).map((vehicle: any) => {
      const primaryImage = vehicle.images?.find((img: any) => img.isPrimary) || vehicle.images?.[0]
      const stats = featuredVehicleStats?.[vehicle._id]

      // Build location string from vehicle address (city, state) or fall back to track location
      const locationParts = []
      if (vehicle.address?.city) locationParts.push(vehicle.address.city)
      if (vehicle.address?.state) locationParts.push(vehicle.address.state)
      const location =
        locationParts.length > 0 ? locationParts.join(", ") : vehicle.track?.location || ""

      return {
        id: vehicle._id,
        image: primaryImage?.cardUrl ?? "",
        imageKey: primaryImage?.r2Key ?? undefined, // Pass r2Key for ImageKit
        name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        pricePerDay: vehicle.dailyRate,
        location,
        track: vehicle.track?.name || "",
        rating: stats?.averageRating || 0,
        reviews: stats?.totalReviews || 0,
        horsepower: vehicle.horsepower,
        transmission: vehicle.transmission,
        drivetrain: vehicle.drivetrain,
      }
    })
  }, [vehiclesData, featuredVehicleStats])

  const benefits = [
    "Instant booking confirmation",
    "Verified host vehicles",
    "24/7 customer support",
  ]

  return (
    <div className="space-y-32 pb-32">
      {/* Hero Section */}
      <section className="relative h-screen max-h-[900px] min-h-[600px] overflow-hidden">
        {/* Fallback Background Image - only shown when video fails */}
        {heroVideoFailed && (
          <div className="absolute inset-0">
            <Image
              alt="Racing on track"
              className="object-cover"
              fill
              priority
              src="/images/clement-delacre-JuEQI7nssh0-unsplash.jpg"
            />
          </div>
        )}

        {/* Video Background - only shown when video hasn't failed */}
        {!heroVideoFailed && (
          <video
            autoPlay
            className="absolute inset-0 h-full w-full object-cover"
            loop
            muted
            onAbort={() => setHeroVideoFailed(true)}
            onError={() => setHeroVideoFailed(true)}
            playsInline
            poster="/images/hero-vid-thumbnail.png"
          >
            <source src="https://ik.imagekit.io/renegaderace/site-media/renegade-hero-video.mp4" type="video/mp4" />
          </video>
        )}

        {/* Dark Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Content Overlay */}
        <div className="container relative z-10 mx-auto flex h-full items-center px-4 sm:px-6">
          <div className="max-w-3xl space-y-8 text-white">
            <div className="space-y-6">
              <h1 className="font-bold text-4xl leading-tight tracking-tight md:text-5xl lg:text-6xl xl:text-7xl">
                Experience the ultimate thrill of racing
              </h1>
              <p className="max-w-xl text-lg text-white/90 leading-relaxed md:text-xl">
                Rent high-performance track cars from verified hosts. Book your dream car today and
                feel the adrenaline rush on the world's best tracks.
              </p>
            </div>

            <div className="flex flex-wrap gap-6">
              {benefits.map((benefit) => (
                <div className="flex items-center gap-2 text-sm text-white/90" key={benefit}>
                  <CheckCircle2 className="size-4 text-primary" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/vehicles">
                <Button className="w-full sm:w-auto" size="lg">
                  <Car className="mr-2 size-5" />
                  Browse Vehicles
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 sm:px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl lg:text-5xl">
            How It Works
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Get on the track in three simple steps
          </p>
        </div>
        <div className="relative">
          <div className="grid gap-8 md:grid-cols-3">
            {/* Step 1 */}
            <div className="relative">
              <Card className="group relative h-full border transition-colors duration-200 hover:border-primary/40">
                <CardContent className="p-8">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                      <Search className="size-8 text-primary" />
                      <div className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-sm">
                        1
                      </div>
                    </div>
                  </div>
                  <h3 className="mb-3 font-semibold text-xl transition-colors group-hover:text-primary">
                    Search & Browse
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Find your perfect track car from our extensive collection of verified vehicles.
                    Filter by location, price, and specifications.
                  </p>
                </CardContent>
              </Card>
              {/* Arrow to Step 2 - Desktop Only */}
              <div className="absolute top-1/2 right-0 hidden translate-x-1/2 -translate-y-1/2 md:block">
                <div className="flex items-center">
                  <div className="h-0.5 w-8 bg-primary/40" />
                  <ArrowRight className="size-5 text-primary" />
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <Card className="group relative h-full border transition-colors duration-200 hover:border-primary/40">
                <CardContent className="p-8">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                      <CreditCard className="size-8 text-primary" />
                      <div className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-sm">
                        2
                      </div>
                    </div>
                  </div>
                  <h3 className="mb-3 font-semibold text-xl transition-colors group-hover:text-primary">
                    Book Instantly
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Secure your rental with instant confirmation and flexible dates that fit your
                    schedule. All payments are secure and protected.
                  </p>
                </CardContent>
              </Card>
              {/* Arrow to Step 3 - Desktop Only */}
              <div className="absolute top-1/2 right-0 hidden translate-x-1/2 -translate-y-1/2 md:block">
                <div className="flex items-center">
                  <div className="h-0.5 w-8 bg-primary/40" />
                  <ArrowRight className="size-5 text-primary" />
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <Card className="group relative h-full border transition-colors duration-200 hover:border-primary/40">
                <CardContent className="p-8">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                      <Car className="size-8 text-primary" />
                      <div className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-sm">
                        3
                      </div>
                    </div>
                  </div>
                  <h3 className="mb-3 font-semibold text-xl transition-colors group-hover:text-primary">
                    Hit the Track
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Pick up your vehicle and experience the ultimate track day with peace of mind.
                    We provide full support throughout your rental.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Vehicles */}
      <section className="bg-primary py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-semibold text-3xl text-primary-foreground tracking-tight md:text-4xl lg:text-5xl">
              Premium Track Vehicles
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-primary-foreground/90">
              Hand-picked selection of top-rated track cars from verified hosts
            </p>
          </div>
          {vehiclesData ? (
            featuredVehicles.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-primary-foreground/90">No vehicles available yet</p>
              </div>
            ) : (
              <div className="grid auto-rows-fr gap-6 md:grid-cols-2 lg:grid-cols-3">
                {featuredVehicles.slice(0, 3).map((vehicle: any) => (
                  <VehicleCard key={vehicle.id} {...vehicle} />
                ))}
              </div>
            )
          ) : (
            <div className="py-16 text-center">
              <div className="mb-4 inline-block size-8 animate-spin rounded-full border-4 border-primary-foreground/30 border-t-primary-foreground" />
              <p className="text-primary-foreground/90">Loading featured vehicles...</p>
            </div>
          )}
          <div className="mt-16 text-center">
            <Link href="/vehicles">
              <Button
                className="group bg-background text-foreground hover:bg-background/90"
                size="lg"
                variant="secondary"
              >
                View All Vehicles
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="container mx-auto px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Text Content */}
          <div className="space-y-6">
            <h2 className="font-bold text-3xl tracking-tight md:text-4xl lg:text-5xl">
              Your Gateway to Track Day Excellence
            </h2>
            <div className="space-y-5 text-lg text-muted-foreground leading-relaxed md:text-xl">
              <p>
                Renegade Rentals connects passionate drivers with high-performance track cars from
                verified hosts. Whether you're a seasoned racer looking to experience a new vehicle
                or a track enthusiast wanting to push your limits, we make it easy to find and rent
                the perfect track car for your next event.
              </p>
              <p>
                Our platform ensures every vehicle meets strict quality and safety standards. Join
                our community of drivers and hosts who share a passion for motorsports and
                performance.
              </p>
            </div>
          </div>

          {/* Video Content */}
          <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
            {videoError ? (
              <Image
                alt="Racing on track"
                className="h-full w-full object-cover"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                src="/images/clement-delacre-JuEQI7nssh0-unsplash.jpg"
              />
            ) : (
              <video
                className="h-full w-full object-cover"
                controls
                loop
                muted
                onError={() => setVideoError(true)}
                playsInline
                preload="metadata"
              >
                <source src="https://ik.imagekit.io/renegaderace/site-media/Renegade_promo_video.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-lg bg-primary p-12 md:p-20">
          <div className="relative z-10 text-center text-primary-foreground">
            <h2 className="mb-6 font-bold text-3xl tracking-tight md:text-4xl lg:text-5xl">
              Ready to Race?
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed opacity-95 md:text-xl">
              Join thousands of drivers who have experienced the thrill of track car rentals. Start
              your journey today.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/vehicles">
                <Button className="w-full sm:w-auto" size="lg" variant="secondary">
                  <Car className="mr-2 size-5" />
                  Browse Available Vehicles
                </Button>
              </Link>
              <Link href="/host/dashboard">
                <Button
                  className="w-full border-white/30 bg-white/15 text-white hover:bg-white/25 sm:w-auto dark:border-white/40 dark:bg-white/20 dark:hover:bg-white/30"
                  size="lg"
                  variant="outline"
                >
                  <Zap className="mr-2 size-5" />
                  Become a Host
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
