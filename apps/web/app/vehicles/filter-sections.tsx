"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
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
import { Slider } from "@workspace/ui/components/slider"
import { cn } from "@workspace/ui/lib/utils"
import { Flame, Grid2x2, HardHat, Lock, MapPin, Shield, Star, X } from "lucide-react"
import * as React from "react"
import { centsToDollarInput, dollarsToCents } from "@/lib/rental-money"
import { parsePriceRange, priceRangeState } from "./price-filter"
import type { FilterActions, FilterState, TrackItem, VehicleItem } from "./types"

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
const DISTANCE_OPTIONS = ["10", "25", "50", "100", "250", "500"]

type FilterSectionsProps = {
  filters: FilterState
  actions: FilterActions
  tracks: TrackItem[]
  vehicles: VehicleItem[]
}

const isDefault = (value: string, ...defaults: string[]) => defaults.includes(value)

export function FilterSections({ filters, actions, tracks, vehicles }: FilterSectionsProps) {
  const prices = vehicles
    .map((v) => v.pricePerDay)
    .filter((price) => Number.isSafeInteger(price) && price >= 0)
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0
  const rawMaxPrice = prices.length > 0 ? Math.max(...prices) : 200000
  // Keep the slider usable for a single price; explicit bounds may extend beyond
  // today's inventory and must not change when results or other filters change.
  const maxPrice = rawMaxPrice > minPrice ? rawMaxPrice : minPrice + 100
  const bounds = parsePriceRange(filters.selectedPriceRange)
  const currentPriceMin = bounds.min ?? minPrice
  const currentPriceMax = bounds.max ?? maxPrice
  const sliderMin = Math.min(minPrice, currentPriceMin)
  const sliderMax = Math.max(maxPrice, currentPriceMin + 1, currentPriceMax)
  const [priceMinInput, setPriceMinInput] = React.useState(centsToDollarInput(currentPriceMin))
  const openMaximum = bounds.min !== undefined && bounds.max === undefined
  const [priceMaxInput, setPriceMaxInput] = React.useState(
    openMaximum ? "" : centsToDollarInput(currentPriceMax)
  )
  const [priceError, setPriceError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setPriceMinInput(centsToDollarInput(currentPriceMin))
    setPriceMaxInput(openMaximum ? "" : centsToDollarInput(currentPriceMax))
    setPriceError(null)
  }, [currentPriceMin, currentPriceMax, openMaximum, filters.selectedPriceRange])

  const histogram = React.useMemo(() => {
    const bucketCount = 16
    const bucketSize = (maxPrice - minPrice) / bucketCount || 1
    const buckets = new Array(bucketCount).fill(0)
    for (const price of prices) {
      const idx = Math.min(bucketCount - 1, Math.floor((price - minPrice) / bucketSize))
      buckets[idx]++
    }
    const maxCount = Math.max(...buckets, 1)
    return buckets.map((count, i) => ({
      height: (count / maxCount) * 100,
      inRange:
        minPrice + i * bucketSize >= currentPriceMin &&
        minPrice + (i + 1) * bucketSize <= currentPriceMax,
    }))
  }, [prices, minPrice, maxPrice, currentPriceMin, currentPriceMax])

  const hasPerformanceFilter =
    filters.selectedDriveType !== "all" ||
    !!filters.minHorsepower ||
    !!filters.maxHorsepower ||
    filters.selectedTransmission !== "all"
  const hasDetailsFilter =
    !!filters.minYear || !!filters.maxYear || (!!filters.minRating && filters.minRating !== "any")
  const hasTrackReqFilter =
    filters.selectedSafetyEquipment.length > 0 ||
    filters.selectedExperienceLevel !== "all" ||
    filters.selectedTireType !== "all" ||
    filters.deliveryOnly
  const hasTrackFilter = filters.selectedTrack !== "all"

  const applyPriceBounds = (min: number, max: number | undefined) => {
    actions.setCustomPriceRange(null)
    actions.setSelectedPriceRange(priceRangeState({ min, max }))
    setPriceError(null)
  }

  const handlePriceChange = (value: number[]) => {
    const min = dollarsToCents(value[0] ?? sliderMin / 100)
    const max = dollarsToCents(value[1] ?? sliderMax / 100)
    if (min !== null && max !== null) applyPriceBounds(min, max)
  }

  const commitPriceInputs = () => {
    const min = priceMinInput.trim() === "" ? 0 : dollarsToCents(priceMinInput)
    const max = priceMaxInput.trim() === "" ? undefined : dollarsToCents(priceMaxInput)
    if (min === null || max === null || (max !== undefined && min > max)) {
      setPriceError("Enter valid dollar amounts with the minimum no greater than the maximum.")
      return
    }
    if (priceMinInput.trim() === "" && priceMaxInput.trim() === "") {
      actions.setCustomPriceRange(null)
      actions.setSelectedPriceRange("any")
      setPriceError(null)
      return
    }
    applyPriceBounds(min, max)
    setPriceMinInput(centsToDollarInput(min))
    setPriceMaxInput(max === undefined ? "" : centsToDollarInput(max))
  }

  const hasLocation = Boolean(filters.userLocation || filters.locationLabel)

  return (
    <div className="space-y-6">
      {/* Distance — only when a location is set in search */}
      {hasLocation && (
        <div className="space-y-2">
          <Label>Distance</Label>
          {filters.locationLabel && (
            <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{filters.locationLabel}</span>
              </span>
              <Button
                className="size-6 shrink-0"
                onClick={actions.clearLocationFilter}
                size="icon"
                variant="ghost"
              >
                <X className="size-3" />
              </Button>
            </div>
          )}
          <Select
            disabled={!filters.userLocation}
            onValueChange={(value) => actions.setMaxDistance(value === "all" ? 0 : Number(value))}
            value={filters.maxDistance === 0 ? "all" : filters.maxDistance.toString()}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any distance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any distance</SelectItem>
              {DISTANCE_OPTIONS.map((mi) => (
                <SelectItem key={mi} value={mi}>
                  Within {mi} miles
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Price — always visible */}
      <div className="space-y-3">
        <Label>Price per Day (USD)</Label>
        <div className="flex h-12 items-end gap-0.5">
          {histogram.map((bucket, i) => (
            <div
              className={cn(
                "flex-1 rounded-t-sm transition-colors",
                bucket.inRange ? "bg-primary/70" : "bg-muted"
              )}
              key={i}
              style={{ height: `${Math.max(bucket.height, 4)}%` }}
            />
          ))}
        </div>
        <Slider
          aria-label="Price range in dollars"
          max={sliderMax / 100}
          min={sliderMin / 100}
          onValueChange={handlePriceChange}
          step={0.01}
          value={[currentPriceMin / 100, Math.max(currentPriceMin, currentPriceMax) / 100]}
        />
        <div className="flex items-center gap-2">
          <Input
            aria-invalid={Boolean(priceError)}
            aria-label="Minimum price (USD)"
            min="0"
            onBlur={commitPriceInputs}
            onChange={(e) => setPriceMinInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitPriceInputs()
            }}
            placeholder="Min"
            step="0.01"
            type="number"
            value={priceMinInput}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            aria-invalid={Boolean(priceError)}
            aria-label="Maximum price (USD)"
            min="0"
            onBlur={commitPriceInputs}
            onChange={(e) => setPriceMaxInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitPriceInputs()
            }}
            placeholder="Max"
            step="0.01"
            type="number"
            value={priceMaxInput}
          />
        </div>
        {priceError && (
          <p className="text-destructive text-sm" role="alert">
            {priceError}
          </p>
        )}
      </div>

      <Accordion className="w-full" defaultValue={["track"]} type="multiple">
        {/* Track */}
        <AccordionItem value="track">
          <AccordionTrigger>
            <SectionLabel active={hasTrackFilter}>Track</SectionLabel>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-2">
              <Select onValueChange={actions.setSelectedTrack} value={filters.selectedTrack}>
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
          </AccordionContent>
        </AccordionItem>

        {/* Performance */}
        <AccordionItem value="performance">
          <AccordionTrigger>
            <SectionLabel active={hasPerformanceFilter}>Performance</SectionLabel>
          </AccordionTrigger>
          <AccordionContent>
            <PerformanceSection actions={actions} filters={filters} />
          </AccordionContent>
        </AccordionItem>

        {/* Details */}
        <AccordionItem value="details">
          <AccordionTrigger>
            <SectionLabel active={hasDetailsFilter}>Details</SectionLabel>
          </AccordionTrigger>
          <AccordionContent>
            <DetailsSection actions={actions} filters={filters} />
          </AccordionContent>
        </AccordionItem>

        {/* Track Requirements */}
        <AccordionItem value="track-requirements">
          <AccordionTrigger>
            <SectionLabel active={hasTrackReqFilter}>Track Requirements</SectionLabel>
          </AccordionTrigger>
          <AccordionContent>
            <TrackRequirementsSection actions={actions} filters={filters} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

function PerformanceSection({
  filters,
  actions,
}: {
  filters: FilterState
  actions: FilterActions
}) {
  const horsepowerError =
    filters.minHorsepower &&
    filters.maxHorsepower &&
    Number.parseInt(filters.minHorsepower, 10) > Number.parseInt(filters.maxHorsepower, 10)

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Drive Type</Label>
        <div className="flex flex-wrap gap-2">
          {DRIVE_TYPES.map((type) => (
            <Button
              key={type}
              onClick={() => actions.setSelectedDriveType(type === "All" ? "all" : type)}
              size="sm"
              variant={
                (type === "All" && isDefault(filters.selectedDriveType, "all")) ||
                filters.selectedDriveType === type
                  ? "default"
                  : "outline"
              }
            >
              {type}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Horsepower</Label>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Minimum horsepower"
            onChange={(e) => actions.setMinHorsepower(e.target.value)}
            placeholder="Min"
            type="number"
            value={filters.minHorsepower}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            aria-label="Maximum horsepower"
            onChange={(e) => actions.setMaxHorsepower(e.target.value)}
            placeholder="Max"
            type="number"
            value={filters.maxHorsepower}
          />
        </div>
        {horsepowerError && (
          <p className="text-destructive text-sm">Min cannot be greater than max</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Transmission</Label>
        <div className="flex flex-wrap gap-2">
          {TRANSMISSIONS.map((trans) => (
            <Button
              key={trans}
              onClick={() => actions.setSelectedTransmission(trans === "All" ? "all" : trans)}
              size="sm"
              variant={
                (trans === "All" && isDefault(filters.selectedTransmission, "all")) ||
                filters.selectedTransmission === trans
                  ? "default"
                  : "outline"
              }
            >
              {trans}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

function DetailsSection({ filters, actions }: { filters: FilterState; actions: FilterActions }) {
  const yearError =
    filters.minYear &&
    filters.maxYear &&
    Number.parseInt(filters.minYear, 10) > Number.parseInt(filters.maxYear, 10)

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Year</Label>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Minimum year"
            min={1950}
            onChange={(e) => actions.setMinYear(e.target.value)}
            placeholder="Min"
            type="number"
            value={filters.minYear}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            aria-label="Maximum year"
            onChange={(e) => actions.setMaxYear(e.target.value)}
            placeholder="Max"
            type="number"
            value={filters.maxYear}
          />
        </div>
        {yearError && <p className="text-destructive text-sm">Min cannot be greater than max</p>}
      </div>
      <div className="space-y-2">
        <Label>Minimum Rating</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              className="transition-transform hover:scale-110"
              key={rating}
              onClick={() =>
                actions.setMinRating(
                  filters.minRating === rating.toString() ? "" : rating.toString()
                )
              }
              type="button"
            >
              <Star
                className={cn(
                  "size-6",
                  Number.parseInt(filters.minRating || "0", 10) >= rating
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground"
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function TrackRequirementsSection({
  filters,
  actions,
}: {
  filters: FilterState
  actions: FilterActions
}) {
  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Safety Equipment</Label>
        <div className="space-y-2">
          {SAFETY_EQUIPMENT.map((item) => {
            const Icon = item.icon
            const checked = filters.selectedSafetyEquipment.includes(item.value)
            return (
              <div className="flex items-center gap-2" key={item.value}>
                <Checkbox
                  checked={checked}
                  id={item.value}
                  onCheckedChange={(next) =>
                    actions.setSelectedSafetyEquipment(
                      next
                        ? [...filters.selectedSafetyEquipment, item.value]
                        : filters.selectedSafetyEquipment.filter((v) => v !== item.value)
                    )
                  }
                />
                <Label className="flex items-center gap-2" htmlFor={item.value}>
                  <Icon className="size-4" />
                  {item.label}
                </Label>
              </div>
            )
          })}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Experience Level</Label>
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE_LEVELS.map((level) => (
            <Button
              key={level}
              onClick={() => actions.setSelectedExperienceLevel(level)}
              size="sm"
              variant={filters.selectedExperienceLevel === level ? "default" : "outline"}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Tire Type</Label>
        <div className="flex flex-wrap gap-2">
          {TIRE_TYPES.map((type) => (
            <Button
              key={type}
              onClick={() => actions.setSelectedTireType(type)}
              size="sm"
              variant={filters.selectedTireType === type ? "default" : "outline"}
            >
              {type === "all" ? "All" : type}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={filters.deliveryOnly}
          id="delivery"
          onCheckedChange={(checked) => actions.setDeliveryOnly(checked === true)}
        />
        <Label htmlFor="delivery">Delivery available only</Label>
      </div>
    </div>
  )
}

function SectionLabel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span>{children}</span>
      {active && <div className="size-2 rounded-full bg-primary" />}
    </div>
  )
}
