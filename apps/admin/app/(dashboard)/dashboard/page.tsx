"use client"

import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useQuery } from "convex/react"
import {
  AlertTriangle,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  DollarSign,
  MapPin,
  Shield,
  Star,
  TrendingUp,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertCard } from "@/components/alert-card"
import { ChartWrapper } from "@/components/chart-wrapper"
import { api } from "@/lib/convex"

type Granularity = "daily" | "weekly" | "monthly"
type DateRange = "7d" | "30d" | "90d" | "ytd"

function toDateString(date: Date): string {
  return date.toISOString().split("T")[0] ?? ""
}

function getDateBounds(range: DateRange): { startDate: string; endDate: string } {
  const now = new Date()
  const endDate = toDateString(now)

  if (range === "ytd") {
    return { startDate: `${now.getFullYear()}-01-01`, endDate }
  }

  const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 }
  const days = daysMap[range] ?? 30
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  return { startDate: toDateString(start), endDate }
}

function formatAxisDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function formatChartCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100)
}

const FUNNEL_COLORS = {
  pending: "#f59e0b",
  approved: "#3b82f6",
  confirmed: "#8b5cf6",
  completed: "#10b981",
  cancelled: "#ef4444",
  declined: "#6b7280",
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="rounded-xl border border-border bg-gradient-to-r from-muted/50 to-muted/30 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      {/* Primary stats skeleton */}
      <div>
        <Skeleton className="mb-4 h-5 w-36" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card className="overflow-hidden" key={`stat-${i}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
                <Skeleton className="mt-3 h-8 w-20" />
                <Skeleton className="mt-2 h-3 w-32" />
                <Skeleton className="mt-2 h-3 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Revenue chart skeleton */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-7 w-36" />
            </div>
          </div>
          <Skeleton className="mt-4 h-[300px] w-full" />
        </CardContent>
      </Card>

      {/* Booking charts skeleton */}
      <div>
        <Skeleton className="mb-4 h-5 w-24" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="mt-4 h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-4 h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Alerts skeleton */}
      <div>
        <Skeleton className="mb-4 h-5 w-32" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card className="overflow-hidden" key={`alert-${i}`}>
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div>
                  <Skeleton className="h-7 w-10" />
                  <Skeleton className="mt-1 h-4 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Secondary stats skeleton */}
      <div>
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card className="overflow-hidden" key={`secondary-${i}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
                <Skeleton className="mt-3 h-8 w-16" />
                <Skeleton className="mt-2 h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

interface DashboardStatCardProps {
  title: string
  value: string
  description: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  trend?: string
}

function DashboardStatCard({
  title,
  value,
  description,
  icon,
  iconBg,
  iconColor,
  trend,
}: DashboardStatCardProps) {
  return (
    <Card className="group overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className="font-medium text-muted-foreground text-sm">{title}</p>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
            <span className={iconColor}>{icon}</span>
          </div>
        </div>
        <p className="mt-3 font-bold text-2xl tracking-tight">{value}</p>
        <p className="mt-1 text-muted-foreground text-xs">{description}</p>
        {trend && (
          <div className="mt-1.5 flex items-center gap-1 font-medium text-emerald-600 text-xs dark:text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const router = useRouter()

  const [revenueGranularity, setRevenueGranularity] = useState<Granularity>("weekly")
  const [revenueDateRange, setRevenueDateRange] = useState<DateRange>("30d")
  const [bookingGranularity, setBookingGranularity] = useState<Granularity>("weekly")
  const [bookingDateRange, setBookingDateRange] = useState<DateRange>("30d")

  const revenueBounds = getDateBounds(revenueDateRange)
  const bookingBounds = getDateBounds(bookingDateRange)

  const stats = useQuery(api.admin.getPlatformStats, {})
  const revenueData = useQuery(api.admin.getRevenueTimeSeries, {
    granularity: revenueGranularity,
    startDate: revenueBounds.startDate,
    endDate: revenueBounds.endDate,
  })
  const bookingData = useQuery(api.admin.getBookingTimeSeries, {
    granularity: bookingGranularity,
    startDate: bookingBounds.startDate,
    endDate: bookingBounds.endDate,
  })
  const funnelData = useQuery(api.admin.getBookingFunnel, {})

  if (stats === undefined) {
    return <DashboardSkeleton />
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100)

  const today = new Date()

  const alertsNeedingAttention = [
    stats.disputes.open,
    stats.vehicles.pending,
    stats.reservations.pending,
  ].filter((v) => v > 0).length

  const funnelChartData = funnelData
    ? [
        { name: "Pending", value: funnelData.pending, color: FUNNEL_COLORS.pending },
        { name: "Approved", value: funnelData.approved, color: FUNNEL_COLORS.approved },
        { name: "Confirmed", value: funnelData.confirmed, color: FUNNEL_COLORS.confirmed },
        { name: "Completed", value: funnelData.completed, color: FUNNEL_COLORS.completed },
        { name: "Cancelled", value: funnelData.cancelled, color: FUNNEL_COLORS.cancelled },
        { name: "Declined", value: funnelData.declined, color: FUNNEL_COLORS.declined },
      ].filter((d) => d.value > 0)
    : []

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-card via-card to-muted/40 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-bold text-2xl tracking-tight md:text-3xl">Welcome back</h1>
            <p className="mt-1 text-muted-foreground">{formatDate(today)}</p>
          </div>
          {alertsNeedingAttention > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-medium text-amber-700 text-sm dark:text-amber-400">
                {alertsNeedingAttention}{" "}
                {alertsNeedingAttention === 1 ? "item needs" : "items need"} attention
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Primary statistics */}
      <section>
        <h2 className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          Platform Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardStatCard
            description={`${stats.users.active} active, ${stats.users.banned} banned`}
            icon={<Users className="h-4.5 w-4.5" />}
            iconBg="bg-blue-100 dark:bg-blue-900/50"
            iconColor="text-blue-600 dark:text-blue-400"
            title="Total Users"
            trend={stats.users.recent > 0 ? `+${stats.users.recent} in last 30 days` : undefined}
            value={stats.users.total.toLocaleString()}
          />
          <DashboardStatCard
            description={`${stats.vehicles.active} active, ${stats.vehicles.pending} pending`}
            icon={<Car className="h-4.5 w-4.5" />}
            iconBg="bg-green-100 dark:bg-green-900/50"
            iconColor="text-green-600 dark:text-green-400"
            title="Total Vehicles"
            value={stats.vehicles.total.toLocaleString()}
          />
          <DashboardStatCard
            description={`${stats.reservations.confirmed} confirmed, ${stats.reservations.pending} pending`}
            icon={<Calendar className="h-4.5 w-4.5" />}
            iconBg="bg-purple-100 dark:bg-purple-900/50"
            iconColor="text-purple-600 dark:text-purple-400"
            title="Total Reservations"
            trend={
              stats.reservations.recent > 0
                ? `+${stats.reservations.recent} in last 30 days`
                : undefined
            }
            value={stats.reservations.total.toLocaleString()}
          />
          <DashboardStatCard
            description={`${formatCurrency(stats.revenue.last30Days)} in last 30 days`}
            icon={<DollarSign className="h-4.5 w-4.5" />}
            iconBg="bg-emerald-100 dark:bg-emerald-900/50"
            iconColor="text-emerald-600 dark:text-emerald-400"
            title="Total Revenue"
            trend={
              stats.revenue.last7Days > 0
                ? `${formatCurrency(stats.revenue.last7Days)} in last 7 days`
                : undefined
            }
            value={formatCurrency(stats.revenue.total)}
          />
        </div>
      </section>

      {/* Revenue Over Time */}
      <section>
        <ChartWrapper
          dateRange={revenueDateRange}
          granularity={revenueGranularity}
          isLoading={revenueData === undefined}
          onDateRangeChange={setRevenueDateRange}
          onGranularityChange={setRevenueGranularity}
          title="Revenue Over Time"
        >
          {revenueData && revenueData.length > 0 ? (
            <ResponsiveContainer height={300} width="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="grossRevenueFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="platformFeesFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="date"
                  fontSize={12}
                  tickFormatter={formatAxisDate}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  fontSize={12}
                  tickFormatter={(v) => formatChartCurrency(v)}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatChartCurrency(Number(value)),
                    name === "grossRevenue" ? "Gross Revenue" : "Platform Fees",
                  ]}
                  labelFormatter={(label) => formatAxisDate(String(label))}
                />
                <Legend
                  formatter={(value) =>
                    value === "grossRevenue" ? "Gross Revenue" : "Platform Fees"
                  }
                />
                <Area
                  dataKey="grossRevenue"
                  fill="url(#grossRevenueFill)"
                  fillOpacity={1}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  type="monotone"
                />
                <Area
                  dataKey="platformFees"
                  fill="url(#platformFeesFill)"
                  fillOpacity={1}
                  stroke="#10b981"
                  strokeWidth={2}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            revenueData && (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
                No revenue data for this period
              </div>
            )
          )}
        </ChartWrapper>
      </section>

      {/* Booking Charts */}
      <section>
        <h2 className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          Bookings
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Booking Activity */}
          <ChartWrapper
            dateRange={bookingDateRange}
            granularity={bookingGranularity}
            isLoading={bookingData === undefined}
            onDateRangeChange={setBookingDateRange}
            onGranularityChange={setBookingGranularity}
            title="Booking Activity"
          >
            {bookingData && bookingData.length > 0 ? (
              <ResponsiveContainer height={300} width="100%">
                <BarChart data={bookingData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="date"
                    fontSize={12}
                    tickFormatter={formatAxisDate}
                    tickLine={false}
                  />
                  <YAxis axisLine={false} fontSize={12} tickLine={false} />
                  <Tooltip labelFormatter={(label) => formatAxisDate(String(label))} />
                  <Legend />
                  <Bar dataKey="created" fill="#3b82f6" name="Created" stackId="bookings" />
                  <Bar dataKey="confirmed" fill="#f59e0b" name="Confirmed" stackId="bookings" />
                  <Bar dataKey="completed" fill="#10b981" name="Completed" stackId="bookings" />
                  <Bar dataKey="cancelled" fill="#ef4444" name="Cancelled" stackId="bookings" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              bookingData && (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
                  No booking data for this period
                </div>
              )
            )}
          </ChartWrapper>

          {/* Booking Funnel */}
          <ChartWrapper isLoading={funnelData === undefined} title="Booking Funnel">
            {funnelData && funnelChartData.length > 0 ? (
              <ResponsiveContainer height={300} width="100%">
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={funnelChartData}
                    dataKey="value"
                    innerRadius={70}
                    nameKey="name"
                    outerRadius={110}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {funnelChartData.map((entry) => (
                      <Cell fill={entry.color} key={entry.name} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [Number(value).toLocaleString()]} />
                  <Legend />
                  {/* Center label for conversion rate */}
                  <text
                    dominantBaseline="middle"
                    fill="currentColor"
                    textAnchor="middle"
                    x="50%"
                    y="47%"
                  >
                    <tspan className="fill-foreground font-bold text-2xl">
                      {funnelData.conversionRate.toFixed(1)}%
                    </tspan>
                  </text>
                  <text
                    dominantBaseline="middle"
                    fill="currentColor"
                    textAnchor="middle"
                    x="50%"
                    y="57%"
                  >
                    <tspan className="fill-muted-foreground text-xs">Conversion</tspan>
                  </text>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              funnelData && (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
                  No booking data available
                </div>
              )
            )}
          </ChartWrapper>
        </div>
      </section>

      {/* Action needed alerts */}
      <section>
        <h2 className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          Needs Attention
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <AlertCard
            count={stats.disputes.open}
            description={`${stats.disputes.resolved} resolved`}
            icon={Shield}
            label="Open Disputes"
            onClick={() => router.push("/disputes")}
            severity={stats.disputes.open > 0 ? "critical" : "info"}
          />
          <AlertCard
            count={stats.vehicles.pending}
            description="Awaiting approval"
            icon={Clock}
            label="Pending Vehicles"
            onClick={() => router.push("/vehicles")}
            severity={stats.vehicles.pending > 0 ? "warning" : "info"}
          />
          <AlertCard
            count={stats.reservations.pending}
            description="Awaiting owner approval"
            icon={Calendar}
            label="Pending Reservations"
            onClick={() => router.push("/reservations")}
            severity={stats.reservations.pending > 0 ? "warning" : "info"}
          />
        </div>
      </section>

      {/* Secondary statistics */}
      <section>
        <h2 className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          Additional Metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardStatCard
            description={`${stats.reservations.cancelled} cancelled`}
            icon={<CheckCircle2 className="h-4.5 w-4.5" />}
            iconBg="bg-teal-100 dark:bg-teal-900/50"
            iconColor="text-teal-600 dark:text-teal-400"
            title="Completed Reservations"
            value={stats.reservations.completed.toLocaleString()}
          />
          <DashboardStatCard
            description={`${stats.reviews.public} public reviews`}
            icon={<Star className="h-4.5 w-4.5" />}
            iconBg="bg-amber-100 dark:bg-amber-900/50"
            iconColor="text-amber-600 dark:text-amber-400"
            title="Total Reviews"
            value={stats.reviews.total.toLocaleString()}
          />
          <DashboardStatCard
            description={`${stats.tracks.total} total tracks`}
            icon={<MapPin className="h-4.5 w-4.5" />}
            iconBg="bg-indigo-100 dark:bg-indigo-900/50"
            iconColor="text-indigo-600 dark:text-indigo-400"
            title="Active Tracks"
            value={stats.tracks.active.toLocaleString()}
          />
          <DashboardStatCard
            description={`${stats.disputes.open} open, ${stats.disputes.resolved} resolved`}
            icon={<Shield className="h-4.5 w-4.5" />}
            iconBg="bg-rose-100 dark:bg-rose-900/50"
            iconColor="text-rose-600 dark:text-rose-400"
            title="Total Disputes"
            value={stats.disputes.total.toLocaleString()}
          />
        </div>
      </section>
    </div>
  )
}
