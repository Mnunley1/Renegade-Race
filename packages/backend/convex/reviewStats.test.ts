import { calculateUserReviewStats, calculateVehicleReviewStats } from "./reviewStats"

// ============================================================================
// calculateUserReviewStats
// ============================================================================

describe("calculateUserReviewStats", () => {
  it("returns zeros for empty reviews", () => {
    const result = calculateUserReviewStats([])
    expect(result.averageRating).toBe(0)
    expect(result.totalReviews).toBe(0)
    expect(result.ratingBreakdown).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
    expect(result.categoryAverages).toEqual({
      communication: 0,
      vehicleCondition: 0,
      professionalism: 0,
      overallExperience: 0,
    })
  })

  it("returns correct stats for a single review", () => {
    const result = calculateUserReviewStats([
      {
        rating: 4,
        communication: 5,
        vehicleCondition: 3,
        professionalism: 4,
        overallExperience: 4,
      },
    ])
    expect(result.averageRating).toBe(4)
    expect(result.totalReviews).toBe(1)
    expect(result.ratingBreakdown).toEqual({ 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 })
    expect(result.categoryAverages.communication).toBe(5)
    expect(result.categoryAverages.vehicleCondition).toBe(3)
    expect(result.categoryAverages.professionalism).toBe(4)
    expect(result.categoryAverages.overallExperience).toBe(4)
  })

  it("calculates correct average for multiple reviews (rounded to 1dp)", () => {
    const result = calculateUserReviewStats([{ rating: 5 }, { rating: 4 }, { rating: 3 }])
    // average = 12/3 = 4.0
    expect(result.averageRating).toBe(4)
    expect(result.totalReviews).toBe(3)
  })

  it("rounds average to 1 decimal place", () => {
    const result = calculateUserReviewStats([{ rating: 5 }, { rating: 5 }, { rating: 4 }])
    // average = 14/3 = 4.666... -> 4.7
    expect(result.averageRating).toBe(4.7)
  })

  it("builds correct breakdown histogram", () => {
    const result = calculateUserReviewStats([
      { rating: 5 },
      { rating: 5 },
      { rating: 3 },
      { rating: 1 },
      { rating: 3 },
    ])
    expect(result.ratingBreakdown).toEqual({ 1: 1, 2: 0, 3: 2, 4: 0, 5: 2 })
  })

  it("handles sparse category data", () => {
    const result = calculateUserReviewStats([
      { rating: 5, communication: 5 },
      { rating: 4, professionalism: 3 },
      { rating: 3, communication: 3, vehicleCondition: 4 },
    ])
    // communication: (5+3)/2 = 4
    expect(result.categoryAverages.communication).toBe(4)
    // vehicleCondition: 4/1 = 4
    expect(result.categoryAverages.vehicleCondition).toBe(4)
    // professionalism: 3/1 = 3
    expect(result.categoryAverages.professionalism).toBe(3)
    // overallExperience: none provided
    expect(result.categoryAverages.overallExperience).toBe(0)
  })

  it("computes all category averages when fully populated", () => {
    const result = calculateUserReviewStats([
      {
        rating: 5,
        communication: 5,
        vehicleCondition: 4,
        professionalism: 5,
        overallExperience: 5,
      },
      {
        rating: 3,
        communication: 3,
        vehicleCondition: 2,
        professionalism: 3,
        overallExperience: 3,
      },
    ])
    expect(result.categoryAverages.communication).toBe(4)
    expect(result.categoryAverages.vehicleCondition).toBe(3)
    expect(result.categoryAverages.professionalism).toBe(4)
    expect(result.categoryAverages.overallExperience).toBe(4)
  })

  it("handles all rating values 1-5", () => {
    const result = calculateUserReviewStats([
      { rating: 1 },
      { rating: 2 },
      { rating: 3 },
      { rating: 4 },
      { rating: 5 },
    ])
    // average = 15/5 = 3.0
    expect(result.averageRating).toBe(3)
    expect(result.ratingBreakdown).toEqual({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 })
  })
})

// ============================================================================
// calculateVehicleReviewStats
// ============================================================================

describe("calculateVehicleReviewStats", () => {
  it("returns zeros for empty reviews", () => {
    const result = calculateVehicleReviewStats([])
    expect(result.averageRating).toBe(0)
    expect(result.totalReviews).toBe(0)
    expect(result.ratingBreakdown).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
  })

  it("returns correct stats for a single review", () => {
    const result = calculateVehicleReviewStats([{ rating: 5 }])
    expect(result.averageRating).toBe(5)
    expect(result.totalReviews).toBe(1)
    expect(result.ratingBreakdown).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 })
  })

  it("calculates correct average rounded to 1dp", () => {
    const result = calculateVehicleReviewStats([{ rating: 4 }, { rating: 5 }, { rating: 4 }])
    // average = 13/3 = 4.333... -> 4.3
    expect(result.averageRating).toBe(4.3)
    expect(result.totalReviews).toBe(3)
  })

  it("builds correct breakdown for multiple reviews", () => {
    const result = calculateVehicleReviewStats([
      { rating: 5 },
      { rating: 5 },
      { rating: 4 },
      { rating: 2 },
      { rating: 2 },
      { rating: 1 },
    ])
    expect(result.ratingBreakdown).toEqual({ 1: 1, 2: 2, 3: 0, 4: 1, 5: 2 })
  })

  it("handles all same ratings", () => {
    const result = calculateVehicleReviewStats([{ rating: 3 }, { rating: 3 }, { rating: 3 }])
    expect(result.averageRating).toBe(3)
    expect(result.ratingBreakdown).toEqual({ 1: 0, 2: 0, 3: 3, 4: 0, 5: 0 })
  })
})
