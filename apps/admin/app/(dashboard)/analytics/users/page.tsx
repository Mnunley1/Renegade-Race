"use client";

import { useQuery } from "convex/react";
import { api } from "@renegade/backend/convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ChartWrapper } from "@/components/chart-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { LoadingState } from "@/components/loading-state";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Users, UserCheck, UserPlus, Briefcase } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

function getDateRange(
  range: "7d" | "30d" | "90d" | "ytd"
): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString().split("T")[0]!;
  let start: Date;
  switch (range) {
    case "7d":
      start = new Date(now.getTime() - 7 * 86400000);
      break;
    case "30d":
      start = new Date(now.getTime() - 30 * 86400000);
      break;
    case "90d":
      start = new Date(now.getTime() - 90 * 86400000);
      break;
    case "ytd":
      start = new Date(now.getFullYear(), 0, 1);
      break;
  }
  return { startDate: start.toISOString().split("T")[0]!, endDate: end };
}

export default function UserAnalyticsPage() {
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "ytd">("30d");

  const stats = useQuery(api.admin.getPlatformStats);
  const dateParams = getDateRange(dateRange);
  const userGrowthData = useQuery(api.admin.getUserGrowthTimeSeries, {
    granularity,
    startDate: dateParams.startDate,
    endDate: dateParams.endDate,
  });
  const topRenters = useQuery(api.admin.getTopUsers, {
    limit: 10,
    role: "renter",
    sortBy: "spend",
  });
  const topHosts = useQuery(api.admin.getTopUsers, {
    limit: 10,
    role: "host",
    sortBy: "earnings",
  });

  if (!stats || !userGrowthData || !topRenters || !topHosts) {
    return <LoadingState message="Loading user analytics..." />;
  }

  const chartData = userGrowthData.map((d: { date: string; newUsers: number; cumulativeTotal: number; newHosts: number }) => ({
    date: format(new Date(d.date), "MMM dd"),
    "New Users": d.newUsers,
    "Total Users": d.cumulativeTotal,
    "New Hosts": d.newHosts,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="User Analytics"
        description="Track user growth and engagement metrics"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Analytics", href: "/analytics" },
          { label: "Users" },
        ]}
      />

      <div className="grid gap-6 md:grid-cols-4">
        <StatCard
          label="Total Users"
          value={stats.users.total.toString()}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          label="Active Users"
          value={stats.users.active.toString()}
          icon={<UserCheck className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          label="Total Hosts"
          value={stats.vehicles.total > 0 ? stats.vehicles.total.toString() : "0"}
          icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          label="New This Month"
          value={stats.users.recent.toString()}
          icon={<UserPlus className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <ChartWrapper
        title="User Growth Over Time"
        granularity={granularity}
        onGranularityChange={setGranularity}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      >
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="Total Users"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.3}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="New Users"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.6}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="New Hosts"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartWrapper>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Renters by Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topRenters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data available</p>
              ) : (
                <div className="space-y-3">
                  {topRenters.map((user, index: number) => (
                    <div key={user._id} className="flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium">{user.name || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">{user.email || ""}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          ${(((user as any).totalSpent || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {(user as any).bookingCount || 0} bookings
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Hosts by Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topHosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data available</p>
              ) : (
                <div className="space-y-3">
                  {topHosts.map((user, index: number) => (
                    <div key={user._id} className="flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium">{user.name || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">{user.email || ""}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          ${(((user as any).totalEarnings || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {(user as any).vehicleCount || 0} vehicles
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
