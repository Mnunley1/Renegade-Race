import type { Doc } from "./_generated/dataModel"
import type { QueryCtx } from "./_generated/server"
import { isAdminIdentity } from "./admin"
import { ErrorCode, throwError } from "./errors"

export function isVehicleArchived(vehicle: {
  isActive: boolean
  deletedAt?: number
  isSuspended?: boolean
}) {
  return !vehicle.isActive || vehicle.deletedAt !== undefined || vehicle.isSuspended === true
}

export function assertRentalVehicleAvailable(
  vehicle: Doc<"vehicles"> | null
): asserts vehicle is Doc<"vehicles"> {
  if (!vehicle) throwError(ErrorCode.NOT_FOUND, "Vehicle not found")
  if (isVehicleArchived(vehicle)) {
    throwError(
      ErrorCode.INVALID_STATUS,
      "This listing is no longer accepting rental requests or payments"
    )
  }
}

export async function canReadVehicleDetails(ctx: QueryCtx, vehicle: Doc<"vehicles">) {
  if (!isVehicleArchived(vehicle)) return true
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return false
  if (identity.subject === vehicle.ownerId || isAdminIdentity(identity)) return true
  const reservation = await ctx.db
    .query("reservations")
    .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicle._id))
    .filter((q) =>
      q.or(q.eq(q.field("renterId"), identity.subject), q.eq(q.field("ownerId"), identity.subject))
    )
    .first()
  return reservation !== null
}
