import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getCurrentUser, getCurrentUserOrThrow } from "./users"

export const create = mutation({
  args: {
    avatarUrl: v.optional(v.string()),
    headline: v.optional(v.string()),
    bio: v.string(),
    experience: v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced"),
      v.literal("professional")
    ),
    racingType: v.optional(
      v.union(v.literal("real-world"), v.literal("sim-racing"), v.literal("both"))
    ),
    simRacingPlatforms: v.optional(v.array(v.string())),
    simRacingRating: v.optional(v.string()),
    licenses: v.array(v.string()),
    preferredCategories: v.array(v.string()),
    availability: v.array(v.string()),
    location: v.string(),
    contactInfo: v.object({
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    // Check if user already has a driver profile
    const existingProfile = await ctx.db
      .query("driverProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user.externalId))
      .first()

    if (existingProfile) {
      throw new Error(
        "You already have a driver profile. Please update your existing profile instead."
      )
    }

    const profileId = await ctx.db.insert("driverProfiles", {
      ...args,
      userId: user.externalId,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Update user type to include driver
    await ctx.db.patch(user._id, {
      userType: user.userType === "team" ? "both" : "driver",
    })

    return profileId
  },
})

export const update = mutation({
  args: {
    profileId: v.id("driverProfiles"),
    avatarUrl: v.optional(v.string()),
    headline: v.optional(v.string()),
    bio: v.optional(v.string()),
    experience: v.optional(
      v.union(
        v.literal("beginner"),
        v.literal("intermediate"),
        v.literal("advanced"),
        v.literal("professional")
      )
    ),
    racingType: v.optional(
      v.union(v.literal("real-world"), v.literal("sim-racing"), v.literal("both"))
    ),
    simRacingPlatforms: v.optional(v.array(v.string())),
    simRacingRating: v.optional(v.string()),
    licenses: v.optional(v.array(v.string())),
    preferredCategories: v.optional(v.array(v.string())),
    availability: v.optional(v.array(v.string())),
    location: v.optional(v.string()),
    contactInfo: v.optional(
      v.object({
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
      })
    ),
    socialLinks: v.optional(
      v.object({
        instagram: v.optional(v.string()),
        twitter: v.optional(v.string()),
        linkedin: v.optional(v.string()),
        website: v.optional(v.string()),
      })
    ),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const { profileId, ...updates } = args

    const profile = await ctx.db.get(profileId)
    if (!profile || profile.userId !== user.externalId) {
      throw new Error("Not authorized to update this profile")
    }

    await ctx.db.patch(profileId, {
      ...updates,
      updatedAt: Date.now(),
    })

    return profileId
  },
})

export const list = query({
  args: {
    location: v.optional(v.string()),
    experience: v.optional(
      v.union(
        v.literal("beginner"),
        v.literal("intermediate"),
        v.literal("advanced"),
        v.literal("professional")
      )
    ),
    racingType: v.optional(
      v.union(v.literal("real-world"), v.literal("sim-racing"), v.literal("both"))
    ),
    preferredCategories: v.optional(v.array(v.string())),
    availability: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    let profilesQuery = ctx.db
      .query("driverProfiles")
      .withIndex("by_active", (q) => q.eq("isActive", true))

    if (args.location) {
      profilesQuery = profilesQuery.filter((q) => q.eq(q.field("location"), args.location))
    }

    if (args.experience) {
      profilesQuery = profilesQuery.filter((q) => q.eq(q.field("experience"), args.experience))
    }

    if (args.racingType) {
      profilesQuery = profilesQuery.filter((q) =>
        q.or(q.eq(q.field("racingType"), args.racingType), q.eq(q.field("racingType"), "both"))
      )
    }

    const profiles = await profilesQuery.collect()

    // Filter by preferred categories if specified
    let filteredProfiles = profiles
    if (args.preferredCategories && args.preferredCategories.length > 0) {
      const preferredCategories = args.preferredCategories
      filteredProfiles = profiles.filter((profile) =>
        preferredCategories.some((category) => profile.preferredCategories.includes(category))
      )
    }

    // Filter by availability if specified
    if (args.availability && args.availability.length > 0) {
      const availability = args.availability
      filteredProfiles = filteredProfiles.filter((profile) =>
        availability.some((avail) => profile.availability.includes(avail))
      )
    }

    // Fetch user data for each profile
    const profilesWithUsers = await Promise.all(
      filteredProfiles.map(async (profile) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", profile.userId))
          .unique()

        return {
          ...profile,
          user: user
            ? {
                name: user.name,
                avatarUrl: user.profileImage,
              }
            : {
                // Fallback for profiles without user data
                name: "Unknown Driver",
                avatarUrl: undefined,
              },
        }
      })
    )

    return profilesWithUsers
  },
})

export const getById = query({
  args: { profileId: v.id("driverProfiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId)
    if (!profile) {
      return null
    }

    // Fetch user data for the profile
    const user = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", profile.userId))
      .unique()

    // Check if current user owns this profile
    let isOwner = false
    try {
      const currentUser = await getCurrentUserOrThrow(ctx)
      isOwner = profile.userId === currentUser.externalId
    } catch {
      // User not authenticated, so not owner
      isOwner = false
    }

    return {
      ...profile,
      isOwner,
      user: user
        ? {
            name: user.name,
            avatarUrl: user.profileImage,
          }
        : {
            name: "Unknown Driver",
            avatarUrl: undefined,
          },
    }
  },
})

export const getByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) {
      return []
    }
    return await ctx.db
      .query("driverProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user.externalId))
      .collect()
  },
})

export const toggleVisibility = mutation({
  args: { profileId: v.id("driverProfiles") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const profile = await ctx.db.get(args.profileId)

    if (!profile || profile.userId !== user.externalId) {
      throw new Error("Not authorized to update this profile")
    }

    await ctx.db.patch(args.profileId, {
      isActive: !profile.isActive,
      updatedAt: Date.now(),
    })

    return !profile.isActive
  },
})

export const deleteProfile = mutation({
  args: { profileId: v.id("driverProfiles") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const profile = await ctx.db.get(args.profileId)

    if (!profile || profile.userId !== user.externalId) {
      throw new Error("Not authorized to delete this profile")
    }

    await ctx.db.delete(args.profileId)
    return true
  },
})

export const getSimilar = query({
  args: {
    profileId: v.id("driverProfiles"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId)
    if (!profile) return []

    // Get all active profiles except this one
    const allProfiles = await ctx.db
      .query("driverProfiles")
      .filter((q) =>
        q.and(q.neq(q.field("_id"), args.profileId), q.eq(q.field("isActive"), true))
      )
      .take(50)

    // Score by: same experience (3), same racingType (2), overlapping categories (1 each)
    const scored = allProfiles.map((p) => {
      let score = 0
      if (p.experience === profile.experience) score += 3
      if (p.racingType === profile.racingType) score += 2
      for (const cat of p.preferredCategories) {
        if (profile.preferredCategories.includes(cat)) score += 1
      }
      return { ...p, score }
    })

    // Sort by score descending, take top N
    scored.sort((a, b) => b.score - a.score)
    const topProfiles = scored.slice(0, args.limit || 3).filter((p) => p.score > 0)

    // Enrich with user data
    const enriched = await Promise.all(
      topProfiles.map(async (p) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", p.userId))
          .first()
        return {
          ...p,
          user: user
            ? {
                name: user.name,
                avatarUrl: user.profileImage,
              }
            : {
                name: "Unknown Driver",
                avatarUrl: undefined,
              },
        }
      })
    )

    return enriched
  },
})
