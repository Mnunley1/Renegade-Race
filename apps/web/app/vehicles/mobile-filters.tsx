"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { Slider } from "@workspace/ui/components/slider"
import { cn } from "@workspace/ui/lib/utils"
import {
  Filter,
  Flame,
  Grid2x2,
  HardHat,
  Loader2,
  Lock,
  Navigation,
  Shield,
  Star,
  X,
} from "lucide-react"
import { useState } from "react"
import type { FilterActions, FilterState, TrackItem, VehicleItem } from "./types"

type MobileFiltersProps = {
  filters: FilterState
  actions: FilterActions
  tracks: TrackItem[]
  makes: string[]
  models: string[]
  vehicles: VehicleItem[]
  activeFiltersCount: number
  isGettingLocation: boolean
  isGeocodingZip: boolean
  locationError: string | null
  getCurrentLocation: () => void
  geocodeZipCode: (zip: string) => void
  isLoading?: boolean
  filteredCount?: number
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
        {title}
      </Label>
      {children}
    </div>
  )
}

export function MobileFilters({
  filters,
  actions,
  tracks,
  makes,
  models,
  vehicles,
  activeFiltersCount,
  isGettingLocation,
  isGeocodingZip,
  locationError,
  getCurrentLocation,
  geocodeZipCode,
  isLoading,
  filteredCount = 0,
}: MobileFiltersProps) {
  const [open, setOpen] = useState(false)

  const prices = vehicles.map((v) => v.pricePerDay).filter(Boolean)
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 5000
  const currentMin = filters.customPriceRange?.[0] ?? minPrice
  const currentMax = filters.customPriceRange?.[1] ?? maxPrice

  // Enhancement #5: Price histogram
  const priceHistogram = () => {
    if (prices.length === 0) return null
    const bucketCount = 20
    const bucketSize = (maxPrice - minPrice) / bucketCount
    const buckets = new Array(bucketCount).fill(0)

    for (const price of prices) {
      const bucketIndex = Math.min(bucketCount - 1, Math.floor((price - minPrice) / bucketSize))
      buckets[bucketIndex]++
    }

    const maxBucketValue = Math.max(...buckets)

    return (
      <div className="flex h-12 items-end gap-0.5">
        {buckets.map((count, i) => {
          const height = maxBucketValue > 0 ? (count / maxBucketValue) * 100 : 0
          const isInRange =
            minPrice + i * bucketSize >= currentMin && minPrice + (i + 1) * bucketSize <= currentMax
          return (
            <div
              className={cn(
                "flex-1 rounded-t-sm transition-colors",
                isInRange ? "bg-primary" : "bg-muted"
              )}
              key={i}
              style={{ height: `${height}%` }}
            />
          )
        })}
      </div>
    )
  }

  // Enhancement #6: Safety equipment icon mapping
  const safetyIcons = {
    "Roll Cage": Shield,
    Harness: Lock,
    "Fire Suppression": Flame,
    "HANS Device": HardHat,
    "Window Net": Grid2x2,
  }

  if (isLoading) {
    return (
      <Button className="h-9 sm:h-10" disabled size="sm" variant="outline">
        <Filter className="mr-2 size-4" />
        Filters
        <Loader2 className="ml-2 size-4 animate-spin" />
      </Button>
    )
  }

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button className="h-9 sm:h-10" size="sm" variant="outline">
          <Filter className="mr-2 size-4" />
          Filters
          {activeFiltersCount > 0 && (
            <Badge className="ml-1.5 text-xs" variant="secondary">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        className="flex w-full flex-col gap-0 p-0 sm:max-w-sm"
        onOpenAutoFocus={(e) => e.preventDefault()}
        side="left"
      >
        <SheetHeader className="shrink-0 space-y-0 border-b px-5 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">Filters</SheetTitle>
            {activeFiltersCount > 0 && (
              <button
                className="font-medium text-primary text-sm hover:underline"
                onClick={actions.clearFilters}
                type="button"
              >
                Clear all
              </button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5 [&:hover::-webkit-scrollbar-thumb]:bg-muted-foreground/25">
          <div className="divide-y">
            {/* Enhancement #9: Quick Filters */}
            <div className="px-5 pb-4">
              <FilterSection title="Quick Filters">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    className="rounded-full border border-border px-3 py-1.5 font-medium text-muted-foreground text-xs transition-colors hover:border-primary hover:bg-primary/5"
                    onClick={() => {
                      actions.setMinHorsepower("500")
                      actions.setSelectedDriveType("RWD")
                    }}
                    type="button"
                  >
                    High Performance
                  </button>
                  <button
                    className="rounded-full border border-border px-3 py-1.5 font-medium text-muted-foreground text-xs transition-colors hover:border-primary hover:bg-primary/5"
                    onClick={() => actions.setSelectedSafetyEquipment(["Roll Cage", "Harness"])}
                    type="button"
                  >
                    Track Ready
                  </button>
                  <button
                    className="rounded-full border border-border px-3 py-1.5 font-medium text-muted-foreground text-xs transition-colors hover:border-primary hover:bg-primary/5"
                    onClick={() => {
                      actions.setCustomPriceRange([0, 500])
                      actions.setSelectedPriceRange("0-500")
                    }}
                    type="button"
                  >
                    Under $500/day
                  </button>
                  <button
                    className="rounded-full border border-border px-3 py-1.5 font-medium text-muted-foreground text-xs transition-colors hover:border-primary hover:bg-primary/5"
                    onClick={() => {
                      actions.setSelectedExperienceLevel("beginner")
                      actions.setDeliveryOnly(true)
                    }}
                    type="button"
                  >
                    Beginner Friendly
                  </button>
                </div>
              </FilterSection>
            </div>

            {/* Location */}
            <div className="px-5 py-4">
              <FilterSection title="Location">
                <Select
                  disabled={!filters.userLocation}
                  onValueChange={(value) =>
                    actions.setMaxDistance(value === "all" ? 0 : Number(value))
                  }
                  value={filters.maxDistance === 0 ? "all" : filters.maxDistance.toString()}
                >
                  <SelectTrigger className="h-10">
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

                <div className="relative">
                  <Input
                    aria-label="ZIP code for location search"
                    className="h-10"
                    maxLength={10}
                    onBlur={() => {
                      if (filters.locationZipCode.length >= 5) {
                        geocodeZipCode(filters.locationZipCode)
                      }
                    }}
                    onChange={(e) => {
                      const value = e.target.value
                      actions.setLocationZipCode(value)
                      if (value.length === 5 && /^\d{5}$/.test(value)) {
                        geocodeZipCode(value)
                      }
                    }}
                    placeholder="Enter ZIP code"
                    value={filters.locationZipCode}
                  />
                  {isGeocodingZip && (
                    <div className="absolute top-1/2 right-3 -translate-y-1/2">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>

                {locationError && <p className="text-destructive text-xs">{locationError}</p>}

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

                {filters.userLocation && filters.locationLabel && (
                  <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                    <span className="text-muted-foreground text-xs">
                      Near:{" "}
                      <span className="font-medium text-foreground">{filters.locationLabel}</span>
                    </span>
                    <button
                      aria-label="Clear location"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={actions.clearLocationFilter}
                      type="button"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
              </FilterSection>
            </div>

            {/* Track */}
            <div className="px-5 py-4">
              <FilterSection title="Track">
                <Select onValueChange={actions.setSelectedTrack} value={filters.selectedTrack}>
                  <SelectTrigger className="h-10">
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
              </FilterSection>
            </div>

            {/* Price Range */}
            <div className="px-5 py-4">
              <FilterSection title="Price Range">
                <div className="space-y-3">
                  {priceHistogram()}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">${currentMin}/day</span>
                    <span className="text-muted-foreground">${currentMax}/day</span>
                  </div>
                  <Slider
                    aria-label="Price range"
                    aria-valuetext={`$${currentMin} to $${currentMax} per day`}
                    className="w-full"
                    max={maxPrice}
                    min={minPrice}
                    onValueChange={(value) => {
                      const [min, max] = value as [number, number]
                      actions.setCustomPriceRange([min, max])
                      if (min === minPrice && max === maxPrice) {
                        actions.setSelectedPriceRange("any")
                      } else if (max === maxPrice) {
                        actions.setSelectedPriceRange(`${min}+`)
                      } else {
                        actions.setSelectedPriceRange(`${min}-${max}`)
                      }
                    }}
                    step={maxPrice > 1000 ? 100 : 25}
                    value={[currentMin, currentMax]}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Minimum price"
                    className="h-10"
                    max={maxPrice}
                    min={minPrice}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      const newMin = Math.max(minPrice, Math.min(val, currentMax))
                      actions.setCustomPriceRange([newMin, currentMax])
                      if (newMin === minPrice && currentMax === maxPrice) {
                        actions.setSelectedPriceRange("any")
                      } else {
                        actions.setSelectedPriceRange(`${newMin}-${currentMax}`)
                      }
                    }}
                    placeholder="Min"
                    type="number"
                    value={currentMin}
                  />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input
                    aria-label="Maximum price"
                    className="h-10"
                    max={maxPrice}
                    min={minPrice}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      const newMax = Math.min(maxPrice, Math.max(val, currentMin))
                      actions.setCustomPriceRange([currentMin, newMax])
                      if (currentMin === minPrice && newMax === maxPrice) {
                        actions.setSelectedPriceRange("any")
                      } else {
                        actions.setSelectedPriceRange(`${currentMin}-${newMax}`)
                      }
                    }}
                    placeholder="Max"
                    type="number"
                    value={currentMax}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    className="h-8 text-xs"
                    onClick={() => {
                      actions.setCustomPriceRange(null)
                      actions.setSelectedPriceRange("any")
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Reset
                  </Button>
                  <Button
                    className="h-8 text-xs"
                    onClick={() => {
                      actions.setCustomPriceRange([0, 500])
                      actions.setSelectedPriceRange("0-500")
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Under $500
                  </Button>
                  <Button
                    className="h-8 text-xs"
                    onClick={() => {
                      actions.setCustomPriceRange([500, 1000])
                      actions.setSelectedPriceRange("500-1000")
                    }}
                    size="sm"
                    variant="outline"
                  >
                    $500-$1K
                  </Button>
                </div>
              </FilterSection>
            </div>

            {/* Enhancement #10: Separator label - Vehicle */}
            <div className="flex items-center gap-2 px-5 py-1">
              <div className="h-px flex-1 bg-border" />
              <span className="font-medium text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                Vehicle
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Make & Model - Enhancement #11: Counts on Make options */}
            <div className="px-5 py-4">
              <FilterSection title="Make & Model">
                <Select onValueChange={actions.setSelectedMake} value={filters.selectedMake}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All makes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All makes</SelectItem>
                    {makes.map((make) => (
                      <SelectItem key={make} value={make}>
                        {make} ({vehicles.filter((v) => v.make === make).length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  disabled={filters.selectedMake === "all"}
                  onValueChange={actions.setSelectedModel}
                  value={filters.selectedModel}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue
                      placeholder={
                        filters.selectedMake === "all" ? "Select make first" : "All models"
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
              </FilterSection>
            </div>

            {/* Enhancement #1: Drive Type toggle chips */}
            <div className="px-5 py-4">
              <FilterSection title="Drive Type">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: "all", label: "All" },
                    { value: "FWD", label: "FWD" },
                    { value: "RWD", label: "RWD" },
                    { value: "AWD", label: "AWD" },
                  ].map((opt) => (
                    <button
                      className={cn(
                        "rounded-full border px-3 py-1.5 font-medium text-xs transition-colors",
                        filters.selectedDriveType === opt.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      key={opt.value}
                      onClick={() => actions.setSelectedDriveType(opt.value)}
                      type="button"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FilterSection>
            </div>

            {/* Enhancement #1: Transmission toggle chips */}
            <div className="px-5 py-4">
              <FilterSection title="Transmission">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: "all", label: "All" },
                    { value: "Manual", label: "Manual" },
                    { value: "Automatic", label: "Automatic" },
                    { value: "Sequential", label: "Sequential" },
                    { value: "DCT", label: "DCT" },
                    { value: "Paddle Shift", label: "Paddle Shift" },
                  ].map((opt) => (
                    <button
                      className={cn(
                        "rounded-full border px-3 py-1.5 font-medium text-xs transition-colors",
                        filters.selectedTransmission === opt.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      key={opt.value}
                      onClick={() => actions.setSelectedTransmission(opt.value)}
                      type="button"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FilterSection>
            </div>

            {/* Enhancement #10: Separator label - Performance */}
            <div className="flex items-center gap-2 px-5 py-1">
              <div className="h-px flex-1 bg-border" />
              <span className="font-medium text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                Performance
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Horsepower */}
            <div className="px-5 py-4">
              <FilterSection title="Horsepower">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-muted-foreground text-xs" htmlFor="mobile-min-hp">
                      Min HP
                    </Label>
                    <Input
                      className="h-10"
                      id="mobile-min-hp"
                      min={0}
                      onChange={(e) => actions.setMinHorsepower(e.target.value)}
                      placeholder="e.g., 400"
                      type="number"
                      value={filters.minHorsepower}
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs" htmlFor="mobile-max-hp">
                      Max HP
                    </Label>
                    <Input
                      className="h-10"
                      id="mobile-max-hp"
                      min={0}
                      onChange={(e) => actions.setMaxHorsepower(e.target.value)}
                      placeholder="e.g., 800"
                      type="number"
                      value={filters.maxHorsepower}
                    />
                  </div>
                </div>
                {filters.minHorsepower &&
                  filters.maxHorsepower &&
                  Number(filters.minHorsepower) > Number(filters.maxHorsepower) && (
                    <p className="text-destructive text-xs">Min must be less than max</p>
                  )}
              </FilterSection>
            </div>

            {/* Year Range */}
            <div className="px-5 py-4">
              <FilterSection title="Year Range">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-muted-foreground text-xs" htmlFor="mobile-min-year">
                      Min Year
                    </Label>
                    <Input
                      className="h-10"
                      id="mobile-min-year"
                      max={new Date().getFullYear() + 1}
                      min={1950}
                      onChange={(e) => actions.setMinYear(e.target.value)}
                      placeholder="e.g., 2020"
                      type="number"
                      value={filters.minYear}
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs" htmlFor="mobile-max-year">
                      Max Year
                    </Label>
                    <Input
                      className="h-10"
                      id="mobile-max-year"
                      max={new Date().getFullYear() + 1}
                      min={1950}
                      onChange={(e) => actions.setMaxYear(e.target.value)}
                      placeholder="e.g., 2024"
                      type="number"
                      value={filters.maxYear}
                    />
                  </div>
                </div>
                {filters.minYear &&
                  filters.maxYear &&
                  Number(filters.minYear) > Number(filters.maxYear) && (
                    <p className="text-destructive text-xs">Min must be less than max</p>
                  )}
              </FilterSection>
            </div>

            {/* Enhancement #10: Separator label - Track Requirements */}
            <div className="flex items-center gap-2 px-5 py-1">
              <div className="h-px flex-1 bg-border" />
              <span className="font-medium text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                Track Requirements
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Enhancement #2: Rating as interactive stars */}
            <div className="px-5 py-4">
              <FilterSection title="Minimum Rating">
                <div className="flex items-center gap-1">
                  {[
                    { value: "any", rating: 0 },
                    { value: "4", rating: 4 },
                    { value: "4.5", rating: 4.5 },
                    { value: "4.7", rating: 4.7 },
                    { value: "4.9", rating: 4.9 },
                  ].map((opt, idx) => (
                    <button
                      aria-label={opt.value === "any" ? "Any rating" : `${opt.rating}+ stars`}
                      className={cn(
                        "rounded-md p-1.5 transition-colors hover:bg-muted",
                        filters.minRating === opt.value && "bg-muted"
                      )}
                      key={opt.value}
                      onClick={() => actions.setMinRating(opt.value)}
                      type="button"
                    >
                      <Star
                        className={cn(
                          "size-6 transition-colors",
                          filters.minRating !== "any" &&
                            idx > 0 &&
                            idx <=
                              ([0, 4, 4.5, 4.7, 4.9].indexOf(
                                Number.parseFloat(filters.minRating)
                              ) || 0)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground"
                        )}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  {filters.minRating === "any" ? "Any rating" : `${filters.minRating}+ stars`}
                </p>
              </FilterSection>
            </div>

            {/* Enhancement #6: Safety Equipment with icons */}
            <div className="px-5 py-4">
              <FilterSection title="Safety Equipment">
                <div className="space-y-2">
                  {(
                    [
                      "Roll Cage",
                      "Harness",
                      "Fire Suppression",
                      "HANS Device",
                      "Window Net",
                    ] as const
                  ).map((item) => {
                    const Icon = safetyIcons[item]
                    return (
                      <label className="flex items-center gap-2 text-sm" key={item}>
                        <Checkbox
                          checked={filters.selectedSafetyEquipment.includes(item)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              actions.setSelectedSafetyEquipment([
                                ...filters.selectedSafetyEquipment,
                                item,
                              ])
                            } else {
                              actions.setSelectedSafetyEquipment(
                                filters.selectedSafetyEquipment.filter((e) => e !== item)
                              )
                            }
                          }}
                        />
                        <Icon className="size-4 text-muted-foreground" />
                        {item}
                      </label>
                    )
                  })}
                </div>
              </FilterSection>
            </div>

            {/* Enhancement #1: Experience Level toggle chips */}
            <div className="px-5 py-4">
              <FilterSection title="Experience Level">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: "all", label: "All" },
                    { value: "beginner", label: "Beginner" },
                    { value: "intermediate", label: "Intermediate" },
                    { value: "advanced", label: "Advanced" },
                  ].map((opt) => (
                    <button
                      className={cn(
                        "rounded-full border px-3 py-1.5 font-medium text-xs transition-colors",
                        filters.selectedExperienceLevel === opt.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      key={opt.value}
                      onClick={() => actions.setSelectedExperienceLevel(opt.value)}
                      type="button"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FilterSection>
            </div>

            {/* Enhancement #1: Tire Type toggle chips */}
            <div className="px-5 py-4">
              <FilterSection title="Tire Type">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: "all", label: "All" },
                    { value: "Street", label: "Street" },
                    { value: "R-Compound", label: "R-Compound" },
                    { value: "Slick", label: "Slick" },
                  ].map((opt) => (
                    <button
                      className={cn(
                        "rounded-full border px-3 py-1.5 font-medium text-xs transition-colors",
                        filters.selectedTireType === opt.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      key={opt.value}
                      onClick={() => actions.setSelectedTireType(opt.value)}
                      type="button"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FilterSection>
            </div>

            {/* Delivery */}
            <div className="px-5 py-4">
              <FilterSection title="Pickup / Delivery">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={filters.deliveryOnly}
                    onCheckedChange={(checked) => actions.setDeliveryOnly(checked === true)}
                  />
                  Delivery available
                </label>
              </FilterSection>
            </div>
          </div>
        </div>

        {/* Enhancement #3: Sticky footer with result count */}
        <div className="shrink-0 border-t bg-background px-5 py-3">
          <div className="flex items-center gap-3">
            {activeFiltersCount > 0 && (
              <Button className="text-sm" onClick={actions.clearFilters} size="sm" variant="ghost">
                Clear all
              </Button>
            )}
            <Button className="flex-1" onClick={() => setOpen(false)} size="lg">
              Show {filteredCount} vehicle{filteredCount !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
