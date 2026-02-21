"use client"

import { Card, CardContent } from "@workspace/ui/components/card"
import { TrendingDown, TrendingUp } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"

interface StatCardProps {
  label: string
  value: string | number
  description?: string
  trend?: { value: number; isPositive: boolean }
  trendLabel?: string
  sparklineData?: { value: number }[]
  icon?: React.ReactNode
  iconBgClassName?: string
  iconClassName?: string
}

export function StatCard({
  label,
  value,
  description,
  trend,
  trendLabel,
  sparklineData,
  icon,
  iconBgClassName = "bg-muted",
  iconClassName,
}: StatCardProps) {
  return (
    <Card className="group transition-all duration-200 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className="font-medium text-muted-foreground text-sm">{label}</p>
          {icon && (
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBgClassName}`}
            >
              <span className={iconClassName}>{icon}</span>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div className="min-w-0">
            <p className="font-bold text-2xl tracking-tight">{value}</p>
            {description && <p className="mt-1 text-muted-foreground text-xs">{description}</p>}
            {trend && (
              <div
                className={`mt-1.5 flex items-center gap-1 font-medium text-xs ${trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>
                  {trendLabel ? trendLabel : `${Math.abs(trend.value)}% from last period`}
                </span>
              </div>
            )}
          </div>
          {sparklineData && sparklineData.length > 0 && (
            <div className="h-10 w-20 shrink-0">
              <ResponsiveContainer height="100%" width="100%">
                <AreaChart data={sparklineData}>
                  <Area
                    dataKey="value"
                    fill={trend?.isPositive !== false ? "#10b98120" : "#ef444420"}
                    stroke={trend?.isPositive !== false ? "#10b981" : "#ef4444"}
                    strokeWidth={1.5}
                    type="monotone"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
