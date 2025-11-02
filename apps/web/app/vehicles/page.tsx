"use client"

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
import { Badge } from "@workspace/ui/components/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { Filter, Search, Grid3x3, List, MapPin, Calendar, X, Star } from "lucide-react"
import { Suspense, useState, useMemo } from "react"
import { useQuery } from "convex/react"
import { VehicleCard } from "@/components/vehicle-card"
import { cn } from "@workspace/ui/lib/utils"
import { api } from "@/lib/convex"

export default function VehiclesPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [showFilters, setShowFilters] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLocation, setSelectedLocation] = useState("")
  const [selectedTrack, setSelectedTrack] = useState("all")
  const [selectedMake, setSelectedMake] = useState("all")
  const [selectedPriceRange, setSelectedPriceRange] = useState("any")
  const [sortBy, setSortBy] = useState("popularity")
  const [selectedDates, setSelectedDates] = useState({
    start: "",
    end: "",
  })

  // Fetch vehicles and tracks from Convex
  const vehiclesData = useQuery(api.vehicles.getAllWithOptimizedImages, {})
  const tracksData = useQuery(api.tracks.getAll, {})

  // Map vehicles to the format expected by VehicleCard
  const vehicles = useMemo(() => {
    if (!vehiclesData) return []
    return vehiclesData.map((vehicle) => {
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
        track: vehicle.track?.name || "",
        rating: 0, // TODO: Calculate from reviews
        reviews: 0, // TODO: Get from reviews
        horsepower: vehicle.horsepower,
        transmission: vehicle.transmission || "",
      }
    })
  }, [vehiclesData])

  const tracks = useMemo(() => {
    if (!tracksData) return []
    return tracksData.map((track) => ({
      id: track._id,
      name: track.name,
      location: track.location,
    }))
  }, [tracksData])

  const mockVehicles = [
    {
      id: "1",
      image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800",
      name: "Porsche 911 GT3",
      year: 2023,
      make: "Porsche",
      model: "911 GT3",
      pricePerDay: 899,
      location: "Daytona Beach, FL",
      track: "Daytona International Speedway",
      rating: 4.9,
      reviews: 23,
      horsepower: 502,
      transmission: "Manual",
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
      track: "Homestead-Miami Speedway",
      rating: 5.0,
      reviews: 45,
      horsepower: 610,
      transmission: "Automatic",
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
      track: "Sebring International Raceway",
      rating: 4.8,
      reviews: 31,
      horsepower: 710,
      transmission: "Automatic",
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
      track: "Daytona International Speedway",
      rating: 4.9,
      reviews: 18,
      horsepower: 710,
      transmission: "Automatic",
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
      track: "Sebring International Raceway",
      rating: 4.7,
      reviews: 12,
      horsepower: 650,
      transmission: "Manual",
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
      track: "Homestead-Miami Speedway",
      rating: 4.8,
      reviews: 27,
      horsepower: 503,
      transmission: "Manual",
    },
  ]

  const makes = useMemo(() => {
    return Array.from(new Set(vehicles.map((v) => v.make))).sort()
  }, [vehicles])

  // Filter vehicles
  const filteredVehicles = useMemo(() => {
    let filtered = vehicles.filter((vehicle) => {
      if (searchQuery && !vehicle.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      if (selectedTrack !== "all" && vehicle.track !== selectedTrack) {
        return false
      }
      if (selectedMake !== "all" && vehicle.make !== selectedMake) {
        return false
      }
      if (selectedLocation && !vehicle.location.toLowerCase().includes(selectedLocation.toLowerCase())) {
        return false
      }
      if (selectedPriceRange !== "any") {
        if (selectedPriceRange.endsWith("+")) {
          // Handle "1500+" case
          const minPrice = parseInt(selectedPriceRange.replace(/\D/g, ""), 10)
          if (vehicle.pricePerDay < minPrice) {
            return false
          }
        } else {
          // Handle "0-500", "500-1000", etc.
          const [min, max] = selectedPriceRange.split("-").map((p) =>
            parseInt(p.replace(/\D/g, ""), 10)
          )
          if (vehicle.pricePerDay < min || vehicle.pricePerDay > max) {
            return false
          }
        }
      }
      return true
    })

    // Sort vehicles
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return a.pricePerDay - b.pricePerDay
        case "price-high":
          return b.pricePerDay - a.pricePerDay
        case "newest":
          return b.year - a.year
        case "rating":
          return (b.rating || 0) - (a.rating || 0)
        case "horsepower":
          return (b.horsepower || 0) - (a.horsepower || 0)
        case "popularity":
        default:
          return (b.reviews || 0) - (a.reviews || 0)
      }
    })

    return filtered
  }, [searchQuery, selectedTrack, selectedMake, selectedLocation, selectedPriceRange, sortBy])

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedLocation("")
    setSelectedTrack("all")
    setSelectedMake("all")
    setSelectedPriceRange("any")
    setSelectedDates({ start: "", end: "" })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <div className="container relative z-10 mx-auto px-4 py-12 md:py-16">
          <div className="mb-8 text-center">
            <h1 className="mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl">
              Find Your Perfect Track Vehicle
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Discover high-performance race cars ready for your next track day
            </p>
          </div>

          {/* Enhanced Search Bar */}
          <Card className="border-2 shadow-xl">
            <CardContent className="p-4 md:p-6">
              <div className="space-y-4">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-12 pl-10 text-base"
                    placeholder="Search by make, model, or track..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <Label htmlFor="track" className="mb-2 flex items-center gap-2">
                      <MapPin className="size-4" />
                      Track
                    </Label>
                    <Select value={selectedTrack} onValueChange={setSelectedTrack}>
                      <SelectTrigger id="track">
                        <SelectValue placeholder="All tracks" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All tracks</SelectItem>
                        {tracks?.map((track) => (
                          <SelectItem key={track.id} value={track.name}>
                            {track.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="location" className="mb-2 flex items-center gap-2">
                      <MapPin className="size-4" />
                      Location
                    </Label>
                    <Input
                      id="location"
                      placeholder="City, State"
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="start-date" className="mb-2 flex items-center gap-2">
                      <Calendar className="size-4" />
                      Start Date
                    </Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={selectedDates.start}
                      onChange={(e) =>
                        setSelectedDates({ ...selectedDates, start: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex items-end">
                    <Button className="w-full" size="lg">
                      <Search className="mr-2 size-4" />
                      Search
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Summary */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">{filteredVehicles.length}</span>{" "}
              vehicles available
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid3x3 className="size-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Enhanced Filter Sidebar */}
          <div className={cn("lg:col-span-1", !showFilters && "hidden lg:block")}>
            <div className="sticky top-20 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="size-5" />
                  <h2 className="text-lg font-semibold">Filters</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setShowFilters(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>

              <Card className="border-2">
                <CardContent className="p-6">
                  <Accordion type="multiple" className="w-full" defaultValue={["make", "price"]}>
                    <AccordionItem value="make">
                      <AccordionTrigger className="text-sm font-medium">
                        Vehicle Make
                      </AccordionTrigger>
                      <AccordionContent>
                        <Select value={selectedMake} onValueChange={setSelectedMake}>
                          <SelectTrigger>
                            <SelectValue placeholder="All makes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All makes</SelectItem>
                            {makes.map((make) => (
                              <SelectItem key={make} value={make}>
                                {make}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </AccordionContent>
                    </AccordionItem>

                    <Separator />

                    <AccordionItem value="price">
                      <AccordionTrigger className="text-sm font-medium">
                        Price Range
                      </AccordionTrigger>
                      <AccordionContent>
                        <Select value={selectedPriceRange} onValueChange={setSelectedPriceRange}>
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
                      </AccordionContent>
                    </AccordionItem>

                    <Separator />

                    <AccordionItem value="sort">
                      <AccordionTrigger className="text-sm font-medium">Sort By</AccordionTrigger>
                      <AccordionContent>
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="popularity">Popularity</SelectItem>
                            <SelectItem value="price-low">Price: Low to High</SelectItem>
                            <SelectItem value="price-high">Price: High to Low</SelectItem>
                            <SelectItem value="newest">Newest</SelectItem>
                            <SelectItem value="rating">Highest Rated</SelectItem>
                            <SelectItem value="horsepower">Horsepower</SelectItem>
                          </SelectContent>
                        </Select>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {(searchQuery || selectedTrack !== "all" || selectedMake !== "all" || selectedPriceRange !== "any" || selectedLocation) && (
                    <div className="mt-4 pt-4 border-t">
                      <Button variant="outline" className="w-full" onClick={clearFilters}>
                        <X className="mr-2 size-4" />
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Mobile Filter Toggle */}
          {!showFilters && (
            <div className="mb-4 lg:hidden">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowFilters(true)}
              >
                <Filter className="mr-2 size-4" />
                Show Filters
              </Button>
            </div>
          )}

          {/* Vehicle Grid */}
          <div className="lg:col-span-3">
            {!vehiclesData || !tracksData ? (
              <Card className="border-2 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="mb-4 size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <h3 className="mb-2 text-lg font-semibold">Loading vehicles...</h3>
                </CardContent>
              </Card>
            ) : filteredVehicles.length === 0 ? (
              <Card className="border-2 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Search className="mb-4 size-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-semibold">No vehicles found</h3>
                  <p className="mb-4 text-center text-muted-foreground">
                    Try adjusting your filters to see more results
                  </p>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Suspense fallback={<div>Loading...</div>}>
                <div
                  className={cn(
                    "grid gap-6",
                    viewMode === "grid"
                      ? "md:grid-cols-2 xl:grid-cols-3 auto-rows-fr"
                      : "grid-cols-1"
                  )}
                >
                  {filteredVehicles.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.id}
                      {...vehicle}
                      track={vehicle.track}
                      horsepower={vehicle.horsepower}
                      transmission={vehicle.transmission}
                    />
                  ))}
                </div>
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
