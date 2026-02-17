/**
 * Pure review aggregation helpers extracted from reviews.ts.
 * These functions have no Convex dependencies and are fully testable.
 */

export interface UserReviewInput {
  rating: number
  communication?: number
  vehicleCondition?: number
  professionalism?: number
  overallExperience?: number
}

export interface UserReviewStats {
  averageRating: number
  totalReviews: number
  ratingBreakdown: Record<number, number>
  categoryAverages: {
    communication: number
    vehicleCondition: number
    professionalism: number
    overallExperience: number
  }
}

export interface VehicleReviewStats {
  averageRating: number
  totalReviews: number
  ratingBreakdown: Record<number, number>
}

/** Calculate user review stats: average, breakdown histogram, category averages */
export function calculateUserReviewStats(reviews: UserReviewInput[]): UserReviewStats {
  if (reviews.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      categoryAverages: {
        communication: 0,
        vehicleCondition: 0,
        professionalism: 0,
        overallExperience: 0,
      },
    }
  }

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0)
  const averageRating = totalRating / reviews.length

  const ratingBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const review of reviews) {
    const bucket = ratingBreakdown[review.rating]
    if (bucket !== undefined) {
      ratingBreakdown[review.rating] = bucket + 1
    }
  }

  const categoryTotals = {
    communication: 0,
    vehicleCondition: 0,
    professionalism: 0,
    overallExperience: 0,
  }
  const categoryCounts = {
    communication: 0,
    vehicleCondition: 0,
    professionalism: 0,
    overallExperience: 0,
  }

  for (const review of reviews) {
    if (review.communication) {
      categoryTotals.communication += review.communication
      categoryCounts.communication++
    }
    if (review.vehicleCondition) {
      categoryTotals.vehicleCondition += review.vehicleCondition
      categoryCounts.vehicleCondition++
    }
    if (review.professionalism) {
      categoryTotals.professionalism += review.professionalism
      categoryCounts.professionalism++
    }
    if (review.overallExperience) {
      categoryTotals.overallExperience += review.overallExperience
      categoryCounts.overallExperience++
    }
  }

  const categoryAverages = {
    communication:
      categoryCounts.communication > 0
        ? categoryTotals.communication / categoryCounts.communication
        : 0,
    vehicleCondition:
      categoryCounts.vehicleCondition > 0
        ? categoryTotals.vehicleCondition / categoryCounts.vehicleCondition
        : 0,
    professionalism:
      categoryCounts.professionalism > 0
        ? categoryTotals.professionalism / categoryCounts.professionalism
        : 0,
    overallExperience:
      categoryCounts.overallExperience > 0
        ? categoryTotals.overallExperience / categoryCounts.overallExperience
        : 0,
  }

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews: reviews.length,
    ratingBreakdown,
    categoryAverages,
  }
}

/** Calculate vehicle review stats: average + breakdown (no categories) */
export function calculateVehicleReviewStats(
  reviews: Array<{ rating: number }>
): VehicleReviewStats {
  if (reviews.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    }
  }

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0)
  const averageRating = totalRating / reviews.length

  const ratingBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const review of reviews) {
    const bucket = ratingBreakdown[review.rating]
    if (bucket !== undefined) {
      ratingBreakdown[review.rating] = bucket + 1
    }
  }

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews: reviews.length,
    ratingBreakdown,
  }
}
