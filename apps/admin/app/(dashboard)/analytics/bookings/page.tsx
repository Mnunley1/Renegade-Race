"use client"

import { useQuery } from "convex/react"
import { api } from "@renegade/backend/convex/_generated/api"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { ChartWrapper } from "@/components/chart-wrapper"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { LoadingState } from "@/components/loading-state"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Calendar, CheckCircle, Clock, XCircle } from "lucide-react"
import { useState } from "react"
import { format } from "date-fns"

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
  // TODO: Implement getBookingTimeSeries and getBookingFunnel queries
  const bookingData: Array<{
    date: string
    created: number
    confirmed: number
    completed: number
    cancelled: number
  }> = []
  const bookingFunnel = {
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    declined: 0,
    conversionRate: 0,
  }

  if (!stats) {
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
        title="Booking Analytics"
        description="Track booking trends and conversion metrics"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Analytics", href: "/analytics" },
          { label: "Bookings" },
        ]}
      />

      <div className="grid gap-6 md:grid-cols-4">
        <StatCard
          label="Total Bookings"
          value={stats.reservations.total.toString()}
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          label="Confirmed"
          value={stats.reservations.confirmed.toString()}
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          label="Completed"
          value={stats.reservations.completed.toString()}
          icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          label="Cancelled"
          value={stats.reservations.cancelled.toString()}
          icon={<XCircle className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <ChartWrapper
        title="Booking Trends Over Time"
        granularity={granularity}
        onGranularityChange={setGranularity}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      >
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="Created"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="Confirmed"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="Completed"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="Cancelled"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.6}
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
              <div key={item.label} className="space-y-2">
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
