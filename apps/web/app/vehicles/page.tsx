"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Calendar as CalendarComponent } from "@workspace/ui/components/calendar"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Slider } from "@workspace/ui/components/slider"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import { format } from "date-fns"
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Filter,
  Grid3x3,
  List,
  MapPin,
  Search,
  X,
} from "lucide-react"
import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { DateRange } from "react-day-picker"
import { VehicleCard } from "@/components/vehicle-card"
import { useDebounce } from "@/hooks/useDebounce"
import { api } from "@/lib/convex"

export default function VehiclesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Initialize state from URL params
  const getInitialState = () => {
    return {
      viewMode: (searchParams.get("view") as "grid" | "list") || "grid",
      searchQuery: searchParams.get("q") || "",
      selectedLocation: searchParams.get("location") || "",
      selectedTrack: searchParams.get("track") || "all",
      selectedMake: searchParams.get("make") || "all",
      selectedModel: searchParams.get("model") || "all",
      selectedRaceCarClass: searchParams.get("class") || "all",
      selectedDriveType: searchParams.get("drive") || "all",
      selectedPriceRange: searchParams.get("price") || "any",
      minHorsepower: searchParams.get("minHp") || "",
      maxHorsepower: searchParams.get("maxHp") || "",
      selectedTransmission: searchParams.get("transmission") || "all",
      minYear: searchParams.get("minYear") || "",
      maxYear: searchParams.get("maxYear") || "",
      minRating: searchParams.get("rating") || "",
      sortBy: searchParams.get("sort") || "popularity",
      startDate: searchParams.get("startDate") || "",
      endDate: searchParams.get("endDate") || "",
    }
  }

  const initialState = getInitialState()
  
  const [viewMode, setViewMode] = useState<"grid" | "list">(initialState.viewMode)
  const [showFilters, setShowFilters] = useState(true)
  const [searchQuery, setSearchQuery] = useState(initialState.searchQuery)
  const [selectedLocation, setSelectedLocation] = useState(initialState.selectedLocation)
  const [selectedTrack, setSelectedTrack] = useState(initialState.selectedTrack)
  const [selectedMake, setSelectedMake] = useState(initialState.selectedMake)
  const [selectedModel, setSelectedModel] = useState(initialState.selectedModel)
  const [selectedRaceCarClass, setSelectedRaceCarClass] = useState(initialState.selectedRaceCarClass)
  const [selectedDriveType, setSelectedDriveType] = useState(initialState.selectedDriveType)
  const [selectedPriceRange, setSelectedPriceRange] = useState(initialState.selectedPriceRange)
  // Price slider state (in dollars per day)
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000])
  const [customPriceRange, setCustomPriceRange] = useState<[number, number] | null>(null)
  const [minHorsepower, setMinHorsepower] = useState(initialState.minHorsepower)
  const [maxHorsepower, setMaxHorsepower] = useState(initialState.maxHorsepower)
  const [selectedTransmission, setSelectedTransmission] = useState(initialState.selectedTransmission)
  const [minYear, setMinYear] = useState(initialState.minYear)
  const [maxYear, setMaxYear] = useState(initialState.maxYear)
  const [minRating, setMinRating] = useState(initialState.minRating)
  const [sortBy, setSortBy] = useState(initialState.sortBy)
  const [selectedDates, setSelectedDates] = useState({
    start: initialState.startDate,
    end: initialState.endDate,
  })
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    initialState.startDate && initialState.endDate
      ? {
          from: new Date(initialState.startDate),
          to: new Date(initialState.endDate),
        }
      : undefined
  )
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Sync state to URL params
  useEffect(() => {
    const params = new URLSearchParams()
    
    if (viewMode !== "grid") params.set("view", viewMode)
    if (debouncedSearchQuery) params.set("q", debouncedSearchQuery)
    if (selectedLocation) params.set("location", selectedLocation)
    if (selectedTrack !== "all") params.set("track", selectedTrack)
    if (selectedMake !== "all") params.set("make", selectedMake)
    if (selectedModel !== "all") params.set("model", selectedModel)
    if (selectedRaceCarClass !== "all") params.set("class", selectedRaceCarClass)
    if (selectedDriveType !== "all") params.set("drive", selectedDriveType)
    if (selectedPriceRange !== "any") params.set("price", selectedPriceRange)
    if (minHorsepower) params.set("minHp", minHorsepower)
    if (maxHorsepower) params.set("maxHp", maxHorsepower)
    if (selectedTransmission !== "all") params.set("transmission", selectedTransmission)
    if (minYear) params.set("minYear", minYear)
    if (maxYear) params.set("maxYear", maxYear)
    if (minRating) params.set("rating", minRating)
    if (sortBy !== "popularity") params.set("sort", sortBy)
    if (selectedDates.start) params.set("startDate", selectedDates.start)
    if (selectedDates.end) params.set("endDate", selectedDates.end)

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    router.replace(newUrl, { scroll: false })
  }, [
    viewMode,
    debouncedSearchQuery,
    selectedLocation,
    selectedTrack,
    selectedMake,
    selectedModel,
    selectedRaceCarClass,
    selectedDriveType,
    selectedPriceRange,
    minHorsepower,
    maxHorsepower,
    selectedTransmission,
    minYear,
    maxYear,
    minRating,
    sortBy,
    selectedDates,
    router,
  ])

  // Fetch tracks first (needed for track ID lookup)
  const tracksData = useQuery(api.tracks.getAll, {})

  // Fetch vehicles and tracks from Convex with availability filtering
  const vehiclesData = useQuery(
    api.vehicles.searchWithAvailability,
    tracksData
      ? {
          startDate: selectedDates.start || undefined,
          endDate: selectedDates.end || undefined,
          trackId:
            selectedTrack !== "all"
              ? (tracksData.find((t) => t.name === selectedTrack)?._id as
                  | string
                  | undefined)
              : undefined,
          limit: 200, // Get more for client-side filtering
        }
      : "skip"
  )

  // Fetch vehicle stats for all vehicles
  const vehicleStats = useQuery(
    api.reviews.getVehicleStatsBatch,
    vehiclesData && vehiclesData.length > 0
      ? { vehicleIds: vehiclesData.map((v) => v._id) as any[] }
      : "skip"
  )

  // Map vehicles to the format expected by VehicleCard
  const vehicles = useMemo(() => {
    if (!vehiclesData) return []
    const mapped = vehiclesData.map((vehicle) => {
      const primaryImage = vehicle.images?.find((img) => img.isPrimary) || vehicle.images?.[0]
      const stats = vehicleStats?.[vehicle._id]
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
        rating: stats?.averageRating || 0,
        reviews: stats?.totalReviews || 0,
        horsepower: vehicle.horsepower,
        transmission: vehicle.transmission || "",
        drivetrain: vehicle.drivetrain || "",
        raceCarClass: (vehicle as any).raceCarClass || "", // TODO: Add to schema
      }
    })
    return mapped
  }, [vehiclesData, vehicleStats])

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

  // Search suggestions based on vehicles
  const searchSuggestions = useMemo(() => {
    if (!debouncedSearchQuery || debouncedSearchQuery.length < 2) return []
    
    const query = debouncedSearchQuery.toLowerCase()
    const suggestions: string[] = []
    
    // Get unique makes, models, tracks, locations
    const makes = Array.from(new Set(vehicles.map((v) => v.make))).filter((make) =>
      make.toLowerCase().includes(query)
    )
    const models = Array.from(new Set(vehicles.map((v) => v.model))).filter((model) =>
      model.toLowerCase().includes(query)
    )
    const tracks = Array.from(new Set(vehicles.map((v) => v.track).filter(Boolean))).filter(
      (track) => track && track.toLowerCase().includes(query)
    ) as string[]
    const locations = Array.from(new Set(vehicles.map((v) => v.location).filter(Boolean))).filter(
      (location) => location && location.toLowerCase().includes(query)
    ) as string[]
    
    suggestions.push(...makes.slice(0, 3))
    suggestions.push(...models.slice(0, 3))
    suggestions.push(...tracks.slice(0, 2))
    suggestions.push(...locations.slice(0, 2))
    
    return Array.from(new Set(suggestions)).slice(0, 5)
  }, [debouncedSearchQuery, vehicles])

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

      // Price range filter (supports both slider and dropdown)
      if (customPriceRange) {
        const [minPrice, maxPrice] = customPriceRange
        if (vehicle.pricePerDay < minPrice || vehicle.pricePerDay > maxPrice) {
          return false
        }
      } else if (selectedPriceRange !== "any") {
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

  // Sync dateRange with selectedDates
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      setSelectedDates({
        start: format(dateRange.from, "yyyy-MM-dd"),
        end: format(dateRange.to, "yyyy-MM-dd"),
      })
    } else if (!dateRange?.from && !dateRange?.to) {
      setSelectedDates({ start: "", end: "" })
    }
  }, [dateRange])

  // Initialize dateRange from selectedDates on mount
  useEffect(() => {
    if (selectedDates.start && selectedDates.end) {
      setDateRange({
        from: new Date(selectedDates.start),
        to: new Date(selectedDates.end),
      })
    }
  }, []) // Only on mount

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
    selectedDates,
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
    setCustomPriceRange(null)
    setMinHorsepower("")
    setMaxHorsepower("")
    setSelectedTransmission("all")
    setMinYear("")
    setMaxYear("")
    setMinRating("")
    setSelectedDates({ start: "", end: "" })
    setDateRange(undefined)
    setCurrentPage(1)
  }

  // Quick filter presets
  const applyQuickFilter = (preset: "thisWeekend" | "nextWeek" | "thisMonth" | "nextMonth") => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let startDate: Date
    let endDate: Date
    
    switch (preset) {
      case "thisWeekend": {
        // This Saturday
        const saturday = new Date(today)
        const dayOfWeek = today.getDay()
        const daysUntilSaturday = dayOfWeek === 0 ? 6 : 6 - dayOfWeek
        saturday.setDate(today.getDate() + daysUntilSaturday)
        startDate = saturday
        // This Sunday
        endDate = new Date(saturday)
        endDate.setDate(saturday.getDate() + 1)
        break
      }
      case "nextWeek": {
        // Next Monday
        const nextMonday = new Date(today)
        const dayOfWeek = today.getDay()
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
        nextMonday.setDate(today.getDate() + daysUntilMonday)
        startDate = nextMonday
        // Next Sunday
        endDate = new Date(nextMonday)
        endDate.setDate(nextMonday.getDate() + 6)
        break
      }
      case "thisMonth": {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        break
      }
      case "nextMonth": {
        startDate = new Date(today.getFullYear(), today.getMonth() + 1, 1)
        endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0)
        break
      }
    }
    
    setDateRange({ from: startDate, to: endDate })
    setDatePickerOpen(false)
  }

  const loadMore = () => {
    if (hasMore) {
      setCurrentPage((prev) => prev + 1)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-border border-b bg-gradient-to-b from-background to-muted/20">
        <div className="container relative z-10 mx-auto px-4 py-8 sm:px-6 md:py-12">
          <div className="mb-6 text-center md:mb-8">
            <h1 className="mb-3 font-bold text-3xl tracking-tight md:text-4xl lg:text-5xl">
              Find Your Perfect Track Vehicle
            </h1>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
              Discover high-performance race cars ready for your next track day
            </p>
          </div>

          {/* Enhanced Search Bar */}
          <Card className="shadow-lg">
            <CardContent className="p-4 md:p-6">
              <div className="space-y-4">
                {/* Enhanced Search Input with Autocomplete */}
                <div className="relative">
                  <Search className="-translate-y-1/2 absolute top-1/2 left-4 size-5 text-muted-foreground" />
                  <Input
                    className="h-14 pl-12 pr-4 text-base shadow-sm"
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onFocus={() => searchSuggestions.length > 0 && setShowSuggestions(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setShowSuggestions(e.target.value.length >= 2)
                    }}
                    placeholder="Search by make, model, track, or location..."
                    value={searchQuery}
                  />
                  {showSuggestions && searchSuggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                      {searchSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            setSearchQuery(suggestion)
                            setShowSuggestions(false)
                          }}
                          type="button"
                        >
                          <Search className="mr-2 inline size-4" />
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Filter Chips */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => applyQuickFilter("thisWeekend")}
                    size="sm"
                    variant="outline"
                  >
                    This Weekend
                  </Button>
                  <Button
                    onClick={() => applyQuickFilter("nextWeek")}
                    size="sm"
                    variant="outline"
                  >
                    Next Week
                  </Button>
                  <Button
                    onClick={() => applyQuickFilter("thisMonth")}
                    size="sm"
                    variant="outline"
                  >
                    This Month
                  </Button>
                  <Button
                    onClick={() => applyQuickFilter("nextMonth")}
                    size="sm"
                    variant="outline"
                  >
                    Next Month
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

                  <div className="md:col-span-2">
                    <Label className="mb-2 flex items-center gap-2">
                      <Calendar className="size-4" />
                      Dates
                    </Label>
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          className={cn(
                            "h-12 w-full justify-start text-left font-normal shadow-sm",
                            !dateRange && "text-muted-foreground"
                          )}
                          id="date-range"
                          variant="outline"
                        >
                          <Calendar className="mr-2 size-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                {format(dateRange.to, "LLL dd, y")}
                              </>
                            ) : (
                              format(dateRange.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Select dates</span>
                          )}
                          <ChevronDown className="ml-auto size-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-auto p-0"
                        sideOffset={4}
                      >
                        <div className="p-3">
                          <CalendarComponent
                            disabled={(date) => {
                              const today = new Date()
                              today.setHours(0, 0, 0, 0)
                              return date < today
                            }}
                            initialFocus
                            mode="range"
                            numberOfMonths={isMobile ? 1 : 2}
                            onSelect={(range) => {
                              setDateRange(range)
                              if (range?.from && range?.to) {
                                setDatePickerOpen(false)
                              }
                            }}
                            selected={dateRange}
                          />
                          {dateRange?.from && (
                            <div className="border-t p-3">
                              <Button
                                className="w-full"
                                onClick={() => {
                                  setDateRange(undefined)
                                  setSelectedDates({ start: "", end: "" })
                                }}
                                size="sm"
                                variant="outline"
                              >
                                <X className="mr-2 size-4" />
                                Clear dates
                              </Button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
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
                        Dates:{" "}
                        {selectedDates.start && selectedDates.end
                          ? `${format(new Date(selectedDates.start), "MMM dd")} - ${format(new Date(selectedDates.end), "MMM dd")}`
                          : selectedDates.start
                            ? format(new Date(selectedDates.start), "MMM dd")
                            : "..."}
                        <X
                          className="size-3 cursor-pointer"
                          onClick={() => {
                            setSelectedDates({ start: "", end: "" })
                            setDateRange(undefined)
                          }}
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
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-muted-foreground">
                <span className="font-bold text-foreground text-lg">
                  {filteredVehicles.length}
                </span>{" "}
                {filteredVehicles.length === 1 ? "vehicle" : "vehicles"} available
                {filteredVehicles.length > paginatedVehicles.length && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    (showing {paginatedVehicles.length} of {filteredVehicles.length})
                  </span>
                )}
              </p>
              {activeFiltersCount > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeFiltersCount} {activeFiltersCount === 1 ? "filter" : "filters"} active
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setViewMode("grid")}
                size="sm"
                variant={viewMode === "grid" ? "default" : "outline"}
              >
                <Grid3x3 className="size-4" />
                <span className="ml-2 hidden sm:inline">Grid</span>
              </Button>
              <Button
                onClick={() => setViewMode("list")}
                size="sm"
                variant={viewMode === "list" ? "default" : "outline"}
              >
                <List className="size-4" />
                <span className="ml-2 hidden sm:inline">List</span>
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
                      <AccordionContent className="space-y-4">
                        {/* Calculate price range from vehicles */}
                        {(() => {
                          const prices = vehicles.map((v) => v.pricePerDay).filter(Boolean)
                          const minPrice = prices.length > 0 ? Math.min(...prices) : 0
                          const maxPrice = prices.length > 0 ? Math.max(...prices) : 5000
                          const currentMin = customPriceRange?.[0] ?? minPrice
                          const currentMax = customPriceRange?.[1] ?? maxPrice

                          return (
                            <>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Min Price</span>
                                  <span className="font-medium">${currentMin}/day</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Max Price</span>
                                  <span className="font-medium">${currentMax}/day</span>
                                </div>
                                <Slider
                                  className="w-full"
                                  max={maxPrice}
                                  min={minPrice}
                                  onValueChange={(value) => {
                                    const [min, max] = value as [number, number]
                                    setCustomPriceRange([min, max])
                                    // Convert to selectedPriceRange format for compatibility
                                    if (min === minPrice && max === maxPrice) {
                                      setSelectedPriceRange("any")
                                    } else if (max === maxPrice) {
                                      setSelectedPriceRange(`${min}+`)
                                    } else {
                                      setSelectedPriceRange(`${min}-${max}`)
                                    }
                                  }}
                                  step={50}
                                  value={[currentMin, currentMax]}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    setCustomPriceRange(null)
                                    setSelectedPriceRange("any")
                                  }}
                                  size="sm"
                                  variant="outline"
                                >
                                  Reset
                                </Button>
                                <Button
                                  onClick={() => {
                                    setCustomPriceRange([0, 500])
                                    setSelectedPriceRange("0-500")
                                  }}
                                  size="sm"
                                  variant="outline"
                                >
                                  Under $500
                                </Button>
                                <Button
                                  onClick={() => {
                                    setCustomPriceRange([500, 1000])
                                    setSelectedPriceRange("500-1000")
                                  }}
                                  size="sm"
                                  variant="outline"
                                >
                                  $500-$1K
                                </Button>
                              </div>
                            </>
                          )
                        })()}
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
              <Button
                className="w-full shadow-sm"
                onClick={() => setShowFilters(true)}
                size="lg"
                variant="outline"
              >
                <Filter className="mr-2 size-4" />
                Show Filters
                {activeFiltersCount > 0 && (
                  <Badge className="ml-2" variant="secondary">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </div>
          )}

          {/* Vehicle Grid */}
          <div className="lg:col-span-3">
            {vehiclesData === undefined || tracksData === undefined ? (
              <div
                className={cn(
                  "grid gap-6",
                  viewMode === "grid"
                    ? "auto-rows-fr md:grid-cols-2 xl:grid-cols-3"
                    : "grid-cols-1"
                )}
              >
                {Array.from({ length: itemsPerPage }).map((_, index) => (
                  <Card key={index} className="overflow-hidden">
                    <Skeleton className="h-64 w-full" />
                    <CardContent className="p-6">
                      <Skeleton className="mb-3 h-6 w-3/4" />
                      <Skeleton className="mb-4 h-4 w-1/2" />
                      <div className="mt-4 border-t pt-4">
                        <Skeleton className="h-8 w-24" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : vehicles.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                    <Search className="size-8 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 font-semibold text-xl">No vehicles available</h3>
                  <p className="mb-4 max-w-md text-center text-muted-foreground">
                    No active and approved vehicles found. Vehicles need to be both active and
                    approved to appear in search results.
                  </p>
                </CardContent>
              </Card>
            ) : filteredVehicles.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                    <Search className="size-8 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 font-semibold text-xl">No vehicles found</h3>
                  <p className="mb-6 max-w-md text-center text-muted-foreground">
                    We couldn't find any vehicles matching your search criteria. Try adjusting your
                    filters or search terms to see more results.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={clearFilters} variant="default">
                      Clear All Filters
                    </Button>
                    <Button
                      onClick={() => {
                        setSearchQuery("")
                        setSelectedDates({ start: "", end: "" })
                        setDateRange(undefined)
                      }}
                      variant="outline"
                    >
                      Clear Search & Dates
                    </Button>
                  </div>
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
                  <div className="mt-8 flex flex-col items-center gap-4">
                    <Button onClick={loadMore} size="lg" variant="outline" className="shadow-sm">
                      Load More Vehicles
                      <ChevronRight className="ml-2 size-4" />
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Showing {paginatedVehicles.length} of {filteredVehicles.length} vehicles
                    </p>
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
