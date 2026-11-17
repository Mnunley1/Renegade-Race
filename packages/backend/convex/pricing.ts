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

/**
 * Resolve the fee % a provider pays: never above their cap, and never above
 * the current global rate (so if global drops below the cap, they get the lower rate).
 */
export function resolvePlatformFeePercentage(
  globalFeePercentage: number,
  platformFeeCapPercentage?: number | null
): number {
  if (platformFeeCapPercentage == null) {
    return globalFeePercentage
  }
  return Math.min(globalFeePercentage, platformFeeCapPercentage)
}

/** Whether the early-adopter signup promo is active at `now`. */
export function isEarlyAdopterPromoActive(
  settings: {
    earlyAdopterPromoStartsAt?: number
    earlyAdopterPromoEndsAt?: number
  } | null,
  now: number = Date.now()
): boolean {
  if (!settings) return false
  const start = settings.earlyAdopterPromoStartsAt
  const end = settings.earlyAdopterPromoEndsAt
  if (start == null || end == null) return false
  return now >= start && now <= end
}

/** Calculate platform fee as a percentage of amount (no min/max dollar clamps). */
export function calculatePlatformFeeAmount(
  amount: number,
  feePercentage: number
): { platformFee: number; ownerAmount: number } {
  const platformFee = Math.round((amount * feePercentage) / 100)
  return {
    platformFee,
    ownerAmount: amount - platformFee,
  }
}

/**
 * US card processing estimate (Stripe's standard domestic rate).
 * Used to gross up charges so the renter covers processing; actual Stripe
 * fees can differ slightly (Amex, international, etc.).
 */
export const STRIPE_CARD_PERCENT = 0.029
export const STRIPE_CARD_FIXED_CENTS = 30

/**
 * Charge amount such that after Stripe's card fee, `desiredNetCents` remains
 * to split between provider and platform.
 */
export function grossUpForStripeCardFees(desiredNetCents: number): number {
  if (desiredNetCents <= 0) return 0
  return Math.ceil((desiredNetCents + STRIPE_CARD_FIXED_CENTS) / (1 - STRIPE_CARD_PERCENT))
}

/** Estimated processing fee the renter pays on top of the listing/service total. */
export function estimateStripeCardProcessingFee(desiredNetCents: number): number {
  if (desiredNetCents <= 0) return 0
  return grossUpForStripeCardFees(desiredNetCents) - desiredNetCents
}

/**
 * Destination-charge amounts where:
 * - renter pays listing + estimated card processing
 * - provider receives listing − Renegade platform fee
 * - application_fee covers Renegade fee + processing (Stripe fee comes out of platform side)
 */
export function buildDestinationChargeAmounts(params: {
  listingAmountCents: number
  platformFeeCents: number
}): {
  chargeAmountCents: number
  processingFeeCents: number
  applicationFeeCents: number
  ownerAmountCents: number
  platformFeeCents: number
} {
  const { listingAmountCents, platformFeeCents } = params
  const ownerAmountCents = listingAmountCents - platformFeeCents
  const chargeAmountCents = grossUpForStripeCardFees(listingAmountCents)
  const processingFeeCents = chargeAmountCents - listingAmountCents
  const applicationFeeCents = chargeAmountCents - ownerAmountCents
  return {
    chargeAmountCents,
    processingFeeCents,
    applicationFeeCents,
    ownerAmountCents,
    platformFeeCents,
  }
}

/** Check if two date ranges overlap (string comparison, YYYY-MM-DD) */
export function datesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA <= endB && endA >= startB
}

/** Calculate refund amount from payment amount and refund percentage */
export function calculateRefundAmount(paymentAmount: number, percentage: number): number {
  return Math.round(paymentAmount * (percentage / 100))
}

const HH_MM_RE = /^\d{2}:\d{2}$/

/**
 * Coaching cancellation refund policy. A coaching session is a scheduled
 * commitment that holds the coach's calendar, so:
 *  - the coach cancelling always refunds the renter in full;
 *  - the renter cancelling is refundable only when it's at least `minNoticeHours`
 *    (default 24h) before the session starts — otherwise the coach keeps the
 *    payment for the slot they held.
 * `startTime` is "HH:MM" (24h) for hourly sessions; day-length sessions assume
 * the start of the day. Dates/times are interpreted as UTC, matching how
 * bookings are stored. `now` is a timestamp (ms).
 */
export function isCoachingCancellationRefundable(params: {
  cancelledByCoach: boolean
  startDate: string
  startTime?: string
  now: number
  minNoticeHours?: number
}): boolean {
  if (params.cancelledByCoach) {
    return true
  }
  const minNoticeMs = (params.minNoticeHours ?? 24) * 60 * 60 * 1000
  const time = params.startTime && HH_MM_RE.test(params.startTime) ? params.startTime : "00:00"
  const sessionStart = Date.parse(`${params.startDate}T${time}:00Z`)
  if (Number.isNaN(sessionStart)) {
    // Unparseable date — be lenient and allow the refund rather than trap funds.
    return true
  }
  return params.now <= sessionStart - minNoticeMs
}
