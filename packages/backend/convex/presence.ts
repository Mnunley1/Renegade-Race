import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// Set typing state for a user in a conversation
export const setTyping = mutation({
  args: {
    conversationId: v.id("conversations"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject
    const now = Date.now()

    // Verify conversation exists and user is part of it
    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation) {
      throw new Error("Conversation not found")
    }

    if (conversation.renterId !== userId && conversation.ownerId !== userId) {
      throw new Error("Not authorized to update presence in this conversation")
    }

    // Check if presence record exists
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", userId)
      )
      .first()

    if (existing) {
      // Update existing presence
      await ctx.db.patch(existing._id, {
        isTyping: args.isTyping,
        lastSeen: now,
        updatedAt: now,
      })
    } else {
      // Create new presence record
      await ctx.db.insert("presence", {
        conversationId: args.conversationId,
        userId,
        isTyping: args.isTyping,
        lastSeen: now,
        updatedAt: now,
      })
    }

    return { success: true }
  },
})

// Get users who are typing in a conversation (excluding self)
export const getTypingUsers = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    const userId = identity.subject
    const now = Date.now()
    const TYPING_TIMEOUT_MS = 5000 // 5 seconds

    // Verify conversation exists and user is part of it
    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation) {
      return []
    }

    if (conversation.renterId !== userId && conversation.ownerId !== userId) {
      return []
    }

    // Get all presence records for this conversation
    const presenceRecords = await ctx.db
      .query("presence")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect()

    // Filter to users who are currently typing (not self, updated within 5 seconds)
    const typingUserIds = presenceRecords
      .filter((p) =>
        p.userId !== userId &&
        p.isTyping &&
        (now - p.updatedAt) < TYPING_TIMEOUT_MS
      )
      .map((p) => p.userId)

    // Get user details for typing users
    const typingUsers = await Promise.all(
      typingUserIds.map(async (typingUserId) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", typingUserId))
          .first()
        return user ? { userId: typingUserId, name: user.name } : null
      })
    )

    return typingUsers.filter((u) => u !== null)
  },
})

// Clean up stale presence records (for periodic cleanup)
export const cleanupStalePresence = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const STALE_THRESHOLD_MS = 60 * 60 * 1000 // 1 hour

    // Find all presence records that haven't been updated in the last hour
    const allPresence = await ctx.db.query("presence").collect()
    const stalePresence = allPresence.filter((p) => (now - p.updatedAt) > STALE_THRESHOLD_MS)

    // Delete stale records
    for (const record of stalePresence) {
      await ctx.db.delete(record._id)
    }

    return { cleaned: stalePresence.length }
  },
})
