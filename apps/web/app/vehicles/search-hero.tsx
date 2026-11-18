"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Calendar as CalendarComponent } from "@workspace/ui/components/calendar"
import { Input } from "@workspace/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { format } from "date-fns"
import { CalendarDays, Loader2, MapPin, Navigation, Search, X } from "lucide-react"
import * as React from "react"
import type { DateRange } from "react-day-picker"
import type { FilterActions, FilterState, TrackItem } from "./types"

type SearchHeroProps = {
  filters: FilterState
  actions: FilterActions
  tracks: TrackItem[]
  searchSuggestions: string[]
  activeFiltersCount: number
  dateRange: DateRange | undefined
  datePickerOpen: boolean
  setDatePickerOpen: (open: boolean) => void
  isMobile: boolean
  getCurrentLocation: () => void
  geocodeZipCode: (zip: string) => void
  isGeocodingZip: boolean
  isGettingLocation: boolean
  locationError: string | null
}

type QuickChip = {
  label: string
  isActive: (f: FilterState) => boolean
  apply: (a: FilterActions, active: boolean) => void
}

const QUICK_CHIPS: QuickChip[] = [
  {
    label: "RWD",
    isActive: (f) => f.selectedDriveType === "RWD",
    apply: (a, active) => a.setSelectedDriveType(active ? "all" : "RWD"),
  },
  {
    label: "AWD",
    isActive: (f) => f.selectedDriveType === "AWD",
    apply: (a, active) => a.setSelectedDriveType(active ? "all" : "AWD"),
  },
  {
    label: "Manual",
    isActive: (f) => f.selectedTransmission === "Manual",
    apply: (a, active) => a.setSelectedTransmission(active ? "all" : "Manual"),
  },
  {
    label: "500+ HP",
    isActive: (f) => f.minHorsepower === "500",
    apply: (a, active) => a.setMinHorsepower(active ? "" : "500"),
  },
  {
    label: "$500/day or less",
    isActive: (f) => f.selectedPriceRange === "0-50000",
    apply: (a, active) => {
      a.setSelectedPriceRange(active ? "any" : "0-50000")
      a.setCustomPriceRange(null)
    },
  },
  {
    label: "Track Ready",
    isActive: (f) => f.selectedTireType === "R-Compound",
    apply: (a, active) => a.setSelectedTireType(active ? "all" : "R-Compound"),
  },
]

export function SearchHero({
  filters,
  actions,
  tracks: _tracks,
  searchSuggestions: _searchSuggestions,
  activeFiltersCount: _activeFiltersCount,
  dateRange,
  datePickerOpen,
  setDatePickerOpen,
  isMobile,
  getCurrentLocation,
  geocodeZipCode,
  isGeocodingZip,
  isGettingLocation,
  locationError,
}: SearchHeroProps) {
  const [zipInput, setZipInput] = React.useState(filters.locationZipCode)

  // Keep local zip in sync when cleared/changed elsewhere
  React.useEffect(() => {
    setZipInput(filters.locationZipCode)
  }, [filters.locationZipCode])

  const submitLocation = () => {
    const zip = zipInput.trim()
    if (zip) {
      geocodeZipCode(zip)
    }
  }

  const hasLocation = Boolean(filters.locationLabel || filters.userLocation)
  const getDatesLabel = () => {
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
    }
    if (dateRange?.from) {
      return format(dateRange.from, "MMM d")
    }
    return "Any dates"
  }
  const datesLabel = getDatesLabel()

  return (
    <div className="sticky top-20 z-40 border-border border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-4 py-3 sm:px-6 sm:py-4">
        {/* Search bar */}
        <div className="flex flex-col gap-2 rounded-2xl border bg-card p-2 shadow-sm lg:flex-row lg:items-center lg:rounded-full lg:p-1.5">
          {/* Keyword */}
          <div className="flex flex-1 items-center gap-2 px-3 py-1.5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              onChange={(e) => actions.setSearchQuery(e.target.value)}
              placeholder="Search make, model, or track…"
              value={filters.searchQuery}
            />
            {filters.searchQuery && (
              <button
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => actions.setSearchQuery("")}
                type="button"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="hidden h-8 w-px bg-border lg:block" />

          {/* Location */}
          <div className="flex flex-1 items-center gap-2 px-3 py-1.5">
            <MapPin className="size-4 shrink-0 text-muted-foreground" />
            {hasLocation ? (
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="truncate text-sm">
                  {filters.locationLabel || "Current location"}
                </span>
                <button
                  aria-label="Clear location"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => actions.clearLocationFilter()}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <Input
                  className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  inputMode="numeric"
                  onChange={(e) => setZipInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitLocation()
                  }}
                  placeholder="ZIP code"
                  value={zipInput}
                />
                <button
                  aria-label="Use current location"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={getCurrentLocation}
                  type="button"
                >
                  {isGettingLocation ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Navigation className="size-4" />
                  )}
                </button>
              </>
            )}
          </div>

          <div className="hidden h-8 w-px bg-border lg:block" />

          {/* Dates */}
          <Popover onOpenChange={setDatePickerOpen} open={datePickerOpen}>
            <PopoverTrigger asChild>
              <button
                className="flex flex-1 items-center gap-2 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-muted/50 lg:rounded-full"
                type="button"
              >
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                <span
                  className={cn("truncate text-sm", !dateRange?.from && "text-muted-foreground")}
                >
                  {datesLabel}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0" sideOffset={8}>
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
                  onSelect={(range) => actions.setDateRange(range)}
                  selected={dateRange}
                />
                {dateRange?.from && (
                  <div className="border-t p-3">
                    <Button
                      className="w-full"
                      onClick={() => {
                        actions.setDateRange(undefined)
                        actions.setSelectedDates({ start: "", end: "" })
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

          {/* Search button */}
          <Button
            className="h-11 shrink-0 gap-2 lg:h-10 lg:rounded-full"
            onClick={submitLocation}
            size="lg"
          >
            {isGeocodingZip ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            <span className="lg:sr-only xl:not-sr-only">Search</span>
          </Button>
        </div>

        {locationError && <p className="mt-2 px-3 text-destructive text-xs">{locationError}</p>}

        {/* Quick filter chips */}
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-0.5">
          {QUICK_CHIPS.map((chip) => {
            const active = chip.isActive(filters)
            return (
              <Badge
                className={cn(
                  "shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 py-1 font-medium text-xs transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
                key={chip.label}
                onClick={() => chip.apply(actions, active)}
              >
                {chip.label}
              </Badge>
            )
          })}
        </div>
      </div>
    </div>
  )
}
