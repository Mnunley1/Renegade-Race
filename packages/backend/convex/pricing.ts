/**
 * Pure pricing and date-overlap helpers extracted from reservation/payment logic.
 * These functions have no Convex dependencies and are fully testable.
 */

/** Calculate add-on total, respecting daily vs one-time price types */
export function calculateAddOnsTotal(
  addOns: Array<{ price: number; priceType?: "daily" | "one-time" }>,
  totalDays: number
): number {
  let total = 0
  for (const addOn of addOns) {
    if (addOn.priceType === "daily") {
      total += addOn.price * totalDays
    } else {
      total += addOn.price
    }
  }
  return total
}

/** Calculate full reservation total: (days * dailyRate) + addOns */
export function calculateReservationTotal(
  dailyRate: number,
  totalDays: number,
  addOns?: Array<{ price: number; priceType?: "daily" | "one-time" }>
): number {
  const baseAmount = totalDays * dailyRate
  if (!addOns || addOns.length === 0) {
    return baseAmount
  }
  return baseAmount + calculateAddOnsTotal(addOns, totalDays)
}

/** Calculate platform fee with percentage, clamped to min/max bounds */
export function calculatePlatformFeeAmount(
  amount: number,
  feePercentage: number,
  minimumFee: number,
  maximumFee?: number
): { platformFee: number; ownerAmount: number } {
  const calculatedFee = Math.round((amount * feePercentage) / 100)
  const platformFee = Math.max(
    minimumFee,
    Math.min(calculatedFee, maximumFee ?? calculatedFee)
  )
  return {
    platformFee,
    ownerAmount: amount - platformFee,
  }
}

/** Check if two date ranges overlap (string comparison, YYYY-MM-DD) */
export function datesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA <= endB && endA >= startB
}

/** Calculate refund amount from payment amount and refund percentage */
export function calculateRefundAmount(
  paymentAmount: number,
  percentage: number
): number {
  return Math.round(paymentAmount * (percentage / 100))
}
