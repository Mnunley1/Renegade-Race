import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getCurrentUserOrThrow } from "./users"

export const add = mutation({
  args: {
    driverProfileId: v.id("driverProfiles"),
    url: v.string(),
    r2Key: v.optional(v.string()),
    type: v.union(v.literal("image"), v.literal("video")),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const profile = await ctx.db.get(args.driverProfileId)

    if (!profile || profile.userId !== user.externalId) {
      throw new Error("Not authorized to add media to this profile")
    }

    // Get current max order
    const existing = await ctx.db
      .query("driverMedia")
      .withIndex("by_driver", (q) => q.eq("driverProfileId", args.driverProfileId))
      .collect()

    const maxOrder = existing.reduce((max, m) => Math.max(max, m.order), -1)

    return await ctx.db.insert("driverMedia", {
      driverProfileId: args.driverProfileId,
      url: args.url,
      r2Key: args.r2Key,
      type: args.type,
      caption: args.caption,
      order: maxOrder + 1,
      createdAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { mediaId: v.id("driverMedia") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const media = await ctx.db.get(args.mediaId)

    if (!media) {
      throw new Error("Media not found")
    }

    const profile = await ctx.db.get(media.driverProfileId)
    if (!profile || profile.userId !== user.externalId) {
      throw new Error("Not authorized to remove this media")
    }

    await ctx.db.delete(args.mediaId)
    return args.mediaId
  },
})

export const reorder = mutation({
  args: {
    mediaIds: v.array(v.id("driverMedia")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    for (let i = 0; i < args.mediaIds.length; i++) {
      const media = await ctx.db.get(args.mediaIds[i]!)

      if (!media) continue

      const profile = await ctx.db.get(media.driverProfileId)
      if (!profile || profile.userId !== user.externalId) {
        throw new Error("Not authorized to reorder this media")
      }

      await ctx.db.patch(args.mediaIds[i]!, { order: i })
    }
  },
})

export const getByDriver = query({
  args: { driverProfileId: v.id("driverProfiles") },
  handler: async (ctx, args) => {
    const media = await ctx.db
      .query("driverMedia")
      .withIndex("by_driver", (q) => q.eq("driverProfileId", args.driverProfileId))
      .collect()

    return media.sort((a, b) => a.order - b.order)
  },
})
