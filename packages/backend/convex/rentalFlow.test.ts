import { calculateDaysBetween } from "./dateUtils"
import {
  calculateReservationTotal,
  calculateAddOnsTotal,
  calculatePlatformFeeAmount,
  datesOverlap,
  calculateRefundAmount,
} from "./pricing"
import { calculateRefundTier } from "./stripe"
import {
  calculateUserReviewStats,
  calculateVehicleReviewStats,
} from "./reviewStats"
import {
  sanitizeMessage,
  sanitizeReview,
  sanitizeShortText,
} from "./sanitize"

// ============================================================================
// 1. Happy Path: Book → Pay → Complete → Review
// ============================================================================

describe("Happy Path: Book → Pay → Complete → Review", () => {
  const startDate = "2024-07-10"
  const endDate = "2024-07-14"
  const dailyRate = 15000 // $150/day in cents
  const addOns = [
    { price: 2000, priceType: "daily" as const }, // helmet rental $20/day
    { price: 5000, priceType: "one-time" as const }, // insurance $50 flat
  ]

  it("calculates days, total, platform fee, and validates fee split", () => {
    const totalDays = calculateDaysBetween(startDate, endDate)
    expect(totalDays).toBe(4)

    const total = calculateReservationTotal(dailyRate, totalDays, addOns)
    // base: 15000 * 4 = 60000, daily add-on: 2000 * 4 = 8000, one-time: 5000
    expect(total).toBe(73000)

    // 5% fee, $1 min, $50 max (all in cents: 100 min, 5000 max)
    const { platformFee, ownerAmount } = calculatePlatformFeeAmount(total, 5, 100, 5000)
    // 5% of 73000 = 3650, within bounds
    expect(platformFee).toBe(3650)
    expect(platformFee + ownerAmount).toBe(total)
  })

  it("aggregates review stats after completion", () => {
    const review = {
      rating: 5,
      communication: 5,
      vehicleCondition: 4,
      professionalism: 5,
      overallExperience: 5,
    }

    const userStats = calculateUserReviewStats([review])
    expect(userStats.averageRating).toBe(5)
    expect(userStats.totalReviews).toBe(1)
    expect(userStats.ratingBreakdown[5]).toBe(1)
    expect(userStats.categoryAverages.vehicleCondition).toBe(4)

    const vehicleStats = calculateVehicleReviewStats([{ rating: review.rating }])
    expect(vehicleStats.averageRating).toBe(5)
    expect(vehicleStats.totalReviews).toBe(1)
  })
})

// ============================================================================
// 2. Cancellation Refund Flow (all 3 policies)
// ============================================================================

describe("Cancellation Refund Flow", () => {
  const startDate = "2024-07-15"
  const dailyRate = 20000
  const totalDays = 3
  const total = calculateReservationTotal(dailyRate, totalDays) // 60000

  describe("flexible policy", () => {
    it("full refund when cancelled 3 days before", () => {
      const tier = calculateRefundTier("2024-07-15", "flexible", new Date(2024, 6, 12))
      expect(tier.percentage).toBe(100)
      const refund = calculateRefundAmount(total, tier.percentage)
      expect(refund).toBe(60000)
      expect(refund).toBeLessThanOrEqual(total)
    })

    it("partial refund when cancelled same day", () => {
      const tier = calculateRefundTier("2024-07-15", "flexible", new Date(2024, 6, 15))
      expect(tier.percentage).toBe(50)
      const refund = calculateRefundAmount(total, tier.percentage)
      expect(refund).toBe(30000)
      expect(refund).toBeLessThanOrEqual(total)
    })
  })

  describe("moderate policy", () => {
    it("full refund when cancelled 10 days before", () => {
      const tier = calculateRefundTier("2024-07-15", "moderate", new Date(2024, 6, 5))
      expect(tier.percentage).toBe(100)
      const refund = calculateRefundAmount(total, tier.percentage)
      expect(refund).toBe(60000)
    })

    it("partial refund when cancelled 4 days before", () => {
      const tier = calculateRefundTier("2024-07-15", "moderate", new Date(2024, 6, 11))
      expect(tier.percentage).toBe(50)
      const refund = calculateRefundAmount(total, tier.percentage)
      expect(refund).toBe(30000)
    })

    it("no refund when cancelled 1 day before", () => {
      const tier = calculateRefundTier("2024-07-15", "moderate", new Date(2024, 6, 14))
      expect(tier.percentage).toBe(0)
      const refund = calculateRefundAmount(total, tier.percentage)
      expect(refund).toBe(0)
    })
  })

  describe("strict policy", () => {
    it("full refund when cancelled 14+ days before", () => {
      const tier = calculateRefundTier("2024-07-15", "strict", new Date(2024, 6, 1))
      expect(tier.percentage).toBe(100)
      const refund = calculateRefundAmount(total, tier.percentage)
      expect(refund).toBe(60000)
    })

    it("partial refund when cancelled 10 days before", () => {
      const tier = calculateRefundTier("2024-07-15", "strict", new Date(2024, 6, 5))
      expect(tier.percentage).toBe(50)
      const refund = calculateRefundAmount(total, tier.percentage)
      expect(refund).toBe(30000)
    })

    it("no refund when cancelled 3 days before", () => {
      const tier = calculateRefundTier("2024-07-15", "strict", new Date(2024, 6, 12))
      expect(tier.percentage).toBe(0)
      const refund = calculateRefundAmount(total, tier.percentage)
      expect(refund).toBe(0)
    })
  })
})

// ============================================================================
// 3. Owner Cancellation (forced 100% refund)
// ============================================================================

describe("Owner Cancellation - forced 100% refund", () => {
  it("refunds full payment regardless of policy", () => {
    const dailyRate = 25000
    const totalDays = calculateDaysBetween("2024-08-01", "2024-08-04") // 3 days
    const total = calculateReservationTotal(dailyRate, totalDays) // 75000
    const { platformFee } = calculatePlatformFeeAmount(total, 5, 100, 5000)

    // Owner cancels → forced 100%, ignoring the policy tier
    const forcedPercentage = 100
    const refund = calculateRefundAmount(total, forcedPercentage)
    expect(refund).toBe(total)

    // Even with strict policy that would give 0%, owner cancel overrides
    const tier = calculateRefundTier("2024-08-01", "strict", new Date(2024, 7, 1))
    expect(tier.percentage).toBe(0) // policy says no refund
    const ownerCancelRefund = calculateRefundAmount(total, forcedPercentage)
    expect(ownerCancelRefund).toBe(total) // but owner cancel forces 100%

    // Platform fee is separate from the refund to the renter
    expect(platformFee).toBeGreaterThan(0)
  })
})

// ============================================================================
// 4. Date Conflict Detection
// ============================================================================

describe("Date Conflict Detection", () => {
  const existingStart = "2024-01-10"
  const existingEnd = "2024-01-15"

  it("detects overlap when new request starts during existing reservation", () => {
    expect(datesOverlap(existingStart, existingEnd, "2024-01-12", "2024-01-18")).toBe(true)
  })

  it("detects no conflict when new request starts after existing ends", () => {
    expect(datesOverlap(existingStart, existingEnd, "2024-01-16", "2024-01-20")).toBe(false)
  })

  it("detects overlap on shared boundary day (Jan 15)", () => {
    expect(datesOverlap(existingStart, existingEnd, "2024-01-15", "2024-01-20")).toBe(true)
  })

  it("detects no overlap when new request ends before existing starts", () => {
    expect(datesOverlap(existingStart, existingEnd, "2024-01-05", "2024-01-09")).toBe(false)
  })
})

// ============================================================================
// 5. Auto-Decline Overlapping Pending Requests
// ============================================================================

describe("Auto-Decline Overlapping Pending Requests", () => {
  it("identifies overlapping pending request after approval", () => {
    // Two pending requests on the same vehicle
    const requestA = { start: "2024-03-10", end: "2024-03-14" }
    const requestB = { start: "2024-03-12", end: "2024-03-18" }

    // Owner approves A → check if B overlaps with the now-confirmed A
    const shouldDeclineB = datesOverlap(
      requestA.start,
      requestA.end,
      requestB.start,
      requestB.end
    )
    expect(shouldDeclineB).toBe(true)
  })

  it("does not decline non-overlapping pending request", () => {
    const requestA = { start: "2024-03-10", end: "2024-03-14" }
    const requestC = { start: "2024-03-15", end: "2024-03-20" }

    const shouldDeclineC = datesOverlap(
      requestA.start,
      requestA.end,
      requestC.start,
      requestC.end
    )
    expect(shouldDeclineC).toBe(false)
  })

  it("auto-declines multiple overlapping requests in a batch", () => {
    const approved = { start: "2024-04-01", end: "2024-04-05" }
    const pendingRequests = [
      { id: "r1", start: "2024-04-03", end: "2024-04-07" }, // overlaps
      { id: "r2", start: "2024-04-06", end: "2024-04-10" }, // no overlap
      { id: "r3", start: "2024-04-01", end: "2024-04-01" }, // overlaps (shared start day)
      { id: "r4", start: "2024-03-28", end: "2024-03-31" }, // no overlap
    ]

    const toDecline = pendingRequests.filter((r) =>
      datesOverlap(approved.start, approved.end, r.start, r.end)
    )

    expect(toDecline.map((r) => r.id)).toEqual(["r1", "r3"])
  })
})

// ============================================================================
// 6. Multi-Rental Review Aggregation
// ============================================================================

describe("Multi-Rental Review Aggregation", () => {
  const reviews = [
    {
      rating: 5,
      communication: 5,
      vehicleCondition: 5,
      professionalism: 5,
      overallExperience: 5,
    },
    {
      rating: 4,
      communication: 4,
      vehicleCondition: 4,
      professionalism: 4,
      overallExperience: 4,
    },
    {
      rating: 4,
      communication: 4,
      vehicleCondition: 3,
      professionalism: 5,
      overallExperience: 4,
    },
    {
      rating: 3,
      communication: 3,
      vehicleCondition: 3,
      professionalism: 3,
      overallExperience: 3,
    },
    {
      rating: 2,
      communication: 2,
      vehicleCondition: 2,
      professionalism: 2,
      overallExperience: 2,
    },
  ]

  it("calculates user stats across 5 rentals", () => {
    const stats = calculateUserReviewStats(reviews)
    // (5+4+4+3+2)/5 = 18/5 = 3.6
    expect(stats.averageRating).toBe(3.6)
    expect(stats.totalReviews).toBe(5)
    expect(stats.ratingBreakdown).toEqual({ 1: 0, 2: 1, 3: 1, 4: 2, 5: 1 })
    // communication: (5+4+4+3+2)/5 = 3.6
    expect(stats.categoryAverages.communication).toBe(3.6)
    // vehicleCondition: (5+4+3+3+2)/5 = 3.4
    expect(stats.categoryAverages.vehicleCondition).toBe(3.4)
    // professionalism: (5+4+5+3+2)/5 = 3.8
    expect(stats.categoryAverages.professionalism).toBe(3.8)
  })

  it("calculates vehicle stats for a subset of reviews", () => {
    // Vehicle only has 3 of the 5 rentals
    const vehicleReviews = reviews.slice(0, 3).map((r) => ({ rating: r.rating }))
    const stats = calculateVehicleReviewStats(vehicleReviews)
    // (5+4+4)/3 = 13/3 = 4.3
    expect(stats.averageRating).toBe(4.3)
    expect(stats.totalReviews).toBe(3)
    expect(stats.ratingBreakdown).toEqual({ 1: 0, 2: 0, 3: 0, 4: 2, 5: 1 })
  })

  it("updates stats correctly when a 6th review is added", () => {
    const sixthReview = {
      rating: 5,
      communication: 5,
      vehicleCondition: 5,
      professionalism: 5,
      overallExperience: 5,
    }
    const allReviews = [...reviews, sixthReview]
    const stats = calculateUserReviewStats(allReviews)
    // (5+4+4+3+2+5)/6 = 23/6 = 3.833... → 3.8
    expect(stats.averageRating).toBe(3.8)
    expect(stats.totalReviews).toBe(6)
    expect(stats.ratingBreakdown).toEqual({ 1: 0, 2: 1, 3: 1, 4: 2, 5: 2 })
  })
})

// ============================================================================
// 7. Content Sanitization Through the Flow
// ============================================================================

describe("Content Sanitization Through the Flow", () => {
  it("sanitizes renter message with HTML", () => {
    const raw = '<img src=x onerror=alert(1)> Hey, is the car available?'
    const sanitized = sanitizeMessage(raw)
    expect(sanitized).not.toContain("<img")
    expect(sanitized).not.toContain("<")
    expect(sanitized).not.toContain(">")
    expect(sanitized).toContain("Hey, is the car available?")
  })

  it("sanitizes review text with script tags", () => {
    const raw = 'Great car! <script>document.cookie</script> Would rent again.'
    const sanitized = sanitizeReview(raw)
    expect(sanitized).not.toContain("<script>")
    expect(sanitized).toContain("Great car!")
    expect(sanitized).toContain("Would rent again.")
  })

  it("sanitizes cancellation reason via sanitizeShortText", () => {
    const raw = 'Schedule conflict <b>sorry</b>'
    const sanitized = sanitizeShortText(raw)
    expect(sanitized).not.toContain("<b>")
    expect(sanitized).toContain("Schedule conflict")
  })

  it("enforces message length limit (10k chars)", () => {
    const long = "x".repeat(12_000)
    const sanitized = sanitizeMessage(long)
    expect(sanitized.length).toBe(10_000)
  })

  it("enforces review length limit (5k chars)", () => {
    const long = "x".repeat(6000)
    const sanitized = sanitizeReview(long)
    expect(sanitized.length).toBe(5000)
  })

  it("enforces short text length limit (500 chars)", () => {
    const long = "x".repeat(600)
    const sanitized = sanitizeShortText(long)
    expect(sanitized.length).toBe(500)
  })
})

// ============================================================================
// 8. Add-On Edge Cases in Pricing
// ============================================================================

describe("Add-On Edge Cases in Pricing", () => {
  const dailyRate = 10000 // $100/day

  it("reservation with only daily add-ons", () => {
    const addOns = [
      { price: 1500, priceType: "daily" as const },
      { price: 2000, priceType: "daily" as const },
    ]
    const totalDays = 3
    const total = calculateReservationTotal(dailyRate, totalDays, addOns)
    // base: 30000, add-ons: (1500+2000)*3 = 10500
    expect(total).toBe(40500)
  })

  it("reservation with only one-time add-ons", () => {
    const addOns = [
      { price: 5000, priceType: "one-time" as const },
      { price: 3000, priceType: "one-time" as const },
    ]
    const totalDays = 3
    const total = calculateReservationTotal(dailyRate, totalDays, addOns)
    // base: 30000, add-ons: 5000+3000 = 8000
    expect(total).toBe(38000)
  })

  it("reservation with no add-ons", () => {
    const totalDays = 3
    const total = calculateReservationTotal(dailyRate, totalDays)
    expect(total).toBe(30000)
  })

  it("1-day rental with daily add-ons (multiplier = 1)", () => {
    const addOns = [{ price: 2500, priceType: "daily" as const }]
    const totalDays = calculateDaysBetween("2024-09-01", "2024-09-01") // 1 day
    expect(totalDays).toBe(1)
    const total = calculateReservationTotal(dailyRate, totalDays, addOns)
    // base: 10000, add-on: 2500*1 = 2500
    expect(total).toBe(12500)
  })

  it("platform fee clamped to minimum on small reservation", () => {
    // $5 reservation → 5% = 25 cents, but min is $1 (100 cents)
    const smallTotal = 500
    const { platformFee, ownerAmount } = calculatePlatformFeeAmount(smallTotal, 5, 100, 5000)
    expect(platformFee).toBe(100)
    expect(platformFee + ownerAmount).toBe(smallTotal)
  })

  it("platform fee clamped to maximum on large reservation", () => {
    // $5000 reservation → 5% = $250, but max is $50 (5000 cents)
    const largeTotal = 500000
    const { platformFee, ownerAmount } = calculatePlatformFeeAmount(largeTotal, 5, 100, 5000)
    expect(platformFee).toBe(5000)
    expect(platformFee + ownerAmount).toBe(largeTotal)
  })
})
