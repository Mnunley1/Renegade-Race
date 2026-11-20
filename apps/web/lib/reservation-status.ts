import { parseLocalDate } from "@/lib/date-utils"

export type ReservationStatus =
  | "pending"
  | "approved"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "declined"

interface StatusMeta {
  label: string
  /** Tailwind classes for a small badge pill */
  className: string
}

const STATUS_META: Record<ReservationStatus, StatusMeta> = {
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  },
  approved: {
    label: "Approved",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  completed: {
    label: "Completed",
    className: "bg-muted text-muted-foreground",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/10 text-destructive",
  },
  declined: {
    label: "Declined",
    className: "bg-destructive/10 text-destructive",
  },
}

export function getReservationStatusMeta(status: string | null | undefined): StatusMeta | null {
  if (!status) return null
  return STATUS_META[status as ReservationStatus] ?? null
}

/** Format an ISO/`YYYY-MM-DD` date range for a booking, e.g. "Jun 14 – 16" */
export function formatBookingDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): string | null {
  if (!(startDate && endDate)) return null
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)
  if (!(start && end)) return null

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  const endLabel = end.toLocaleDateString(
    undefined,
    sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" }
  )
  return `${startLabel} – ${endLabel}`
}
