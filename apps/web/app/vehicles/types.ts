export type VehicleItem = {
  id: string
  image: string
  imageKey?: string
  name: string
  year: number
  make: string
  model: string
  pricePerDay: number
  location: string
  track: string
  rating: number
  reviews: number
  horsepower?: number
  transmission: string
  drivetrain: string
  bookingCount?: number
  amenities?: string[]
  experienceLevel?: string
  tireType?: string
  deliveryAvailable?: boolean
}

export type TrackItem = {
  id: string
  name: string
  location: string
}

export type FilterState = {
  searchQuery: string
  selectedLocation: string
  selectedTrack: string
  selectedMake: string
  selectedModel: string
  selectedDriveType: string
  selectedPriceRange: string
  customPriceRange: [number, number] | null
  minHorsepower: string
  maxHorsepower: string
  selectedTransmission: string
  minYear: string
  maxYear: string
  minRating: string
  selectedDates: { start: string; end: string }
  userLocation: { lat: number; lng: number } | null
  locationZipCode: string
  locationLabel: string
  maxDistance: number
  selectedSafetyEquipment: string[]
  selectedExperienceLevel: string
  selectedTireType: string
  selectedTransmissionExpanded: string
  deliveryOnly: boolean
}

export type FilterActions = {
  setSearchQuery: (value: string) => void
  setSelectedLocation: (value: string) => void
  setSelectedTrack: (value: string) => void
  setSelectedMake: (value: string) => void
  setSelectedModel: (value: string) => void
  setSelectedDriveType: (value: string) => void
  setSelectedPriceRange: (value: string) => void
  setCustomPriceRange: (value: [number, number] | null) => void
  setMinHorsepower: (value: string) => void
  setMaxHorsepower: (value: string) => void
  setSelectedTransmission: (value: string) => void
  setMinYear: (value: string) => void
  setMaxYear: (value: string) => void
  setMinRating: (value: string) => void
  setSelectedDates: (value: { start: string; end: string }) => void
  setDateRange: (value: import("react-day-picker").DateRange | undefined) => void
  setUserLocation: (value: { lat: number; lng: number } | null) => void
  setLocationZipCode: (value: string) => void
  setLocationLabel: (value: string) => void
  setMaxDistance: (value: number) => void
  clearFilters: () => void
  clearLocationFilter: () => void
  setSelectedSafetyEquipment: (value: string[]) => void
  setSelectedExperienceLevel: (value: string) => void
  setSelectedTireType: (value: string) => void
  setDeliveryOnly: (value: boolean) => void
}

export type SortOption =
  | "popularity"
  | "price-low"
  | "price-high"
  | "newest"
  | "rating"
  | "horsepower"

export type ViewMode = "grid" | "list"
