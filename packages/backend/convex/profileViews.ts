import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getCurrentUser } from "./users"

export const recordView = mutation({
  args: {
    profileId: v.string(),
    profileType: v.union(v.literal("driver"), v.literal("team")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const viewerId = user?.externalId

    // Dedup: one view per viewer per profile per 24h
    if (viewerId) {
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000
      const recent = await ctx.db
        .query("profileViews")
        .withIndex("by_profile_viewer", (q) =>
          q
            .eq("profileId", args.profileId)
            .eq("profileType", args.profileType)
            .eq("viewerId", viewerId)
        )
        .filter((q) => q.gte(q.field("viewedAt"), dayAgo))
        .first()

      if (recent) return recent._id
    }

    return await ctx.db.insert("profileViews", {
      profileId: args.profileId,
      profileType: args.profileType,
      viewerId: viewerId ?? undefined,
      viewedAt: Date.now(),
    })
  },
})

export const getViewCount = query({
  args: {
    profileId: v.string(),
    profileType: v.union(v.literal("driver"), v.literal("team")),
  },
  handler: async (ctx, args) => {
    const views = await ctx.db
      .query("profileViews")
      .withIndex("by_profile", (q) =>
        q.eq("profileId", args.profileId).eq("profileType", args.profileType)
      )
      .collect()

    return views.length
  },
})

export const getRecentViewers = query({
  args: {
    profileId: v.string(),
    profileType: v.union(v.literal("driver"), v.literal("team")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { limit = 10 } = args

    const views = await ctx.db
      .query("profileViews")
      .withIndex("by_profile", (q) =>
        q.eq("profileId", args.profileId).eq("profileType", args.profileType)
      )
      .order("desc")
      .take(limit)

    return await Promise.all(
      views
        .filter((v) => v.viewerId)
        .map(async (view) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", view.viewerId!))
            .first()
          return { ...view, user }
        })
    )
  },
})
