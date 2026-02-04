"use client"

import { useQuery } from "convex/react"
import { Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
import { useDebounce } from "@/hooks/useDebounce"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { formatDateToISO, parseLocalDate } from "@/lib/date-utils"
import { ActiveFilterBadges } from "./active-filter-badges"
import { CompareBar } from "./compare-bar"
import { CompareModal } from "./compare-modal"
import { FilterPanel } from "./filter-panel"
import { MobileFilters } from "./mobile-filters"
import { RecentlyViewed } from "./recently-viewed"
import { SearchHero } from "./search-hero"
import type { FilterActions, FilterState, SortOption, VehicleItem, ViewMode } from "./types"
import { VehicleResultsGrid } from "./vehicle-results-grid"

const FILTERS_STORAGE_KEY = "renegade-vehicle-filters"

const getStoredFilters = () => {
  if (typeof window === "undefined") {
    return null
  }
  try {
    const stored = sessionStorage.getItem(FILTERS_STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    if (parsed.timestamp && Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(FILTERS_STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const saveFiltersToStorage = (filters: Record<string, unknown>) => {
  if (typeof window === "undefined") {
    return
  }
  try {
    sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ ...filters, timestamp: Date.now() }))
  } catch {
    // Ignore storage errors
  }
}

function VehiclesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const getInitialState = () => {
    const hasUrlParams = searchParams.toString().length > 0
    const latParam = searchParams.get("lat")
    const lngParam = searchParams.get("lng")
    const hasLocation = latParam && lngParam
    const storedFilters = hasUrlParams ? null : getStoredFilters()

    return {
      viewMode: (searchParams.get("view") as ViewMode) || storedFilters?.viewMode || "grid",
      searchQuery: searchParams.get("q") || storedFilters?.searchQuery || "",
      selectedLocation: searchParams.get("location") || storedFilters?.selectedLocation || "",
      selectedTrack: searchParams.get("track") || storedFilters?.selectedTrack || "all",
      selectedMake: searchParams.get("make") || storedFilters?.selectedMake || "all",
      selectedModel: searchParams.get("model") || storedFilters?.selectedModel || "all",
      selectedDriveType: searchParams.get("drive") || storedFilters?.selectedDriveType || "all",
      selectedPriceRange: searchParams.get("price") || storedFilters?.selectedPriceRange || "any",
      minHorsepower: searchParams.get("minHp") || storedFilters?.minHorsepower || "",
      maxHorsepower: searchParams.get("maxHp") || storedFilters?.maxHorsepower || "",
      selectedTransmission:
        searchParams.get("transmission") || storedFilters?.selectedTransmission || "all",
      minYear: searchParams.get("minYear") || storedFilters?.minYear || "",
      maxYear: searchParams.get("maxYear") || storedFilters?.maxYear || "",
      minRating: searchParams.get("rating") || storedFilters?.minRating || "",
      sortBy: (searchParams.get("sort") as SortOption) || storedFilters?.sortBy || "popularity",
      startDate: searchParams.get("startDate") || storedFilters?.startDate || "",
      endDate: searchParams.get("endDate") || storedFilters?.endDate || "",
      userLocation: hasLocation
        ? { lat: Number(latParam), lng: Number(lngParam) }
        : storedFilters?.userLocation || null,
      locationZipCode: searchParams.get("zip") || storedFilters?.locationZipCode || "",
      locationLabel: searchParams.get("locLabel") || storedFilters?.locationLabel || "",
      maxDistance: Number(searchParams.get("dist")) || storedFilters?.maxDistance || 0,
      selectedSafetyEquipment: storedFilters?.selectedSafetyEquipment || [],
      selectedExperienceLevel: searchParams.get("expLevel") || storedFilters?.selectedExperienceLevel || "all",
      selectedTireType: searchParams.get("tire") || storedFilters?.selectedTireType || "all",
      deliveryOnly: searchParams.get("delivery") === "true" || storedFilters?.deliveryOnly || false,
    }
  }

  const initialState = getInitialState()

  // View & pagination state
  const [viewMode, setViewMode] = useState<ViewMode>(initialState.viewMode)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  // Filter state
  const [searchQuery, setSearchQuery] = useState(initialState.searchQuery)
  const [selectedLocation, setSelectedLocation] = useState(initialState.selectedLocation)
  const [selectedTrack, setSelectedTrack] = useState(initialState.selectedTrack)
  const [selectedMake, setSelectedMake] = useState(initialState.selectedMake)
  const [selectedModel, setSelectedModel] = useState(initialState.selectedModel)
  const [selectedDriveType, setSelectedDriveType] = useState(initialState.selectedDriveType)
  const [selectedPriceRange, setSelectedPriceRange] = useState(initialState.selectedPriceRange)
  const [customPriceRange, setCustomPriceRange] = useState<[number, number] | null>(null)
  const [minHorsepower, setMinHorsepower] = useState(initialState.minHorsepower)
  const [maxHorsepower, setMaxHorsepower] = useState(initialState.maxHorsepower)
  const [selectedTransmission, setSelectedTransmission] = useState(
    initialState.selectedTransmission
  )
  const [minYear, setMinYear] = useState(initialState.minYear)
  const [maxYear, setMaxYear] = useState(initialState.maxYear)
  const [minRating, setMinRating] = useState(initialState.minRating)
  const [sortBy, setSortBy] = useState<SortOption>(initialState.sortBy as SortOption)
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

  // Location state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(
    initialState.userLocation
  )
  const [locationZipCode, setLocationZipCode] = useState(initialState.locationZipCode)
  const [locationLabel, setLocationLabel] = useState(initialState.locationLabel)
  const [maxDistance, setMaxDistance] = useState<number>(initialState.maxDistance)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [isGeocodingZip, setIsGeocodingZip] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [selectedSafetyEquipment, setSelectedSafetyEquipment] = useState<string[]>(
    initialState.selectedSafetyEquipment || []
  )
  const [selectedExperienceLevel, setSelectedExperienceLevel] = useState(
    initialState.selectedExperienceLevel || "all"
  )
  const [selectedTireType, setSelectedTireType] = useState(
    initialState.selectedTireType || "all"
  )
  const [deliveryOnly, setDeliveryOnly] = useState(
    initialState.deliveryOnly || false
  )

  // Filter sheet state (for sub-xl screens)

  // Compare state
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set())
  const [compareOpen, setCompareOpen] = useState(false)

  // Responsive
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Location helpers
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser")
      return
    }
    setIsGettingLocation(true)
    setLocationError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
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

  const geocodeZipCode = useCallback(async (zipCode: string) => {
    if (!zipCode || zipCode.length < 5) {
      return
    }
    setIsGeocodingZip(true)
    setLocationError(null)
    try {
      const response = await fetch(
        `/api/geocode?address=${encodeURIComponent(zipCode)}`
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

  const clearLocationFilter = useCallback(() => {
    setUserLocation(null)
    setLocationZipCode("")
    setLocationLabel("")
    setLocationError(null)
    setMaxDistance(0)
  }, [])

  const clearFilters = useCallback(() => {
    setSearchQuery("")
    setSelectedLocation("")
    setSelectedTrack("all")
    setSelectedMake("all")
    setSelectedModel("all")
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
    setSelectedSafetyEquipment([])
    setSelectedExperienceLevel("all")
    setSelectedTireType("all")
    setDeliveryOnly(false)
    clearLocationFilter()
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(FILTERS_STORAGE_KEY)
    }
  }, [clearLocationFilter])

  // Build filter state & actions objects
  const filterState: FilterState = useMemo(
    () => ({
      searchQuery,
      selectedLocation,
      selectedTrack,
      selectedMake,
      selectedModel,
      selectedDriveType,
      selectedPriceRange,
      customPriceRange,
      minHorsepower,
      maxHorsepower,
      selectedTransmission,
      minYear,
      maxYear,
      minRating,
      selectedDates,
      userLocation,
      locationZipCode,
      locationLabel,
      maxDistance,
      selectedSafetyEquipment,
      selectedExperienceLevel,
      selectedTireType,
      selectedTransmissionExpanded: selectedTransmission,
      deliveryOnly,
    }),
    [
      searchQuery,
      selectedLocation,
      selectedTrack,
      selectedMake,
      selectedModel,
      selectedDriveType,
      selectedPriceRange,
      customPriceRange,
      minHorsepower,
      maxHorsepower,
      selectedTransmission,
      minYear,
      maxYear,
      minRating,
      selectedDates,
      userLocation,
      locationZipCode,
      locationLabel,
      maxDistance,
      selectedSafetyEquipment,
      selectedExperienceLevel,
      selectedTireType,
      deliveryOnly,
    ]
  )

  const filterActions: FilterActions = useMemo(
    () => ({
      setSearchQuery,
      setSelectedLocation,
      setSelectedTrack,
      setSelectedMake,
      setSelectedModel,
      setSelectedDriveType,
      setSelectedPriceRange,
      setCustomPriceRange,
      setMinHorsepower,
      setMaxHorsepower,
      setSelectedTransmission,
      setMinYear,
      setMaxYear,
      setMinRating,
      setSelectedDates,
      setDateRange,
      setUserLocation,
      setLocationZipCode,
      setLocationLabel,
      setMaxDistance,
      clearFilters,
      clearLocationFilter,
      setSelectedSafetyEquipment,
      setSelectedExperienceLevel,
      setSelectedTireType,
      setDeliveryOnly,
    }),
    [clearFilters, clearLocationFilter]
  )

  // Sync URL + session storage
  useEffect(() => {
    const params = new URLSearchParams()
    if (viewMode !== "grid") {
      params.set("view", viewMode)
    }
    if (debouncedSearchQuery) {
      params.set("q", debouncedSearchQuery)
    }
    if (selectedLocation) {
      params.set("location", selectedLocation)
    }
    if (selectedTrack !== "all") {
      params.set("track", selectedTrack)
    }
    if (selectedMake !== "all") {
      params.set("make", selectedMake)
    }
    if (selectedModel !== "all") {
      params.set("model", selectedModel)
    }
    if (selectedDriveType !== "all") {
      params.set("drive", selectedDriveType)
    }
    if (selectedPriceRange !== "any") {
      params.set("price", selectedPriceRange)
    }
    if (minHorsepower) {
      params.set("minHp", minHorsepower)
    }
    if (maxHorsepower) {
      params.set("maxHp", maxHorsepower)
    }
    if (selectedTransmission !== "all") {
      params.set("transmission", selectedTransmission)
    }
    if (minYear) {
      params.set("minYear", minYear)
    }
    if (maxYear) {
      params.set("maxYear", maxYear)
    }
    if (minRating && minRating !== "any") {
      params.set("rating", minRating)
    }
    if (sortBy !== "popularity") {
      params.set("sort", sortBy)
    }
    if (selectedDates.start) {
      params.set("startDate", selectedDates.start)
    }
    if (selectedDates.end) {
      params.set("endDate", selectedDates.end)
    }
    if (userLocation) {
      params.set("lat", userLocation.lat.toString())
      params.set("lng", userLocation.lng.toString())
    }
    if (locationZipCode) {
      params.set("zip", locationZipCode)
    }
    if (locationLabel) {
      params.set("locLabel", locationLabel)
    }
    if (maxDistance > 0) {
      params.set("dist", maxDistance.toString())
    }
    if (selectedSafetyEquipment.length > 0) {
      params.set("safety", selectedSafetyEquipment.join(","))
    }
    if (selectedExperienceLevel !== "all") {
      params.set("expLevel", selectedExperienceLevel)
    }
    if (selectedTireType !== "all") {
      params.set("tire", selectedTireType)
    }
    if (deliveryOnly) {
      params.set("delivery", "true")
    }

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    router.replace(newUrl, { scroll: false })

    saveFiltersToStorage({
      viewMode,
      searchQuery: debouncedSearchQuery,
      selectedLocation,
      selectedTrack,
      selectedMake,
      selectedModel,
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
      selectedSafetyEquipment,
      selectedExperienceLevel,
      selectedTireType,
      deliveryOnly,
    })
  }, [
    viewMode,
    debouncedSearchQuery,
    selectedLocation,
    selectedTrack,
    selectedMake,
    selectedModel,
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
    selectedSafetyEquipment,
    selectedExperienceLevel,
    selectedTireType,
    deliveryOnly,
    router,
  ])

  // Data queries
  const tracksData = useQuery(api.tracks.getAll, {})
  const vehiclesData = useQuery(
    api.vehicles.searchWithAvailability,
    tracksData
      ? {
          startDate: selectedDates.start || undefined,
          endDate: selectedDates.end || undefined,
          trackId:
            selectedTrack !== "all"
              ? (tracksData.find((t) => t.name === selectedTrack)?._id as Id<"tracks">)
              : undefined,
          limit: 200,
          userLatitude: userLocation && maxDistance > 0 ? userLocation.lat : undefined,
          userLongitude: userLocation && maxDistance > 0 ? userLocation.lng : undefined,
          maxDistanceMiles: userLocation && maxDistance > 0 ? maxDistance : undefined,
        }
      : "skip"
  )

  const vehicleStats = useQuery(
    api.reviews.getVehicleStatsBatch,
    vehiclesData && vehiclesData.length > 0
      ? { vehicleIds: vehiclesData.map((v: any) => v._id as Id<"vehicles">) }
      : "skip"
  )

  // Map vehicles
  const vehicles: VehicleItem[] = useMemo(() => {
    if (!vehiclesData) {
      return []
    }
    return vehiclesData.map((vehicle: any) => {
      const primaryImage = vehicle.images?.find((img: any) => img.isPrimary) || vehicle.images?.[0]
      const stats = vehicleStats?.[vehicle._id]
      const locationParts: string[] = []
      if (vehicle.address?.city) {
        locationParts.push(vehicle.address.city)
      }
      if (vehicle.address?.state) {
        locationParts.push(vehicle.address.state)
      }
      const location =
        locationParts.length > 0 ? locationParts.join(", ") : vehicle.track?.location || ""

      return {
        id: vehicle._id,
        image: primaryImage?.cardUrl ?? "",
        imageKey: primaryImage?.r2Key ?? undefined,
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
        amenities: vehicle.amenities || [],
        experienceLevel: vehicle.experienceLevel,
        tireType: vehicle.tireType,
        deliveryAvailable: vehicle.deliveryAvailable,
      }
    })
  }, [vehiclesData, vehicleStats])

  const tracks = useMemo(() => {
    if (!tracksData) {
      return []
    }
    return tracksData.map((track: any) => ({
      id: track._id,
      name: track.name,
      location: track.location,
    }))
  }, [tracksData])

  const makes = useMemo(() => Array.from(new Set(vehicles.map((v) => v.make))).sort(), [vehicles])

  const models = useMemo(() => {
    const filtered =
      selectedMake !== "all" ? vehicles.filter((v) => v.make === selectedMake) : vehicles
    return Array.from(new Set(filtered.map((v) => v.model))).sort()
  }, [vehicles, selectedMake])

  // Search suggestions
  const searchSuggestions = useMemo(() => {
    if (!debouncedSearchQuery || debouncedSearchQuery.length < 2) {
      return []
    }
    const query = debouncedSearchQuery.toLowerCase()
    const suggestions: string[] = []
    const uniqueMakes = Array.from(new Set(vehicles.map((v) => v.make))).filter((m) =>
      m.toLowerCase().includes(query)
    )
    const uniqueModels = Array.from(new Set(vehicles.map((v) => v.model))).filter((m) =>
      m.toLowerCase().includes(query)
    )
    const uniqueTracks = Array.from(new Set(vehicles.map((v) => v.track).filter(Boolean))).filter(
      (t) => t.toLowerCase().includes(query)
    )
    const uniqueLocations = Array.from(
      new Set(vehicles.map((v) => v.location).filter(Boolean))
    ).filter((l) => l.toLowerCase().includes(query))
    suggestions.push(...uniqueMakes.slice(0, 3))
    suggestions.push(...uniqueModels.slice(0, 3))
    suggestions.push(...uniqueTracks.slice(0, 2))
    suggestions.push(...uniqueLocations.slice(0, 2))
    return Array.from(new Set(suggestions)).slice(0, 5)
  }, [debouncedSearchQuery, vehicles])

  // Filter vehicles (bug fix: customPriceRange in deps)
  const filteredVehicles = useMemo(() => {
    let filtered = vehicles.filter((vehicle) => {
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
      if (selectedTrack !== "all" && vehicle.track !== selectedTrack) {
        return false
      }
      if (selectedMake !== "all" && vehicle.make !== selectedMake) {
        return false
      }
      if (selectedModel !== "all" && vehicle.model !== selectedModel) {
        return false
      }
      if (
        selectedDriveType !== "all" &&
        vehicle.drivetrain &&
        vehicle.drivetrain.toUpperCase() !== selectedDriveType.toUpperCase()
      ) {
        return false
      }
      if (
        selectedLocation &&
        !vehicle.location.toLowerCase().includes(selectedLocation.toLowerCase())
      ) {
        return false
      }

      // Price filter (bug fix: check customPriceRange first)
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
      if (
        selectedTransmission !== "all" &&
        vehicle.transmission?.toLowerCase() !== selectedTransmission.toLowerCase()
      ) {
        return false
      }
      if (minYear && vehicle.year < Number.parseInt(minYear, 10)) {
        return false
      }
      if (maxYear && vehicle.year > Number.parseInt(maxYear, 10)) {
        return false
      }
      if (minRating && minRating !== "any" && vehicle.rating < Number.parseFloat(minRating)) {
        return false
      }
      if (selectedSafetyEquipment.length > 0) {
        const vehicleAmenities = (vehicle.amenities || []).map((a) => a.toLowerCase())
        if (!selectedSafetyEquipment.every((eq) => vehicleAmenities.includes(eq.toLowerCase()))) {
          return false
        }
      }
      if (selectedExperienceLevel !== "all" && vehicle.experienceLevel !== selectedExperienceLevel) {
        return false
      }
      if (selectedTireType !== "all" && vehicle.tireType !== selectedTireType) {
        return false
      }
      if (deliveryOnly && !vehicle.deliveryAvailable) {
        return false
      }

      return true
    })

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
    selectedDriveType,
    selectedLocation,
    selectedPriceRange,
    customPriceRange,
    minHorsepower,
    maxHorsepower,
    selectedTransmission,
    minYear,
    maxYear,
    minRating,
    sortBy,
    selectedSafetyEquipment,
    selectedExperienceLevel,
    selectedTireType,
    deliveryOnly,
  ])

  const paginatedVehicles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredVehicles.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredVehicles, currentPage])

  const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage)
  const hasMore = currentPage < totalPages

  // Reset model when make changes
  useEffect(() => {
    setSelectedModel("all")
  }, [selectedMake])

  // Sync dateRange -> selectedDates
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

  // Init dateRange from selectedDates on mount
  useEffect(() => {
    if (selectedDates.start && selectedDates.end) {
      const start = parseLocalDate(selectedDates.start)
      const end = parseLocalDate(selectedDates.end)
      if (start && end) {
        setDateRange({ from: start, to: end })
      }
    }
  }, [selectedDates.end, selectedDates.start]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1)
  }, [])

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (debouncedSearchQuery) {
      count++
    }
    if (selectedTrack !== "all") {
      count++
    }
    if (selectedMake !== "all") {
      count++
    }
    if (selectedModel !== "all") {
      count++
    }
    if (selectedDriveType !== "all") {
      count++
    }
    if (selectedLocation) {
      count++
    }
    if (selectedPriceRange !== "any") {
      count++
    }
    if (minHorsepower || maxHorsepower) {
      count++
    }
    if (selectedTransmission !== "all") {
      count++
    }
    if (minYear || maxYear) {
      count++
    }
    if (minRating && minRating !== "any") {
      count++
    }
    if (selectedDates.start || selectedDates.end) {
      count++
    }
    if (userLocation && maxDistance > 0) {
      count++
    }
    if (selectedSafetyEquipment.length > 0) count++
    if (selectedExperienceLevel !== "all") count++
    if (selectedTireType !== "all") count++
    if (deliveryOnly) count++
    return count
  }, [
    debouncedSearchQuery,
    selectedTrack,
    selectedMake,
    selectedModel,
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
    selectedSafetyEquipment,
    selectedExperienceLevel,
    selectedTireType,
    deliveryOnly,
  ])

  const loadMore = () => {
    if (hasMore) {
      setCurrentPage((prev) => prev + 1)
    }
  }

  const clearSearchAndDates = useCallback(() => {
    setSearchQuery("")
    setSelectedDates({ start: "", end: "" })
    setDateRange(undefined)
  }, [])

  // Compare handlers
  const compareVehicles = useMemo(
    () => vehicles.filter((v) => compareIds.has(v.id)),
    [vehicles, compareIds]
  )

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 3) {
        next.add(id)
      }
      return next
    })
  }, [])

  const datesSelected = Boolean(selectedDates.start && selectedDates.end)

  return (
    <div className="min-h-screen bg-background">
      <SearchHero
        actions={filterActions}
        activeFiltersCount={activeFiltersCount}
        datePickerOpen={datePickerOpen}
        dateRange={dateRange}
        filters={filterState}
        isMobile={isMobile}
        searchSuggestions={searchSuggestions}
        setDatePickerOpen={setDatePickerOpen}
        tracks={tracks}
      />

      {/* Active Filter Badges below hero */}
      {activeFiltersCount > 0 && (
        <div className="container mx-auto px-4 pt-4 sm:px-6">
          <ActiveFilterBadges
            actions={filterActions}
            activeFiltersCount={activeFiltersCount}
            debouncedSearchQuery={debouncedSearchQuery}
            filters={filterState}
          />
        </div>
      )}

      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-6 xl:grid-cols-[320px_1fr] xl:gap-8">
          {/* Filters Sidebar - Desktop */}
          <aside className="hidden xl:block">
            <div className="sticky top-20">
              <FilterPanel
                actions={filterActions}
                activeFiltersCount={activeFiltersCount}
                filters={filterState}
                geocodeZipCode={geocodeZipCode}
                getCurrentLocation={getCurrentLocation}
                isGeocodingZip={isGeocodingZip}
                isGettingLocation={isGettingLocation}
                locationError={locationError}
                makes={makes}
                models={models}
                tracks={tracks}
                vehicles={vehicles}
              />
            </div>
          </aside>

          {/* Results */}
          <div className="w-full">
            <RecentlyViewed />
            <VehicleResultsGrid
              clearFilters={clearFilters}
              clearSearchAndDates={clearSearchAndDates}
              compareVehicleIds={compareIds}
              datesSelected={datesSelected}
              filteredVehicles={filteredVehicles}
              filterState={filterState}
              filterActions={filterActions}
              hasMore={hasMore}
              isLoading={vehiclesData === undefined || tracksData === undefined}
              itemsPerPage={itemsPerPage}
              loadMore={loadMore}
              mobileFilters={
                <MobileFilters
                  actions={filterActions}
                  activeFiltersCount={activeFiltersCount}
                  filteredCount={filteredVehicles.length}
                  filters={filterState}
                  geocodeZipCode={geocodeZipCode}
                  getCurrentLocation={getCurrentLocation}
                  isGeocodingZip={isGeocodingZip}
                  isGettingLocation={isGettingLocation}
                  locationError={locationError}
                  makes={makes}
                  models={models}
                  tracks={tracks}
                  vehicles={vehicles}
                />
              }
              onToggleCompare={toggleCompare}
              paginatedVehicles={paginatedVehicles}
              setSortBy={(s) => setSortBy(s as SortOption)}
              setViewMode={setViewMode}
              sortBy={sortBy}
              vehicles={vehicles}
              viewMode={viewMode}
            />
          </div>
        </div>
      </div>


      {/* Compare */}
      <CompareBar
        onClear={() => setCompareIds(new Set())}
        onCompare={() => setCompareOpen(true)}
        onRemove={(id) => toggleCompare(id)}
        selectedVehicles={compareVehicles}
      />
      <CompareModal onOpenChange={setCompareOpen} open={compareOpen} vehicles={compareVehicles} />

      {/* Bottom padding for filter bar */}
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
