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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { DollarSign, TrendingUp, CreditCard } from "lucide-react";
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

export default function RevenueAnalyticsPage() {
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "ytd">("30d");

  const stats = useQuery(api.admin.getPlatformStats);
  const dateParams = getDateRange(dateRange);
  const revenueData = useQuery(api.admin.getRevenueTimeSeries, {
    granularity,
    startDate: dateParams.startDate,
    endDate: dateParams.endDate,
  });

  if (!stats || !revenueData) {
    return <LoadingState message="Loading revenue analytics..." />;
  }

  const totalRevenue = stats.revenue.total / 100;
  const totalPlatformFees = revenueData.reduce((sum: number, d: { platformFees: number }) => sum + d.platformFees, 0) / 100;
  const totalBookings = stats.reservations.total;
  const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

  const chartData = revenueData.map((d: { date: string; grossRevenue: number; platformFees: number }) => ({
    date: format(new Date(d.date), "MMM dd"),
    "Gross Revenue": d.grossRevenue / 100,
    "Platform Fees": d.platformFees / 100,
  }));

  const barChartData = revenueData.slice(-14).map((d: { date: string; grossRevenue: number }) => ({
    date: format(new Date(d.date), "MMM dd"),
    Revenue: d.grossRevenue / 100,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Revenue Analytics"
        description="Track revenue trends and platform fees"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Analytics", href: "/analytics" },
          { label: "Revenue" },
        ]}
      />

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          label="Total Revenue"
          value={`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          label="Platform Fees"
          value={`$${totalPlatformFees.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          label="Avg Booking Value"
          value={`$${avgBookingValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <ChartWrapper
        title="Revenue Over Time"
        granularity={granularity}
        onGranularityChange={setGranularity}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      >
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis
              tickFormatter={(value) =>
                `$${value.toLocaleString("en-US", { minimumFractionDigits: 0 })}`
              }
            />
            <Tooltip
              formatter={(value: number) =>
                `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="Gross Revenue"
              stackId="1"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="Platform Fees"
              stackId="2"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartWrapper>

      <Card>
        <CardHeader>
          <CardTitle>Daily Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis
                tickFormatter={(value) =>
                  `$${value.toLocaleString("en-US", { minimumFractionDigits: 0 })}`
                }
              />
              <Tooltip
                formatter={(value: number) =>
                  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
              />
              <Bar dataKey="Revenue" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
