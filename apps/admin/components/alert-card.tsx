import { Card, CardContent } from "@workspace/ui/components/card"
import type { LucideIcon } from "lucide-react"

type Severity = "critical" | "warning" | "info"

const severityStyles: Record<Severity, { bg: string; text: string; border: string }> = {
  critical: {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
  },
  warning: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800",
  },
  info: {
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    text: "text-yellow-700 dark:text-yellow-400",
    border: "border-yellow-200 dark:border-yellow-800",
  },
}

interface AlertCardProps {
  icon: LucideIcon
  label: string
  count: number
  severity: Severity
  onClick?: () => void
}

export function AlertCard({ icon: Icon, label, count, severity, onClick }: AlertCardProps) {
  const styles = severityStyles[severity]
  return (
    <Card
      className={`cursor-pointer border ${styles.border} ${styles.bg} transition-colors hover:opacity-90`}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`rounded-lg p-2 ${styles.bg}`}>
          <Icon className={`h-5 w-5 ${styles.text}`} />
        </div>
        <div>
          <p className={`font-bold text-2xl ${styles.text}`}>{count}</p>
          <p className={`text-sm ${styles.text} opacity-80`}>{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
