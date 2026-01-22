import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import type { Id } from "./_generated/dataModel"

// Helper function to check if user is admin via Clerk metadata
// biome-ignore lint: ctx type is provided by Convex
async function checkAdmin(ctx: any) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error("Not authenticated")
  }

  const role = (identity as Record<string, unknown> & { metadata: { role: string } }).metadata?.role

  if (role !== "admin") {
    throw new Error("Admin access required")
  }

  return identity
}

// Check if current user is admin
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    try {
      await checkAdmin(ctx)
      return true
    } catch {
      return false
    }
  },
})

// Get all users for admin management
export const getAllUsers = query({
  args: {
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const { limit = 50, search, cursor } = args

    const usersQuery = ctx.db.query("users")

    // If search provided, we'll filter after fetching (Convex doesn't support full-text search easily)
    let allUsers = await usersQuery.order("desc").take(limit + 1)

    // Apply cursor-based pagination
    if (cursor) {
      allUsers = allUsers.filter((u) => u._id < (cursor as Id<"users">))
    }

    let filteredUsers = allUsers

    if (search) {
      const searchLower = search.toLowerCase()
      filteredUsers = allUsers.filter(
        (user) =>
          user.name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.externalId?.toLowerCase().includes(searchLower)
      )
    }

    const filtered = filteredUsers.slice(0, limit)
    const finalHasMore = allUsers.length > limit

    return {
      users: filtered,
      hasMore: finalHasMore,
      nextCursor: finalHasMore && filtered.length > 0 ? filtered[filtered.length - 1]._id : null,
    }
  },
})

// Ban a user
export const banUser = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error("User not found")
    }

    await ctx.db.patch(args.userId, {
      isBanned: true,
    })

    return args.userId
  },
})

// Unban a user
export const unbanUser = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error("User not found")
    }

    await ctx.db.patch(args.userId, {
      isBanned: false,
    })

    return args.userId
  },
})

// Get all disputes for admin view
export const getAllDisputes = query({
  args: {
    status: v.optional(v.union(v.literal("open"), v.literal("resolved"), v.literal("closed"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const { status, limit = 50 } = args

    const disputes = status
      ? await ctx.db
          .query("disputes")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .take(limit)
      : await ctx.db.query("disputes").order("desc").take(limit)

    // Get related data for each dispute
    const disputesWithDetails = await Promise.all(
      disputes.map(async (dispute) => {
        const [completion, reservation, vehicle, renter, owner] = await Promise.all([
          ctx.db.get(dispute.completionId),
          ctx.db.get(dispute.reservationId),
          ctx.db.get(dispute.vehicleId),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", dispute.renterId))
            .first(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", dispute.ownerId))
            .first(),
        ])

        return {
          ...dispute,
          completion,
          reservation,
          vehicle,
          renter,
          owner,
        }
      })
    )

    return disputesWithDetails
  },
})

// Resolve dispute as admin
export const resolveDisputeAsAdmin = mutation({
  args: {
    disputeId: v.id("disputes"),
    resolution: v.string(),
    resolutionType: v.union(
      v.literal("resolved_in_favor_renter"),
      v.literal("resolved_in_favor_owner"),
      v.literal("resolved_compromise"),
      v.literal("dismissed")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await checkAdmin(ctx)

    const dispute = await ctx.db.get(args.disputeId)
    if (!dispute) {
      throw new Error("Dispute not found")
    }

    if (dispute.status !== "open") {
      throw new Error("Dispute is already resolved")
    }

    // Update dispute status
    await ctx.db.patch(args.disputeId, {
      status: "resolved",
      resolution: args.resolution,
      resolutionType: args.resolutionType,
      resolvedAt: Date.now(),
      resolvedBy: identity.subject, // Used here
      updatedAt: Date.now(),
    })

    // Update completion status back to completed if resolved
    if (args.resolutionType === "resolved_compromise" || args.resolutionType === "dismissed") {
      await ctx.db.patch(dispute.completionId, {
        status: "completed",
        updatedAt: Date.now(),
      })
    }

    return args.disputeId
  },
})

// Send admin message to a user (creates a system message)
export const sendAdminMessage = mutation({
  args: {
    userId: v.string(), // externalId of the user
    content: v.string(),
    vehicleId: v.optional(v.id("vehicles")),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx) // Verify admin access

    // Find or create a conversation between admin and user
    // For admin messages, we'll create a special system conversation
    // First, find if user exists
    const user = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.userId))
      .first()

    if (!user) {
      throw new Error("User not found")
    }

    // For admin messages, we'll use a special approach:
    // Create a system message that can be displayed in the user's inbox
    // This is a simplified version - in production you might want a dedicated admin messages table

    // For now, we'll create a conversation if vehicleId is provided, otherwise we'll need
    // a different approach. Let's create a system message that can be retrieved separately
    // This is a placeholder - you may want to enhance the messages system to support admin messages

    return { success: true, message: "Admin message functionality to be implemented" }
  },
})

// Get platform statistics for admin dashboard
export const getPlatformStats = query({
  args: {},
  handler: async (ctx) => {
    await checkAdmin(ctx)

    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

    // Get all users
    const allUsers = await ctx.db.query("users").collect()
    const totalUsers = allUsers.length
    const bannedUsers = allUsers.filter((u) => u.isBanned === true).length
    const activeUsers = totalUsers - bannedUsers

    // Get users created in last 30 days
    const recentUsers = allUsers.filter((u) => u.createdAt >= thirtyDaysAgo).length

    // Get all vehicles
    const allVehicles = await ctx.db.query("vehicles").collect()
    const totalVehicles = allVehicles.length
    const pendingVehicles = allVehicles.filter((v) => v.status === "pending").length
    const approvedVehicles = allVehicles.filter((v) => v.status === "approved").length
    const activeVehicles = allVehicles.filter((v) => v.status === "approved" && v.isActive !== false).length

    // Get all reservations
    const allReservations = await ctx.db.query("reservations").collect()
    const totalReservations = allReservations.length
    const pendingReservations = allReservations.filter((r) => r.status === "pending").length
    const confirmedReservations = allReservations.filter((r) => r.status === "confirmed").length
    const completedReservations = allReservations.filter((r) => r.status === "completed").length
    const cancelledReservations = allReservations.filter((r) => r.status === "cancelled").length

    // Get reservations created in last 30 days
    const recentReservations = allReservations.filter((r) => r.createdAt >= thirtyDaysAgo).length

    // Calculate revenue (from confirmed and completed reservations)
    const revenueReservations = allReservations.filter(
      (r) => r.status === "confirmed" || r.status === "completed"
    )
    const totalRevenue = revenueReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
    const revenueLast30Days = revenueReservations
      .filter((r) => r.createdAt >= thirtyDaysAgo)
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0)
    const revenueLast7Days = revenueReservations
      .filter((r) => r.createdAt >= sevenDaysAgo)
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0)

    // Get all disputes
    const allDisputes = await ctx.db.query("disputes").collect()
    const openDisputes = allDisputes.filter((d) => d.status === "open").length
    const resolvedDisputes = allDisputes.filter((d) => d.status === "resolved").length

    // Get all reviews
    const allReviews = await ctx.db.query("rentalReviews").collect()
    const totalReviews = allReviews.length
    const publicReviews = allReviews.filter((r) => r.isPublic === true).length

    // Get all tracks
    const allTracks = await ctx.db.query("tracks").collect()
    const activeTracks = allTracks.filter((t) => t.isActive !== false).length

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        banned: bannedUsers,
        recent: recentUsers,
      },
      vehicles: {
        total: totalVehicles,
        pending: pendingVehicles,
        approved: approvedVehicles,
        active: activeVehicles,
      },
      reservations: {
        total: totalReservations,
        pending: pendingReservations,
        confirmed: confirmedReservations,
        completed: completedReservations,
        cancelled: cancelledReservations,
        recent: recentReservations,
      },
      revenue: {
        total: totalRevenue,
        last30Days: revenueLast30Days,
        last7Days: revenueLast7Days,
      },
      disputes: {
        open: openDisputes,
        resolved: resolvedDisputes,
        total: allDisputes.length,
      },
      reviews: {
        total: totalReviews,
        public: publicReviews,
      },
      tracks: {
        total: allTracks.length,
        active: activeTracks,
      },
    }
  },
})

// Get all reservations for admin management
export const getAllReservations = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("cancelled"),
        v.literal("completed"),
        v.literal("declined")
      )
    ),
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const { status, limit = 50, search, startDate, endDate, cursor } = args

    let reservationsQuery = ctx.db.query("reservations")

    if (status) {
      reservationsQuery = reservationsQuery.withIndex("by_status", (q) => q.eq("status", status))
    }

    let reservations = await reservationsQuery.order("desc").take(limit + 1)

    // Apply cursor-based pagination
    if (cursor) {
      reservations = reservations.filter((r) => r._id < (cursor as Id<"reservations">))
    }

    // Filter by date range if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).getTime() : 0
      const end = endDate ? new Date(endDate).getTime() : Date.now()
      reservations = reservations.filter((r) => {
        const reservationDate = new Date(r.startDate).getTime()
        return reservationDate >= start && reservationDate <= end
      })
    }

    const hasMore = reservations.length > limit
    const paginatedReservations = hasMore ? reservations.slice(0, limit) : reservations

    // Get related data for each reservation
    const reservationsWithDetails = await Promise.all(
      paginatedReservations.map(async (reservation) => {
        const [vehicle, renter, owner] = await Promise.all([
          ctx.db.get(reservation.vehicleId),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", reservation.renterId))
            .first(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", reservation.ownerId))
            .first(),
        ])

        // Get vehicle images if vehicle exists
        let vehicleWithImages = vehicle
        if (vehicle) {
          const images = await ctx.db
            .query("vehicleImages")
            .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicle._id))
            .order("asc")
            .collect()

          vehicleWithImages = {
            ...vehicle,
            images,
          } as typeof vehicle & { images: typeof images }
        }

        return {
          ...reservation,
          vehicle: vehicleWithImages,
          renter,
          owner,
        }
      })
    )

    // Filter by search if provided
    let filteredReservations = reservationsWithDetails
    if (search) {
      const searchLower = search.toLowerCase()
      filteredReservations = reservationsWithDetails.filter(
        (r) =>
          r.renter?.name?.toLowerCase().includes(searchLower) ||
          r.owner?.name?.toLowerCase().includes(searchLower) ||
          r.renter?.email?.toLowerCase().includes(searchLower) ||
          r.owner?.email?.toLowerCase().includes(searchLower) ||
          r.vehicle?.make?.toLowerCase().includes(searchLower) ||
          r.vehicle?.model?.toLowerCase().includes(searchLower) ||
          r._id.includes(searchLower)
      )
    }

    const filtered = filteredReservations.slice(0, limit)
    const finalHasMore = filteredReservations.length > limit

    return {
      reservations: filtered,
      hasMore: finalHasMore,
      nextCursor: finalHasMore && filtered.length > 0 ? filtered[filtered.length - 1]._id : null,
    }
  },
})

// Cancel reservation as admin (admin override)
export const cancelReservationAsAdmin = mutation({
  args: {
    reservationId: v.id("reservations"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const reservation = await ctx.db.get(args.reservationId)
    if (!reservation) {
      throw new Error("Reservation not found")
    }

    if (reservation.status === "cancelled") {
      throw new Error("Reservation is already cancelled")
    }

    if (reservation.status === "completed") {
      throw new Error("Cannot cancel a completed reservation")
    }

    // Update reservation status
    await ctx.db.patch(args.reservationId, {
      status: "cancelled",
      updatedAt: Date.now(),
    })

    return args.reservationId
  },
})

// Get all reviews for admin management
export const getAllReviews = query({
  args: {
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    isModerated: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const { limit = 50, search, isPublic, isModerated, cursor } = args

    let reviewsQuery = ctx.db.query("rentalReviews")

    if (isPublic !== undefined) {
      reviewsQuery = reviewsQuery.withIndex("by_public", (q) => q.eq("isPublic", isPublic))
    }

    let reviews = await reviewsQuery.order("desc").take(limit + 1)

    // Apply cursor-based pagination
    if (cursor) {
      reviews = reviews.filter((r) => r._id < (cursor as Id<"rentalReviews">))
    }

    const hasMore = reviews.length > limit
    const paginatedReviews = hasMore ? reviews.slice(0, limit) : reviews

    // Get related data for each review
    const reviewsWithDetails = await Promise.all(
      paginatedReviews.map(async (review) => {
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

    // Filter by moderation status if provided
    let filteredReviews = reviewsWithDetails
    if (isModerated !== undefined) {
      filteredReviews = filteredReviews.filter((r) => r.isModerated === isModerated)
    }

    // Filter by search if provided
    if (search) {
      const searchLower = search.toLowerCase()
      filteredReviews = filteredReviews.filter(
        (r) =>
          r.reviewer?.name?.toLowerCase().includes(searchLower) ||
          r.reviewed?.name?.toLowerCase().includes(searchLower) ||
          r.title?.toLowerCase().includes(searchLower) ||
          r.review?.toLowerCase().includes(searchLower) ||
          r.vehicle?.make?.toLowerCase().includes(searchLower) ||
          r.vehicle?.model?.toLowerCase().includes(searchLower) ||
          r._id.includes(searchLower)
      )
    }

    const filtered = filteredReviews.slice(0, limit)
    const finalHasMore = filteredReviews.length > limit

    return {
      reviews: filtered,
      hasMore: finalHasMore,
      nextCursor: finalHasMore && filtered.length > 0 ? filtered[filtered.length - 1]._id : null,
    }
  },
})

// Delete review as admin
export const deleteReviewAsAdmin = mutation({
  args: {
    reviewId: v.id("rentalReviews"),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const review = await ctx.db.get(args.reviewId)
    if (!review) {
      throw new Error("Review not found")
    }

    const reviewedId = review.reviewedId
    await ctx.db.delete(args.reviewId)

    // Update user rating after deletion
    const { api } = await import("./_generated/api")
    await ctx.scheduler.runAfter(0, api.reviews.updateUserRating, {
      userId: reviewedId,
    })

    return args.reviewId
  },
})

// Toggle review visibility (isPublic) as admin
export const toggleReviewVisibility = mutation({
  args: {
    reviewId: v.id("rentalReviews"),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const review = await ctx.db.get(args.reviewId)
    if (!review) {
      throw new Error("Review not found")
    }

    await ctx.db.patch(args.reviewId, {
      isPublic: args.isPublic,
      isModerated: true,
      moderatedAt: Date.now(),
      updatedAt: Date.now(),
    })

    return args.reviewId
  },
})

// Mark review as moderated
export const markReviewAsModerated = mutation({
  args: {
    reviewId: v.id("rentalReviews"),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const review = await ctx.db.get(args.reviewId)
    if (!review) {
      throw new Error("Review not found")
    }

    await ctx.db.patch(args.reviewId, {
      isModerated: true,
      moderatedAt: Date.now(),
      updatedAt: Date.now(),
    })

    return args.reviewId
  },
})

// Get all vehicles for admin management
export const getAllVehicles = query({
  args: {
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))
    ),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const { limit = 50, search, status, cursor } = args

    let vehiclesQuery = ctx.db.query("vehicles")

    if (status) {
      vehiclesQuery = vehiclesQuery.withIndex("by_status", (q) => q.eq("status", status))
    }

    let vehicles = await vehiclesQuery.order("desc").take(limit + 1)

    // Apply cursor-based pagination
    if (cursor) {
      vehicles = vehicles.filter((v) => v._id < (cursor as Id<"vehicles">))
    }

    const hasMore = vehicles.length > limit
    const paginatedVehicles = hasMore ? vehicles.slice(0, limit) : vehicles

    // Get related data for each vehicle
    const vehiclesWithDetails = await Promise.all(
      paginatedVehicles.map(async (vehicle) => {
        const [owner, track, images] = await Promise.all([
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", vehicle.ownerId))
            .first(),
          vehicle.trackId ? ctx.db.get(vehicle.trackId) : Promise.resolve(undefined),
          ctx.db
            .query("vehicleImages")
            .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicle._id))
            .order("asc")
            .collect(),
        ])

        return {
          ...vehicle,
          owner,
          track,
          images,
        }
      })
    )

    // Filter by search if provided
    let filteredVehicles = vehiclesWithDetails
    if (search) {
      const searchLower = search.toLowerCase()
      filteredVehicles = vehiclesWithDetails.filter(
        (v) =>
          v.make?.toLowerCase().includes(searchLower) ||
          v.model?.toLowerCase().includes(searchLower) ||
          v.owner?.name?.toLowerCase().includes(searchLower) ||
          v.owner?.email?.toLowerCase().includes(searchLower) ||
          v.track?.name?.toLowerCase().includes(searchLower) ||
          v._id.includes(searchLower)
      )
    }

    const filtered = filteredVehicles.slice(0, limit)
    const finalHasMore = filteredVehicles.length > limit

    return {
      vehicles: filtered,
      hasMore: finalHasMore,
      nextCursor: finalHasMore && filtered.length > 0 ? filtered[filtered.length - 1]._id : null,
    }
  },
})

// Suspend/unsuspend vehicle as admin
export const suspendVehicle = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const vehicle = await ctx.db.get(args.vehicleId)
    if (!vehicle) {
      throw new Error("Vehicle not found")
    }

    await ctx.db.patch(args.vehicleId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    })

    return args.vehicleId
  },
})

// Bulk suspend/activate vehicles
export const bulkSuspendVehicles = mutation({
  args: {
    vehicleIds: v.array(v.id("vehicles")),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    await Promise.all(
      args.vehicleIds.map((vehicleId) =>
        ctx.db.patch(vehicleId, {
          isActive: args.isActive,
          updatedAt: Date.now(),
        })
      )
    )

    return args.vehicleIds.length
  },
})

// Bulk delete reviews
export const bulkDeleteReviews = mutation({
  args: {
    reviewIds: v.array(v.id("rentalReviews")),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const reviews = await Promise.all(
      args.reviewIds.map((id) => ctx.db.get(id))
    )

    const reviewedIds = new Set(
      reviews.filter((r) => r).map((r) => r!.reviewedId)
    )

    // Delete reviews
    await Promise.all(args.reviewIds.map((id) => ctx.db.delete(id)))

    // Update user ratings after deletion
    const { api } = await import("./_generated/api")
    await Promise.all(
      Array.from(reviewedIds).map((userId) =>
        ctx.scheduler.runAfter(0, api.reviews.updateUserRating, { userId })
      )
    )

    return args.reviewIds.length
  },
})

// Bulk toggle review visibility
export const bulkToggleReviewVisibility = mutation({
  args: {
    reviewIds: v.array(v.id("rentalReviews")),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    await Promise.all(
      args.reviewIds.map((reviewId) =>
        ctx.db.patch(reviewId, {
          isPublic: args.isPublic,
          isModerated: true,
          moderatedAt: Date.now(),
          updatedAt: Date.now(),
        })
      )
    )

    return args.reviewIds.length
  },
})

// Bulk mark reviews as moderated
export const bulkMarkReviewsAsModerated = mutation({
  args: {
    reviewIds: v.array(v.id("rentalReviews")),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    await Promise.all(
      args.reviewIds.map((reviewId) =>
        ctx.db.patch(reviewId, {
          isModerated: true,
          moderatedAt: Date.now(),
          updatedAt: Date.now(),
        })
      )
    )

    return args.reviewIds.length
  },
})

// Get all payments for admin management
export const getAllPayments = query({
  args: {
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("succeeded"),
        v.literal("failed"),
        v.literal("refunded")
      )
    ),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const { limit = 50, search, status, startDate, endDate, cursor } = args

    let paymentsQuery = ctx.db.query("payments")

    if (status) {
      paymentsQuery = paymentsQuery.withIndex("by_status", (q) => q.eq("status", status))
    }

    let payments = await paymentsQuery.order("desc").take(limit + 1)

    // Apply cursor-based pagination
    if (cursor) {
      payments = payments.filter((p) => p._id < (cursor as Id<"payments">))
    }

    // Filter by date range if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).getTime() : 0
      const end = endDate ? new Date(endDate).getTime() : Date.now()
      payments = payments.filter((p) => {
        const paymentDate = p.createdAt
        return paymentDate >= start && paymentDate <= end
      })
    }

    const hasMore = payments.length > limit
    const paginatedPayments = hasMore ? payments.slice(0, limit) : payments

    // Get related data for each payment
    const paymentsWithDetails = await Promise.all(
      paginatedPayments.map(async (payment) => {
        const [reservation, vehicle, renter, owner] = await Promise.all([
          ctx.db.get(payment.reservationId),
          payment.metadata?.vehicleId
            ? ctx.db.get(payment.metadata.vehicleId as Id<"vehicles">)
            : Promise.resolve(undefined),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", payment.renterId))
            .first(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", payment.ownerId))
            .first(),
        ])

        return {
          ...payment,
          reservation,
          vehicle,
          renter,
          owner,
        }
      })
    )

    // Filter by search if provided
    let filteredPayments = paymentsWithDetails
    if (search) {
      const searchLower = search.toLowerCase()
      filteredPayments = paymentsWithDetails.filter(
        (p) =>
          p.renter?.name?.toLowerCase().includes(searchLower) ||
          p.owner?.name?.toLowerCase().includes(searchLower) ||
          p.renter?.email?.toLowerCase().includes(searchLower) ||
          p.owner?.email?.toLowerCase().includes(searchLower) ||
          p.stripePaymentIntentId?.toLowerCase().includes(searchLower) ||
          p._id.includes(searchLower)
      )
    }

    const filtered = filteredPayments.slice(0, limit)
    const finalHasMore = filteredPayments.length > limit

    return {
      payments: filtered,
      hasMore: finalHasMore,
      nextCursor: finalHasMore && filtered.length > 0 ? filtered[filtered.length - 1]._id : null,
    }
  },
})

// Get reservations for a specific vehicle (admin)
export const getVehicleReservations = query({
  args: {
    vehicleId: v.id("vehicles"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const { vehicleId, limit = 50 } = args

    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicleId))
      .order("desc")
      .take(limit)

    const reservationsWithDetails = await Promise.all(
      reservations.map(async (reservation) => {
        const [renter, owner] = await Promise.all([
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", reservation.renterId))
            .first(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", reservation.ownerId))
            .first(),
        ])

        return {
          ...reservation,
          renter,
          owner,
        }
      })
    )

    return reservationsWithDetails
  },
})

// Get user detail data for admin
export const getUserDetail = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error("User not found")
    }

    // Get user's reservations (as renter and owner)
    const [renterReservations, ownerReservations] = await Promise.all([
      ctx.db
        .query("reservations")
        .withIndex("by_renter", (q) => q.eq("renterId", user.externalId))
        .order("desc")
        .take(50)
        .collect(),
      ctx.db
        .query("reservations")
        .withIndex("by_owner", (q) => q.eq("ownerId", user.externalId))
        .order("desc")
        .take(50)
        .collect(),
    ])

    // Get user's vehicles
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_owner", (q) => q.eq("ownerId", user.externalId))
      .order("desc")
      .collect()

    // Get reviews given and received
    const [reviewsGiven, reviewsReceived] = await Promise.all([
      ctx.db
        .query("rentalReviews")
        .withIndex("by_reviewer", (q) => q.eq("reviewerId", user.externalId))
        .order("desc")
        .take(50)
        .collect(),
      ctx.db
        .query("rentalReviews")
        .withIndex("by_reviewed", (q) => q.eq("reviewedId", user.externalId))
        .order("desc")
        .take(50)
        .collect(),
    ])

    // Get disputes involved in
    const disputes = await ctx.db
      .query("disputes")
      .filter((q) =>
        q.or(
          q.eq(q.field("renterId"), user.externalId),
          q.eq(q.field("ownerId"), user.externalId)
        )
      )
      .order("desc")
      .take(50)
      .collect()

    // Get payments
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_renter", (q) => q.eq("renterId", user.externalId))
      .order("desc")
      .take(50)
      .collect()

    return {
      user,
      renterReservations: renterReservations.length,
      ownerReservations: ownerReservations.length,
      totalReservations: renterReservations.length + ownerReservations.length,
      vehicles: vehicles.length,
      reviewsGiven: reviewsGiven.length,
      reviewsReceived: reviewsReceived.length,
      disputes: disputes.length,
      payments: payments.length,
    }
  },
})
