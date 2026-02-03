import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// Block a user
export const blockUser = mutation({
  args: {
    blockedUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const blockerId = identity.subject

    // Prevent self-blocking
    if (blockerId === args.blockedUserId) {
      throw new Error("Cannot block yourself")
    }

    // Check if block already exists
    const existingBlock = await ctx.db
      .query("userBlocks")
      .withIndex("by_blocker_blocked", (q) =>
        q.eq("blockerId", blockerId).eq("blockedUserId", args.blockedUserId)
      )
      .first()

    if (existingBlock) {
      return existingBlock._id
    }

    // Create the block
    const blockId = await ctx.db.insert("userBlocks", {
      blockerId,
      blockedUserId: args.blockedUserId,
      createdAt: Date.now(),
    })

    return blockId
  },
})

// Unblock a user
export const unblockUser = mutation({
  args: {
    blockedUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const blockerId = identity.subject

    // Find the block
    const block = await ctx.db
      .query("userBlocks")
      .withIndex("by_blocker_blocked", (q) =>
        q.eq("blockerId", blockerId).eq("blockedUserId", args.blockedUserId)
      )
      .first()

    if (!block) {
      throw new Error("Block not found")
    }

    // Delete the block
    await ctx.db.delete(block._id)

    return block._id
  },
})

// Get blocked users list
export const getBlockedUsers = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    // Verify the authenticated user matches the userId
    if (identity.subject !== args.userId) {
      throw new Error("Unauthorized: Cannot access other users' data")
    }

    const blocks = await ctx.db
      .query("userBlocks")
      .withIndex("by_blocker", (q) => q.eq("blockerId", args.userId))
      .collect()

    // Get user details for each blocked user
    const blockedUsersWithDetails = await Promise.all(
      blocks.map(async (block) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", block.blockedUserId))
          .first()

        return {
          ...block,
          user,
        }
      })
    )

    return blockedUsersWithDetails
  },
})

// Check if a user is blocked (bidirectional check)
export const isBlocked = query({
  args: {
    userId: v.string(),
    otherUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if userId has blocked otherUserId
    const block1 = await ctx.db
      .query("userBlocks")
      .withIndex("by_blocker_blocked", (q) =>
        q.eq("blockerId", args.userId).eq("blockedUserId", args.otherUserId)
      )
      .first()

    // Check if otherUserId has blocked userId
    const block2 = await ctx.db
      .query("userBlocks")
      .withIndex("by_blocker_blocked", (q) =>
        q.eq("blockerId", args.otherUserId).eq("blockedUserId", args.userId)
      )
      .first()

    return !!(block1 || block2)
  },
})
