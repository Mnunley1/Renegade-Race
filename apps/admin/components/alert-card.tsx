import { Card, CardContent } from "@workspace/ui/components/card"
import type { LucideIcon } from "lucide-react"

type Severity = "critical" | "warning" | "info"

const severityStyles: Record<
  Severity,
  { bg: string; iconBg: string; text: string; border: string; dot: string }
> = {
  critical: {
    bg: "bg-red-50 dark:bg-red-950/30",
    iconBg: "bg-red-100 dark:bg-red-900/50",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    dot: "bg-red-500",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    iconBg: "bg-amber-100 dark:bg-amber-900/50",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    iconBg: "bg-blue-100 dark:bg-blue-900/50",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
  },
}

interface AlertCardProps {
  icon: LucideIcon
  label: string
  count: number
  description?: string
  severity: Severity
  onClick?: () => void
}

export function AlertCard({
  icon: Icon,
  label,
  count,
  description,
  severity,
  onClick,
}: AlertCardProps) {
  const styles = severityStyles[severity]
  const hasItems = count > 0

  return (
    <Card
      className={`group border ${styles.border} ${styles.bg} transition-all duration-200 hover:shadow-md ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`relative rounded-xl p-2.5 ${styles.iconBg}`}>
          <Icon className={`h-5 w-5 ${styles.text}`} />
          {hasItems && (
            <span
              className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ${styles.dot} ring-2 ring-white dark:ring-gray-900`}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`font-bold text-2xl leading-tight ${styles.text}`}>{count}</p>
          <p className={`font-medium text-sm ${styles.text}`}>{label}</p>
          {description && (
            <p className={`mt-0.5 text-xs ${styles.text} opacity-60`}>{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
