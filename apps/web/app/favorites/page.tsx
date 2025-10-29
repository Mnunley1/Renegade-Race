import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Heart } from "lucide-react"
import Link from "next/link"
import { VehicleCard } from "@/components/vehicle-card"

export default function FavoritesPage() {
  // TODO: Replace with Convex query to fetch user's favorites
  const favorites = [
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
            <VehicleCard key={vehicle.id} {...vehicle} />
          ))}
        </div>
      )}
    </div>
  )
}
