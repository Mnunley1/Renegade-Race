"use client"

import { useQuery } from "convex/react"
import { useMemo } from "react"
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
    "24/7 customer support",
  ]

  return (
    <div className="space-y-32 pb-32">
      {/* Hero Section */}
      <section className="relative h-screen min-h-[600px] max-h-[900px] overflow-hidden">
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
          <source src="/videos/renegade-hero-vid.mp4" type="video/mp4" />
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
              <p className="max-w-xl text-lg leading-relaxed text-white/90 md:text-xl">
                Rent high-performance track cars from verified hosts. Book your dream car today
                and feel the adrenaline rush on the world's best tracks.
              </p>
            </div>

            <div className="flex flex-wrap gap-6">
              {benefits.map((benefit) => (
                <div
                  className="flex items-center gap-2 text-sm text-white/90"
                  key={benefit}
                >
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

      {/* Featured Vehicles */}
      <section className="container mx-auto px-4 sm:px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-semibold text-3xl md:text-4xl lg:text-5xl tracking-tight">
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
          <div className="grid auto-rows-fr gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredVehicles.slice(0, 3).map((vehicle) => (
              <VehicleCard key={vehicle.id} {...vehicle} />
            ))}
          </div>
        )}
        <div className="mt-16 text-center">
          <Link href="/vehicles">
            <Button size="lg" variant="outline" className="group">
              View All Vehicles
              <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </section>

      {/* About Section */}
      <section className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 font-semibold text-3xl md:text-4xl lg:text-5xl tracking-tight">
            Your Gateway to Track Day Excellence
          </h2>
          <div className="space-y-5 text-muted-foreground text-lg md:text-xl leading-relaxed">
            <p>
              Renegade Rentals connects passionate drivers with high-performance track cars from
              verified hosts. Whether you're a seasoned racer looking to experience a new vehicle
              or a track enthusiast wanting to push your limits, we make it easy to find and rent the
              perfect track car for your next event.
            </p>
            <p>
              Our platform ensures every vehicle meets strict quality and safety standards. Join our
              community of drivers and hosts who share a passion for motorsports and performance.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 sm:px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-semibold text-3xl md:text-4xl lg:text-5xl tracking-tight">
            How It Works
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground text-lg">
            Get on the track in three simple steps
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          <div className="group space-y-4 rounded-xl border border-border bg-card p-8 transition-all hover:shadow-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 font-semibold text-xl text-primary">
              1
            </div>
            <h3 className="font-semibold text-xl">Search & Browse</h3>
            <p className="text-muted-foreground leading-relaxed">
              Find your perfect track car from our extensive collection of verified vehicles. Filter
              by location, price, and specifications.
            </p>
          </div>
          <div className="group space-y-4 rounded-xl border border-border bg-card p-8 transition-all hover:shadow-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 font-semibold text-xl text-primary">
              2
            </div>
            <h3 className="font-semibold text-xl">Book Instantly</h3>
            <p className="text-muted-foreground leading-relaxed">
              Secure your rental with instant confirmation and flexible dates that fit your
              schedule. All payments are secure and protected.
            </p>
          </div>
          <div className="group space-y-4 rounded-xl border border-border bg-card p-8 transition-all hover:shadow-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 font-semibold text-xl text-primary">
              3
            </div>
            <h3 className="font-semibold text-xl">Hit the Track</h3>
            <p className="text-muted-foreground leading-relaxed">
              Pick up your vehicle and experience the ultimate track day with peace of mind. We
              provide full support throughout your rental.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-primary p-12 md:p-20">
          <div className="relative z-10 text-center text-primary-foreground">
            <h2 className="mb-6 font-semibold text-3xl md:text-4xl lg:text-5xl tracking-tight">
              Ready to Race?
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg md:text-xl opacity-95 leading-relaxed">
              Join thousands of drivers who have experienced the thrill of track car rentals.
              Start your journey today.
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
