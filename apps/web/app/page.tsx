import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { CheckCircle2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { VehicleCard } from "@/components/vehicle-card"

export default function HomePage() {
  const featuredVehicles = [
    {
      id: "1",
      image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800",
      name: "Porsche 911 GT3",
      year: 2023,
      make: "Porsche",
      model: "911 GT3",
      pricePerDay: 899,
      location: "Daytona Beach, FL",
      rating: 4.9,
      reviews: 23,
    },
    {
      id: "2",
      image: "https://images.unsplash.com/photo-1593941707882-a5bac6861d0d?w=800",
      name: "Lamborghini Huracán",
      year: 2024,
      make: "Lamborghini",
      model: "Huracán",
      pricePerDay: 1299,
      location: "Miami, FL",
      rating: 5.0,
      reviews: 45,
    },
    {
      id: "3",
      image: "https://images.unsplash.com/photo-1549952891-fcf406dd2aa9?w=800",
      name: "Ferrari F8 Tributo",
      year: 2022,
      make: "Ferrari",
      model: "F8 Tributo",
      pricePerDay: 1199,
      location: "Orlando, FL",
      rating: 4.8,
      reviews: 31,
    },
  ]

  const categories = [
    {
      name: "Supercars",
      description: "Ultra-high performance exotic cars",
      icon: "🏎️",
      count: "50+",
      color: "from-purple-500 to-pink-500",
    },
    {
      name: "Track Ready",
      description: "Racing configured vehicles",
      icon: "🏁",
      count: "35+",
      color: "from-blue-500 to-cyan-500",
    },
    {
      name: "Muscle Cars",
      description: "American power and performance",
      icon: "💪",
      count: "25+",
      color: "from-orange-500 to-red-500",
    },
  ]

  const benefits = [
    "Instant booking confirmation",
    "Verified host vehicles",
    "Track insurance included",
    "24/7 customer support",
  ]

  return (
    <div className="space-y-32 pb-32">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="container relative mx-auto px-4 pt-16 pb-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge className="px-4 py-1 text-sm">🚗 Track Car Rentals</Badge>
                <h1 className="font-bold text-5xl leading-tight tracking-tight md:text-6xl lg:text-7xl">
                  Experience the{" "}
                  <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    thrill
                  </span>{" "}
                  of racing on the track
                </h1>
                <p className="max-w-xl text-muted-foreground text-xl">
                  Rent high-performance track cars from verified hosts. Book your dream car today
                  and feel the adrenaline rush.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {benefits.map((benefit) => (
                  <div
                    className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm"
                    key={benefit}
                  >
                    <CheckCircle2 className="size-4 text-primary" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Link href="/vehicles">
                  <Button className="w-full sm:w-auto" size="lg">
                    Search Vehicles
                  </Button>
                </Link>
                <Link href="/how-it-works">
                  <Button className="w-full sm:w-auto" size="lg" variant="outline">
                    How It Works
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative aspect-square overflow-hidden rounded-2xl lg:aspect-video">
              <Image
                alt="Racing on track"
                className="object-cover"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                src="https://images.unsplash.com/photo-1617654116429-5da33150a27d?w=1200"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Featured Vehicles */}
      <section className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-bold text-4xl md:text-5xl">Featured Vehicles</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground text-xl">
            Hand-picked selection of top-rated track cars
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {featuredVehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} {...vehicle} />
          ))}
        </div>
        <div className="mt-16 text-center">
          <Link href="/vehicles">
            <Button size="lg" variant="outline">
              View All Vehicles
            </Button>
          </Link>
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-bold text-4xl md:text-5xl">Browse by Category</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground text-xl">
            Find your perfect ride based on your preferences
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {categories.map((category) => (
            <Link href="/vehicles" key={category.name}>
              <Card className="group relative overflow-hidden border-2 transition-all hover:scale-105 hover:shadow-xl">
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-10",
                    category.color
                  )}
                />
                <CardHeader className="pb-3">
                  <div className="mb-4 text-5xl">{category.icon}</div>
                  <CardTitle className="text-2xl">{category.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-6 text-muted-foreground">{category.description}</p>
                  <Badge className="text-sm" variant="secondary">
                    {category.count} vehicles
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-bold text-4xl md:text-5xl">How It Works</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground text-xl">
            Get on the track in three simple steps
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          <div className="group space-y-4 rounded-2xl border p-8 transition-all hover:bg-accent/50">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 font-bold text-2xl text-primary-foreground transition-transform group-hover:scale-110">
              1
            </div>
            <h3 className="font-bold text-xl">Search & Browse</h3>
            <p className="text-muted-foreground">
              Find your perfect track car from our extensive collection of verified vehicles
            </p>
          </div>
          <div className="group space-y-4 rounded-2xl border p-8 transition-all hover:bg-accent/50">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 font-bold text-2xl text-primary-foreground transition-transform group-hover:scale-110">
              2
            </div>
            <h3 className="font-bold text-xl">Book Instantly</h3>
            <p className="text-muted-foreground">
              Secure your rental with instant confirmation and flexible dates that fit your schedule
            </p>
          </div>
          <div className="group space-y-4 rounded-2xl border p-8 transition-all hover:bg-accent/50">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 font-bold text-2xl text-primary-foreground transition-transform group-hover:scale-110">
              3
            </div>
            <h3 className="font-bold text-xl">Hit the Track</h3>
            <p className="text-muted-foreground">
              Pick up your vehicle and experience the ultimate track day with peace of mind
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-3xl border-2 bg-gradient-to-br from-primary via-primary to-primary/80 p-12 shadow-xl md:p-16">
          <div className="relative z-10 text-center text-primary-foreground">
            <h2 className="mb-6 font-bold text-4xl md:text-5xl">Ready to Race?</h2>
            <p className="mx-auto mb-8 max-w-2xl text-xl opacity-95">
              Join thousands of drivers who have experienced the thrill of track car rentals
            </p>
            <Link href="/vehicles">
              <Button className="text-base" size="lg" variant="secondary">
                Browse Available Vehicles
              </Button>
            </Link>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10">
            <div className="text-9xl">🏁</div>
          </div>
        </div>
      </section>
    </div>
  )
}
