import {
  buildDestinationChargeAmounts,
  calculateAddOnsTotal,
  calculatePlatformFeeAmount,
  calculateRefundAmount,
  calculateReservationTotal,
  datesOverlap,
  estimateStripeCardProcessingFee,
  grossUpForStripeCardFees,
  isCoachingCancellationRefundable,
  isEarlyAdopterPromoActive,
  resolvePlatformFeePercentage,
  STRIPE_CARD_FIXED_CENTS,
  STRIPE_CARD_PERCENT,
} from "./pricing"

// ============================================================================
// calculateAddOnsTotal
// ============================================================================

describe("calculateAddOnsTotal", () => {
  it("returns 0 for empty array", () => {
    expect(calculateAddOnsTotal([], 3)).toBe(0)
  })

  it("sums one-time add-ons regardless of days", () => {
    const addOns = [
      { price: 500, priceType: "one-time" as const },
      { price: 300, priceType: "one-time" as const },
    ]
    expect(calculateAddOnsTotal(addOns, 5)).toBe(800)
  })

  it("multiplies daily add-ons by totalDays", () => {
    const addOns = [{ price: 200, priceType: "daily" as const }]
    expect(calculateAddOnsTotal(addOns, 3)).toBe(600)
  })

  it("handles mix of daily and one-time", () => {
    const addOns = [
      { price: 200, priceType: "daily" as const },
      { price: 500, priceType: "one-time" as const },
    ]
    expect(calculateAddOnsTotal(addOns, 4)).toBe(200 * 4 + 500)
  })

  it("treats undefined priceType as one-time", () => {
    const addOns = [{ price: 1000 }]
    expect(calculateAddOnsTotal(addOns, 7)).toBe(1000)
  })

  it("handles single day with daily add-ons", () => {
    const addOns = [{ price: 150, priceType: "daily" as const }]
    expect(calculateAddOnsTotal(addOns, 1)).toBe(150)
  })
})

// ============================================================================
// calculateReservationTotal
// ============================================================================

describe("calculateReservationTotal", () => {
  it("returns base amount with no add-ons", () => {
    expect(calculateReservationTotal(5000, 3)).toBe(15000)
  })

  it("returns base amount with undefined add-ons", () => {
    expect(calculateReservationTotal(5000, 3, undefined)).toBe(15000)
  })

  it("returns base amount with empty add-ons array", () => {
    expect(calculateReservationTotal(5000, 3, [])).toBe(15000)
  })

  it("adds one-time add-ons to base", () => {
    const addOns = [{ price: 1000, priceType: "one-time" as const }]
    expect(calculateReservationTotal(5000, 3, addOns)).toBe(15000 + 1000)
  })

  it("adds daily add-ons scaled by days", () => {
    const addOns = [{ price: 200, priceType: "daily" as const }]
    expect(calculateReservationTotal(5000, 3, addOns)).toBe(15000 + 600)
  })

  it("handles multi-day with mixed add-ons", () => {
    const addOns = [
      { price: 200, priceType: "daily" as const },
      { price: 500, priceType: "one-time" as const },
      { price: 100 }, // defaults to one-time
    ]
    expect(calculateReservationTotal(3000, 5, addOns)).toBe(3000 * 5 + 200 * 5 + 500 + 100)
  })

  it("handles 1 day rental", () => {
    expect(calculateReservationTotal(10000, 1)).toBe(10000)
  })
})

// ============================================================================
// calculatePlatformFeeAmount
// ============================================================================

describe("calculatePlatformFeeAmount", () => {
  it("calculates 5% of 10000 cents", () => {
    const result = calculatePlatformFeeAmount(10000, 5)
    expect(result.platformFee).toBe(500)
    expect(result.ownerAmount).toBe(9500)
  })

  it("applies percentage on small amounts with no dollar floor", () => {
    // 5% of 500 = 25
    const result = calculatePlatformFeeAmount(500, 5)
    expect(result.platformFee).toBe(25)
    expect(result.ownerAmount).toBe(475)
  })

  it("applies percentage on large amounts with no dollar ceiling", () => {
    // 5% of 200000 = 10000
    const result = calculatePlatformFeeAmount(200000, 5)
    expect(result.platformFee).toBe(10000)
    expect(result.ownerAmount).toBe(190000)
  })

  it("returns 0 fee for 0% percentage", () => {
    const result = calculatePlatformFeeAmount(10000, 0)
    expect(result.platformFee).toBe(0)
    expect(result.ownerAmount).toBe(10000)
  })

  it("rounds to nearest cent", () => {
    // 5% of 333 = 16.65, rounds to 17
    const result = calculatePlatformFeeAmount(333, 5)
    expect(result.platformFee).toBe(17)
    expect(result.ownerAmount).toBe(316)
  })

  it("fee + ownerAmount always equals original amount", () => {
    const result = calculatePlatformFeeAmount(9999, 7)
    expect(result.platformFee + result.ownerAmount).toBe(9999)
  })
})

describe("grossUpForStripeCardFees / buildDestinationChargeAmounts", () => {
  it("grosses up so net after estimated Stripe fees equals listing", () => {
    const listing = 100_00 // $100.00
    const charge = grossUpForStripeCardFees(listing)
    const estimatedStripeFee = Math.round(charge * STRIPE_CARD_PERCENT) + STRIPE_CARD_FIXED_CENTS
    // charge - stripeFee >= listing (ceil can leave a cent or two of slack)
    expect(charge - estimatedStripeFee).toBeGreaterThanOrEqual(listing - 1)
    expect(estimateStripeCardProcessingFee(listing)).toBe(charge - listing)
  })

  it("keeps provider at listing minus Renegade fee", () => {
    const listing = 100_000 // $1,000
    const platformFee = 3_000 // 3%
    const amounts = buildDestinationChargeAmounts({
      listingAmountCents: listing,
      platformFeeCents: platformFee,
    })
    expect(amounts.ownerAmountCents).toBe(97_000)
    expect(amounts.chargeAmountCents - amounts.applicationFeeCents).toBe(97_000)
    expect(amounts.applicationFeeCents).toBe(platformFee + amounts.processingFeeCents)
    expect(amounts.chargeAmountCents).toBe(listing + amounts.processingFeeCents)
  })

  it("with 0% platform fee still passes processing to the payer", () => {
    const listing = 50_000
    const amounts = buildDestinationChargeAmounts({
      listingAmountCents: listing,
      platformFeeCents: 0,
    })
    expect(amounts.ownerAmountCents).toBe(listing)
    expect(amounts.applicationFeeCents).toBe(amounts.processingFeeCents)
    expect(amounts.chargeAmountCents - amounts.applicationFeeCents).toBe(listing)
  })
})

describe("resolvePlatformFeePercentage", () => {
  it("returns global when no cap is set", () => {
    expect(resolvePlatformFeePercentage(5, null)).toBe(5)
    expect(resolvePlatformFeePercentage(5, undefined)).toBe(5)
  })

  it("returns the lower of global and cap", () => {
    expect(resolvePlatformFeePercentage(5, 3)).toBe(3)
    expect(resolvePlatformFeePercentage(2, 3)).toBe(2)
    expect(resolvePlatformFeePercentage(3, 3)).toBe(3)
  })
})

describe("isEarlyAdopterPromoActive", () => {
  const now = 1_700_000_000_000

  it("is inactive when dates are missing", () => {
    expect(isEarlyAdopterPromoActive(null, now)).toBe(false)
    expect(isEarlyAdopterPromoActive({}, now)).toBe(false)
    expect(isEarlyAdopterPromoActive({ earlyAdopterPromoStartsAt: now }, now)).toBe(false)
  })

  it("is active inside the window inclusive", () => {
    expect(
      isEarlyAdopterPromoActive(
        { earlyAdopterPromoStartsAt: now - 1, earlyAdopterPromoEndsAt: now + 1 },
        now
      )
    ).toBe(true)
    expect(
      isEarlyAdopterPromoActive(
        { earlyAdopterPromoStartsAt: now, earlyAdopterPromoEndsAt: now },
        now
      )
    ).toBe(true)
  })

  it("is inactive outside the window", () => {
    expect(
      isEarlyAdopterPromoActive(
        { earlyAdopterPromoStartsAt: now + 1, earlyAdopterPromoEndsAt: now + 10 },
        now
      )
    ).toBe(false)
    expect(
      isEarlyAdopterPromoActive(
        { earlyAdopterPromoStartsAt: now - 10, earlyAdopterPromoEndsAt: now - 1 },
        now
      )
    ).toBe(false)
  })
})

// ============================================================================
// datesOverlap
// ============================================================================

describe("datesOverlap", () => {
  it("returns false when A is entirely before B", () => {
    expect(datesOverlap("2024-01-01", "2024-01-05", "2024-01-10", "2024-01-15")).toBe(false)
  })

  it("returns false when A is entirely after B", () => {
    expect(datesOverlap("2024-02-01", "2024-02-05", "2024-01-01", "2024-01-05")).toBe(false)
  })

  it("returns true for identical date ranges", () => {
    expect(datesOverlap("2024-01-01", "2024-01-05", "2024-01-01", "2024-01-05")).toBe(true)
  })

  it("returns true when A starts during B", () => {
    expect(datesOverlap("2024-01-03", "2024-01-10", "2024-01-01", "2024-01-05")).toBe(true)
  })

  it("returns true when A ends during B", () => {
    expect(datesOverlap("2024-01-01", "2024-01-03", "2024-01-02", "2024-01-05")).toBe(true)
  })

  it("returns true for adjacent dates (end == start)", () => {
    // endA == startB means they share one day
    expect(datesOverlap("2024-01-01", "2024-01-05", "2024-01-05", "2024-01-10")).toBe(true)
  })

  it("returns false when ranges are one day apart", () => {
    expect(datesOverlap("2024-01-01", "2024-01-04", "2024-01-05", "2024-01-10")).toBe(false)
  })

  it("returns true when one range contains the other", () => {
    expect(datesOverlap("2024-01-01", "2024-01-31", "2024-01-10", "2024-01-15")).toBe(true)
  })

  it("returns true when inner contains outer", () => {
    expect(datesOverlap("2024-01-10", "2024-01-15", "2024-01-01", "2024-01-31")).toBe(true)
  })
})

// ============================================================================
// calculateRefundAmount
// ============================================================================

describe("calculateRefundAmount", () => {
  it("returns full amount for 100%", () => {
    expect(calculateRefundAmount(10000, 100)).toBe(10000)
  })

  it("returns half for 50%", () => {
    expect(calculateRefundAmount(10000, 50)).toBe(5000)
  })

  it("returns 0 for 0%", () => {
    expect(calculateRefundAmount(10000, 0)).toBe(0)
  })

  it("rounds correctly for odd amounts", () => {
    // 50% of 1999 = 999.5, rounds to 1000
    expect(calculateRefundAmount(1999, 50)).toBe(1000)
  })

  it("rounds correctly for 33%", () => {
    // 33% of 10000 = 3300
    expect(calculateRefundAmount(10000, 33)).toBe(3300)
  })

  it("handles small amounts", () => {
    // 50% of 1 = 0.5, rounds to 1
    expect(calculateRefundAmount(1, 50)).toBe(1)
  })
})

// ============================================================================
// isCoachingCancellationRefundable
// ============================================================================

describe("isCoachingCancellationRefundable", () => {
  const now = Date.parse("2030-06-01T00:00:00Z")

  it("always refunds when the coach cancels, regardless of timing", () => {
    expect(
      isCoachingCancellationRefundable({
        cancelledByCoach: true,
        startDate: "2030-06-01",
        startTime: "09:00",
        now,
      })
    ).toBe(true)
  })

  it("refunds a renter cancelling with more than 24h notice", () => {
    expect(
      isCoachingCancellationRefundable({
        cancelledByCoach: false,
        startDate: "2030-06-10",
        now,
      })
    ).toBe(true)
  })

  it("does not refund a renter cancelling the same day", () => {
    expect(
      isCoachingCancellationRefundable({
        cancelledByCoach: false,
        startDate: "2030-06-01",
        startTime: "09:00",
        now,
      })
    ).toBe(false)
  })

  it("treats exactly 24h before as still refundable", () => {
    // now is 2030-06-01T00:00Z; a session at 2030-06-02T00:00Z is exactly 24h out.
    expect(
      isCoachingCancellationRefundable({
        cancelledByCoach: false,
        startDate: "2030-06-02",
        startTime: "00:00",
        now,
      })
    ).toBe(true)
  })

  it("does not refund just inside the 24h window", () => {
    // Session at 2030-06-01T23:00Z is 23h out from now — inside the window.
    expect(
      isCoachingCancellationRefundable({
        cancelledByCoach: false,
        startDate: "2030-06-01",
        startTime: "23:00",
        now,
      })
    ).toBe(false)
  })
})
