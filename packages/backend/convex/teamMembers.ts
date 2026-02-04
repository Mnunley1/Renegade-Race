import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getCurrentUserOrThrow } from "./users"

export const addMember = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.string(),
    driverProfileId: v.optional(v.id("driverProfiles")),
    role: v.union(v.literal("owner"), v.literal("driver"), v.literal("crew"), v.literal("manager")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const team = await ctx.db.get(args.teamId)

    if (!team || team.ownerId !== user.externalId) {
      throw new Error("Not authorized to add members to this team")
    }

    // Check for existing membership
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId).eq("userId", args.userId))
      .first()

    if (existing) {
      throw new Error("User is already a team member")
    }

    const now = Date.now()
    return await ctx.db.insert("teamMembers", {
      teamId: args.teamId,
      driverProfileId: args.driverProfileId,
      userId: args.userId,
      role: args.role,
      joinedAt: now,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const removeMember = mutation({
  args: {
    memberId: v.id("teamMembers"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const member = await ctx.db.get(args.memberId)

    if (!member) {
      throw new Error("Member not found")
    }

    const team = await ctx.db.get(member.teamId)
    if (!team || team.ownerId !== user.externalId) {
      throw new Error("Not authorized to remove members from this team")
    }

    if (member.role === "owner") {
      throw new Error("Cannot remove the team owner")
    }

    await ctx.db.patch(args.memberId, {
      status: "inactive",
      updatedAt: Date.now(),
    })

    return args.memberId
  },
})

export const updateRole = mutation({
  args: {
    memberId: v.id("teamMembers"),
    role: v.union(v.literal("driver"), v.literal("crew"), v.literal("manager")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const member = await ctx.db.get(args.memberId)

    if (!member) {
      throw new Error("Member not found")
    }

    const team = await ctx.db.get(member.teamId)
    if (!team || team.ownerId !== user.externalId) {
      throw new Error("Not authorized to update member roles")
    }

    await ctx.db.patch(args.memberId, {
      role: args.role,
      updatedAt: Date.now(),
    })

    return args.memberId
  },
})

export const getByTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_status", (q) => q.eq("teamId", args.teamId).eq("status", "active"))
      .collect()

    // Enrich with user and driver profile data
    return await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", member.userId))
          .first()

        const driverProfile = member.driverProfileId
          ? await ctx.db.get(member.driverProfileId)
          : null

        return { ...member, user, driverProfile }
      })
    )
  },
})

export const getByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx)

    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("userId", user.externalId))
      .collect()

    return await Promise.all(
      memberships
        .filter((m) => m.status === "active")
        .map(async (member) => {
          const team = await ctx.db.get(member.teamId)
          return { ...member, team }
        })
    )
  },
})
