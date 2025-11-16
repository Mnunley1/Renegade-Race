"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { ArrowRight, Award, Car, CheckCircle2, CreditCard, Search, Zap } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { VehicleCard } from "@/components/vehicle-card"
import { api } from "@/lib/convex"

export default function HomePage() {
  // Track video load error
  const [videoError, setVideoError] = useState(false)

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
    "24/7 customer support",
  ]

  return (
    <div className="space-y-32 pb-32">
      {/* Hero Section */}
      <section className="relative h-screen max-h-[900px] min-h-[600px] overflow-hidden">
        {/* Fallback Background Image */}
        <div className="absolute inset-0">
          <Image
            alt="Racing on track"
            className="object-cover"
            fill
            priority
            src="/images/clement-delacre-JuEQI7nssh0-unsplash.jpg"
          />
        </div>

        {/* Video Background */}
        <video
          autoPlay
          className="absolute inset-0 h-full w-full object-cover"
          loop
          muted
          playsInline
          poster="/images/clement-delacre-JuEQI7nssh0-unsplash.jpg"
        >
          <source src="/videos/renegade-hero-video.mp4" type="video/mp4" />
        </video>

        {/* Dark Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Content Overlay */}
        <div className="container relative z-10 mx-auto flex h-full items-center px-4 sm:px-6">
          <div className="max-w-3xl space-y-8 text-white">
            <div className="space-y-6">
              <h1 className="font-semibold text-4xl leading-tight tracking-tight md:text-5xl lg:text-6xl xl:text-7xl">
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
              <Link href="/motorsports">
                <Button
                  className="w-full border-white/20 bg-white text-black hover:bg-white/90 sm:w-auto"
                  size="lg"
                  variant="outline"
                >
                  <Award className="mr-2 size-5" />
                  Motorsports
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 sm:px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-semibold text-3xl tracking-tight md:text-4xl lg:text-5xl">
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
              <Card className="group relative h-full border-2 transition-all duration-300 hover:scale-[1.02] hover:border-primary/50 hover:shadow-xl">
                <CardContent className="p-8">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 transition-all group-hover:scale-110 group-hover:from-primary/30 group-hover:to-primary/10">
                      <Search className="size-8 text-primary" />
                      <div className="-right-2 -top-2 absolute flex h-7 w-7 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-sm shadow-lg">
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
              <div className="-translate-y-1/2 absolute top-1/2 right-0 hidden translate-x-1/2 md:block">
                <div className="flex items-center">
                  <div className="h-0.5 w-8 bg-gradient-to-r from-primary/50 to-primary" />
                  <ArrowRight className="size-5 text-primary" />
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <Card className="group relative h-full border-2 transition-all duration-300 hover:scale-[1.02] hover:border-primary/50 hover:shadow-xl">
                <CardContent className="p-8">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 transition-all group-hover:scale-110 group-hover:from-primary/30 group-hover:to-primary/10">
                      <CreditCard className="size-8 text-primary" />
                      <div className="-right-2 -top-2 absolute flex h-7 w-7 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-sm shadow-lg">
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
              <div className="-translate-y-1/2 absolute top-1/2 right-0 hidden translate-x-1/2 md:block">
                <div className="flex items-center">
                  <div className="h-0.5 w-8 bg-gradient-to-r from-primary/50 to-primary" />
                  <ArrowRight className="size-5 text-primary" />
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <Card className="group relative h-full border-2 transition-all duration-300 hover:scale-[1.02] hover:border-primary/50 hover:shadow-xl">
                <CardContent className="p-8">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 transition-all group-hover:scale-110 group-hover:from-primary/30 group-hover:to-primary/10">
                      <Car className="size-8 text-primary" />
                      <div className="-right-2 -top-2 absolute flex h-7 w-7 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-sm shadow-lg">
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
                {featuredVehicles.slice(0, 3).map((vehicle) => (
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
            <h2 className="font-semibold text-3xl tracking-tight md:text-4xl lg:text-5xl">
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
          <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
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
                <source src="/videos/renegade_promo_video.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-primary p-12 md:p-20">
          <div className="relative z-10 text-center text-primary-foreground">
            <h2 className="mb-6 font-semibold text-3xl tracking-tight md:text-4xl lg:text-5xl">
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
        </div>
      </section>
    </div>
  )
}
