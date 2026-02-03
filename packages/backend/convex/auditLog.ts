import { v } from "convex/values"
import { internalMutation } from "./_generated/server"

export const create = internalMutation({
  args: {
    entityType: v.union(
      v.literal("reservation"),
      v.literal("payment"),
      v.literal("user"),
      v.literal("vehicle"),
      v.literal("dispute")
    ),
    entityId: v.optional(v.string()),
    action: v.string(),
    userId: v.optional(v.string()),
    previousState: v.optional(v.any()),
    newState: v.optional(v.any()),
    metadata: v.optional(v.any()),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const logEntry = {
      entityType: args.entityType,
      entityId: args.entityId || "",
      action: args.action,
      userId: args.userId,
      previousState: args.previousState,
      newState: args.newState,
      metadata: args.metadata || args.details,
      timestamp: Date.now(),
    }

    await ctx.db.insert("auditLogs", logEntry)
  },
})
