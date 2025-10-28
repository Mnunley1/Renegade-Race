import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
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
    },
    {
      name: "Track Ready",
      description: "Racing configured vehicles",
      icon: "🏁",
      count: "35+",
    },
    {
      name: "Muscle Cars",
      description: "American power and performance",
      icon: "💪",
      count: "25+",
    },
  ]

  return (
    <div className="space-y-24 pb-24">
      <section className="container mx-auto px-4 pt-12">
        <div className="grid gap-12 md:grid-cols-2">
          <div className="space-y-6">
            <Badge>🚗 Track Car Rentals</Badge>
            <h1 className="font-bold text-4xl md:text-6xl">
              Experience the thrill of racing on the track
            </h1>
            <p className="text-lg text-muted-foreground">
              Rent high-performance track cars from verified hosts. Book your dream car today and
              feel the adrenaline rush.
            </p>
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
          <div className="relative aspect-video overflow-hidden rounded-lg">
            <Image
              alt="Racing on track"
              className="object-cover"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              src="https://images.unsplash.com/photo-1617654116429-5da33150a27d?w=1200"
            />
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 font-bold text-3xl md:text-4xl">Featured Vehicles</h2>
          <p className="text-muted-foreground">Hand-picked selection of top-rated track cars</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featuredVehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} {...vehicle} />
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/vehicles">
            <Button variant="outline">View All Vehicles</Button>
          </Link>
        </div>
      </section>

      <section className="container mx-auto px-4">
        <div className="grid gap-6 md:grid-cols-3">
          {categories.map((category) => (
            <Card className="transition-all hover:shadow-lg" key={category.name}>
              <CardHeader>
                <div className="mb-2 text-4xl">{category.icon}</div>
                <CardTitle>{category.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-muted-foreground text-sm">{category.description}</p>
                <Badge variant="secondary">{category.count} vehicles</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-xl">
                  1
                </div>
                <h3 className="font-semibold text-lg">Search & Browse</h3>
                <p className="text-muted-foreground text-sm">
                  Find your perfect track car from our extensive collection
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-xl">
                  2
                </div>
                <h3 className="font-semibold text-lg">Book Instantly</h3>
                <p className="text-muted-foreground text-sm">
                  Secure your rental with instant confirmation and flexible dates
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-xl">
                  3
                </div>
                <h3 className="font-semibold text-lg">Hit the Track</h3>
                <p className="text-muted-foreground text-sm">
                  Pick up your vehicle and experience the ultimate track day
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="container mx-auto px-4">
        <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-3xl">Ready to Race?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-lg opacity-90">
              Join thousands of drivers who have experienced the thrill of track car rentals
            </p>
            <Link href="/vehicles">
              <Button size="lg" variant="secondary">
                Browse Available Vehicles
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
