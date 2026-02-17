import { v } from "convex/values"
import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import { getReviewResponseEmailTemplate, sendTransactionalEmail } from "./emails"
import { getWebUrl } from "./helpers"
import { calculateUserReviewStats, calculateVehicleReviewStats } from "./reviewStats"
import { sanitizeReview, sanitizeShortText } from "./sanitize"

// Get review by completion ID for current user
export const getByCompletion = query({
  args: {
    completionId: v.id("rentalCompletions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const review = await ctx.db
      .query("rentalReviews")
      .withIndex("by_rental_completion", (q) => q.eq("rentalCompletionId", args.completionId))
      .filter((q) => q.eq(q.field("reviewerId"), identity.subject))
      .first()

    if (!review) return null

    // Get related data
    const [vehicle, reviewer, reviewed, reservation] = await Promise.all([
      ctx.db.get(review.vehicleId),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", review.reviewerId))
        .first(),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", review.reviewedId))
        .first(),
      ctx.db.get(review.reservationId),
    ])

    return {
      ...review,
      vehicle,
      reviewer,
      reviewed,
      reservation,
    }
  },
})

// Get reviews for a user (as reviewer or reviewed)
export const getByUser = query({
  args: {
    userId: v.string(),
    role: v.union(v.literal("reviewer"), v.literal("reviewed")),
  },
  handler: async (ctx, args) => {
    const { userId, role } = args

    let reviewsQuery
    if (role === "reviewer") {
      reviewsQuery = ctx.db
        .query("rentalReviews")
        .withIndex("by_reviewer", (q) => q.eq("reviewerId", userId))
    } else {
      reviewsQuery = ctx.db
        .query("rentalReviews")
        .withIndex("by_reviewed", (q) => q.eq("reviewedId", userId))
    }

    const reviews = await reviewsQuery
      .filter((q) => q.eq(q.field("isPublic"), true))
      .order("desc")
      .collect()

    // Get related data
    const reviewsWithDetails = await Promise.all(
      reviews.map(async (review) => {
        const [vehicle, reviewer, reviewed, reservation] = await Promise.all([
          ctx.db.get(review.vehicleId),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", review.reviewerId))
            .first(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", review.reviewedId))
            .first(),
          ctx.db.get(review.reservationId),
        ])

        return {
          ...review,
          vehicle,
          reviewer,
          reviewed,
          reservation,
        }
      })
    )

    return reviewsWithDetails
  },
})

// Get reviews for a vehicle
export const getByVehicle = query({
  args: {
    vehicleId: v.id("vehicles"),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("rentalReviews")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .filter((q) => q.eq(q.field("isPublic"), true))
      .order("desc")
      .collect()

    // Get related data
    const reviewsWithDetails = await Promise.all(
      reviews.map(async (review) => {
        const [reviewer, reviewed, reservation] = await Promise.all([
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", review.reviewerId))
            .first(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", review.reviewedId))
            .first(),
          ctx.db.get(review.reservationId),
        ])

        return {
          ...review,
          reviewer,
          reviewed,
          reservation,
        }
      })
    )

    return reviewsWithDetails
  },
})

// Get reviews for a vehicle with pagination
export const getByVehiclePaginated = query({
  args: {
    vehicleId: v.id("vehicles"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10

    let reviewsQuery = ctx.db
      .query("rentalReviews")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .filter((q) => q.eq(q.field("isPublic"), true))
      .order("desc")

    if (args.cursor) {
      reviewsQuery = reviewsQuery.filter((q) =>
        q.lt(q.field("_id"), args.cursor as Id<"rentalReviews">)
      )
    }

    const reviews = await reviewsQuery.take(limit + 1)
    const hasMore = reviews.length > limit
    const paginatedReviews = hasMore ? reviews.slice(0, limit) : reviews

    // Get related data
    const reviewsWithDetails = await Promise.all(
      paginatedReviews.map(async (review) => {
        const [reviewer, reviewed] = await Promise.all([
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", review.reviewerId))
            .first(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", review.reviewedId))
            .first(),
        ])

        return {
          ...review,
          reviewer,
          reviewed,
        }
      })
    )

    return {
      reviews: reviewsWithDetails,
      hasMore,
      nextCursor: hasMore ? paginatedReviews.at(-1)?._id : null,
    }
  },
})

// Get review statistics for a user
export const getUserStats = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("rentalReviews")
      .withIndex("by_reviewed", (q) => q.eq("reviewedId", args.userId))
      .filter((q) => q.eq(q.field("isPublic"), true))
      .collect()

    return calculateUserReviewStats(reviews)
  },
})

// Get review statistics for a vehicle
export const getVehicleStats = query({
  args: {
    vehicleId: v.id("vehicles"),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("rentalReviews")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .filter((q) => q.eq(q.field("isPublic"), true))
      .collect()

    return calculateVehicleReviewStats(reviews)
  },
})

// Get review statistics for multiple vehicles (batch query for efficiency)
export const getVehicleStatsBatch = query({
  args: {
    vehicleIds: v.array(v.id("vehicles")),
  },
  handler: async (ctx, args) => {
    if (args.vehicleIds.length === 0) {
      return {}
    }

    // Get all reviews for all vehicles in one query
    const allReviews = await ctx.db
      .query("rentalReviews")
      .filter((q) =>
        q.and(
          q.or(...args.vehicleIds.map((id) => q.eq(q.field("vehicleId"), id))),
          q.eq(q.field("isPublic"), true)
        )
      )
      .collect()

    // Group reviews by vehicle ID
    const reviewsByVehicle = new Map<string, typeof allReviews>()
    allReviews.forEach((review) => {
      const vehicleId = review.vehicleId
      if (!reviewsByVehicle.has(vehicleId)) {
        reviewsByVehicle.set(vehicleId, [])
      }
      reviewsByVehicle.get(vehicleId)?.push(review)
    })

    // Calculate stats for each vehicle
    const statsMap: Record<string, { averageRating: number; totalReviews: number }> = {}

    args.vehicleIds.forEach((vehicleId) => {
      const reviews = reviewsByVehicle.get(vehicleId) || []
      const stats = calculateVehicleReviewStats(reviews)
      statsMap[vehicleId] = {
        averageRating: stats.averageRating,
        totalReviews: stats.totalReviews,
      }
    })

    return statsMap
  },
})

// Submit a review response
export const submitResponse = mutation({
  args: {
    reviewId: v.id("rentalReviews"),
    response: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const review = await ctx.db.get(args.reviewId)
    if (!review) {
      throw new Error("Review not found")
    }

    if (review.reviewedId !== identity.subject) {
      throw new Error("Not authorized to respond to this review")
    }

    if (review.response) {
      throw new Error("Response already submitted for this review")
    }

    await ctx.db.patch(args.reviewId, {
      response: {
        text: sanitizeReview(args.response),
        respondedAt: Date.now(),
      },
      updatedAt: Date.now(),
    })

    // Send email to reviewer about review response
    try {
      const [vehicle, reviewer, reviewed] = await Promise.all([
        ctx.db.get(review.vehicleId),
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", review.reviewerId))
          .first(),
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", review.reviewedId))
          .first(),
      ])

      if (vehicle && reviewer?.email && reviewed) {
        const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        const webUrl = getWebUrl()
        const template = getReviewResponseEmailTemplate({
          reviewerName: reviewer.name || "Guest",
          reviewedName: reviewed.name || "Guest",
          vehicleName,
          reviewUrl: `${webUrl}/profile`,
        })
        await sendTransactionalEmail(ctx, reviewer.email, template)
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logError } = require("./logger")
      logError(error, "Failed to send review response email")
      // Don't fail the mutation if email fails
    }

    return args.reviewId
  },
})

// Update user rating when a new review is submitted
export const updateUserRating = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("rentalReviews")
      .withIndex("by_reviewed", (q) => q.eq("reviewedId", args.userId))
      .filter((q) => q.eq(q.field("isPublic"), true))
      .collect()

    if (reviews.length === 0) {
      // Remove rating if no reviews
      await ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", args.userId))
        .first()
        .then((user) => {
          if (user) {
            ctx.db.patch(user._id, { rating: undefined })
          }
        })
      return
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0)
    const averageRating = totalRating / reviews.length

    // Update user's rating
    const user = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.userId))
      .first()

    if (user) {
      await ctx.db.patch(user._id, {
        rating: Math.round(averageRating * 10) / 10,
      })
    }

    return averageRating
  },
})

// Get reviews that need response from user
export const getPendingResponses = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("rentalReviews")
      .withIndex("by_reviewed", (q) => q.eq("reviewedId", args.userId))
      .filter((q) => q.and(q.eq(q.field("isPublic"), true), q.eq(q.field("response"), undefined)))
      .order("desc")
      .collect()

    // Get related data
    const reviewsWithDetails = await Promise.all(
      reviews.map(async (review) => {
        const [vehicle, reviewer, reservation] = await Promise.all([
          ctx.db.get(review.vehicleId),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", review.reviewerId))
            .first(),
          ctx.db.get(review.reservationId),
        ])

        return {
          ...review,
          vehicle,
          reviewer,
          reservation,
        }
      })
    )

    return reviewsWithDetails
  },
})

// Update a review (only by reviewer)
export const updateReview = mutation({
  args: {
    reviewId: v.id("rentalReviews"),
    rating: v.number(),
    communication: v.optional(v.number()),
    vehicleCondition: v.optional(v.number()),
    professionalism: v.optional(v.number()),
    overallExperience: v.optional(v.number()),
    title: v.string(),
    review: v.string(),
    photos: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const existingReview = await ctx.db.get(args.reviewId)
    if (!existingReview) {
      throw new Error("Review not found")
    }

    if (existingReview.reviewerId !== identity.subject) {
      throw new Error("Not authorized to update this review")
    }

    await ctx.db.patch(args.reviewId, {
      rating: args.rating,
      communication: args.communication,
      vehicleCondition: args.vehicleCondition,
      professionalism: args.professionalism,
      overallExperience: args.overallExperience,
      title: sanitizeShortText(args.title),
      review: sanitizeReview(args.review),
      photos: args.photos,
      updatedAt: Date.now(),
    })

    // Update the reviewed user's rating via scheduler
    await ctx.scheduler.runAfter(0, api.reviews.updateUserRating, {
      userId: existingReview.reviewedId,
    })

    return args.reviewId
  },
})

// Get review by ID for current user
export const getById = query({
  args: {
    reviewId: v.id("rentalReviews"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const review = await ctx.db.get(args.reviewId)
    if (!review) {
      return null
    }

    // Only return if user is the reviewer
    if (review.reviewerId !== identity.subject) {
      return null
    }

    // Get related data
    const [vehicle, reviewer, reviewed, reservation] = await Promise.all([
      ctx.db.get(review.vehicleId),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", review.reviewerId))
        .first(),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", review.reviewedId))
        .first(),
      ctx.db.get(review.reservationId),
    ])

    return {
      ...review,
      vehicle,
      reviewer,
      reviewed,
      reservation,
    }
  },
})

// Delete a review (only by reviewer)
export const deleteReview = mutation({
  args: {
    reviewId: v.id("rentalReviews"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const review = await ctx.db.get(args.reviewId)
    if (!review) {
      throw new Error("Review not found")
    }

    if (review.reviewerId !== identity.subject) {
      throw new Error("Not authorized to delete this review")
    }

    const reviewedId = review.reviewedId
    await ctx.db.delete(args.reviewId)

    // Update user rating after deletion
    await ctx.scheduler.runAfter(0, api.reviews.updateUserRating, {
      userId: reviewedId,
    })

    return args.reviewId
  },
})
