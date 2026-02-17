import { calculateRefundTier } from "./stripe"

// ============================================================================
// calculateRefundTier - Flexible policy
// ============================================================================

describe("calculateRefundTier - flexible policy", () => {
  it("returns 100% when 1+ days before start", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      "flexible",
      new Date(2024, 5, 13) // June 13 = 2 days before
    )
    expect(result.percentage).toBe(100)
    expect(result.policy).toBe("full")
  })

  it("returns 100% when exactly 1 day before start", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      "flexible",
      new Date(2024, 5, 14) // June 14 = 1 day before
    )
    expect(result.percentage).toBe(100)
    expect(result.policy).toBe("full")
  })

  it("returns 50% on same day as start", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      "flexible",
      new Date(2024, 5, 15) // June 15 = same day
    )
    expect(result.percentage).toBe(50)
    expect(result.policy).toBe("partial")
  })

  it("returns 50% after start date", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      "flexible",
      new Date(2024, 5, 16) // June 16 = 1 day after
    )
    expect(result.percentage).toBe(50)
    expect(result.policy).toBe("partial")
  })
})

// ============================================================================
// calculateRefundTier - Moderate policy (default)
// ============================================================================

describe("calculateRefundTier - moderate policy", () => {
  it("returns 100% when 7+ days before start", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      "moderate",
      new Date(2024, 5, 7) // June 7 = 8 days before
    )
    expect(result.percentage).toBe(100)
    expect(result.policy).toBe("full")
  })

  it("returns 100% when exactly 7 days before start", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      "moderate",
      new Date(2024, 5, 8) // June 8 = 7 days before
    )
    expect(result.percentage).toBe(100)
    expect(result.policy).toBe("full")
  })

  it("returns 50% when 2-6 days before start", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      "moderate",
      new Date(2024, 5, 10) // June 10 = 5 days before
    )
    expect(result.percentage).toBe(50)
    expect(result.policy).toBe("partial")
  })

  it("returns 50% when exactly 2 days before start", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      "moderate",
      new Date(2024, 5, 13) // June 13 = 2 days before
    )
    expect(result.percentage).toBe(50)
    expect(result.policy).toBe("partial")
  })

  it("returns 0% when less than 2 days before start", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      "moderate",
      new Date(2024, 5, 14) // June 14 = 1 day before
    )
    expect(result.percentage).toBe(0)
    expect(result.policy).toBe("none")
  })

  it("returns 0% on same day as start", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      "moderate",
      new Date(2024, 5, 15) // Same day
    )
    expect(result.percentage).toBe(0)
    expect(result.policy).toBe("none")
  })

  it("defaults to moderate when no policy specified", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      undefined,
      new Date(2024, 5, 7) // 8 days before
    )
    expect(result.percentage).toBe(100)
    expect(result.policy).toBe("full")
  })
})

// ============================================================================
// calculateRefundTier - Strict policy
// ============================================================================

describe("calculateRefundTier - strict policy", () => {
  it("returns 100% when 14+ days before start", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      "strict",
      new Date(2024, 5, 1) // June 1 = 14 days before
    )
    expect(result.percentage).toBe(100)
    expect(result.policy).toBe("full")
  })

  it("returns 50% when 7-13 days before start", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      "strict",
      new Date(2024, 5, 5) // June 5 = 10 days before
    )
    expect(result.percentage).toBe(50)
    expect(result.policy).toBe("partial")
  })

  it("returns 50% when exactly 7 days before start", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      "strict",
      new Date(2024, 5, 8) // June 8 = 7 days before
    )
    expect(result.percentage).toBe(50)
    expect(result.policy).toBe("partial")
  })

  it("returns 0% when less than 7 days before start", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      "strict",
      new Date(2024, 5, 10) // June 10 = 5 days before
    )
    expect(result.percentage).toBe(0)
    expect(result.policy).toBe("none")
  })

  it("returns 0% on same day as start", () => {
    const result = calculateRefundTier(
      "2024-06-15",
      "strict",
      new Date(2024, 5, 15)
    )
    expect(result.percentage).toBe(0)
    expect(result.policy).toBe("none")
  })
})

// ============================================================================
// Edge cases
// ============================================================================

describe("calculateRefundTier - edge cases", () => {
  it("returns 0% for invalid startDate", () => {
    const result = calculateRefundTier("not-a-date", "moderate", new Date(2024, 5, 1))
    expect(result.percentage).toBe(0)
    expect(result.policy).toBe("none")
  })

  it("returns 0% for empty startDate", () => {
    const result = calculateRefundTier("", "moderate", new Date(2024, 5, 1))
    expect(result.percentage).toBe(0)
    expect(result.policy).toBe("none")
  })

  it("handles cross-year boundary", () => {
    const result = calculateRefundTier(
      "2025-01-10",
      "moderate",
      new Date(2024, 11, 25) // Dec 25 = 16 days before Jan 10
    )
    expect(result.percentage).toBe(100)
    expect(result.policy).toBe("full")
  })
})
