"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronRight, Grid3x3, List, Search, X } from "lucide-react"
import { Suspense } from "react"
import { VehicleCard } from "@/components/vehicle-card"
import type { FilterActions, FilterState, SortOption, VehicleItem, ViewMode } from "./types"

type VehicleResultsGridProps = {
  vehicles: VehicleItem[]
  filteredVehicles: VehicleItem[]
  paginatedVehicles: VehicleItem[]
  isLoading: boolean
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  sortBy: SortOption
  setSortBy: (sort: string) => void
  hasMore: boolean
  loadMore: () => void
  clearFilters: () => void
  clearSearchAndDates: () => void
  itemsPerPage: number
  datesSelected: boolean
  compareVehicleIds: Set<string>
  onToggleCompare?: (id: string) => void
  filterState?: FilterState
  filterActions?: FilterActions
  mobileFilters?: React.ReactNode
}

export function VehicleResultsGrid({
  vehicles,
  filteredVehicles,
  paginatedVehicles,
  isLoading,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  hasMore,
  loadMore,
  clearFilters,
  clearSearchAndDates,
  itemsPerPage,
  datesSelected,
  compareVehicleIds,
  onToggleCompare,
  filterState,
  filterActions,
  mobileFilters,
}: VehicleResultsGridProps) {
  return (
    <div className="w-full">
      {/* Results Summary Bar */}
      <div className="mb-6 flex items-center justify-between border-b pb-4">
        <p className="text-muted-foreground text-sm sm:text-base">
          <span className="font-bold text-base text-foreground sm:text-lg">
            {filteredVehicles.length}
          </span>{" "}
          {filteredVehicles.length === 1 ? "vehicle" : "vehicles"} available
        </p>

        <div className="flex items-center gap-2 sm:gap-3">
          {mobileFilters && <div className="xl:hidden">{mobileFilters}</div>}
          <Select onValueChange={setSortBy} value={sortBy}>
            <SelectTrigger
              aria-label="Sort vehicles"
              className="h-9 w-[140px] text-sm sm:h-10 sm:w-[180px]"
            >
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
              aria-label="Grid view"
              className="size-9"
              onClick={() => setViewMode("grid")}
              size="icon"
              variant={viewMode === "grid" ? "default" : "ghost"}
            >
              <Grid3x3 className="size-4" />
            </Button>
            <Button
              aria-label="List view"
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

      {isLoading ? (
        <div
          className={cn(
            "grid gap-4 sm:gap-6",
            viewMode === "grid" ? "auto-rows-fr grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
          )}
        >
          {Array.from({ length: itemsPerPage }).map((_, index) => (
            <Card className="overflow-hidden" key={`skeleton-${index}`}>
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
            <p className="mb-4 max-w-md px-4 text-center text-muted-foreground text-sm sm:px-0 sm:text-base">
              No vehicles match your current filters. Try removing some filters to see more results.
            </p>
            {filterState && filterActions && (
              <div className="mb-4 flex flex-wrap justify-center gap-2">
                {filterState.selectedMake !== "all" && (
                  <Badge
                    className="cursor-pointer gap-1"
                    onClick={() => filterActions.setSelectedMake("all")}
                    variant="secondary"
                  >
                    Make: {filterState.selectedMake} <X className="size-3" />
                  </Badge>
                )}
                {filterState.selectedTransmission !== "all" && (
                  <Badge
                    className="cursor-pointer gap-1"
                    onClick={() => filterActions.setSelectedTransmission("all")}
                    variant="secondary"
                  >
                    Trans: {filterState.selectedTransmission} <X className="size-3" />
                  </Badge>
                )}
                {filterState.selectedDriveType !== "all" && (
                  <Badge
                    className="cursor-pointer gap-1"
                    onClick={() => filterActions.setSelectedDriveType("all")}
                    variant="secondary"
                  >
                    Drive: {filterState.selectedDriveType} <X className="size-3" />
                  </Badge>
                )}
                {filterState.selectedPriceRange !== "any" && (
                  <Badge
                    className="cursor-pointer gap-1"
                    onClick={() => {
                      filterActions.setSelectedPriceRange("any")
                      filterActions.setCustomPriceRange(null)
                    }}
                    variant="secondary"
                  >
                    Price: {filterState.selectedPriceRange} <X className="size-3" />
                  </Badge>
                )}
                {filterState.selectedExperienceLevel !== "all" && (
                  <Badge
                    className="cursor-pointer gap-1"
                    onClick={() => filterActions.setSelectedExperienceLevel("all")}
                    variant="secondary"
                  >
                    Exp: {filterState.selectedExperienceLevel} <X className="size-3" />
                  </Badge>
                )}
                {filterState.selectedTireType !== "all" && (
                  <Badge
                    className="cursor-pointer gap-1"
                    onClick={() => filterActions.setSelectedTireType("all")}
                    variant="secondary"
                  >
                    Tires: {filterState.selectedTireType} <X className="size-3" />
                  </Badge>
                )}
              </div>
            )}
            <div className="flex w-full flex-col gap-2 px-4 sm:w-auto sm:flex-row sm:px-0">
              <Button className="w-full sm:w-auto" onClick={clearFilters} variant="default">
                Clear All Filters
              </Button>
              <Button className="w-full sm:w-auto" onClick={clearSearchAndDates} variant="outline">
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
                viewMode === "grid" ? "auto-rows-fr grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
              )}
            >
              {paginatedVehicles.map((vehicle) => (
                <VehicleCard
                  bookingCount={vehicle.bookingCount}
                  datesSelected={datesSelected}
                  drivetrain={vehicle.drivetrain}
                  horsepower={vehicle.horsepower}
                  id={vehicle.id}
                  image={vehicle.image}
                  imageKey={vehicle.imageKey}
                  key={vehicle.id}
                  location={vehicle.location}
                  make={vehicle.make}
                  model={vehicle.model}
                  name={vehicle.name}
                  pricePerDay={vehicle.pricePerDay}
                  rating={vehicle.rating}
                  reviews={vehicle.reviews}
                  track={vehicle.track}
                  transmission={vehicle.transmission}
                  year={vehicle.year}
                />
              ))}
            </div>
          </Suspense>

          {hasMore && (
            <div className="mt-6 flex flex-col items-center gap-3 sm:mt-8 sm:gap-4">
              <Button className="w-full sm:w-auto" onClick={loadMore} size="lg" variant="outline">
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
  )
}
