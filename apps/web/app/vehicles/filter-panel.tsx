"use client"

import * as React from "react"
import {
  Filter,
  Loader2,
  MapPin,
  Navigation,
  Star,
  Shield,
  Lock,
  Flame,
  HardHat,
  Grid2x2,
  X,
} from "lucide-react"
import { Card } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Badge } from "@workspace/ui/components/badge"
import { Slider } from "@workspace/ui/components/slider"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { Combobox } from "@workspace/ui/components/command"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import type { FilterState, FilterActions, TrackItem, VehicleItem } from "./types"

type FilterPanelProps = {
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
}

const QUICK_PRESETS = [
  { label: "High Performance", filters: { minHorsepower: "500" } },
  { label: "Track Ready", filters: { selectedTireType: "R-Compound" } },
  { label: "Under $500/day", filters: { selectedPriceRange: "0-500" } },
  { label: "Beginner Friendly", filters: { selectedExperienceLevel: "beginner" } },
]

const DRIVE_TYPES = ["All", "FWD", "RWD", "AWD"]

const TRANSMISSIONS = ["All", "Manual", "Automatic", "Sequential", "DCT", "Paddle Shift"]

const EXPERIENCE_LEVELS = ["all", "beginner", "intermediate", "advanced"]

const TIRE_TYPES = ["all", "Street", "R-Compound", "Slick"]

const SAFETY_EQUIPMENT = [
  { value: "rollcage", label: "Roll Cage", icon: Shield },
  { value: "harness", label: "Racing Harness", icon: Lock },
  { value: "extinguisher", label: "Fire Extinguisher", icon: Flame },
  { value: "helmet", label: "Helmet", icon: HardHat },
  { value: "hans", label: "HANS Device", icon: Grid2x2 },
]

export function FilterPanel({
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
  isLoading = false,
}: FilterPanelProps) {
  const [zipInput, setZipInput] = React.useState(filters.locationZipCode)

  // Calculate price range from vehicles
  const prices = vehicles.map((v) => v.pricePerDay)
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 2000

  // Price histogram buckets
  const histogramBuckets = React.useMemo(() => {
    const bucketCount = 10
    const bucketSize = (maxPrice - minPrice) / bucketCount
    const buckets = Array(bucketCount).fill(0)

    prices.forEach((price) => {
      const bucketIndex = Math.min(
        Math.floor((price - minPrice) / bucketSize),
        bucketCount - 1
      )
      buckets[bucketIndex]++
    })

    const maxCount = Math.max(...buckets, 1)
    return buckets.map((count) => (count / maxCount) * 100)
  }, [prices, minPrice, maxPrice])

  // Adaptive step for price slider
  const priceStep = maxPrice > 1000 ? 100 : 25

  // Parse current price range
  const currentPriceMin = filters.customPriceRange?.[0] ?? minPrice
  const currentPriceMax = filters.customPriceRange?.[1] ?? maxPrice

  // Count vehicles by make
  const makeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    vehicles.forEach((v) => {
      counts[v.make] = (counts[v.make] || 0) + 1
    })
    return counts
  }, [vehicles])

  // Count vehicles by model
  const modelCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    vehicles.forEach((v) => {
      counts[v.model] = (counts[v.model] || 0) + 1
    })
    return counts
  }, [vehicles])

  // Active filters check for accordion dots
  const hasMakeModelFilter = filters.selectedMake !== "all" || filters.selectedModel !== "all"
  const hasDriveTypeFilter = filters.selectedDriveType !== "all"
  const hasHorsepowerFilter = !!filters.minHorsepower || !!filters.maxHorsepower
  const hasTransmissionFilter = filters.selectedTransmission !== "all"
  const hasYearFilter = !!filters.minYear || !!filters.maxYear
  const hasRatingFilter = !!filters.minRating && filters.minRating !== "any"
  const hasSafetyFilter = filters.selectedSafetyEquipment.length > 0
  const hasExperienceFilter = filters.selectedExperienceLevel !== "all"
  const hasTireTypeFilter = filters.selectedTireType !== "all"
  const hasDeliveryFilter = filters.deliveryOnly

  // Horsepower validation
  const horsepowerError =
    filters.minHorsepower &&
    filters.maxHorsepower &&
    Number.parseInt(filters.minHorsepower) > Number.parseInt(filters.maxHorsepower)

  // Year validation
  const yearError =
    filters.minYear &&
    filters.maxYear &&
    Number.parseInt(filters.minYear) > Number.parseInt(filters.maxYear)

  const handleZipSubmit = () => {
    if (zipInput.length === 5) {
      geocodeZipCode(zipInput)
    }
  }

  const handlePriceChange = (value: number[]) => {
    const min = value[0] ?? minPrice
    const max = value[1] ?? maxPrice
    actions.setCustomPriceRange([min, max])
    if (min === minPrice && max === maxPrice) {
      actions.setSelectedPriceRange("any")
    } else if (max === maxPrice) {
      actions.setSelectedPriceRange(`${min}+`)
    } else {
      actions.setSelectedPriceRange(`${min}-${max}`)
    }
  }

  const handleQuickPrice = (range: string) => {
    actions.setSelectedPriceRange(range)
    actions.setCustomPriceRange(null)
  }

  const applyPreset = (preset: (typeof QUICK_PRESETS)[number]) => {
    const f = preset.filters as unknown as Record<string, string>
    if (f.minHorsepower) actions.setMinHorsepower(f.minHorsepower)
    if (f.selectedTireType) actions.setSelectedTireType(f.selectedTireType)
    if (f.selectedPriceRange) handleQuickPrice(f.selectedPriceRange)
    if (f.selectedExperienceLevel) actions.setSelectedExperienceLevel(f.selectedExperienceLevel)
  }

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Filter className="size-5" />
          <h2 className="text-lg font-semibold">Filters</h2>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary">{activeFiltersCount}</Badge>
          )}
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-2">
          {QUICK_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {/* Location Section */}
        <div className="space-y-3">
          <Label>Location</Label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Enter ZIP code"
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleZipSubmit()
                }}
                maxLength={5}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleZipSubmit}
                disabled={isGeocodingZip || zipInput.length !== 5}
              >
                {isGeocodingZip ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={getCurrentLocation}
              disabled={isGettingLocation}
            >
              <Navigation className="size-4 mr-2" />
              {isGettingLocation ? "Getting location..." : "Use my current location"}
            </Button>
            {filters.locationLabel && (
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">{filters.locationLabel}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={actions.clearLocationFilter}
                >
                  <X className="size-3" />
                </Button>
              </div>
            )}
            {locationError && (
              <p className="text-sm text-destructive">{locationError}</p>
            )}
            <div className="space-y-2">
              <Label>Max Distance</Label>
              <Select
                value={filters.maxDistance === 0 ? "all" : filters.maxDistance.toString()}
                onValueChange={(value) => actions.setMaxDistance(value === "all" ? 0 : Number(value))}
                disabled={!filters.userLocation}
              >
                <SelectTrigger>
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
          </div>
        </div>

        {/* Track Select */}
        <div className="space-y-2">
          <Label>Track</Label>
          <Select value={filters.selectedTrack} onValueChange={actions.setSelectedTrack}>
            <SelectTrigger>
              <SelectValue placeholder="All tracks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tracks</SelectItem>
              {tracks.map((track) => (
                <SelectItem key={track.id} value={track.name}>
                  {track.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Price Section */}
        <div className="space-y-3">
          <Label>Price per Day</Label>

          {/* Histogram */}
          <div className="flex items-end justify-between gap-1 h-16 px-1">
            {histogramBuckets.map((height, i) => (
              <div
                key={i}
                className="flex-1 bg-primary/20 rounded-t"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>

          {/* Slider */}
          <Slider
            min={minPrice}
            max={maxPrice}
            step={priceStep}
            value={[currentPriceMin, currentPriceMax]}
            onValueChange={handlePriceChange}
            aria-label="Price range slider"
          />

          {/* Manual inputs */}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={currentPriceMin}
              onChange={(e) =>
                handlePriceChange([Number.parseInt(e.target.value) || minPrice, currentPriceMax])
              }
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="Max"
              value={currentPriceMax}
              onChange={(e) =>
                handlePriceChange([currentPriceMin, Number.parseInt(e.target.value) || maxPrice])
              }
            />
          </div>

          {/* Quick price buttons */}
          <div className="flex flex-wrap gap-2">
            {["0-250", "250-500", "500-1000", "1000-2000"].map((range) => (
              <Button
                key={range}
                variant={filters.selectedPriceRange === range ? "default" : "outline"}
                size="sm"
                onClick={() => handleQuickPrice(range)}
              >
                ${range.replace("-", " - $")}
              </Button>
            ))}
          </div>
        </div>

        {/* Secondary Filters Accordion */}
        <Accordion type="multiple" className="w-full">
          {/* Vehicle Make/Model */}
          <AccordionItem value="make-model">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <span>Vehicle Make & Model</span>
                {hasMakeModelFilter && (
                  <div className="size-2 rounded-full bg-primary" />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                <div className="space-y-2">
                  <Label>Make</Label>
                  <Combobox
                    options={[
                      { value: "all", label: `All makes (${vehicles.length})` },
                      ...makes.map((make) => ({
                        value: make,
                        label: `${make} (${makeCounts[make] || 0})`,
                      })),
                    ]}
                    value={filters.selectedMake}
                    onValueChange={actions.setSelectedMake}
                    placeholder="All makes"
                    searchPlaceholder="Search makes..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={filters.selectedModel}
                    onValueChange={actions.setSelectedModel}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All models" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All models</SelectItem>
                      {models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model} ({modelCounts[model] || 0})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Performance Section */}
          <AccordionItem value="performance">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <span>Performance</span>
                {(hasDriveTypeFilter || hasHorsepowerFilter || hasTransmissionFilter) && (
                  <div className="size-2 rounded-full bg-primary" />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {/* Drive Type */}
                <div className="space-y-2">
                  <Label>Drive Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {DRIVE_TYPES.map((type) => (
                      <Button
                        key={type}
                        variant={
                          (type === "All" && filters.selectedDriveType === "all") ||
                          filters.selectedDriveType === type
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          actions.setSelectedDriveType(type === "All" ? "all" : type)
                        }
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Horsepower */}
                <div className="space-y-2">
                  <Label>Horsepower</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={filters.minHorsepower}
                      onChange={(e) => actions.setMinHorsepower(e.target.value)}
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filters.maxHorsepower}
                      onChange={(e) => actions.setMaxHorsepower(e.target.value)}
                    />
                  </div>
                  {horsepowerError && (
                    <p className="text-sm text-destructive">
                      Min cannot be greater than max
                    </p>
                  )}
                </div>

                {/* Transmission */}
                <div className="space-y-2">
                  <Label>Transmission</Label>
                  <div className="flex flex-wrap gap-2">
                    {TRANSMISSIONS.map((trans) => (
                      <Button
                        key={trans}
                        variant={
                          (trans === "All" && filters.selectedTransmission === "all") ||
                          filters.selectedTransmission === trans
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          actions.setSelectedTransmission(trans === "All" ? "all" : trans)
                        }
                      >
                        {trans}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Details Section */}
          <AccordionItem value="details">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <span>Details</span>
                {(hasYearFilter || hasRatingFilter) && (
                  <div className="size-2 rounded-full bg-primary" />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {/* Year Range */}
                <div className="space-y-2">
                  <Label>Year</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      min={1950}
                      value={filters.minYear}
                      onChange={(e) => actions.setMinYear(e.target.value)}
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filters.maxYear}
                      onChange={(e) => actions.setMaxYear(e.target.value)}
                    />
                  </div>
                  {yearError && (
                    <p className="text-sm text-destructive">
                      Min cannot be greater than max
                    </p>
                  )}
                </div>

                {/* Rating */}
                <div className="space-y-2">
                  <Label>Minimum Rating</Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() =>
                          actions.setMinRating(
                            filters.minRating === rating.toString() ? "" : rating.toString()
                          )
                        }
                        className="transition-colors hover:scale-110"
                      >
                        <Star
                          className={cn(
                            "size-6",
                            Number.parseInt(filters.minRating || "0") >= rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Track Requirements Section */}
          <AccordionItem value="track-requirements">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <span>Track Requirements</span>
                {(hasSafetyFilter || hasExperienceFilter || hasTireTypeFilter || hasDeliveryFilter) && (
                  <div className="size-2 rounded-full bg-primary" />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {/* Safety Equipment */}
                <div className="space-y-2">
                  <Label>Safety Equipment</Label>
                  <div className="space-y-2">
                    {SAFETY_EQUIPMENT.map((item) => {
                      const Icon = item.icon
                      return (
                        <div key={item.value} className="flex items-center gap-2">
                          <Checkbox
                            id={item.value}
                            checked={filters.selectedSafetyEquipment.includes(item.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                actions.setSelectedSafetyEquipment([
                                  ...filters.selectedSafetyEquipment,
                                  item.value,
                                ])
                              } else {
                                actions.setSelectedSafetyEquipment(
                                  filters.selectedSafetyEquipment.filter(
                                    (v) => v !== item.value
                                  )
                                )
                              }
                            }}
                          />
                          <Label htmlFor={item.value} className="flex items-center gap-2">
                            <Icon className="size-4" />
                            {item.label}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Experience Level */}
                <div className="space-y-2">
                  <Label>Experience Level</Label>
                  <div className="flex flex-wrap gap-2">
                    {EXPERIENCE_LEVELS.map((level) => (
                      <Button
                        key={level}
                        variant={
                          filters.selectedExperienceLevel === level ||
                          (level === "all" && filters.selectedExperienceLevel === "all")
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          actions.setSelectedExperienceLevel(level)
                        }
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Tire Type */}
                <div className="space-y-2">
                  <Label>Tire Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {TIRE_TYPES.map((type) => (
                      <Button
                        key={type}
                        variant={
                          filters.selectedTireType === type ||
                          (type === "all" && filters.selectedTireType === "all")
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          actions.setSelectedTireType(type)
                        }
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Delivery */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="delivery"
                    checked={filters.deliveryOnly}
                    onCheckedChange={(checked) =>
                      actions.setDeliveryOnly(checked === true)
                    }
                  />
                  <Label htmlFor="delivery">Delivery available only</Label>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Clear Filters */}
        {activeFiltersCount > 0 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={actions.clearFilters}
          >
            Clear All Filters
          </Button>
        )}
      </div>
    </Card>
  )
}
