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
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
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
  Loader2,
  MapPin,
  Navigation,
  Search,
  X,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
import { VehicleCard } from "@/components/vehicle-card"
import { useDebounce } from "@/hooks/useDebounce"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { formatDateToISO, parseLocalDate } from "@/lib/date-utils"

const FILTERS_STORAGE_KEY = "renegade-vehicle-filters"

// Helper to get filters from session storage
const getStoredFilters = () => {
  if (typeof window === "undefined") return null
  try {
    const stored = sessionStorage.getItem(FILTERS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

// Helper to save filters to session storage
const saveFiltersToStorage = (filters: Record<string, unknown>) => {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
  } catch {
    // Ignore storage errors
  }
}

function VehiclesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize state from URL params, falling back to session storage
  const getInitialState = () => {
    // Check if URL has any filter params
    const hasUrlParams = searchParams.toString().length > 0

    // Parse location coordinates from URL
    const latParam = searchParams.get("lat")
    const lngParam = searchParams.get("lng")
    const hasLocation = latParam && lngParam

    // If no URL params, try to restore from session storage
    const storedFilters = hasUrlParams ? null : getStoredFilters()

    return {
      viewMode: (searchParams.get("view") as "grid" | "list") || storedFilters?.viewMode || "grid",
      searchQuery: searchParams.get("q") || storedFilters?.searchQuery || "",
      selectedLocation: searchParams.get("location") || storedFilters?.selectedLocation || "",
      selectedTrack: searchParams.get("track") || storedFilters?.selectedTrack || "all",
      selectedMake: searchParams.get("make") || storedFilters?.selectedMake || "all",
      selectedModel: searchParams.get("model") || storedFilters?.selectedModel || "all",
      selectedRaceCarClass:
        searchParams.get("class") || storedFilters?.selectedRaceCarClass || "all",
      selectedDriveType: searchParams.get("drive") || storedFilters?.selectedDriveType || "all",
      selectedPriceRange: searchParams.get("price") || storedFilters?.selectedPriceRange || "any",
      minHorsepower: searchParams.get("minHp") || storedFilters?.minHorsepower || "",
      maxHorsepower: searchParams.get("maxHp") || storedFilters?.maxHorsepower || "",
      selectedTransmission:
        searchParams.get("transmission") || storedFilters?.selectedTransmission || "all",
      minYear: searchParams.get("minYear") || storedFilters?.minYear || "",
      maxYear: searchParams.get("maxYear") || storedFilters?.maxYear || "",
      minRating: searchParams.get("rating") || storedFilters?.minRating || "",
      sortBy: searchParams.get("sort") || storedFilters?.sortBy || "popularity",
      startDate: searchParams.get("startDate") || storedFilters?.startDate || "",
      endDate: searchParams.get("endDate") || storedFilters?.endDate || "",
      // Location-based search params
      userLocation: hasLocation
        ? { lat: Number(latParam), lng: Number(lngParam) }
        : storedFilters?.userLocation || null,
      locationZipCode: searchParams.get("zip") || storedFilters?.locationZipCode || "",
      locationLabel: searchParams.get("locLabel") || storedFilters?.locationLabel || "",
      maxDistance: Number(searchParams.get("dist")) || storedFilters?.maxDistance || 0,
    }
  }

  const initialState = getInitialState()

  const [viewMode, setViewMode] = useState<"grid" | "list">(initialState.viewMode)
  const [showFilters, setShowFilters] = useState(false) // Start hidden on mobile
  const [searchQuery, setSearchQuery] = useState(initialState.searchQuery)
  const [selectedLocation, setSelectedLocation] = useState(initialState.selectedLocation)
  const [selectedTrack, setSelectedTrack] = useState(initialState.selectedTrack)
  const [selectedMake, setSelectedMake] = useState(initialState.selectedMake)
  const [selectedModel, setSelectedModel] = useState(initialState.selectedModel)
  const [selectedRaceCarClass, setSelectedRaceCarClass] = useState(
    initialState.selectedRaceCarClass
  )
  const [selectedDriveType, setSelectedDriveType] = useState(initialState.selectedDriveType)
  const [selectedPriceRange, setSelectedPriceRange] = useState(initialState.selectedPriceRange)
  // Price slider state (in dollars per day)
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000])
  const [customPriceRange, setCustomPriceRange] = useState<[number, number] | null>(null)
  const [minHorsepower, setMinHorsepower] = useState(initialState.minHorsepower)
  const [maxHorsepower, setMaxHorsepower] = useState(initialState.maxHorsepower)
  const [selectedTransmission, setSelectedTransmission] = useState(
    initialState.selectedTransmission
  )
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
          from: parseLocalDate(initialState.startDate) || undefined,
          to: parseLocalDate(initialState.endDate) || undefined,
        }
      : undefined
  )
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isMedium, setIsMedium] = useState(false)
  const [isLarge, setIsLarge] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  // Location-based search state (initialized from URL params)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(
    initialState.userLocation
  )
  const [locationZipCode, setLocationZipCode] = useState(initialState.locationZipCode)
  const [locationLabel, setLocationLabel] = useState(initialState.locationLabel)
  const [maxDistance, setMaxDistance] = useState<number>(initialState.maxDistance) // 0 = All miles
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [isGeocodingZip, setIsGeocodingZip] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  // Get user's current location using browser geolocation
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser")
      return
    }

    setIsGettingLocation(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setLocationLabel("Current location")
        setLocationZipCode("")
        setIsGettingLocation(false)
      },
      (error) => {
        setIsGettingLocation(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location access denied. Please enable location permissions.")
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information unavailable.")
            break
          case error.TIMEOUT:
            setLocationError("Location request timed out.")
            break
          default:
            setLocationError("Unable to get your location.")
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 300_000 }
    )
  }, [])

  // Geocode ZIP code to coordinates using Google Maps API
  const geocodeZipCode = useCallback(async (zipCode: string) => {
    if (!zipCode || zipCode.length < 5) return

    setIsGeocodingZip(true)
    setLocationError(null)

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(zipCode)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      )
      const data = await response.json()

      if (data.status === "OK" && data.results?.[0]) {
        const location = data.results[0].geometry.location
        setUserLocation({ lat: location.lat, lng: location.lng })
        setLocationLabel(zipCode)
        setLocationError(null)
      } else if (data.status === "ZERO_RESULTS") {
        setLocationError("ZIP code not found")
      } else {
        setLocationError("Unable to find location for this ZIP code")
      }
    } catch {
      setLocationError("Failed to geocode ZIP code")
    } finally {
      setIsGeocodingZip(false)
    }
  }, [])

  // Clear location filter
  const clearLocationFilter = useCallback(() => {
    setUserLocation(null)
    setLocationZipCode("")
    setLocationLabel("")
    setLocationError(null)
  }, [])

  // Detect screen size for other responsive features (mobile-specific)
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth
      const mobile = width < 768
      const medium = width >= 768 && width < 1024
      const large = width >= 1024

      setIsMobile(mobile)
      setIsMedium(medium)
      setIsLarge(large)

      // On screens >= 1300px, filters are always visible as a column (no Sheet)
      // On screens < 1300px, filters use Sheet and start hidden
      if (width < 1300) {
        // Keep filters closed by default on small screens
        if (showFilters && width < 1300) {
          // Sheet is open, keep it
        } else {
          setShowFilters(false)
        }
      } else {
        // On large screens, ensure Sheet is closed (filters shown via CSS)
        setShowFilters(false)
      }
    }
    checkScreenSize()
    window.addEventListener("resize", checkScreenSize)
    return () => window.removeEventListener("resize", checkScreenSize)
  }, [showFilters])

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Sync state to URL params and session storage
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
    // Location-based search params
    if (userLocation) {
      params.set("lat", userLocation.lat.toString())
      params.set("lng", userLocation.lng.toString())
    }
    if (locationZipCode) params.set("zip", locationZipCode)
    if (locationLabel) params.set("locLabel", locationLabel)
    if (maxDistance > 0) params.set("dist", maxDistance.toString())

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    router.replace(newUrl, { scroll: false })

    // Save filters to session storage for persistence across navigation
    saveFiltersToStorage({
      viewMode,
      searchQuery: debouncedSearchQuery,
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
      startDate: selectedDates.start,
      endDate: selectedDates.end,
      userLocation,
      locationZipCode,
      locationLabel,
      maxDistance,
    })
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
    userLocation,
    locationZipCode,
    locationLabel,
    maxDistance,
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
              ? (tracksData.find((t: any) => t.name === selectedTrack)?._id as any)
              : undefined,
          limit: 200, // Get more for client-side filtering
          // Location-based filtering (only apply if location set AND distance is not "All miles")
          userLatitude: userLocation && maxDistance > 0 ? userLocation.lat : undefined,
          userLongitude: userLocation && maxDistance > 0 ? userLocation.lng : undefined,
          maxDistanceMiles: userLocation && maxDistance > 0 ? maxDistance : undefined,
        }
      : "skip"
  )

  // Fetch vehicle stats for all vehicles
  const vehicleStats = useQuery(
    api.reviews.getVehicleStatsBatch,
    vehiclesData && vehiclesData.length > 0
      ? { vehicleIds: vehiclesData.map((v: any) => v._id as Id<"vehicles">) }
      : "skip"
  )

  // Map vehicles to the format expected by VehicleCard
  const vehicles = useMemo(() => {
    if (!vehiclesData) return []
    const mapped = vehiclesData.map((vehicle: any) => {
      const primaryImage = vehicle.images?.find((img: any) => img.isPrimary) || vehicle.images?.[0]
      const stats = vehicleStats?.[vehicle._id]

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
        transmission: vehicle.transmission || "",
        drivetrain: vehicle.drivetrain || "",
        raceCarClass: "", // Removed: not in schema
      }
    })
    return mapped
  }, [vehiclesData, vehicleStats])

  const tracks = useMemo(() => {
    if (!tracksData) return []
    return tracksData.map((track: any) => ({
      id: track._id,
      name: track.name,
      location: track.location,
    }))
  }, [tracksData])

  const makes = useMemo(
    () => Array.from(new Set(vehicles.map((v: any) => v.make))).sort(),
    [vehicles]
  )

  const models = useMemo(() => {
    // Filter models based on selected make if one is selected
    const filteredVehicles =
      selectedMake !== "all" ? vehicles.filter((v: any) => v.make === selectedMake) : vehicles
    return Array.from(new Set(filteredVehicles.map((v: any) => v.model))).sort()
  }, [vehicles, selectedMake])

  const driveTypes = useMemo(
    () => Array.from(new Set(vehicles.map((v: any) => v.drivetrain).filter(Boolean))).sort(),
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
    const makes = Array.from(new Set(vehicles.map((v: any) => v.make))).filter((make: any) =>
      (make as string).toLowerCase().includes(query)
    )
    const models = Array.from(new Set(vehicles.map((v: any) => v.model))).filter((model: any) =>
      (model as string).toLowerCase().includes(query)
    )
    const tracks = Array.from(new Set(vehicles.map((v: any) => v.track).filter(Boolean))).filter(
      (track: any) => track && (track as string).toLowerCase().includes(query)
    ) as string[]
    const locations = Array.from(
      new Set(vehicles.map((v: any) => v.location).filter(Boolean))
    ).filter(
      (location: any) => location && (location as string).toLowerCase().includes(query)
    ) as string[]

    suggestions.push(...(makes as string[]).slice(0, 3))
    suggestions.push(...(models as string[]).slice(0, 3))
    suggestions.push(...tracks.slice(0, 2))
    suggestions.push(...locations.slice(0, 2))

    return Array.from(new Set(suggestions)).slice(0, 5)
  }, [debouncedSearchQuery, vehicles])

  // Filter vehicles with enhanced search and filters
  const filteredVehicles = useMemo(() => {
    let filtered = vehicles.filter((vehicle: any) => {
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
            .map((p: string) => Number.parseInt(p.replace(/\D/g, ""), 10))
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
        start: formatDateToISO(dateRange.from),
        end: formatDateToISO(dateRange.to),
      })
    } else if (!(dateRange?.from || dateRange?.to)) {
      setSelectedDates({ start: "", end: "" })
    }
  }, [dateRange])

  // Initialize dateRange from selectedDates on mount
  useEffect(() => {
    if (selectedDates.start && selectedDates.end) {
      const startDate = parseLocalDate(selectedDates.start)
      const endDate = parseLocalDate(selectedDates.end)
      if (startDate && endDate) {
        setDateRange({
          from: startDate,
          to: endDate,
        })
      }
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
    if (userLocation && maxDistance > 0) count++
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
    userLocation,
    maxDistance,
  ])

  const clearFilters = useCallback(() => {
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
    // Clear location filter
    clearLocationFilter()
    // Clear session storage
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(FILTERS_STORAGE_KEY)
    }
  }, [clearLocationFilter])

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

  // Filter Content - Reusable component (memoized to avoid recreating)
  const filterContent = useMemo(
    () => (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="size-4 sm:size-5" />
          <h2 className="font-semibold text-base sm:text-lg">Filters</h2>
          {activeFiltersCount > 0 && (
            <Badge className="ml-2 text-xs" variant="secondary">
              {activeFiltersCount}
            </Badge>
          )}
        </div>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <Accordion
              className="w-full"
              defaultValue={["location", "track", "make", "price"]}
              type="multiple"
            >
              <AccordionItem value="location">
                <AccordionTrigger className="font-medium text-xs sm:text-sm">
                  Location
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-3">
                  {/* Search within dropdown */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Search within</Label>
                    <Select
                      onValueChange={(value) => setMaxDistance(value === "all" ? 0 : Number(value))}
                      value={maxDistance === 0 ? "all" : maxDistance.toString()}
                    >
                      <SelectTrigger className="h-9 text-sm sm:h-11 sm:text-base">
                        <SelectValue placeholder="All miles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All miles</SelectItem>
                        <SelectItem value="10">10 miles</SelectItem>
                        <SelectItem value="25">25 miles</SelectItem>
                        <SelectItem value="50">50 miles</SelectItem>
                        <SelectItem value="100">100 miles</SelectItem>
                        <SelectItem value="250">250 miles</SelectItem>
                        <SelectItem value="500">500 miles</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ZIP code input */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">ZIP code</Label>
                    <div className="relative">
                      <Input
                        className="h-9 text-sm sm:h-11 sm:text-base"
                        maxLength={10}
                        onChange={(e) => {
                          const value = e.target.value
                          setLocationZipCode(value)
                          // Auto-geocode when 5 digits entered
                          if (value.length === 5 && /^\d{5}$/.test(value)) {
                            geocodeZipCode(value)
                          }
                        }}
                        onBlur={() => {
                          // Geocode on blur if valid ZIP
                          if (locationZipCode.length >= 5) {
                            geocodeZipCode(locationZipCode)
                          }
                        }}
                        placeholder="Enter ZIP code"
                        value={locationZipCode}
                      />
                      {isGeocodingZip && (
                        <div className="-translate-y-1/2 absolute top-1/2 right-3">
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    {locationError && <p className="text-destructive text-xs">{locationError}</p>}
                  </div>

                  {/* Use current location link */}
                  <button
                    className="flex items-center gap-2 text-primary text-sm hover:underline disabled:opacity-50"
                    disabled={isGettingLocation}
                    onClick={getCurrentLocation}
                    type="button"
                  >
                    {isGettingLocation ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Navigation className="size-4" />
                    )}
                    {isGettingLocation ? "Getting location..." : "Use my current location"}
                  </button>

                  {/* Current location indicator */}
                  {userLocation && locationLabel && (
                    <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                      <span className="text-muted-foreground text-xs">
                        Searching near:{" "}
                        <span className="font-medium text-foreground">{locationLabel}</span>
                      </span>
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        onClick={clearLocationFilter}
                        type="button"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              <Separator />

              <AccordionItem value="track">
                <AccordionTrigger className="font-medium text-xs sm:text-sm">
                  Track
                </AccordionTrigger>
                <AccordionContent className="pt-3">
                  <Select onValueChange={setSelectedTrack} value={selectedTrack}>
                    <SelectTrigger className="h-9 text-sm sm:h-11 sm:text-base">
                      <SelectValue placeholder="All tracks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tracks</SelectItem>
                      {tracks?.map((track: any) => (
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
                <AccordionTrigger className="font-medium text-xs sm:text-sm">
                  Vehicle Make
                </AccordionTrigger>
                <AccordionContent className="pt-3">
                  <Select onValueChange={setSelectedMake} value={selectedMake}>
                    <SelectTrigger className="h-9 text-sm sm:h-11 sm:text-base">
                      <SelectValue placeholder="All makes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All makes</SelectItem>
                      {makes.map((make: any) => (
                        <SelectItem key={make as string} value={make as string}>
                          {make as string}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </AccordionContent>
              </AccordionItem>

              <Separator />

              <AccordionItem value="model">
                <AccordionTrigger className="font-medium text-xs sm:text-sm">
                  Model
                </AccordionTrigger>
                <AccordionContent className="pt-3">
                  <Select
                    disabled={selectedMake === "all"}
                    onValueChange={setSelectedModel}
                    value={selectedModel}
                  >
                    <SelectTrigger className="h-9 text-sm sm:h-11 sm:text-base">
                      <SelectValue
                        placeholder={selectedMake === "all" ? "Select make first" : "All models"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All models</SelectItem>
                      {models.map((model: any) => (
                        <SelectItem key={model as string} value={model as string}>
                          {model as string}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </AccordionContent>
              </AccordionItem>

              <Separator />

              <AccordionItem value="raceCarClass">
                <AccordionTrigger className="font-medium text-xs sm:text-sm">
                  Race Car Class
                </AccordionTrigger>
                <AccordionContent className="pt-3">
                  <Select onValueChange={setSelectedRaceCarClass} value={selectedRaceCarClass}>
                    <SelectTrigger className="h-9 text-sm sm:h-11 sm:text-base">
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
                    Note: This filter will work once race car class is added to the vehicle schema.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <Separator />

              <AccordionItem value="driveType">
                <AccordionTrigger className="font-medium text-xs sm:text-sm">
                  Drive Type
                </AccordionTrigger>
                <AccordionContent className="pt-3">
                  <Select onValueChange={setSelectedDriveType} value={selectedDriveType}>
                    <SelectTrigger className="h-9 text-sm sm:h-11 sm:text-base">
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
                <AccordionTrigger className="font-medium text-xs sm:text-sm">
                  Price Range
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-3 sm:space-y-4">
                  {(() => {
                    const prices = vehicles.map((v: any) => v.pricePerDay).filter(Boolean)
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
                        <div className="flex flex-wrap gap-2">
                          <Button
                            className="text-xs sm:text-sm"
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
                            className="text-xs sm:text-sm"
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
                            className="text-xs sm:text-sm"
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
                <AccordionTrigger className="font-medium text-xs sm:text-sm">
                  Horsepower
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-3">
                  <div>
                    <Label className="text-xs sm:text-sm" htmlFor="min-hp">
                      Min HP
                    </Label>
                    <Input
                      className="h-9 text-sm sm:h-11 sm:text-base"
                      id="min-hp"
                      min={0}
                      onChange={(e) => setMinHorsepower(e.target.value)}
                      placeholder="e.g., 400"
                      type="number"
                      value={minHorsepower}
                    />
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm" htmlFor="max-hp">
                      Max HP
                    </Label>
                    <Input
                      className="h-9 text-sm sm:h-11 sm:text-base"
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
                <AccordionTrigger className="font-medium text-xs sm:text-sm">
                  Transmission
                </AccordionTrigger>
                <AccordionContent className="pt-3">
                  <Select onValueChange={setSelectedTransmission} value={selectedTransmission}>
                    <SelectTrigger className="h-9 text-sm sm:h-11 sm:text-base">
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
                <AccordionTrigger className="font-medium text-xs sm:text-sm">
                  Year Range
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-3">
                  <div>
                    <Label className="text-xs sm:text-sm" htmlFor="min-year">
                      Min Year
                    </Label>
                    <Input
                      className="h-9 text-sm sm:h-11 sm:text-base"
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
                    <Label className="text-xs sm:text-sm" htmlFor="max-year">
                      Max Year
                    </Label>
                    <Input
                      className="h-9 text-sm sm:h-11 sm:text-base"
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
                <AccordionTrigger className="font-medium text-xs sm:text-sm">
                  Minimum Rating
                </AccordionTrigger>
                <AccordionContent className="pt-3">
                  <Select onValueChange={setMinRating} value={minRating}>
                    <SelectTrigger className="h-9 text-sm sm:h-11 sm:text-base">
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
            </Accordion>

            {activeFiltersCount > 0 && (
              <div className="mt-4 border-t pt-4">
                <Button className="w-full text-sm" onClick={clearFilters} variant="outline">
                  <X className="mr-2 size-4" />
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    ),
    [
      activeFiltersCount,
      tracks,
      makes,
      models,
      selectedMake,
      raceCarClasses,
      vehicles,
      customPriceRange,
      selectedTrack,
      selectedModel,
      selectedRaceCarClass,
      selectedDriveType,
      minHorsepower,
      maxHorsepower,
      selectedTransmission,
      minYear,
      maxYear,
      minRating,
      // Location filter dependencies
      userLocation,
      locationLabel,
      locationZipCode,
      locationError,
      maxDistance,
      isGettingLocation,
      isGeocodingZip,
      getCurrentLocation,
      geocodeZipCode,
      clearLocationFilter,
      clearFilters,
    ]
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-border border-b bg-gradient-to-b from-background to-muted/20">
        <div className="container relative z-10 mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12">
          <div className="mb-4 text-center sm:mb-6 md:mb-8">
            <h1 className="mb-2 font-bold text-2xl tracking-tight sm:mb-3 sm:text-3xl md:text-4xl lg:text-5xl">
              Find Your Perfect Track Vehicle
            </h1>
            <p className="mx-auto max-w-2xl text-muted-foreground text-sm sm:text-base md:text-lg">
              Discover high-performance race cars ready for your next track day
            </p>
          </div>

          {/* Enhanced Search Bar */}
          <Card className="shadow-lg">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="space-y-3 sm:space-y-4">
                {/* Enhanced Search Input with Autocomplete */}
                <div className="relative">
                  <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground sm:left-4 sm:size-5" />
                  <Input
                    className="h-12 pr-3 pl-10 text-sm shadow-sm sm:h-14 sm:pr-4 sm:pl-12 sm:text-base"
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setShowSuggestions(e.target.value.length >= 2)
                    }}
                    onFocus={() => searchSuggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Search by make, model, track, or location..."
                    value={searchQuery}
                  />
                  {showSuggestions && searchSuggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                      {searchSuggestions.map((suggestion, index) => (
                        <button
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent sm:px-4"
                          key={index}
                          onClick={() => {
                            setSearchQuery(suggestion)
                            setShowSuggestions(false)
                          }}
                          type="button"
                        >
                          <Search className="mr-2 inline size-3.5 sm:size-4" />
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Filter Chips */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <Button
                    className="text-xs sm:text-sm"
                    onClick={() => applyQuickFilter("thisWeekend")}
                    size="sm"
                    variant="outline"
                  >
                    This Weekend
                  </Button>
                  <Button
                    className="text-xs sm:text-sm"
                    onClick={() => applyQuickFilter("nextWeek")}
                    size="sm"
                    variant="outline"
                  >
                    Next Week
                  </Button>
                  <Button
                    className="text-xs sm:text-sm"
                    onClick={() => applyQuickFilter("thisMonth")}
                    size="sm"
                    variant="outline"
                  >
                    This Month
                  </Button>
                  <Button
                    className="text-xs sm:text-sm"
                    onClick={() => applyQuickFilter("nextMonth")}
                    size="sm"
                    variant="outline"
                  >
                    Next Month
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                  <div className="sm:col-span-1">
                    <Label
                      className="mb-1.5 flex items-center gap-1.5 text-xs sm:mb-2 sm:gap-2 sm:text-sm"
                      htmlFor="track"
                    >
                      <MapPin className="size-3.5 sm:size-4" />
                      Track
                    </Label>
                    <Select onValueChange={setSelectedTrack} value={selectedTrack}>
                      <SelectTrigger className="h-10 text-sm sm:h-11 sm:text-base" id="track">
                        <SelectValue placeholder="All tracks" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All tracks</SelectItem>
                        {tracks?.map((track: any) => (
                          <SelectItem key={track.id} value={track.name}>
                            {track.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-1">
                    <Label
                      className="mb-1.5 flex items-center gap-1.5 text-xs sm:mb-2 sm:gap-2 sm:text-sm"
                      htmlFor="location"
                    >
                      <MapPin className="size-3.5 sm:size-4" />
                      Location
                    </Label>
                    <Input
                      className="h-10 text-sm sm:h-11 sm:text-base"
                      id="location"
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      placeholder="City, State"
                      value={selectedLocation}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label className="mb-1.5 flex items-center gap-1.5 text-xs sm:mb-2 sm:gap-2 sm:text-sm">
                      <Calendar className="size-3.5 sm:size-4" />
                      Dates
                    </Label>
                    <Popover onOpenChange={setDatePickerOpen} open={datePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          className={cn(
                            "h-10 w-full justify-start text-left font-normal text-sm shadow-sm sm:h-12 sm:text-base",
                            !dateRange && "text-muted-foreground"
                          )}
                          id="date-range"
                          variant="outline"
                        >
                          <Calendar className="mr-2 size-3.5 shrink-0 sm:size-4" />
                          <span className="truncate">
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
                              "Select dates"
                            )}
                          </span>
                          <ChevronDown className="ml-auto size-3.5 shrink-0 opacity-50 sm:size-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0" sideOffset={4}>
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
                  <div className="flex flex-wrap items-center gap-1.5 border-t pt-2 sm:gap-2">
                    <span className="text-muted-foreground text-xs sm:text-sm">
                      Active filters:
                    </span>
                    {debouncedSearchQuery && (
                      <Badge className="gap-1 text-xs" variant="secondary">
                        <span className="max-w-[120px] truncate sm:max-w-none">
                          Search: {debouncedSearchQuery}
                        </span>
                        <X
                          className="size-3 shrink-0 cursor-pointer"
                          onClick={() => setSearchQuery("")}
                        />
                      </Badge>
                    )}
                    {selectedTrack !== "all" && (
                      <Badge className="gap-1 text-xs" variant="secondary">
                        <span className="max-w-[100px] truncate sm:max-w-none">
                          Track: {selectedTrack}
                        </span>
                        <X
                          className="size-3 shrink-0 cursor-pointer"
                          onClick={() => setSelectedTrack("all")}
                        />
                      </Badge>
                    )}
                    {selectedMake !== "all" && (
                      <Badge className="gap-1 text-xs" variant="secondary">
                        <span className="max-w-[100px] truncate sm:max-w-none">
                          Make: {selectedMake}
                        </span>
                        <X
                          className="size-3 shrink-0 cursor-pointer"
                          onClick={() => setSelectedMake("all")}
                        />
                      </Badge>
                    )}
                    {selectedModel !== "all" && (
                      <Badge className="gap-1 text-xs" variant="secondary">
                        <span className="max-w-[100px] truncate sm:max-w-none">
                          Model: {selectedModel}
                        </span>
                        <X
                          className="size-3 shrink-0 cursor-pointer"
                          onClick={() => setSelectedModel("all")}
                        />
                      </Badge>
                    )}
                    {selectedRaceCarClass !== "all" && (
                      <Badge className="gap-1 text-xs" variant="secondary">
                        <span className="max-w-[100px] truncate sm:max-w-none">
                          Class: {selectedRaceCarClass}
                        </span>
                        <X
                          className="size-3 shrink-0 cursor-pointer"
                          onClick={() => setSelectedRaceCarClass("all")}
                        />
                      </Badge>
                    )}
                    {selectedDriveType !== "all" && (
                      <Badge className="gap-1 text-xs" variant="secondary">
                        <span className="max-w-[100px] truncate sm:max-w-none">
                          Drive: {selectedDriveType}
                        </span>
                        <X
                          className="size-3 shrink-0 cursor-pointer"
                          onClick={() => setSelectedDriveType("all")}
                        />
                      </Badge>
                    )}
                    {selectedLocation && (
                      <Badge className="gap-1 text-xs" variant="secondary">
                        <span className="max-w-[100px] truncate sm:max-w-none">
                          Location: {selectedLocation}
                        </span>
                        <X
                          className="size-3 shrink-0 cursor-pointer"
                          onClick={() => setSelectedLocation("")}
                        />
                      </Badge>
                    )}
                    {selectedPriceRange !== "any" && (
                      <Badge className="gap-1 text-xs" variant="secondary">
                        <span className="max-w-[100px] truncate sm:max-w-none">
                          Price: {selectedPriceRange}
                        </span>
                        <X
                          className="size-3 shrink-0 cursor-pointer"
                          onClick={() => setSelectedPriceRange("any")}
                        />
                      </Badge>
                    )}
                    {(minHorsepower || maxHorsepower) && (
                      <Badge className="gap-1 text-xs" variant="secondary">
                        <span className="max-w-[100px] truncate sm:max-w-none">
                          HP: {minHorsepower || "0"}-{maxHorsepower || "∞"}
                        </span>
                        <X
                          className="size-3 shrink-0 cursor-pointer"
                          onClick={() => {
                            setMinHorsepower("")
                            setMaxHorsepower("")
                          }}
                        />
                      </Badge>
                    )}
                    {selectedTransmission !== "all" && (
                      <Badge className="gap-1 text-xs" variant="secondary">
                        <span className="max-w-[100px] truncate sm:max-w-none">
                          Trans: {selectedTransmission}
                        </span>
                        <X
                          className="size-3 shrink-0 cursor-pointer"
                          onClick={() => setSelectedTransmission("all")}
                        />
                      </Badge>
                    )}
                    {(minYear || maxYear) && (
                      <Badge className="gap-1 text-xs" variant="secondary">
                        <span className="max-w-[100px] truncate sm:max-w-none">
                          Year: {minYear || "Any"}-{maxYear || "Any"}
                        </span>
                        <X
                          className="size-3 shrink-0 cursor-pointer"
                          onClick={() => {
                            setMinYear("")
                            setMaxYear("")
                          }}
                        />
                      </Badge>
                    )}
                    {minRating && (
                      <Badge className="gap-1 text-xs" variant="secondary">
                        <span className="max-w-[100px] truncate sm:max-w-none">
                          Rating: {minRating}+
                        </span>
                        <X
                          className="size-3 shrink-0 cursor-pointer"
                          onClick={() => setMinRating("")}
                        />
                      </Badge>
                    )}
                    {(selectedDates.start || selectedDates.end) && (
                      <Badge className="gap-1 text-xs" variant="secondary">
                        <span className="max-w-[120px] truncate sm:max-w-none">
                          Dates:{" "}
                          {selectedDates.start && selectedDates.end
                            ? `${format(parseLocalDate(selectedDates.start) || new Date(), "MMM dd")} - ${format(parseLocalDate(selectedDates.end) || new Date(), "MMM dd")}`
                            : selectedDates.start
                              ? format(parseLocalDate(selectedDates.start) || new Date(), "MMM dd")
                              : "..."}
                        </span>
                        <X
                          className="size-3 shrink-0 cursor-pointer"
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

          {/* Show Filters Button - Mobile only */}
          <div className="mt-4 sm:mt-6 xl:hidden">
            <Sheet
              onOpenChange={(open) => {
                if (typeof window !== "undefined" && window.innerWidth < 1300) {
                  setShowFilters(open)
                } else {
                  setShowFilters(false)
                }
              }}
              open={showFilters}
            >
              {!showFilters && (
                <SheetTrigger asChild>
                  <Button className="w-full shadow-sm sm:w-auto" size="lg" variant="outline">
                    <Filter className="mr-2 size-4" />
                    Show Filters
                    {activeFiltersCount > 0 && (
                      <Badge className="ml-2 text-xs" variant="secondary">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
              )}
              <SheetContent className="w-full overflow-y-auto sm:max-w-sm" side="left">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6">{filterContent}</div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-6 xl:grid-cols-[280px_1fr] xl:gap-8">
          {/* Filters Sidebar Column - Direct column display on large screens (>= 1300px) */}
          <aside className="show-at-1300 hidden xl:block">
            <div className="sticky top-20">{filterContent}</div>
          </aside>

          {/* Vehicle Grid - Results Column */}
          <div className="w-full">
            {/* Results Summary Bar - Vehicle count on left, Sort on right */}
            <div className="mb-6 flex items-center justify-between border-b pb-4">
              {/* Vehicle Count - Left side */}
              <p className="text-muted-foreground text-sm sm:text-base">
                <span className="font-bold text-base text-foreground sm:text-lg">
                  {filteredVehicles.length}
                </span>{" "}
                {filteredVehicles.length === 1 ? "vehicle" : "vehicles"} available
              </p>

              {/* Sort and View Controls - Right side */}
              <div className="flex items-center gap-2 sm:gap-3">
                <Select onValueChange={setSortBy} value={sortBy}>
                  <SelectTrigger className="h-9 w-[140px] text-sm sm:h-10 sm:w-[180px]">
                    <SelectValue placeholder="Sort by" />
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
                <div className="hidden sm:flex sm:items-center sm:gap-1">
                  <Button
                    className="size-9"
                    onClick={() => setViewMode("grid")}
                    size="icon"
                    variant={viewMode === "grid" ? "default" : "ghost"}
                  >
                    <Grid3x3 className="size-4" />
                  </Button>
                  <Button
                    className="size-9"
                    onClick={() => setViewMode("list")}
                    size="icon"
                    variant={viewMode === "list" ? "default" : "ghost"}
                  >
                    <List className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
            {vehiclesData === undefined || tracksData === undefined ? (
              <div
                className={cn(
                  "grid gap-4 sm:gap-6",
                  viewMode === "grid"
                    ? "auto-rows-fr grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                    : "grid-cols-1"
                )}
              >
                {Array.from({ length: itemsPerPage }).map((_, index) => (
                  <Card className="overflow-hidden" key={index}>
                    <Skeleton className="h-48 w-full sm:h-64" />
                    <CardContent className="p-4 sm:p-6">
                      <Skeleton className="mb-3 h-5 w-3/4 sm:h-6" />
                      <Skeleton className="mb-4 h-4 w-1/2" />
                      <div className="mt-4 border-t pt-4">
                        <Skeleton className="h-7 w-20 sm:h-8 sm:w-24" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : vehicles.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted sm:size-16">
                    <Search className="size-6 text-muted-foreground sm:size-8" />
                  </div>
                  <h3 className="mb-2 font-semibold text-lg sm:text-xl">No vehicles available</h3>
                  <p className="mb-4 max-w-md px-4 text-center text-muted-foreground text-sm sm:px-0 sm:text-base">
                    No vehicles are currently available.
                  </p>
                </CardContent>
              </Card>
            ) : filteredVehicles.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted sm:size-16">
                    <Search className="size-6 text-muted-foreground sm:size-8" />
                  </div>
                  <h3 className="mb-2 font-semibold text-lg sm:text-xl">No vehicles found</h3>
                  <p className="mb-6 max-w-md px-4 text-center text-muted-foreground text-sm sm:px-0 sm:text-base">
                    We couldn't find any vehicles matching your search criteria. Try adjusting your
                    filters or search terms to see more results.
                  </p>
                  <div className="flex w-full flex-col gap-2 px-4 sm:w-auto sm:flex-row sm:px-0">
                    <Button className="w-full sm:w-auto" onClick={clearFilters} variant="default">
                      Clear All Filters
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
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
                      "grid gap-4 sm:gap-6",
                      viewMode === "grid"
                        ? "auto-rows-fr grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                        : "grid-cols-1"
                    )}
                  >
                    {paginatedVehicles.map((vehicle: any) => (
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
                  <div className="mt-6 flex flex-col items-center gap-3 sm:mt-8 sm:gap-4">
                    <Button
                      className="w-full shadow-sm sm:w-auto"
                      onClick={loadMore}
                      size="lg"
                      variant="outline"
                    >
                      Load More Vehicles
                      <ChevronRight className="ml-2 size-4" />
                    </Button>
                    <p className="text-muted-foreground text-xs sm:text-sm">
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

export default function VehiclesPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading vehicles...</p>
            </div>
          </div>
        </div>
      }
    >
      <VehiclesPageContent />
    </Suspense>
  )
}
