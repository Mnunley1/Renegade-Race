"use client"

import { useState, useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "@renegade/backend/convex/_generated/api"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameMonth,
  parseISO,
} from "date-fns"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { LoadingState } from "@/components/loading-state"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default function ReservationCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)

  const result = useQuery(api.admin.getAllReservations, {
    startDate: format(monthStart, "yyyy-MM-dd"),
    endDate: format(monthEnd, "yyyy-MM-dd"),
    limit: 500,
  })

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDayOfWeek = getDay(monthStart) // 0 = Sunday

  const reservationsByDay = useMemo(() => {
    if (!result?.reservations) return {}
    const map: Record<string, { confirmed: number; pending: number; completed: number }> = {}

    for (const res of result.reservations) {
      try {
        const start = parseISO(res.startDate)
        const end = parseISO(res.endDate)
        const daysInRange = eachDayOfInterval({ start, end })

        for (const day of daysInRange) {
          if (!isSameMonth(day, currentMonth)) continue
          const key = format(day, "yyyy-MM-dd")
          if (!map[key]) map[key] = { confirmed: 0, pending: 0, completed: 0 }
          if (res.status === "confirmed") map[key].confirmed++
          else if (res.status === "pending") map[key].pending++
          else if (res.status === "completed") map[key].completed++
        }
      } catch {
        /* skip invalid dates */
      }
    }
    return map
  }, [result?.reservations, currentMonth])

  if (result === undefined) return <LoadingState message="Loading calendar..." />

  return (
    <div className="space-y-6">
      <PageHeader title="Reservation Calendar" description="Monthly view of all reservations" />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-blue-500" /> Confirmed
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-yellow-500" /> Pending
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-emerald-500" /> Completed
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px rounded-lg border bg-muted">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="bg-background p-2 text-center font-medium text-muted-foreground text-xs"
              >
                {d}
              </div>
            ))}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-background p-2" />
            ))}
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd")
              const counts = reservationsByDay[key]
              return (
                <div key={key} className="min-h-[80px] bg-background p-2">
                  <span className="text-sm">{format(day, "d")}</span>
                  {counts && (
                    <div className="mt-1 space-y-0.5">
                      {counts.confirmed > 0 && (
                        <div className="rounded bg-blue-100 px-1 text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {counts.confirmed} confirmed
                        </div>
                      )}
                      {counts.pending > 0 && (
                        <div className="rounded bg-yellow-100 px-1 text-[10px] text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                          {counts.pending} pending
                        </div>
                      )}
                      {counts.completed > 0 && (
                        <div className="rounded bg-emerald-100 px-1 text-[10px] text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {counts.completed} completed
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
