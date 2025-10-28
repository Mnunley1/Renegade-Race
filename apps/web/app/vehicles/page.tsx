import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { Filter, Search } from "lucide-react"
import { Suspense } from "react"
import { VehicleCard } from "@/components/vehicle-card"

export default function VehiclesPage() {
  const vehicles = [
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
    {
      id: "4",
      image: "https://images.unsplash.com/photo-1605170088216-9058e29c8e9f?w=800",
      name: "McLaren 720S",
      year: 2023,
      make: "McLaren",
      model: "720S",
      pricePerDay: 1599,
      location: "Tampa, FL",
      rating: 4.9,
      reviews: 18,
    },
    {
      id: "5",
      image: "https://images.unsplash.com/photo-1619682817481-ae0c7d3a0f8c?w=800",
      name: "Chevrolet Corvette Z06",
      year: 2024,
      make: "Chevrolet",
      model: "Corvette Z06",
      pricePerDay: 699,
      location: "Jacksonville, FL",
      rating: 4.7,
      reviews: 12,
    },
    {
      id: "6",
      image: "https://images.unsplash.com/photo-1605170088197-48c5e1c45f3f?w=800",
      name: "Aston Martin Vantage",
      year: 2023,
      make: "Aston Martin",
      model: "Vantage",
      pricePerDay: 1099,
      location: "Naples, FL",
      rating: 4.8,
      reviews: 27,
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 font-bold text-3xl">Track Cars</h1>
        <p className="text-muted-foreground">
          {vehicles.length} vehicles available for track rental
        </p>
      </div>

      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="flex-1 space-y-4 md:flex md:gap-4">
                <div className="flex-1">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="Where are you racing?" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="dates">Dates</Label>
                  <Input id="dates" type="date" />
                </div>
              </div>
              <Button className="w-full md:w-auto" size="lg">
                <Search className="mr-2 size-4" />
                Search
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-6">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Filter className="size-4" />
                <h2 className="font-semibold text-lg">Filters</h2>
              </div>
              <Card>
                <CardContent className="space-y-4 p-6">
                  <div>
                    <Label>Make</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="All makes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All makes</SelectItem>
                        <SelectItem value="porsche">Porsche</SelectItem>
                        <SelectItem value="lamborghini">Lamborghini</SelectItem>
                        <SelectItem value="ferrari">Ferrari</SelectItem>
                        <SelectItem value="mclaren">McLaren</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div>
                    <Label>Price Range</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Any price" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any price</SelectItem>
                        <SelectItem value="0-500">$0 - $500/day</SelectItem>
                        <SelectItem value="500-1000">$500 - $1,000/day</SelectItem>
                        <SelectItem value="1000-1500">$1,000 - $1,500/day</SelectItem>
                        <SelectItem value="1500+">$1,500+/day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div>
                    <Label>Sort By</Label>
                    <Select defaultValue="popularity">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="popularity">Popularity</SelectItem>
                        <SelectItem value="price-low">Price: Low to High</SelectItem>
                        <SelectItem value="price-high">Price: High to Low</SelectItem>
                        <SelectItem value="newest">Newest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">Showing {vehicles.length} results</p>
          </div>
          <Suspense fallback={<div>Loading...</div>}>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {vehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} {...vehicle} />
              ))}
            </div>
          </Suspense>
        </div>
      </div>
    </div>
  )
}
