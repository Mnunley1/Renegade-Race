/**
 * Pure coach booking pricing helpers (no Convex dependencies).
 * Billing uses "units" derived from pricingUnit + date range (+ hours for hourly coaching).
 */

import { calculateDaysBetween } from "./dateUtils"
import { calculateReservationTotal } from "./pricing"

export type CoachPricingUnit = "hour" | "half_day" | "full_day" | "session"

/**
 * Number of billable units for a coach service over a date range.
 * - full_day: inclusive calendar days (same semantics as vehicle rentals).
 * - half_day: two units per calendar day.
 * - session: single flat unit per booking.
 * - hour: uses totalHours (dates ignored except for validation elsewhere).
 */
export function calculateBillingUnits(
  pricingUnit: CoachPricingUnit,
  startDate: string,
  endDate: string,
  totalHours?: number
): number {
  if (pricingUnit === "hour") {
    if (typeof totalHours !== "number" || totalHours <= 0) {
      return 0
    }
    return totalHours
  }

  if (pricingUnit === "session") {
    return 1
  }

  const days = calculateDaysBetween(startDate, endDate)
  if (days <= 0) {
    return 0
  }

  if (pricingUnit === "full_day") {
    return days
  }

  // half_day
  return days * 2
}

/** One row per track the coach charges extra to travel to (amounts in cents). */
export type TravelSurchargeRow = {
  trackId: string
  amount: number
  label?: string
}

/**
 * Returns the configured travel surcharge for an event track, or 0 if none / no selection.
 */
export function lookupTravelSurchargeCents(
  surcharges: TravelSurchargeRow[] | undefined,
  eventTrackId: string | undefined
): number {
  if (!eventTrackId || !surcharges?.length) {
    return 0
  }
  const row = surcharges.find((s) => s.trackId === eventTrackId)
  return row?.amount ?? 0
}

export type CoachBookingTotalArgs = {
  baseRate: number
  pricingUnit: CoachPricingUnit
  startDate: string
  endDate: string
  addOns?: Array<{ price: number; priceType?: "daily" | "one-time" }>
  totalHours?: number
  /** One-time travel surcharge in cents (from lookupTravelSurchargeCents). */
  travelSurchargeCents?: number
}

/**
 * Total amount in cents: (baseRate * billingUnits) + add-ons + travel surcharge.
 * Add-ons with priceType "daily" multiply by billing units; "one-time" is flat.
 */
export function calculateCoachBookingTotal(args: CoachBookingTotalArgs): number {
  const units = calculateBillingUnits(
    args.pricingUnit,
    args.startDate,
    args.endDate,
    args.totalHours
  )
  if (units <= 0) {
    return 0
  }
  const basePlusAddOns = calculateReservationTotal(args.baseRate, units, args.addOns)
  const travel = Math.max(0, args.travelSurchargeCents ?? 0)
  return basePlusAddOns + travel
}
