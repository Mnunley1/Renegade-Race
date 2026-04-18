import { v } from "convex/values"
import { mutation } from "./_generated/server"

/** Increment view count for a public coach listing. */
export const trackView = mutation({
  args: { coachServiceId: v.id("coachServices") },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.coachServiceId)
    if (
      !service ||
      service.deletedAt ||
      !service.isActive ||
      service.isSuspended ||
      !service.isApproved
    ) {
      return null
    }

    await ctx.db.patch(args.coachServiceId, {
      viewCount: (service.viewCount || 0) + 1,
    })

    return { success: true }
  },
})

/** Increment share count (Web Share API, copy link, etc.). */
export const trackShare = mutation({
  args: {
    coachServiceId: v.id("coachServices"),
    platform: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.coachServiceId)
    if (!service) {
      throw new Error("Coach service not found")
    }

    await ctx.db.patch(args.coachServiceId, {
      shareCount: (service.shareCount || 0) + 1,
    })

    return { success: true }
  },
})
