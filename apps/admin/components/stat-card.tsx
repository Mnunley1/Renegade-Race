"use client"

import { Card, CardContent } from "@workspace/ui/components/card"
import { TrendingDown, TrendingUp } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"

interface StatCardProps {
  label: string
  value: string | number
  trend?: { value: number; isPositive: boolean }
  sparklineData?: { value: number }[]
  icon?: React.ReactNode
}

export function StatCard({ label, value, trend, sparklineData, icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="font-medium text-muted-foreground text-sm">{label}</p>
          {icon}
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <p className="font-bold text-2xl">{value}</p>
            {trend && (
              <div
                className={`mt-1 flex items-center gap-1 text-xs ${trend.isPositive ? "text-emerald-600" : "text-red-600"}`}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{Math.abs(trend.value)}% from last period</span>
              </div>
            )}
          </div>
          {sparklineData && sparklineData.length > 0 && (
            <div className="h-10 w-20">
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
