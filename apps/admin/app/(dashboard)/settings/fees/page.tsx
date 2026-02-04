"use client"

import { useQuery } from "convex/react"
import { api } from "@renegade/backend/convex/_generated/api"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { StatCard } from "@/components/stat-card"
import { LoadingState } from "@/components/loading-state"
import { DollarSign, Percent, TrendingUp, Calendar } from "lucide-react"

export default function FeesPage() {
  const settings = useQuery(api.admin.getPlatformSettings)
  const stats = useQuery(api.admin.getPlatformStats)

  if (stats === undefined || settings === undefined) return <LoadingState message="Loading fee data..." />

  return (
    <div>
      <PageHeader
        title="Fee Management"
        description="Detailed view of platform fees and revenue"
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Fees" }]}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard
          label="Fee Rate"
          value={`${settings?.platformFeePercentage ?? 0}%`}
          icon={<Percent className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          label="Min Fee"
          value={`$${((settings?.minimumPlatformFee ?? 0) / 100).toFixed(2)}`}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          label="Max Fee"
          value={`$${((settings?.maximumPlatformFee ?? 0) / 100).toFixed(2)}`}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Revenue Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Revenue</span>
              <span className="font-medium">${((stats?.revenue.total ?? 0) / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last 30 Days</span>
              <span className="font-medium">
                ${((stats?.revenue.last30Days ?? 0) / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last 7 Days</span>
              <span className="font-medium">
                ${((stats?.revenue.last7Days ?? 0) / 100).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Transaction Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Reservations</span>
              <span className="font-medium">{stats?.reservations.total ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed</span>
              <span className="font-medium">{stats?.reservations.completed ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cancelled</span>
              <span className="font-medium">{stats?.reservations.cancelled ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fee Calculation Example</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-lg bg-muted p-4">
            <h4 className="font-medium">Example Booking: $1,000</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Amount:</span>
                <span>$1,000.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Platform Fee ({settings?.platformFeePercentage ?? 0}%):
                </span>
                <span>${((1000 * (settings?.platformFeePercentage ?? 0)) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-medium">
                <span>Total Charged to Renter:</span>
                <span>
                  ${(1000 + (1000 * (settings?.platformFeePercentage ?? 0)) / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Host Receives:</span>
                <span>$1,000.00</span>
              </div>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Note: Actual fees are capped by the minimum ($
            {((settings?.minimumPlatformFee ?? 0) / 100).toFixed(2)}) and maximum ($
            {((settings?.maximumPlatformFee ?? 0) / 100).toFixed(2)}) fee limits.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
