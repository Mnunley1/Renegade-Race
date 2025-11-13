import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

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
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const { limit = 100, search } = args

    const usersQuery = ctx.db.query("users")

    // If search provided, we'll filter after fetching (Convex doesn't support full-text search easily)
    const allUsers = await usersQuery.order("desc").take(limit * 2) // Fetch more to account for filtering

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

    return filteredUsers.slice(0, limit)
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
