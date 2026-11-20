import { ConvexError } from "convex/values"
import type { Id } from "./_generated/dataModel"
import type { QueryCtx } from "./_generated/server"
import { formatDateToISO, parseLocalDate } from "./dateUtils"

type RentalRange = {
  vehicleId: Id<"vehicles">
  startDate: string
  endDate: string
  excludeReservationId?: Id<"reservations">
}

export function assertRentalDateRange(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)
  if (
    !(start && end) ||
    formatDateToISO(start) !== startDate ||
    formatDateToISO(end) !== endDate ||
    startDate > endDate
  ) {
    throw new ConvexError({
      code: "INVALID_DATE_RANGE",
      message: "Choose a valid rental date range.",
    })
  }
}

/** Approval holds dates. Pending requests compete without reserving them. */
export async function getRentalConflicts(ctx: Pick<QueryCtx, "db">, args: RentalRange) {
  assertRentalDateRange(args.startDate, args.endDate)
  const [blockedDates, reservedReservations] = await Promise.all([
    ctx.db
      .query("availability")
      .withIndex("by_vehicle_date", (q) => q.eq("vehicleId", args.vehicleId))
      .filter((q) =>
        q.and(
          q.eq(q.field("isAvailable"), false),
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate)
        )
      )
      .collect(),
    ctx.db
      .query("reservations")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .filter((q) =>
        q.and(
          q.or(q.eq(q.field("status"), "approved"), q.eq(q.field("status"), "confirmed")),
          q.lte(q.field("startDate"), args.endDate),
          q.gte(q.field("endDate"), args.startDate)
        )
      )
      .collect()
      .then((rows) => rows.filter((row) => row._id !== args.excludeReservationId)),
  ])
  return {
    blockedDates,
    reservedReservations,
    isAvailable: blockedDates.length === 0 && reservedReservations.length === 0,
  }
}

export async function assertRentalDatesAvailable(ctx: Pick<QueryCtx, "db">, args: RentalRange) {
  const conflicts = await getRentalConflicts(ctx, args)
  if (!conflicts.isAvailable) {
    throw new ConvexError({
      code: "DATES_UNAVAILABLE",
      message:
        "These dates are blocked or reserved for another booking. Choose other dates or contact the host to resolve the conflict.",
    })
  }
  return conflicts
}
