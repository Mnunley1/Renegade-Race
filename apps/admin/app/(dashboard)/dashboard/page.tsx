"use client"

import type React from "react"
import { useQuery } from "convex/react"
import { api } from "@/lib/convex"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Users,
  Car,
  Calendar,
  DollarSign,
  Shield,
  Star,
  MapPin,
  TrendingUp,
  AlertCircle,
} from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"

export default function DashboardPage() {
  const stats = useQuery(api.admin.getPlatformStats, {})

  if (stats === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    )
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100)

  const statCards = [
    {
      title: "Total Users",
      value: stats.users.total.toLocaleString(),
      description: `${stats.users.active} active, ${stats.users.banned} banned`,
      icon: Users,
      trend: stats.users.recent > 0 ? `+${stats.users.recent} in last 30 days` : undefined,
      color: "text-blue-600",
    },
    {
      title: "Total Vehicles",
      value: stats.vehicles.total.toLocaleString(),
      description: `${stats.vehicles.active} active, ${stats.vehicles.pending} pending`,
      icon: Car,
      trend: undefined,
      color: "text-green-600",
    },
    {
      title: "Total Reservations",
      value: stats.reservations.total.toLocaleString(),
      description: `${stats.reservations.confirmed} confirmed, ${stats.reservations.pending} pending`,
      icon: Calendar,
      trend:
        stats.reservations.recent > 0 ? `+${stats.reservations.recent} in last 30 days` : undefined,
      color: "text-purple-600",
    },
    {
      title: "Total Revenue",
      value: formatCurrency(stats.revenue.total),
      description: `${formatCurrency(stats.revenue.last30Days)} in last 30 days`,
      icon: DollarSign,
      trend:
        stats.revenue.last7Days > 0
          ? `${formatCurrency(stats.revenue.last7Days)} in last 7 days`
          : undefined,
      color: "text-emerald-600",
    },
  ]

  const alertCards: Array<{
    title: string
    value: number
    description: string
    icon: React.ComponentType<{ className?: string }>
    variant: "default" | "destructive" | "outline" | "secondary"
  }> = [
    {
      title: "Open Disputes",
      value: stats.disputes.open,
      description: `${stats.disputes.resolved} resolved`,
      icon: Shield,
      variant: stats.disputes.open > 0 ? "destructive" : "default",
    },
    {
      title: "Pending Vehicles",
      value: stats.vehicles.pending,
      description: "Awaiting approval",
      icon: Car,
      variant: stats.vehicles.pending > 0 ? "default" : "secondary",
    },
    {
      title: "Pending Reservations",
      value: stats.reservations.pending,
      description: "Awaiting owner approval",
      icon: Calendar,
      variant: stats.reservations.pending > 0 ? "default" : "secondary",
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl md:text-3xl">Admin Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Platform overview and statistics</p>
      </div>

      {/* Main Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">{stat.title}</CardTitle>
              <stat.icon className={`size-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">{stat.value}</div>
              <p className="mt-1 text-muted-foreground text-xs">{stat.description}</p>
              {stat.trend && (
                <div className="mt-2 flex items-center gap-1">
                  <TrendingUp className="size-3 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs">{stat.trend}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts & Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        {alertCards.map((alert) => (
          <Card key={alert.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">{alert.title}</CardTitle>
              <alert.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="font-bold text-2xl">{alert.value}</div>
                {alert.value > 0 && alert.variant !== "secondary" && (
                  <Badge variant={alert.variant} className="text-xs">
                    <AlertCircle className="mr-1 size-3" />
                    Action Required
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-muted-foreground text-xs">{alert.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Completed Reservations</CardTitle>
            <Calendar className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {stats.reservations.completed.toLocaleString()}
            </div>
            <p className="mt-1 text-muted-foreground text-xs">
              {stats.reservations.cancelled} cancelled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Reviews</CardTitle>
            <Star className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.reviews.total.toLocaleString()}</div>
            <p className="mt-1 text-muted-foreground text-xs">
              {stats.reviews.public} public reviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Tracks</CardTitle>
            <MapPin className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.tracks.active.toLocaleString()}</div>
            <p className="mt-1 text-muted-foreground text-xs">{stats.tracks.total} total tracks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Disputes</CardTitle>
            <Shield className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.disputes.total.toLocaleString()}</div>
            <p className="mt-1 text-muted-foreground text-xs">
              {stats.disputes.open} open, {stats.disputes.resolved} resolved
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
