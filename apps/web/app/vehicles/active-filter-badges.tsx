"use client"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { format } from "date-fns"
import { X } from "lucide-react"
import { parseLocalDate } from "@/lib/date-utils"
import type { FilterActions, FilterState } from "./types"

type ActiveFilterBadgesProps = {
  filters: FilterState
  actions: FilterActions
  debouncedSearchQuery: string
  activeFiltersCount: number
}

function FilterBadge({
  children,
  onDismiss,
  dismissLabel,
  colorClass,
}: {
  children: React.ReactNode
  onDismiss: () => void
  dismissLabel: string
  colorClass: string
}) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium text-xs transition-colors",
        colorClass
      )}
    >
      {children}
      <button
        aria-label={dismissLabel}
        className="inline-flex shrink-0 cursor-pointer opacity-60 transition-opacity hover:opacity-100"
        onClick={onDismiss}
        type="button"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

export function ActiveFilterBadges({
  filters,
  actions,
  debouncedSearchQuery,
  activeFiltersCount,
}: ActiveFilterBadgesProps) {
  if (activeFiltersCount === 0) {
    return null
  }

  return (
    <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto border-t pt-2 pb-2 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:pb-0">
      <div className="inline-flex shrink-0 items-center rounded-full bg-primary px-2.5 py-0.5 font-semibold text-primary-foreground text-xs">
        {activeFiltersCount} filter{activeFiltersCount !== 1 ? "s" : ""}
      </div>

      {debouncedSearchQuery && (
        <FilterBadge
          colorClass="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
          dismissLabel="Clear search filter"
          onDismiss={() => actions.setSearchQuery("")}
        >
          <span className="max-w-[120px] truncate sm:max-w-none">
            Search: {debouncedSearchQuery}
          </span>
        </FilterBadge>
      )}

      {filters.selectedLocation && (
        <FilterBadge
          colorClass="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
          dismissLabel="Clear location filter"
          onDismiss={() => actions.setSelectedLocation("")}
        >
          <span className="max-w-[100px] truncate sm:max-w-none">
            Location: {filters.selectedLocation}
          </span>
        </FilterBadge>
      )}

      {filters.selectedMake !== "all" && (
        <FilterBadge
          colorClass="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
          dismissLabel="Clear make filter"
          onDismiss={() => actions.setSelectedMake("all")}
        >
          <span className="max-w-[100px] truncate sm:max-w-none">Make: {filters.selectedMake}</span>
        </FilterBadge>
      )}

      {filters.selectedModel !== "all" && (
        <FilterBadge
          colorClass="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
          dismissLabel="Clear model filter"
          onDismiss={() => actions.setSelectedModel("all")}
        >
          <span className="max-w-[100px] truncate sm:max-w-none">
            Model: {filters.selectedModel}
          </span>
        </FilterBadge>
      )}

      {filters.selectedDriveType !== "all" && (
        <FilterBadge
          colorClass="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
          dismissLabel="Clear drive type filter"
          onDismiss={() => actions.setSelectedDriveType("all")}
        >
          <span className="max-w-[100px] truncate sm:max-w-none">
            Drive: {filters.selectedDriveType}
          </span>
        </FilterBadge>
      )}

      {filters.selectedTransmission !== "all" && (
        <FilterBadge
          colorClass="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
          dismissLabel="Clear transmission filter"
          onDismiss={() => actions.setSelectedTransmission("all")}
        >
          <span className="max-w-[100px] truncate sm:max-w-none">
            Trans: {filters.selectedTransmission}
          </span>
        </FilterBadge>
      )}

      {(filters.minHorsepower || filters.maxHorsepower) && (
        <FilterBadge
          colorClass="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
          dismissLabel="Clear horsepower filter"
          onDismiss={() => {
            actions.setMinHorsepower("")
            actions.setMaxHorsepower("")
          }}
        >
          <span className="max-w-[100px] truncate sm:max-w-none">
            HP: {filters.minHorsepower || "0"}-{filters.maxHorsepower || "∞"}
          </span>
        </FilterBadge>
      )}

      {(filters.minYear || filters.maxYear) && (
        <FilterBadge
          colorClass="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
          dismissLabel="Clear year filter"
          onDismiss={() => {
            actions.setMinYear("")
            actions.setMaxYear("")
          }}
        >
          <span className="max-w-[100px] truncate sm:max-w-none">
            Year: {filters.minYear || "Any"}-{filters.maxYear || "Any"}
          </span>
        </FilterBadge>
      )}

      {filters.selectedPriceRange !== "any" && (
        <FilterBadge
          colorClass="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
          dismissLabel="Clear price filter"
          onDismiss={() => {
            actions.setSelectedPriceRange("any")
            actions.setCustomPriceRange(null)
          }}
        >
          <span className="max-w-[100px] truncate sm:max-w-none">
            Price: {filters.selectedPriceRange}
          </span>
        </FilterBadge>
      )}

      {filters.selectedTrack !== "all" && (
        <FilterBadge
          colorClass="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
          dismissLabel="Clear track filter"
          onDismiss={() => actions.setSelectedTrack("all")}
        >
          <span className="max-w-[100px] truncate sm:max-w-none">
            Track: {filters.selectedTrack}
          </span>
        </FilterBadge>
      )}

      {(filters.selectedDates.start || filters.selectedDates.end) && (
        <FilterBadge
          colorClass="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
          dismissLabel="Clear date filter"
          onDismiss={() => {
            actions.setSelectedDates({ start: "", end: "" })
            actions.setDateRange(undefined)
          }}
        >
          <span className="max-w-[120px] truncate sm:max-w-none">
            Dates:{" "}
            {filters.selectedDates.start && filters.selectedDates.end
              ? `${format(parseLocalDate(filters.selectedDates.start) || new Date(), "MMM dd")} - ${format(parseLocalDate(filters.selectedDates.end) || new Date(), "MMM dd")}`
              : filters.selectedDates.start
                ? format(parseLocalDate(filters.selectedDates.start) || new Date(), "MMM dd")
                : "..."}
          </span>
        </FilterBadge>
      )}

      {filters.selectedSafetyEquipment.length > 0 && (
        <FilterBadge
          colorClass="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800"
          dismissLabel="Clear safety equipment filter"
          onDismiss={() => actions.setSelectedSafetyEquipment([])}
        >
          <span className="max-w-[120px] truncate sm:max-w-none">
            Safety: {filters.selectedSafetyEquipment.join(", ")}
          </span>
        </FilterBadge>
      )}

      {filters.selectedExperienceLevel !== "all" && (
        <FilterBadge
          colorClass="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800"
          dismissLabel="Clear experience level filter"
          onDismiss={() => actions.setSelectedExperienceLevel("all")}
        >
          <span className="max-w-[100px] truncate sm:max-w-none">
            Exp: {filters.selectedExperienceLevel}
          </span>
        </FilterBadge>
      )}

      {filters.selectedTireType !== "all" && (
        <FilterBadge
          colorClass="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800"
          dismissLabel="Clear tire type filter"
          onDismiss={() => actions.setSelectedTireType("all")}
        >
          <span className="max-w-[100px] truncate sm:max-w-none">
            Tires: {filters.selectedTireType}
          </span>
        </FilterBadge>
      )}

      {filters.deliveryOnly && (
        <FilterBadge
          colorClass="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800"
          dismissLabel="Clear delivery filter"
          onDismiss={() => actions.setDeliveryOnly(false)}
        >
          Delivery only
        </FilterBadge>
      )}

      {filters.minRating && filters.minRating !== "any" && (
        <FilterBadge
          colorClass="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800"
          dismissLabel="Clear rating filter"
          onDismiss={() => actions.setMinRating("")}
        >
          <span className="max-w-[100px] truncate sm:max-w-none">Rating: {filters.minRating}+</span>
        </FilterBadge>
      )}

      <Button className="h-6 text-xs" onClick={actions.clearFilters} size="sm" variant="ghost">
        Clear all
      </Button>
    </div>
  )
}
