"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { Badge } from "@workspace/ui/components/badge"
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
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import { Calendar, ChevronRight, Filter, Grid3x3, List, MapPin, Search, X } from "lucide-react"
import { Suspense, useEffect, useMemo, useState } from "react"
import { VehicleCard } from "@/components/vehicle-card"
import { useDebounce } from "@/hooks/useDebounce"
import { api } from "@/lib/convex"

export default function VehiclesPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [showFilters, setShowFilters] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLocation, setSelectedLocation] = useState("")
  const [selectedTrack, setSelectedTrack] = useState("all")
  const [selectedMake, setSelectedMake] = useState("all")
  const [selectedModel, setSelectedModel] = useState("all")
  const [selectedRaceCarClass, setSelectedRaceCarClass] = useState("all")
  const [selectedDriveType, setSelectedDriveType] = useState("all")
  const [selectedPriceRange, setSelectedPriceRange] = useState("any")
  const [minHorsepower, setMinHorsepower] = useState("")
  const [maxHorsepower, setMaxHorsepower] = useState("")
  const [selectedTransmission, setSelectedTransmission] = useState("all")
  const [minYear, setMinYear] = useState("")
  const [maxYear, setMaxYear] = useState("")
  const [minRating, setMinRating] = useState("")
  const [sortBy, setSortBy] = useState("popularity")
  const [selectedDates, setSelectedDates] = useState({
    start: "",
    end: "",
  })
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Fetch vehicles and tracks from Convex
  const vehiclesData = useQuery(api.vehicles.getAllWithOptimizedImages, {})
  const tracksData = useQuery(api.tracks.getAll, {})

  // Map vehicles to the format expected by VehicleCard
  const vehicles = useMemo(() => {
    if (!vehiclesData) return []
    const mapped = vehiclesData.map((vehicle) => {
      const primaryImage = vehicle.images?.find((img) => img.isPrimary) || vehicle.images?.[0]
      return {
        id: vehicle._id,
        image: primaryImage?.cardUrl ?? "",
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
        drivetrain: vehicle.drivetrain || "",
        raceCarClass: (vehicle as any).raceCarClass || "", // TODO: Add to schema
      }
    })
    return mapped
  }, [vehiclesData])

  const tracks = useMemo(() => {
    if (!tracksData) return []
    return tracksData.map((track) => ({
      id: track._id,
      name: track.name,
      location: track.location,
    }))
  }, [tracksData])

  const makes = useMemo(() => Array.from(new Set(vehicles.map((v) => v.make))).sort(), [vehicles])

  const models = useMemo(() => {
    // Filter models based on selected make if one is selected
    const filteredVehicles =
      selectedMake !== "all" ? vehicles.filter((v) => v.make === selectedMake) : vehicles
    return Array.from(new Set(filteredVehicles.map((v) => v.model))).sort()
  }, [vehicles, selectedMake])

  const driveTypes = useMemo(
    () => Array.from(new Set(vehicles.map((v) => v.drivetrain).filter(Boolean))).sort(),
    [vehicles]
  )

  const raceCarClasses = useMemo(() => {
    // Common race car classes - this will be populated from schema once added
    return [
      "GT3",
      "GT4",
      "Formula",
      "Prototype",
      "Touring",
      "Rally",
      "Drift",
      "Time Attack",
      "Endurance",
    ]
  }, [])

  // Filter vehicles with enhanced search and filters
  const filteredVehicles = useMemo(() => {
    let filtered = vehicles.filter((vehicle) => {
      // Enhanced multi-field search
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase()
        const searchableText = [
          vehicle.make,
          vehicle.model,
          vehicle.name,
          vehicle.track,
          vehicle.location,
        ]
          .join(" ")
          .toLowerCase()
        if (!searchableText.includes(query)) {
          return false
        }
      }

      // Track filter
      if (selectedTrack !== "all" && vehicle.track !== selectedTrack) {
        return false
      }

      // Make filter
      if (selectedMake !== "all" && vehicle.make !== selectedMake) {
        return false
      }

      // Model filter
      if (selectedModel !== "all" && vehicle.model !== selectedModel) {
        return false
      }

      // Race Car Class filter (will work once schema is updated)
      if (
        selectedRaceCarClass !== "all" &&
        vehicle.raceCarClass &&
        vehicle.raceCarClass !== selectedRaceCarClass
      ) {
        return false
      }

      // Drive Type filter
      if (
        selectedDriveType !== "all" &&
        vehicle.drivetrain &&
        vehicle.drivetrain.toUpperCase() !== selectedDriveType.toUpperCase()
      ) {
        return false
      }

      // Location filter
      if (
        selectedLocation &&
        !vehicle.location.toLowerCase().includes(selectedLocation.toLowerCase())
      ) {
        return false
      }

      // Price range filter
      if (selectedPriceRange !== "any") {
        if (selectedPriceRange.endsWith("+")) {
          const minPrice = Number.parseInt(selectedPriceRange.replace(/\D/g, ""), 10)
          if (vehicle.pricePerDay < minPrice) {
            return false
          }
        } else {
          const [min, max] = selectedPriceRange
            .split("-")
            .map((p) => Number.parseInt(p.replace(/\D/g, ""), 10))
          if (vehicle.pricePerDay < min || vehicle.pricePerDay > max) {
            return false
          }
        }
      }

      // Horsepower filter
      if (
        minHorsepower &&
        vehicle.horsepower &&
        vehicle.horsepower < Number.parseInt(minHorsepower, 10)
      ) {
        return false
      }
      if (
        maxHorsepower &&
        vehicle.horsepower &&
        vehicle.horsepower > Number.parseInt(maxHorsepower, 10)
      ) {
        return false
      }

      // Transmission filter
      if (
        selectedTransmission !== "all" &&
        vehicle.transmission?.toLowerCase() !== selectedTransmission.toLowerCase()
      ) {
        return false
      }

      // Year filter
      if (minYear && vehicle.year < Number.parseInt(minYear, 10)) {
        return false
      }
      if (maxYear && vehicle.year > Number.parseInt(maxYear, 10)) {
        return false
      }

      // Rating filter
      if (minRating && vehicle.rating < Number.parseFloat(minRating)) {
        return false
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
  }, [
    vehicles,
    debouncedSearchQuery,
    selectedTrack,
    selectedMake,
    selectedModel,
    selectedRaceCarClass,
    selectedDriveType,
    selectedLocation,
    selectedPriceRange,
    minHorsepower,
    maxHorsepower,
    selectedTransmission,
    minYear,
    maxYear,
    minRating,
    sortBy,
  ])

  // Paginate filtered vehicles
  const paginatedVehicles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredVehicles.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredVehicles, currentPage])

  const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage)
  const hasMore = currentPage < totalPages

  // Reset model filter when make changes
  useEffect(() => {
    setSelectedModel("all")
  }, [selectedMake])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [
    debouncedSearchQuery,
    selectedTrack,
    selectedMake,
    selectedModel,
    selectedRaceCarClass,
    selectedDriveType,
    selectedLocation,
    selectedPriceRange,
    minHorsepower,
    maxHorsepower,
    selectedTransmission,
    minYear,
    maxYear,
    minRating,
    sortBy,
  ])

  // Get active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (debouncedSearchQuery) count++
    if (selectedTrack !== "all") count++
    if (selectedMake !== "all") count++
    if (selectedModel !== "all") count++
    if (selectedRaceCarClass !== "all") count++
    if (selectedDriveType !== "all") count++
    if (selectedLocation) count++
    if (selectedPriceRange !== "any") count++
    if (minHorsepower || maxHorsepower) count++
    if (selectedTransmission !== "all") count++
    if (minYear || maxYear) count++
    if (minRating) count++
    if (selectedDates.start || selectedDates.end) count++
    return count
  }, [
    debouncedSearchQuery,
    selectedTrack,
    selectedMake,
    selectedModel,
    selectedRaceCarClass,
    selectedDriveType,
    selectedLocation,
    selectedPriceRange,
    minHorsepower,
    maxHorsepower,
    selectedTransmission,
    minYear,
    maxYear,
    minRating,
    selectedDates,
  ])

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedLocation("")
    setSelectedTrack("all")
    setSelectedMake("all")
    setSelectedModel("all")
    setSelectedRaceCarClass("all")
    setSelectedDriveType("all")
    setSelectedPriceRange("any")
    setMinHorsepower("")
    setMaxHorsepower("")
    setSelectedTransmission("all")
    setMinYear("")
    setMaxYear("")
    setMinRating("")
    setSelectedDates({ start: "", end: "" })
    setCurrentPage(1)
  }

  const loadMore = () => {
    if (hasMore) {
      setCurrentPage((prev) => prev + 1)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-border border-b">
        <div className="container relative z-10 mx-auto px-4 py-12 sm:px-6 md:py-16">
          <div className="mb-8 text-center">
            <h1 className="mb-3 font-semibold text-4xl tracking-tight md:text-5xl">
              Find Your Perfect Track Vehicle
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Discover high-performance race cars ready for your next track day
            </p>
          </div>

          {/* Enhanced Search Bar */}
          <Card className="shadow-sm">
            <CardContent className="p-4 md:p-6">
              <div className="space-y-4">
                {/* Search Input */}
                <div className="relative">
                  <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-5 text-muted-foreground" />
                  <Input
                    className="h-12 pl-10 text-base"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by make, model, track, or location..."
                    value={searchQuery}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <Label className="mb-2 flex items-center gap-2" htmlFor="track">
                      <MapPin className="size-4" />
                      Track
                    </Label>
                    <Select onValueChange={setSelectedTrack} value={selectedTrack}>
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
                    <Label className="mb-2 flex items-center gap-2" htmlFor="location">
                      <MapPin className="size-4" />
                      Location
                    </Label>
                    <Input
                      id="location"
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      placeholder="City, State"
                      value={selectedLocation}
                    />
                  </div>

                  <div>
                    <Label className="mb-2 flex items-center gap-2" htmlFor="start-date">
                      <Calendar className="size-4" />
                      Start Date
                    </Label>
                    <Input
                      id="start-date"
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) =>
                        setSelectedDates({ ...selectedDates, start: e.target.value })
                      }
                      type="date"
                      value={selectedDates.start}
                    />
                  </div>

                  <div>
                    <Label className="mb-2 flex items-center gap-2" htmlFor="end-date">
                      <Calendar className="size-4" />
                      End Date
                    </Label>
                    <Input
                      id="end-date"
                      min={selectedDates.start || new Date().toISOString().split("T")[0]}
                      onChange={(e) => setSelectedDates({ ...selectedDates, end: e.target.value })}
                      type="date"
                      value={selectedDates.end}
                    />
                  </div>

                  <div className="flex items-end">
                    <Button className="w-full" size="lg">
                      <Search className="mr-2 size-4" />
                      Search
                    </Button>
                  </div>
                </div>

                {/* Active Filters Badges */}
                {activeFiltersCount > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                    <span className="text-muted-foreground text-sm">Active filters:</span>
                    {debouncedSearchQuery && (
                      <Badge className="gap-1" variant="secondary">
                        Search: {debouncedSearchQuery}
                        <X className="size-3 cursor-pointer" onClick={() => setSearchQuery("")} />
                      </Badge>
                    )}
                    {selectedTrack !== "all" && (
                      <Badge className="gap-1" variant="secondary">
                        Track: {selectedTrack}
                        <X
                          className="size-3 cursor-pointer"
                          onClick={() => setSelectedTrack("all")}
                        />
                      </Badge>
                    )}
                    {selectedMake !== "all" && (
                      <Badge className="gap-1" variant="secondary">
                        Make: {selectedMake}
                        <X
                          className="size-3 cursor-pointer"
                          onClick={() => setSelectedMake("all")}
                        />
                      </Badge>
                    )}
                    {selectedModel !== "all" && (
                      <Badge className="gap-1" variant="secondary">
                        Model: {selectedModel}
                        <X
                          className="size-3 cursor-pointer"
                          onClick={() => setSelectedModel("all")}
                        />
                      </Badge>
                    )}
                    {selectedRaceCarClass !== "all" && (
                      <Badge className="gap-1" variant="secondary">
                        Class: {selectedRaceCarClass}
                        <X
                          className="size-3 cursor-pointer"
                          onClick={() => setSelectedRaceCarClass("all")}
                        />
                      </Badge>
                    )}
                    {selectedDriveType !== "all" && (
                      <Badge className="gap-1" variant="secondary">
                        Drive: {selectedDriveType}
                        <X
                          className="size-3 cursor-pointer"
                          onClick={() => setSelectedDriveType("all")}
                        />
                      </Badge>
                    )}
                    {selectedLocation && (
                      <Badge className="gap-1" variant="secondary">
                        Location: {selectedLocation}
                        <X
                          className="size-3 cursor-pointer"
                          onClick={() => setSelectedLocation("")}
                        />
                      </Badge>
                    )}
                    {selectedPriceRange !== "any" && (
                      <Badge className="gap-1" variant="secondary">
                        Price: {selectedPriceRange}
                        <X
                          className="size-3 cursor-pointer"
                          onClick={() => setSelectedPriceRange("any")}
                        />
                      </Badge>
                    )}
                    {(minHorsepower || maxHorsepower) && (
                      <Badge className="gap-1" variant="secondary">
                        HP: {minHorsepower || "0"}-{maxHorsepower || "∞"}
                        <X
                          className="size-3 cursor-pointer"
                          onClick={() => {
                            setMinHorsepower("")
                            setMaxHorsepower("")
                          }}
                        />
                      </Badge>
                    )}
                    {selectedTransmission !== "all" && (
                      <Badge className="gap-1" variant="secondary">
                        Transmission: {selectedTransmission}
                        <X
                          className="size-3 cursor-pointer"
                          onClick={() => setSelectedTransmission("all")}
                        />
                      </Badge>
                    )}
                    {(minYear || maxYear) && (
                      <Badge className="gap-1" variant="secondary">
                        Year: {minYear || "Any"}-{maxYear || "Any"}
                        <X
                          className="size-3 cursor-pointer"
                          onClick={() => {
                            setMinYear("")
                            setMaxYear("")
                          }}
                        />
                      </Badge>
                    )}
                    {minRating && (
                      <Badge className="gap-1" variant="secondary">
                        Rating: {minRating}+
                        <X className="size-3 cursor-pointer" onClick={() => setMinRating("")} />
                      </Badge>
                    )}
                    {(selectedDates.start || selectedDates.end) && (
                      <Badge className="gap-1" variant="secondary">
                        Dates: {selectedDates.start || "..."} - {selectedDates.end || "..."}
                        <X
                          className="size-3 cursor-pointer"
                          onClick={() => setSelectedDates({ start: "", end: "" })}
                        />
                      </Badge>
                    )}
                    <Button
                      className="h-6 text-xs"
                      onClick={clearFilters}
                      size="sm"
                      variant="ghost"
                    >
                      Clear all
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results Summary */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">{filteredVehicles.length}</span>{" "}
              vehicles available
              {filteredVehicles.length > paginatedVehicles.length && (
                <span className="ml-2 text-sm">
                  (showing {paginatedVehicles.length} of {filteredVehicles.length})
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setViewMode("grid")}
                size="sm"
                variant={viewMode === "grid" ? "default" : "outline"}
              >
                <Grid3x3 className="size-4" />
              </Button>
              <Button
                onClick={() => setViewMode("list")}
                size="sm"
                variant={viewMode === "list" ? "default" : "outline"}
              >
                <List className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Enhanced Filter Sidebar */}
          <div className={cn("lg:col-span-1", !showFilters && "hidden lg:block")}>
            <div className="sticky top-20 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="size-5" />
                  <h2 className="font-semibold text-lg">Filters</h2>
                  {activeFiltersCount > 0 && (
                    <Badge className="ml-2" variant="secondary">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </div>
                <Button
                  className="lg:hidden"
                  onClick={() => setShowFilters(false)}
                  size="sm"
                  variant="ghost"
                >
                  <X className="size-4" />
                </Button>
              </div>

              <Card>
                <CardContent className="p-6">
                  <Accordion
                    className="w-full"
                    defaultValue={["track", "make", "price"]}
                    type="multiple"
                  >
                    <AccordionItem value="track">
                      <AccordionTrigger className="font-medium text-sm">Track</AccordionTrigger>
                      <AccordionContent>
                        <Select onValueChange={setSelectedTrack} value={selectedTrack}>
                          <SelectTrigger>
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
                      </AccordionContent>
                    </AccordionItem>

                    <Separator />

                    <AccordionItem value="make">
                      <AccordionTrigger className="font-medium text-sm">
                        Vehicle Make
                      </AccordionTrigger>
                      <AccordionContent>
                        <Select onValueChange={setSelectedMake} value={selectedMake}>
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

                    <AccordionItem value="model">
                      <AccordionTrigger className="font-medium text-sm">Model</AccordionTrigger>
                      <AccordionContent>
                        <Select
                          disabled={selectedMake === "all"}
                          onValueChange={setSelectedModel}
                          value={selectedModel}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                selectedMake === "all" ? "Select make first" : "All models"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All models</SelectItem>
                            {models.map((model) => (
                              <SelectItem key={model} value={model}>
                                {model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </AccordionContent>
                    </AccordionItem>

                    <Separator />

                    <AccordionItem value="raceCarClass">
                      <AccordionTrigger className="font-medium text-sm">
                        Race Car Class
                      </AccordionTrigger>
                      <AccordionContent>
                        <Select
                          onValueChange={setSelectedRaceCarClass}
                          value={selectedRaceCarClass}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All classes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All classes</SelectItem>
                            {raceCarClasses.map((raceClass) => (
                              <SelectItem key={raceClass} value={raceClass}>
                                {raceClass}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="mt-2 text-muted-foreground text-xs">
                          Note: This filter will work once race car class is added to the vehicle
                          schema.
                        </p>
                      </AccordionContent>
                    </AccordionItem>

                    <Separator />

                    <AccordionItem value="driveType">
                      <AccordionTrigger className="font-medium text-sm">
                        Drive Type
                      </AccordionTrigger>
                      <AccordionContent>
                        <Select onValueChange={setSelectedDriveType} value={selectedDriveType}>
                          <SelectTrigger>
                            <SelectValue placeholder="All drive types" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All drive types</SelectItem>
                            <SelectItem value="FWD">FWD</SelectItem>
                            <SelectItem value="RWD">RWD</SelectItem>
                            <SelectItem value="AWD">AWD</SelectItem>
                          </SelectContent>
                        </Select>
                      </AccordionContent>
                    </AccordionItem>

                    <Separator />

                    <AccordionItem value="price">
                      <AccordionTrigger className="font-medium text-sm">
                        Price Range
                      </AccordionTrigger>
                      <AccordionContent>
                        <Select onValueChange={setSelectedPriceRange} value={selectedPriceRange}>
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

                    <AccordionItem value="horsepower">
                      <AccordionTrigger className="font-medium text-sm">
                        Horsepower
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        <div>
                          <Label htmlFor="min-hp">Min HP</Label>
                          <Input
                            id="min-hp"
                            min={0}
                            onChange={(e) => setMinHorsepower(e.target.value)}
                            placeholder="e.g., 400"
                            type="number"
                            value={minHorsepower}
                          />
                        </div>
                        <div>
                          <Label htmlFor="max-hp">Max HP</Label>
                          <Input
                            id="max-hp"
                            min={0}
                            onChange={(e) => setMaxHorsepower(e.target.value)}
                            placeholder="e.g., 800"
                            type="number"
                            value={maxHorsepower}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <Separator />

                    <AccordionItem value="transmission">
                      <AccordionTrigger className="font-medium text-sm">
                        Transmission
                      </AccordionTrigger>
                      <AccordionContent>
                        <Select
                          onValueChange={setSelectedTransmission}
                          value={selectedTransmission}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All transmissions" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All transmissions</SelectItem>
                            <SelectItem value="Manual">Manual</SelectItem>
                            <SelectItem value="Automatic">Automatic</SelectItem>
                            <SelectItem value="Sequential">Sequential</SelectItem>
                          </SelectContent>
                        </Select>
                      </AccordionContent>
                    </AccordionItem>

                    <Separator />

                    <AccordionItem value="year">
                      <AccordionTrigger className="font-medium text-sm">
                        Year Range
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        <div>
                          <Label htmlFor="min-year">Min Year</Label>
                          <Input
                            id="min-year"
                            max={new Date().getFullYear() + 1}
                            min={1900}
                            onChange={(e) => setMinYear(e.target.value)}
                            placeholder="e.g., 2020"
                            type="number"
                            value={minYear}
                          />
                        </div>
                        <div>
                          <Label htmlFor="max-year">Max Year</Label>
                          <Input
                            id="max-year"
                            max={new Date().getFullYear() + 1}
                            min={1900}
                            onChange={(e) => setMaxYear(e.target.value)}
                            placeholder="e.g., 2024"
                            type="number"
                            value={maxYear}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <Separator />

                    <AccordionItem value="rating">
                      <AccordionTrigger className="font-medium text-sm">
                        Minimum Rating
                      </AccordionTrigger>
                      <AccordionContent>
                        <Select onValueChange={setMinRating} value={minRating}>
                          <SelectTrigger>
                            <SelectValue placeholder="Any rating" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Any rating</SelectItem>
                            <SelectItem value="4">4+ stars</SelectItem>
                            <SelectItem value="4.5">4.5+ stars</SelectItem>
                            <SelectItem value="4.7">4.7+ stars</SelectItem>
                            <SelectItem value="4.9">4.9+ stars</SelectItem>
                          </SelectContent>
                        </Select>
                      </AccordionContent>
                    </AccordionItem>

                    <Separator />

                    <AccordionItem value="sort">
                      <AccordionTrigger className="font-medium text-sm">Sort By</AccordionTrigger>
                      <AccordionContent>
                        <Select onValueChange={setSortBy} value={sortBy}>
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

                  {activeFiltersCount > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <Button className="w-full" onClick={clearFilters} variant="outline">
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
              <Button className="w-full" onClick={() => setShowFilters(true)} variant="outline">
                <Filter className="mr-2 size-4" />
                Show Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              </Button>
            </div>
          )}

          {/* Vehicle Grid */}
          <div className="lg:col-span-3">
            {vehiclesData === undefined || tracksData === undefined ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="mb-4 size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <h3 className="mb-2 font-semibold text-lg">Loading vehicles...</h3>
                </CardContent>
              </Card>
            ) : vehicles.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Search className="mb-4 size-12 text-muted-foreground" />
                  <h3 className="mb-2 font-semibold text-lg">No vehicles in database</h3>
                  <p className="mb-4 text-center text-muted-foreground">
                    No active and approved vehicles found. Vehicles need to be both active and
                    approved to appear.
                  </p>
                </CardContent>
              </Card>
            ) : filteredVehicles.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Search className="mb-4 size-12 text-muted-foreground" />
                  <h3 className="mb-2 font-semibold text-lg">No vehicles found</h3>
                  <p className="mb-4 text-center text-muted-foreground">
                    Try adjusting your filters to see more results
                  </p>
                  <Button onClick={clearFilters} variant="outline">
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Suspense fallback={<div>Loading...</div>}>
                  <div
                    className={cn(
                      "grid gap-6",
                      viewMode === "grid"
                        ? "auto-rows-fr md:grid-cols-2 xl:grid-cols-3"
                        : "grid-cols-1"
                    )}
                  >
                    {paginatedVehicles.map((vehicle) => (
                      <VehicleCard
                        key={vehicle.id}
                        {...vehicle}
                        horsepower={vehicle.horsepower}
                        track={vehicle.track}
                        transmission={vehicle.transmission}
                      />
                    ))}
                  </div>
                </Suspense>

                {/* Pagination / Load More */}
                {hasMore && (
                  <div className="mt-8 flex justify-center">
                    <Button onClick={loadMore} size="lg" variant="outline">
                      Load More Vehicles
                      <ChevronRight className="ml-2 size-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
