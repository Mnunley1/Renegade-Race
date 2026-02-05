import { Badge } from "@workspace/ui/components/badge"

type StatusType =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "declined"
  | "open"
  | "resolved"
  | "closed"
  | "approved"
  | "rejected"
  | "succeeded"
  | "failed"
  | "processing"
  | "refunded"
  | "partially_refunded"
  | "enabled"
  | "restricted"
  | "disabled"
  | "active"
  | "inactive"
  | "banned"
  | "published"
  | "hidden"
  | "moderated"
  | "unmoderated"
  | "sending"
  | "archived"

const statusConfig: Record<
  string,
  { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  pending: {
    variant: "outline",
    className: "border-yellow-500 text-yellow-700 dark:text-yellow-400",
  },
  confirmed: { variant: "default", className: "bg-blue-600" },
  completed: { variant: "default", className: "bg-emerald-600" },
  cancelled: { variant: "destructive" },
  declined: { variant: "destructive" },
  open: { variant: "outline", className: "border-red-500 text-red-700 dark:text-red-400" },
  resolved: { variant: "default", className: "bg-emerald-600" },
  closed: { variant: "secondary" },
  approved: { variant: "default", className: "bg-emerald-600" },
  rejected: { variant: "destructive" },
  succeeded: { variant: "default", className: "bg-emerald-600" },
  failed: { variant: "destructive" },
  processing: { variant: "outline", className: "border-blue-500 text-blue-700 dark:text-blue-400" },
  refunded: { variant: "secondary" },
  partially_refunded: {
    variant: "outline",
    className: "border-orange-500 text-orange-700 dark:text-orange-400",
  },
  enabled: { variant: "default", className: "bg-emerald-600" },
  restricted: {
    variant: "outline",
    className: "border-orange-500 text-orange-700 dark:text-orange-400",
  },
  disabled: { variant: "destructive" },
  active: { variant: "default", className: "bg-emerald-600" },
  inactive: { variant: "secondary" },
  banned: { variant: "destructive" },
  published: { variant: "default", className: "bg-emerald-600" },
  hidden: { variant: "secondary" },
  moderated: { variant: "default", className: "bg-blue-600" },
  unmoderated: {
    variant: "outline",
    className: "border-yellow-500 text-yellow-700 dark:text-yellow-400",
  },
  sending: { variant: "outline", className: "border-blue-500 text-blue-700 dark:text-blue-400" },
  archived: { variant: "secondary" },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { variant: "secondary" as const }
  return (
    <Badge className={`${config.className ?? ""} ${className ?? ""}`} variant={config.variant}>
      {status.replace(/_/g, " ")}
    </Badge>
  )
}
