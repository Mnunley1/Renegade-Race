import { v } from "convex/values"
import { internal } from "./_generated/api"
import { mutation, query } from "./_generated/server"
import { getCurrentUserOrThrow } from "./users"

export const endorse = mutation({
  args: {
    driverProfileId: v.id("driverProfiles"),
    type: v.union(
      v.literal("racecraft"),
      v.literal("consistency"),
      v.literal("qualifying_pace"),
      v.literal("teamwork"),
      v.literal("communication")
    ),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const profile = await ctx.db.get(args.driverProfileId)

    if (!profile) {
      throw new Error("Driver profile not found")
    }

    // No self-endorsement
    if (profile.userId === user.externalId) {
      throw new Error("Cannot endorse yourself")
    }

    // One endorsement per endorser per driver
    const existing = await ctx.db
      .query("endorsements")
      .withIndex("by_driver_endorser", (q) =>
        q.eq("driverProfileId", args.driverProfileId).eq("endorserId", user.externalId)
      )
      .first()

    if (existing) {
      throw new Error("You have already endorsed this driver")
    }

    const endorsementId = await ctx.db.insert("endorsements", {
      driverProfileId: args.driverProfileId,
      endorserId: user.externalId,
      type: args.type,
      message: args.message,
      createdAt: Date.now(),
    })

    // Notify the driver
    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: profile.userId,
      type: "endorsement_received",
      title: "New Endorsement",
      message: `${user.name} endorsed you for ${args.type.replace(/_/g, " ")}`,
      link: `/motorsports/drivers/${args.driverProfileId}`,
      metadata: { endorsementId },
    })

    return endorsementId
  },
})

export const remove = mutation({
  args: { endorsementId: v.id("endorsements") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const endorsement = await ctx.db.get(args.endorsementId)

    if (!endorsement) {
      throw new Error("Endorsement not found")
    }

    if (endorsement.endorserId !== user.externalId) {
      throw new Error("Not authorized to remove this endorsement")
    }

    await ctx.db.delete(args.endorsementId)
    return args.endorsementId
  },
})

export const getByDriver = query({
  args: { driverProfileId: v.id("driverProfiles") },
  handler: async (ctx, args) => {
    const endorsements = await ctx.db
      .query("endorsements")
      .withIndex("by_driver", (q) => q.eq("driverProfileId", args.driverProfileId))
      .collect()

    // Enrich with endorser info
    return await Promise.all(
      endorsements.map(async (e) => {
        const endorser = await ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", e.endorserId))
          .first()
        return { ...e, endorser }
      })
    )
  },
})
