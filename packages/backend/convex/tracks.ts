import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { checkAdmin } from "./admin"

// Get all active tracks
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("asc")
      .collect()

    return tracks
  },
})

// Get all tracks (including inactive) - admin only
export const getAllForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await checkAdmin(ctx)

    const tracks = await ctx.db.query("tracks").order("asc").collect()

    return tracks
  },
})

// Get track by ID
export const getById = query({
  args: { id: v.id("tracks") },
  handler: async (ctx, args) => {
    const track = await ctx.db.get(args.id)
    return track
  },
})

// Create a new track - admin only
export const create = mutation({
  args: {
    name: v.string(),
    location: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const trackId = await ctx.db.insert("tracks", {
      name: args.name,
      location: args.location,
      description: args.description,
      imageUrl: args.imageUrl,
      isActive: args.isActive ?? true,
    })

    return trackId
  },
})

// Update a track - admin only
export const update = mutation({
  args: {
    id: v.id("tracks"),
    name: v.optional(v.string()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const track = await ctx.db.get(args.id)
    if (!track) {
      throw new Error("Track not found")
    }

    const updates: any = {}
    if (args.name !== undefined) updates.name = args.name
    if (args.location !== undefined) updates.location = args.location
    if (args.description !== undefined) updates.description = args.description
    if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl
    if (args.isActive !== undefined) updates.isActive = args.isActive

    await ctx.db.patch(args.id, updates)

    return args.id
  },
})

// Delete a track - admin only
export const deleteTrack = mutation({
  args: {
    id: v.id("tracks"),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const track = await ctx.db.get(args.id)
    if (!track) {
      throw new Error("Track not found")
    }

    // Check if track is being used by any vehicles
    const vehiclesUsingTrack = await ctx.db
      .query("vehicles")
      .withIndex("by_track", (q) => q.eq("trackId", args.id))
      .first()

    if (vehiclesUsingTrack) {
      throw new Error("Cannot delete track that is being used by vehicles")
    }

    await ctx.db.delete(args.id)

    return args.id
  },
})

// Migration-only mutation for importing tracks (no admin check)
export const createMigrationTrack = mutation({
  args: {
    name: v.string(),
    location: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const trackId = await ctx.db.insert("tracks", {
      name: args.name,
      location: args.location,
      isActive: args.isActive,
    })
    return trackId
  },
})
