import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { internalMutation, mutation, query } from "./_generated/server"
import { checkAdmin } from "./admin"
import { ErrorCode, throwError } from "./errors"
import { rateLimiter } from "./rateLimiter"
import { calculateCoachReviewStats } from "./reviewStats"
import { sanitizeReview, sanitizeShortText } from "./sanitize"
import { publicDisplayName } from "./userProfile"

function validateScore(label: string, value?: number) {
  if (value === undefined) return
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throwError(ErrorCode.INVALID_INPUT, `${label} must be a whole number between 1 and 5`)
  }
}

export const submitReview = mutation({
  args: {
    bookingId: v.id("coachingBookings"),
    rating: v.number(),
    communication: v.optional(v.number()),
    knowledge: v.optional(v.number()),
    value: v.optional(v.number()),
    title: v.string(),
    review: v.string(),
    photos: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    await rateLimiter.limit(ctx, "createReview", { key: identity.subject, throws: true })

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throwError(ErrorCode.NOT_FOUND, "Booking not found")
    }
    if (booking.renterId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Only the renter who took the session can review it")
    }
    if (booking.status !== "completed") {
      throwError(ErrorCode.INVALID_STATUS, "You can only review a completed session")
    }

    // No coaching-specific ownership-bound photo upload flow exists yet.
    // Existing review photos remain readable; new reviews can be text-only.
    if (args.photos?.length) {
      throwError(
        ErrorCode.INVALID_INPUT,
        "Photo attachments are not supported for coaching reviews"
      )
    }

    // One review per booking
    const existing = await ctx.db
      .query("coachingReviews")
      .withIndex("by_booking", (q) => q.eq("coachingBookingId", args.bookingId))
      .first()
    if (existing) {
      throwError(ErrorCode.ALREADY_EXISTS, "You have already reviewed this session")
    }

    validateScore("Rating", args.rating)
    if (args.rating === undefined) {
      throwError(ErrorCode.INVALID_INPUT, "Rating is required")
    }
    validateScore("Communication", args.communication)
    validateScore("Knowledge", args.knowledge)
    validateScore("Value", args.value)

    if (!args.title.trim()) {
      throwError(ErrorCode.INVALID_INPUT, "Title is required")
    }
    if (!args.review.trim()) {
      throwError(ErrorCode.INVALID_INPUT, "Review is required")
    }

    const now = Date.now()
    const reviewId = await ctx.db.insert("coachingReviews", {
      coachingBookingId: args.bookingId,
      coachProfileId: booking.coachProfileId,
      coachUserId: booking.coachUserId,
      reviewerId: identity.subject,
      rating: args.rating,
      communication: args.communication,
      knowledge: args.knowledge,
      value: args.value,
      title: sanitizeShortText(args.title),
      review: sanitizeReview(args.review),
      photos: args.photos,
      isPublic: true,
      isModerated: false,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.scheduler.runAfter(0, internal.coachingReviews.recalcCoachRating, {
      coachProfileId: booking.coachProfileId,
    })

    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: booking.coachUserId,
      type: "review_received",
      title: "New coaching review",
      message: "A driver left a review of their session with you.",
      link: "/coach/dashboard",
      metadata: { bookingId: args.bookingId, reviewId },
    })

    return reviewId
  },
})

// Recompute and cache the coach profile's aggregate rating + review count from
// public reviews. Mirrors reviews.ts:updateUserRating.
export const recalcCoachRating = internalMutation({
  args: { coachProfileId: v.id("coachProfiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.coachProfileId)
    if (!profile) return

    const reviews = await ctx.db
      .query("coachingReviews")
      .withIndex("by_coach_profile", (q) => q.eq("coachProfileId", args.coachProfileId))
      .filter((q) => q.eq(q.field("isPublic"), true))
      .collect()

    const stats = calculateCoachReviewStats(reviews)
    await ctx.db.patch(args.coachProfileId, {
      rating: stats.totalReviews > 0 ? stats.averageRating : undefined,
      reviewCount: stats.totalReviews,
      updatedAt: Date.now(),
    })
  },
})

async function enrichReview(ctx: any, review: Doc<"coachingReviews">) {
  const reviewer = await ctx.db
    .query("users")
    .withIndex("by_external_id", (q: any) => q.eq("externalId", review.reviewerId))
    .first()
  return {
    ...review,
    reviewer: reviewer
      ? {
          name: publicDisplayName(reviewer),
          avatarUrl: reviewer.profileImage as string | undefined,
        }
      : { name: "Driver", avatarUrl: undefined as string | undefined },
  }
}

export const getByCoach = query({
  args: { coachProfileId: v.id("coachProfiles") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("coachingReviews")
      .withIndex("by_coach_profile", (q) => q.eq("coachProfileId", args.coachProfileId))
      .filter((q) => q.eq(q.field("isPublic"), true))
      .order("desc")
      .collect()

    const stats = calculateCoachReviewStats(reviews)
    const enriched = await Promise.all(reviews.map((r) => enrichReview(ctx, r)))
    return { reviews: enriched, stats }
  },
})

export const getByCoachPaginated = query({
  args: {
    coachProfileId: v.id("coachProfiles"),
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("coachingReviews")
      .withIndex("by_coach_profile", (q) => q.eq("coachProfileId", args.coachProfileId))
      .filter((q) => q.eq(q.field("isPublic"), true))
      .order("desc")
      .paginate(args.paginationOpts)

    const page = await Promise.all(result.page.map((r) => enrichReview(ctx, r)))
    return { ...result, page }
  },
})

// Returns the current user's review for a booking, if any (drives "edit" vs "leave" CTA).
export const getByBooking = query({
  args: { bookingId: v.id("coachingBookings") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("coachingReviews")
      .withIndex("by_booking", (q) => q.eq("coachingBookingId", args.bookingId))
      .first(),
})

// -------- Admin moderation (mirrors rental review moderation) --------

export const getAllCoachingReviews = query({
  args: {
    isPublic: v.optional(v.boolean()),
    isModerated: v.optional(v.boolean()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)
    let reviews = await ctx.db
      .query("coachingReviews")
      .order("desc")
      .take(args.limit ?? 100)

    if (args.isPublic !== undefined) {
      reviews = reviews.filter((r) => r.isPublic === args.isPublic)
    }
    if (args.isModerated !== undefined) {
      reviews = reviews.filter((r) => r.isModerated === args.isModerated)
    }

    const enriched = await Promise.all(
      reviews.map(async (r) => {
        const [withReviewer, profile] = await Promise.all([
          enrichReview(ctx, r),
          ctx.db.get(r.coachProfileId),
        ])
        return { ...withReviewer, coachHeadline: profile?.headline ?? profile?.location }
      })
    )

    if (args.search) {
      const term = args.search.toLowerCase()
      return enriched.filter(
        (r) =>
          r.title.toLowerCase().includes(term) ||
          r.review.toLowerCase().includes(term) ||
          r.reviewer.name?.toLowerCase().includes(term)
      )
    }
    return enriched
  },
})

export const toggleCoachingReviewVisibility = mutation({
  args: { reviewId: v.id("coachingReviews") },
  handler: async (ctx, args) => {
    const identity = await checkAdmin(ctx)
    const review = await ctx.db.get(args.reviewId)
    if (!review) {
      throwError(ErrorCode.NOT_FOUND, "Review not found")
    }
    const nextPublic = !review.isPublic
    await ctx.db.patch(args.reviewId, { isPublic: nextPublic, updatedAt: Date.now() })

    await ctx.runMutation(internal.auditLog.create, {
      entityType: "coaching_review",
      entityId: args.reviewId,
      action: "toggle_coaching_review_visibility",
      userId: identity.subject,
      previousState: { isPublic: review.isPublic },
      newState: { isPublic: nextPublic },
    })

    // Hiding/showing changes the aggregate, so recompute.
    await ctx.scheduler.runAfter(0, internal.coachingReviews.recalcCoachRating, {
      coachProfileId: review.coachProfileId,
    })
    return nextPublic
  },
})

export const markCoachingReviewModerated = mutation({
  args: { reviewId: v.id("coachingReviews") },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)
    const review = await ctx.db.get(args.reviewId)
    if (!review) {
      throwError(ErrorCode.NOT_FOUND, "Review not found")
    }
    await ctx.db.patch(args.reviewId, {
      isModerated: true,
      moderatedAt: Date.now(),
      updatedAt: Date.now(),
    })
    return args.reviewId
  },
})

export const deleteCoachingReviewAsAdmin = mutation({
  args: { reviewId: v.id("coachingReviews") },
  handler: async (ctx, args) => {
    const identity = await checkAdmin(ctx)
    const review = await ctx.db.get(args.reviewId)
    if (!review) {
      throwError(ErrorCode.NOT_FOUND, "Review not found")
    }
    await ctx.db.delete(args.reviewId)

    await ctx.runMutation(internal.auditLog.create, {
      entityType: "coaching_review",
      entityId: args.reviewId,
      action: "delete_coaching_review",
      userId: identity.subject,
      previousState: { rating: review.rating, coachProfileId: review.coachProfileId },
      newState: null,
    })

    await ctx.scheduler.runAfter(0, internal.coachingReviews.recalcCoachRating, {
      coachProfileId: review.coachProfileId,
    })
    return true
  },
})
