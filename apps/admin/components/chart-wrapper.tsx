"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

type Granularity = "daily" | "weekly" | "monthly"
type DateRange = "7d" | "30d" | "90d" | "ytd"

interface ChartWrapperProps {
  title: string
  children: React.ReactNode
  granularity?: Granularity
  onGranularityChange?: (g: Granularity) => void
  dateRange?: DateRange
  onDateRangeChange?: (r: DateRange) => void
  isLoading?: boolean
}

const granularities: Granularity[] = ["daily", "weekly", "monthly"]
const dateRanges: { value: DateRange; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "ytd", label: "YTD" },
]

export function ChartWrapper({
  title,
  children,
  granularity,
  onGranularityChange,
  dateRange,
  onDateRangeChange,
  isLoading,
}: ChartWrapperProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-semibold text-base">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {onGranularityChange && (
            <div className="flex rounded-md border">
              {granularities.map((g) => (
                <Button
                  key={g}
                  variant={granularity === g ? "default" : "ghost"}
                  size="sm"
                  className="h-7 rounded-none px-2 text-xs first:rounded-l-md last:rounded-r-md"
                  onClick={() => onGranularityChange(g)}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </Button>
              ))}
            </div>
          )}
          {onDateRangeChange && (
            <div className="flex rounded-md border">
              {dateRanges.map((r) => (
                <Button
                  key={r.value}
                  variant={dateRange === r.value ? "default" : "ghost"}
                  size="sm"
                  className="h-7 rounded-none px-2 text-xs first:rounded-l-md last:rounded-r-md"
                  onClick={() => onDateRangeChange(r.value)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>{isLoading ? <Skeleton className="h-[300px] w-full" /> : children}</CardContent>
    </Card>
  )
}
