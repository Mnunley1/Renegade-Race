import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// Track a vehicle view - just increment counter
export const trackView = mutation({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId)
    if (!vehicle?.isActive) {
      return null
    }

    // Increment view count (or set to 1 if doesn't exist)
    await ctx.db.patch(args.vehicleId, {
      viewCount: (vehicle.viewCount || 0) + 1,
    })

    return { success: true }
  },
})

// Track a vehicle share - just increment counter
export const trackShare = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    platform: v.optional(v.string()), // 'facebook', 'twitter', 'linkedin', 'copy_link', etc.
  },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId)
    if (!vehicle) {
      throw new Error("Vehicle not found")
    }

    await ctx.db.patch(args.vehicleId, {
      shareCount: (vehicle.shareCount || 0) + 1,
    })

    return { success: true }
  },
})

// Get analytics for a vehicle (for host)
export const getVehicleAnalytics = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const vehicle = await ctx.db.get(args.vehicleId)
    if (!vehicle || vehicle.ownerId !== identity.subject) {
      throw new Error("Not authorized")
    }

    // Get favorite count
    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .collect()

    return {
      totalViews: vehicle.viewCount || 0,
      totalShares: vehicle.shareCount || 0,
      favoriteCount: favorites.length,
    }
  },
})

// Get analytics for all vehicles owned by a user
export const getAllVehicleAnalytics = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity || identity.subject !== args.ownerId) {
      throw new Error("Not authorized")
    }

    // Get all vehicles owned by this user
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect()

    // Get analytics for each vehicle
    const analyticsPromises = vehicles.map(async (vehicle) => {
      const favorites = await ctx.db
        .query("favorites")
        .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicle._id))
        .collect()

      return {
        vehicleId: vehicle._id,
        vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        totalViews: vehicle.viewCount || 0,
        totalShares: vehicle.shareCount || 0,
        favoriteCount: favorites.length,
      }
    })

    return await Promise.all(analyticsPromises)
  },
})
