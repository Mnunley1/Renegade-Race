import {
  assertValidCoachDateOrder,
  requiresTotalHours,
  validateHourlyTotalHours,
} from "./coachBookingValidation"
import type { CoachPricingUnit } from "./coachPricing"

const INVALID_DATE_RANGE_RE = /INVALID_DATE_RANGE/

describe("requiresTotalHours", () => {
  it("is true only for hour pricing", () => {
    expect(requiresTotalHours("hour")).toBe(true)
    expect(requiresTotalHours("full_day")).toBe(false)
    expect(requiresTotalHours("half_day")).toBe(false)
    expect(requiresTotalHours("session")).toBe(false)
  })
})

describe("validateHourlyTotalHours", () => {
  it("returns null when hours are valid for hourly pricing", () => {
    expect(validateHourlyTotalHours("hour", 2)).toBeNull()
  })

  it("returns error code when hourly pricing has invalid hours", () => {
    expect(validateHourlyTotalHours("hour")).toBe("INVALID_HOURS")
    expect(validateHourlyTotalHours("hour", 0)).toBe("INVALID_HOURS")
    expect(validateHourlyTotalHours("hour", -1)).toBe("INVALID_HOURS")
  })

  it("ignores hours for non-hour pricing", () => {
    expect(validateHourlyTotalHours("full_day" as CoachPricingUnit)).toBeNull()
  })
})

describe("assertValidCoachDateOrder", () => {
  it("does not throw when end is on or after start", () => {
    expect(() => assertValidCoachDateOrder("2025-08-01", "2025-08-01")).not.toThrow()
    expect(() => assertValidCoachDateOrder("2025-08-01", "2025-08-10")).not.toThrow()
  })

  it("throws when end is before start", () => {
    expect(() => assertValidCoachDateOrder("2025-08-10", "2025-08-01")).toThrow(
      INVALID_DATE_RANGE_RE
    )
  })
})
