"use client"

import { api } from "@renegade/backend/convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { format } from "date-fns"
import { Calendar, CheckCircle, Clock, XCircle } from "lucide-react"
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

export default function BookingAnalyticsPage() {
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily")
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "ytd">("30d")

  const stats = useQuery(api.admin.getPlatformStats)
  const dateParams = getDateRange(dateRange)
  const bookingData = useQuery(api.admin.getBookingTimeSeries, {
    granularity,
    ...dateParams,
  })
  const bookingFunnel = useQuery(api.admin.getBookingFunnel)

  if (!(stats && bookingData && bookingFunnel)) {
    return <LoadingState message="Loading booking analytics..." />
  }

  const chartData = bookingData.map(
    (d: {
      date: string
      created: number
      confirmed: number
      completed: number
      cancelled: number
    }) => ({
      date: format(new Date(d.date), "MMM dd"),
      Created: d.created,
      Confirmed: d.confirmed,
      Completed: d.completed,
      Cancelled: d.cancelled,
    })
  )

  const funnelTotal =
    bookingFunnel.pending +
    bookingFunnel.confirmed +
    bookingFunnel.completed +
    bookingFunnel.cancelled +
    bookingFunnel.declined

  const funnelData = [
    {
      label: "Pending",
      count: bookingFunnel.pending,
      percentage: funnelTotal > 0 ? (bookingFunnel.pending / funnelTotal) * 100 : 0,
      color: "bg-yellow-500",
    },
    {
      label: "Confirmed",
      count: bookingFunnel.confirmed,
      percentage: funnelTotal > 0 ? (bookingFunnel.confirmed / funnelTotal) * 100 : 0,
      color: "bg-blue-500",
    },
    {
      label: "Completed",
      count: bookingFunnel.completed,
      percentage: funnelTotal > 0 ? (bookingFunnel.completed / funnelTotal) * 100 : 0,
      color: "bg-green-500",
    },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Analytics", href: "/analytics" },
          { label: "Bookings" },
        ]}
        description="Track booking trends and conversion metrics"
        title="Booking Analytics"
      />

      <div className="grid gap-6 md:grid-cols-4">
        <StatCard
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
          label="Total Bookings"
          value={stats.reservations.total.toString()}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          label="Confirmed"
          value={stats.reservations.confirmed.toString()}
        />
        <StatCard
          icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
          label="Completed"
          value={stats.reservations.completed.toString()}
        />
        <StatCard
          icon={<XCircle className="h-4 w-4 text-muted-foreground" />}
          label="Cancelled"
          value={stats.reservations.cancelled.toString()}
        />
      </div>

      <ChartWrapper
        dateRange={dateRange}
        granularity={granularity}
        onDateRangeChange={setDateRange}
        onGranularityChange={setGranularity}
        title="Booking Trends Over Time"
      >
        <ResponsiveContainer height={400} width="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              dataKey="Created"
              fill="#8b5cf6"
              fillOpacity={0.6}
              stroke="#8b5cf6"
              type="monotone"
            />
            <Area
              dataKey="Confirmed"
              fill="#3b82f6"
              fillOpacity={0.6}
              stroke="#3b82f6"
              type="monotone"
            />
            <Area
              dataKey="Completed"
              fill="#10b981"
              fillOpacity={0.6}
              stroke="#10b981"
              type="monotone"
            />
            <Area
              dataKey="Cancelled"
              fill="#ef4444"
              fillOpacity={0.6}
              stroke="#ef4444"
              type="monotone"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartWrapper>

      <Card>
        <CardHeader>
          <CardTitle>Booking Funnel & Conversion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Conversion Rate</span>
            <span className="font-bold text-2xl">{bookingFunnel.conversionRate.toFixed(1)}%</span>
          </div>
          <div className="space-y-4">
            {funnelData.map((item, index) => (
              <div className="space-y-2" key={item.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">
                    {item.count} ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="relative h-12 w-full overflow-hidden rounded-lg bg-secondary">
                  <div
                    className={`h-full ${item.color} flex items-center justify-center font-semibold text-white transition-all`}
                    style={{ width: `${item.percentage}%` }}
                  >
                    {item.percentage > 10 && <span>{item.count}</span>}
                  </div>
                </div>
                {index < funnelData.length - 1 && (
                  <div className="flex justify-center">
                    <div className="h-4 w-0.5 bg-border" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Cancelled</p>
              <p className="font-semibold text-2xl">{bookingFunnel.cancelled}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Declined</p>
              <p className="font-semibold text-2xl">{bookingFunnel.declined}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
