"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { Filter } from "lucide-react"
import { useState } from "react"
import { FilterSections } from "./filter-sections"
import type { FilterActions, FilterState, TrackItem, VehicleItem } from "./types"

type MobileFiltersProps = {
  filters: FilterState
  actions: FilterActions
  tracks: TrackItem[]
  vehicles: VehicleItem[]
  activeFiltersCount: number
  filteredCount?: number
  isLoading?: boolean
}

export function MobileFilters({
  filters,
  actions,
  tracks,
  vehicles,
  activeFiltersCount,
  filteredCount = 0,
  isLoading = false,
}: MobileFiltersProps) {
  const [open, setOpen] = useState(false)

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

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <FilterSections actions={actions} filters={filters} tracks={tracks} vehicles={vehicles} />
        </div>

        {/* Sticky footer with result count */}
        <div className="shrink-0 border-t bg-background px-5 py-3">
          <Button className="w-full" disabled={isLoading} onClick={() => setOpen(false)} size="lg">
            {isLoading
              ? "Loading listings…"
              : `Show ${filteredCount} matching ${filteredCount === 1 ? "listing" : "listings"}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
