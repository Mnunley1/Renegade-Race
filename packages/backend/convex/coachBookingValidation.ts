import type { CoachPricingUnit } from "./coachPricing"
import { ErrorCode, throwError } from "./errors"

export function requiresTotalHours(pricingUnit: CoachPricingUnit): boolean {
  return pricingUnit === "hour"
}

/**
 * @returns error code string if invalid, or null if OK
 */
export function validateHourlyTotalHours(
  pricingUnit: CoachPricingUnit,
  totalHours?: number
): string | null {
  if (pricingUnit !== "hour") {
    return null
  }
  if (typeof totalHours !== "number" || totalHours <= 0) {
    return "INVALID_HOURS"
  }
  return null
}

export function assertValidCoachDateOrder(startDate: string, endDate: string): void {
  if (startDate > endDate) {
    throwError(ErrorCode.INVALID_DATE_RANGE, "End date must be on or after start date", {
      startDate,
      endDate,
    })
  }
}
