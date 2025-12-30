"use client"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { useMutation, useQuery } from "convex/react"
import { format } from "date-fns"
import { ArrowLeft, Calendar as CalendarIcon, Loader2, XCircle } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
import { toast } from "sonner"
import { api } from "@/lib/convex"

export default function HostVehicleAvailabilityPage() {
  const params = useParams()
  const vehicleId = params.id as string

  // State for calendar interaction
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(undefined)
  const [isSelectingRange, setIsSelectingRange] = useState(false)

  // Fetch vehicle from Convex
  const vehicle = useQuery(api.vehicles.getById, vehicleId ? { id: vehicleId as any } : "skip")

  // Fetch availability data for the current month
  const calendarData = useQuery(
    api.availability.getCalendarData,
    vehicle?._id
      ? {
          vehicleId: vehicle._id,
          year: selectedMonth.getFullYear(),
          month: selectedMonth.getMonth() + 1,
        }
      : "skip"
  )

  // Mutations
  const blockDateRange = useMutation(api.availability.blockDateRange)
  const unblockDateRange = useMutation(api.availability.unblockDateRange)
  const blockDate = useMutation(api.availability.blockDate)
  const unblockDate = useMutation(api.availability.unblockDate)

  // Helper function to parse YYYY-MM-DD string to local Date (avoids timezone issues)
  const parseDateString = (dateString: string): Date => {
    const [year, month, day] = dateString.split("-").map(Number)
    return new Date(year, month - 1, day)
  }

  // Get blocked dates for calendar
  const blockedDates = useMemo(() => {
    if (!calendarData?.availability) return []
    return calendarData.availability
      .filter((a) => !a.isAvailable)
      .map((a) => parseDateString(a.date))
  }, [calendarData])

  // Get reserved dates for calendar
  const reservedDates = useMemo(() => {
    if (!calendarData?.reservations) return []
    const reserved: Date[] = []
    calendarData.reservations.forEach((res) => {
      const start = parseDateString(res.startDate)
      const end = parseDateString(res.endDate)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        reserved.push(new Date(d))
      }
    })
    return reserved
  }, [calendarData])

  // Calculate available dates for current month
  const availableThisMonth = useMemo(() => {
    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    // Count blocked and reserved dates in the current month
    const monthStart = new Date(year, month, 1)
    monthStart.setHours(0, 0, 0, 0)
    const monthEnd = new Date(year, month + 1, 0)
    monthEnd.setHours(23, 59, 59, 999)

    const blockedInMonth = blockedDates.filter((d) => {
      const date = new Date(d)
      date.setHours(0, 0, 0, 0)
      return date >= monthStart && date <= monthEnd
    }).length

    const reservedInMonth = reservedDates.filter((d) => {
      const date = new Date(d)
      date.setHours(0, 0, 0, 0)
      return date >= monthStart && date <= monthEnd
    }).length

    return daysInMonth - blockedInMonth - reservedInMonth
  }, [selectedMonth, blockedDates, reservedDates])

  // Show loading state
  if (vehicle === undefined || calendarData === undefined) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading availability...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error if vehicle not found
  if (!vehicle) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <XCircle className="mx-auto mb-4 size-12 text-destructive" />
            <h2 className="mb-2 font-bold text-2xl">Vehicle Not Found</h2>
            <p className="mb-6 text-muted-foreground">
              The vehicle you're looking for doesn't exist or has been removed.
            </p>
            <Link href="/host/vehicles/list">
              <Button>Back to Vehicles</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Handle date selection - toggle blocked state
  const handleDateSelect = async (date: Date | undefined) => {
    if (!(vehicle?._id && date)) return

    // Extract date components directly to avoid any timezone conversion issues
    // react-day-picker passes dates in local time, so we use the components directly
    const year = date.getFullYear()
    const month = date.getMonth() + 1 // getMonth() returns 0-11, we need 1-12
    const day = date.getDate()

    // Create date string directly from components to avoid any timezone issues
    const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

    // Create normalized date for comparisons
    const normalizedDate = new Date(year, date.getMonth(), day)

    // Don't allow blocking reserved dates
    if (isDateReserved(normalizedDate)) {
      toast.error("Cannot block reserved dates")
      return
    }

    const isBlocked = isDateBlocked(normalizedDate)

    try {
      if (isBlocked) {
        await unblockDate({
          vehicleId: vehicle._id,
          date: dateString,
        })
        toast.success("Date unblocked")
      } else {
        await blockDate({
          vehicleId: vehicle._id,
          date: dateString,
        })
        toast.success("Date blocked")
      }
    } catch (error) {
      console.error(`Failed to ${isBlocked ? "unblock" : "block"} date:`, error)
      toast.error("An error occurred")
    }
  }

  // Handle range selection - block or unblock entire range
  const handleRangeSelect = async (range: DateRange | undefined) => {
    if (!(vehicle?._id && range?.from)) return

    // Extract date components directly to avoid any timezone conversion issues
    const fromYear = range.from.getFullYear()
    const fromMonth = range.from.getMonth() + 1
    const fromDay = range.from.getDate()

    const startDate = `${fromYear}-${String(fromMonth).padStart(2, "0")}-${String(fromDay).padStart(2, "0")}`

    let endDate = startDate
    if (range.to) {
      const toYear = range.to.getFullYear()
      const toMonth = range.to.getMonth() + 1
      const toDay = range.to.getDate()
      endDate = `${toYear}-${String(toMonth).padStart(2, "0")}-${String(toDay).padStart(2, "0")}`
    }

    // Normalize dates for comparisons
    const normalizedFrom = new Date(fromYear, range.from.getMonth(), fromDay)
    const normalizedTo = range.to
      ? new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate())
      : normalizedFrom

    // Check if range contains reserved dates
    const start = new Date(normalizedFrom)
    const end = new Date(normalizedTo)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const normalizedD = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      if (isDateReserved(normalizedD)) {
        toast.error("Cannot block dates that are reserved")
        setSelectedRange(undefined)
        return
      }
    }

    // Determine if we're blocking or unblocking
    // If all dates in range are blocked, unblock them; otherwise block them
    let allBlocked = true
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const normalizedD = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      if (!isDateBlocked(normalizedD)) {
        allBlocked = false
        break
      }
    }

    try {
      if (allBlocked) {
        await unblockDateRange({
          vehicleId: vehicle._id,
          startDate,
          endDate,
        })
        toast.success("Date range unblocked")
      } else {
        await blockDateRange({
          vehicleId: vehicle._id,
          startDate,
          endDate,
        })
        toast.success("Date range blocked")
      }
      setSelectedRange(undefined)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${allBlocked ? "unblock" : "block"} date range`
      )
    }
  }

  // Check if a date is blocked
  const isDateBlocked = (date: Date) => {
    // Normalize both dates to midnight for accurate comparison
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dateString = format(normalizedDate, "yyyy-MM-dd")
    return blockedDates.some((d) => {
      const normalizedD = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      return format(normalizedD, "yyyy-MM-dd") === dateString
    })
  }

  // Check if a date is reserved
  const isDateReserved = (date: Date) => {
    // Normalize both dates to midnight for accurate comparison
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dateString = format(normalizedDate, "yyyy-MM-dd")
    return reservedDates.some((d) => {
      const normalizedD = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      return format(normalizedD, "yyyy-MM-dd") === dateString
    })
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <Link href={`/host/vehicles/${vehicleId}`}>
          <Button className="mb-6" variant="outline">
            <ArrowLeft className="mr-2 size-4" />
            Back to Vehicle
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="mb-2 font-bold text-3xl">
          Manage Availability - {vehicle.year} {vehicle.make} {vehicle.model}
        </h1>
        <p className="text-muted-foreground">
          Click dates to block or unblock them. Use range mode to select multiple dates at once.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Availability Calendar</CardTitle>
              <p className="text-muted-foreground text-sm">
                {isSelectingRange
                  ? "Select a date range to block or unblock"
                  : "Click a date to toggle its blocked state"}
              </p>
            </div>
            <Button
              onClick={() => {
                setIsSelectingRange(!isSelectingRange)
                setSelectedRange(undefined)
              }}
              size="sm"
              variant={isSelectingRange ? "default" : "outline"}
            >
              <CalendarIcon className="mr-2 size-4" />
              {isSelectingRange ? "Single Date Mode" : "Range Mode"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Calendar */}
            <div className="flex justify-center rounded-lg border p-4">
              {isSelectingRange ? (
                <div className="space-y-4">
                  <Calendar
                    className="rounded-md border"
                    disabled={(date) => {
                      // Don't allow blocking dates in the past or reserved dates
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      const normalizedDate = new Date(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate()
                      )
                      normalizedDate.setHours(0, 0, 0, 0)
                      return normalizedDate < today || isDateReserved(normalizedDate)
                    }}
                    mode="range"
                    modifiers={{
                      blocked: blockedDates,
                      reserved: reservedDates,
                    }}
                    modifiersClassNames={{
                      blocked: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
                      reserved: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
                    }}
                    month={selectedMonth}
                    numberOfMonths={2}
                    onMonthChange={setSelectedMonth}
                    onSelect={setSelectedRange}
                    selected={selectedRange}
                  />
                  {selectedRange?.from && (
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-1">
                        <p className="font-medium text-sm">Selected Range</p>
                        <p className="text-muted-foreground text-sm">
                          {selectedRange.from ? format(selectedRange.from, "PPP") : "Start date"}
                          {selectedRange.to ? ` - ${format(selectedRange.to, "PPP")}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setSelectedRange(undefined)
                          }}
                          size="sm"
                          variant="outline"
                        >
                          Clear
                        </Button>
                        {selectedRange.to && (
                          <Button
                            onClick={() => {
                              if (selectedRange?.from && selectedRange?.to) {
                                handleRangeSelect(selectedRange)
                              }
                            }}
                            size="sm"
                          >
                            Apply Range
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Calendar
                  className="rounded-md border"
                  disabled={(date) => {
                    // Don't allow blocking dates in the past
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const normalizedDate = new Date(
                      date.getFullYear(),
                      date.getMonth(),
                      date.getDate()
                    )
                    normalizedDate.setHours(0, 0, 0, 0)
                    return normalizedDate < today
                  }}
                  mode="single"
                  modifiers={{
                    blocked: blockedDates,
                    reserved: reservedDates,
                  }}
                  modifiersClassNames={{
                    blocked: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
                    reserved: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
                  }}
                  month={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  onSelect={handleDateSelect}
                />
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <div className="size-4 rounded bg-red-100 dark:bg-red-900/20" />
                <span className="font-medium text-sm">Blocked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-4 rounded bg-blue-100 dark:bg-blue-900/20" />
                <span className="font-medium text-sm">Reserved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-4 rounded border" />
                <span className="font-medium text-sm">Available</span>
              </div>
              <div className="ml-auto text-muted-foreground text-sm">
                {isSelectingRange
                  ? "Select a date range to block or unblock all dates in that range"
                  : "Click any available date to toggle its blocked state"}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <div className="text-muted-foreground text-sm">Blocked This Month</div>
                <div className="mt-1 font-bold text-2xl">{blockedDates.length}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-muted-foreground text-sm">Reserved This Month</div>
                <div className="mt-1 font-bold text-2xl">{reservedDates.length}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-muted-foreground text-sm">Available This Month</div>
                <div className="mt-1 font-bold text-2xl">{availableThisMonth}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
