"use client"

import { api } from "@renegade/backend/convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { Calendar, Percent, TrendingUp } from "lucide-react"
import { LoadingState } from "@/components/loading-state"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"

export default function FeesPage() {
  const settings = useQuery(api.admin.getPlatformSettings)
  const stats = useQuery(api.admin.getPlatformStats)

  if (stats === undefined || settings === undefined)
    return <LoadingState message="Loading fee data..." />

  const promoActive =
    settings.earlyAdopterPromoStartsAt != null &&
    settings.earlyAdopterPromoEndsAt != null &&
    Date.now() >= settings.earlyAdopterPromoStartsAt &&
    Date.now() <= settings.earlyAdopterPromoEndsAt

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Fees" }]}
        description="Detailed view of platform fees and revenue"
        title="Fee Management"
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<Percent className="h-4 w-4 text-muted-foreground" />}
          label="Global Fee Rate"
          value={`${settings?.platformFeePercentage ?? 0}%`}
        />
        <StatCard
          icon={<Percent className="h-4 w-4 text-muted-foreground" />}
          label="Early Adopter Cap"
          value={`${settings?.earlyAdopterFeeCapPercentage ?? 3}%`}
        />
        <StatCard
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
          label="Promo Status"
          value={promoActive ? "Active" : "Inactive"}
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
                <span>Provider Receives:</span>
                <span>
                  ${(1000 - (1000 * (settings?.platformFeePercentage ?? 0)) / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Providers with a fee cap pay min(global rate, their cap). There is no dollar min/max
            clamp on the fee.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
