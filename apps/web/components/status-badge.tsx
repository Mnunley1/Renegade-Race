import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { CheckCircle2, Clock, XCircle } from "lucide-react"

const statusConfig = {
  pending: {
    icon: Clock,
    variant: "secondary" as const,
    label: "Pending",
  },
  confirmed: {
    icon: CheckCircle2,
    variant: "default" as const,
    label: "Confirmed",
  },
  completed: {
    icon: CheckCircle2,
    variant: "secondary" as const,
    label: "Completed",
  },
  cancelled: {
    icon: XCircle,
    variant: "destructive" as const,
    label: "Cancelled",
  },
  declined: {
    icon: XCircle,
    variant: "destructive" as const,
    label: "Declined",
  },
} as const

interface StatusBadgeProps {
  status: keyof typeof statusConfig
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge className={cn("gap-1", className)} variant={config.variant}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  )
}
