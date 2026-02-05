"use client"

import { Button } from "@workspace/ui/components/button"
import { Calendar as CalendarComponent } from "@workspace/ui/components/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { format } from "date-fns"
import { Search, X } from "lucide-react"
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
}

export function SearchHero({
  filters,
  actions,
  tracks,
  searchSuggestions,
  activeFiltersCount,
  dateRange,
  datePickerOpen,
  setDatePickerOpen,
  isMobile,
}: SearchHeroProps) {
  return (
    <div className="border-border border-b bg-background">
      <div className="container mx-auto px-4 py-3 sm:py-4">
        <div className="relative mx-auto max-w-xl">
          <Popover onOpenChange={setDatePickerOpen} open={datePickerOpen}>
            <PopoverTrigger asChild>
              <div className="flex cursor-pointer items-center rounded-full border shadow-sm transition-shadow hover:shadow-md">
                {/* Start date segment */}
                <button
                  className="flex min-w-0 flex-1 flex-col rounded-l-full px-4 py-2.5 text-left transition-colors hover:bg-muted/50 sm:px-6 sm:py-3"
                  type="button"
                >
                  <span className="font-semibold text-xs">Start date</span>
                  <span
                    className={cn("truncate text-sm", !dateRange?.from && "text-muted-foreground")}
                  >
                    {dateRange?.from ? format(dateRange.from, "MMM d, yyyy") : "Add date"}
                  </span>
                </button>

                <div className="h-8 w-px bg-border" />

                {/* End date segment */}
                <button
                  className="flex min-w-0 flex-1 flex-col px-4 py-2.5 text-left transition-colors hover:bg-muted/50 sm:px-6 sm:py-3"
                  type="button"
                >
                  <span className="font-semibold text-xs">End date</span>
                  <span
                    className={cn("truncate text-sm", !dateRange?.to && "text-muted-foreground")}
                  >
                    {dateRange?.to ? format(dateRange.to, "MMM d, yyyy") : "Add date"}
                  </span>
                </button>

                {/* Search icon */}
                <div className="pr-2">
                  <div
                    aria-label="Search"
                    className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground sm:size-10"
                  >
                    <Search className="size-4" />
                  </div>
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-auto p-0" sideOffset={8}>
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
                    actions.setDateRange(range)
                  }}
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
        </div>
      </div>
    </div>
  )
}
