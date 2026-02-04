"use client"

import { api } from "@renegade/backend/convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { format } from "date-fns"
import { Car, CheckCircle, Clock, MapPin } from "lucide-react"
import { useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChartWrapper } from "@/components/chart-wrapper"
import { LoadingState } from "@/components/loading-state"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"

function getDateRange(range: "7d" | "30d" | "90d" | "ytd"): { startDate: string; endDate: string } {
  const now = new Date()
  const end = now.toISOString().split("T")[0]!
  let start: Date
  switch (range) {
    case "7d":
      start = new Date(now.getTime() - 7 * 86_400_000)
      break
    case "30d":
      start = new Date(now.getTime() - 30 * 86_400_000)
      break
    case "90d":
      start = new Date(now.getTime() - 90 * 86_400_000)
      break
    case "ytd":
      start = new Date(now.getFullYear(), 0, 1)
      break
  }
  return { startDate: start.toISOString().split("T")[0]!, endDate: end }
}

export default function VehicleAnalyticsPage() {
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily")
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "ytd">("30d")

  const stats = useQuery(api.admin.getPlatformStats)
  const dateParams = getDateRange(dateRange)
  const vehicleData = useQuery(api.admin.getVehicleTimeSeries, {
    granularity,
    ...dateParams,
  })
  const topVehicles = useQuery(api.admin.getTopVehicles, { limit: 10 })

  if (!(stats && vehicleData && topVehicles)) {
    return <LoadingState message="Loading vehicle analytics..." />
  }

  const chartData = vehicleData.map(
    (d: { date: string; newListings: number; totalActive: number }) => ({
      date: format(new Date(d.date), "MMM dd"),
      "New Listings": d.newListings,
      "Total Active": d.totalActive,
    })
  )

  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Analytics", href: "/analytics" },
          { label: "Vehicles" },
        ]}
        description="Track vehicle listings and performance metrics"
        title="Vehicle Analytics"
      />

      <div className="grid gap-6 md:grid-cols-4">
        <StatCard
          icon={<Car className="h-4 w-4 text-muted-foreground" />}
          label="Total Vehicles"
          value={stats.vehicles.total.toString()}
        />
        <StatCard
          icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
          label="Active Vehicles"
          value={stats.vehicles.active.toString()}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          label="Pending Approval"
          value={stats.vehicles.pending.toString()}
        />
        <StatCard
          icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
          label="Total Tracks"
          value={stats.tracks.total.toString()}
        />
      </div>

      <ChartWrapper
        dateRange={dateRange}
        granularity={granularity}
        onDateRangeChange={setDateRange}
        onGranularityChange={setGranularity}
        title="Vehicle Listings Over Time"
      >
        <ResponsiveContainer height={400} width="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis orientation="right" yAxisId="right" />
            <Tooltip />
            <Legend />
            <Area
              dataKey="Total Active"
              fill="#3b82f6"
              fillOpacity={0.3}
              stroke="#3b82f6"
              type="monotone"
              yAxisId="right"
            />
            <Area
              dataKey="New Listings"
              fill="#10b981"
              fillOpacity={0.6}
              stroke="#10b981"
              type="monotone"
              yAxisId="left"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartWrapper>

      <Card>
        <CardHeader>
          <CardTitle>Top Vehicles by Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topVehicles.length === 0 ? (
              <p className="text-muted-foreground text-sm">No data available</p>
            ) : (
              <div className="space-y-4">
                {topVehicles.map(
                  (
                    vehicle: {
                      _id: string
                      year: number
                      make: string
                      model: string
                      location?: { city: string }
                      totalRevenue?: number
                      bookingCount?: number
                      averageRating?: number
                    },
                    index: number
                  ) => (
                    <div
                      className="flex items-center justify-between border-b pb-4"
                      key={vehicle._id}
                    >
                      <div className="flex items-center gap-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-lg text-primary">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {vehicle.location?.city || "Unknown location"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">
                          $
                          {((vehicle.totalRevenue || 0) / 100).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                        <div className="flex items-center gap-4 text-muted-foreground text-sm">
                          <span>{vehicle.bookingCount || 0} bookings</span>
                          <span>
                            {vehicle.averageRating
                              ? `${vehicle.averageRating.toFixed(1)} ⭐`
                              : "No rating"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
