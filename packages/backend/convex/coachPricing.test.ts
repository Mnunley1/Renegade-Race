import { calculateBillingUnits, calculateCoachBookingTotal } from "./coachPricing"
import { calculateAddOnsTotal } from "./pricing"

describe("calculateBillingUnits", () => {
  it("counts full_day units using the same day span as vehicle rentals (calculateDaysBetween)", () => {
    expect(calculateBillingUnits("full_day", "2025-06-01", "2025-06-01")).toBe(1)
    // Jun 1 → Jun 4 is a 3-day span in dateUtils (matches reservations semantics)
    expect(calculateBillingUnits("full_day", "2025-06-01", "2025-06-04")).toBe(3)
  })

  it("counts half_day as two units per billing day", () => {
    expect(calculateBillingUnits("half_day", "2025-06-01", "2025-06-01")).toBe(2)
    // Two calendar-day span (Jun1→Jun3) → 2 billing days → 4 half-day units
    expect(calculateBillingUnits("half_day", "2025-06-01", "2025-06-03")).toBe(4)
  })

  it("uses a single billing unit for session pricing", () => {
    expect(calculateBillingUnits("session", "2025-06-01", "2025-06-10")).toBe(1)
  })

  it("uses totalHours for hour pricing when provided", () => {
    expect(calculateBillingUnits("hour", "2025-06-01", "2025-06-05", 8)).toBe(8)
  })

  it("returns 0 hours when totalHours is missing or non-positive for hour pricing", () => {
    expect(calculateBillingUnits("hour", "2025-06-01", "2025-06-05")).toBe(0)
    expect(calculateBillingUnits("hour", "2025-06-01", "2025-06-05", 0)).toBe(0)
    expect(calculateBillingUnits("hour", "2025-06-01", "2025-06-05", -1)).toBe(0)
  })
})

describe("calculateCoachBookingTotal", () => {
  const addOns = [
    { price: 1000, priceType: "daily" as const },
    { price: 5000, priceType: "one-time" as const },
  ]

  it("computes base + add-ons for full_day using billing units", () => {
    // Jul 1 → Jul 3 is a 2-day span → 2 billing units (same as reservations)
    const total = calculateCoachBookingTotal({
      baseRate: 20000,
      pricingUnit: "full_day",
      startDate: "2025-07-01",
      endDate: "2025-07-03",
      addOns,
    })
    expect(total).toBe(20000 * 2 + 1000 * 2 + 5000)
  })

  it("computes half_day units correctly", () => {
    // 1 calendar day -> 2 half-day units
    const total = calculateCoachBookingTotal({
      baseRate: 10000,
      pricingUnit: "half_day",
      startDate: "2025-07-01",
      endDate: "2025-07-01",
    })
    expect(total).toBe(10000 * 2)
  })

  it("computes session as flat base rate times one unit", () => {
    const total = calculateCoachBookingTotal({
      baseRate: 15000,
      pricingUnit: "session",
      startDate: "2025-07-01",
      endDate: "2025-07-05",
    })
    expect(total).toBe(15000)
  })

  it("computes hour pricing from totalHours", () => {
    const total = calculateCoachBookingTotal({
      baseRate: 5000,
      pricingUnit: "hour",
      startDate: "2025-07-01",
      endDate: "2025-07-01",
      totalHours: 4,
    })
    expect(total).toBe(5000 * 4)
  })

  it("returns 0 total when billing units are 0", () => {
    const total = calculateCoachBookingTotal({
      baseRate: 5000,
      pricingUnit: "hour",
      startDate: "2025-07-01",
      endDate: "2025-07-01",
    })
    expect(total).toBe(0)
  })
})

describe("coach add-on aggregation matches vehicle add-on rules", () => {
  it("reuses calculateAddOnsTotal with billing units as the day multiplier", () => {
    const units = 3
    const addOns = [
      { price: 2000, priceType: "daily" as const },
      { price: 5000, priceType: "one-time" as const },
    ]
    expect(calculateAddOnsTotal(addOns, units)).toBe(2000 * 3 + 5000)
  })
})
