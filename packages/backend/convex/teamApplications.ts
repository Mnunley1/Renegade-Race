import { v } from "convex/values"
import { internal } from "./_generated/api"
import { mutation, query } from "./_generated/server"
import { getCurrentUserOrThrow } from "./users"

export const apply = mutation({
  args: {
    teamId: v.id("teams"),
    message: v.string(),
    driverExperience: v.string(),
    preferredDates: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    const applicationId = await ctx.db.insert("teamApplications", {
      ...args,
      driverId: user.externalId,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Notify team owner
    const team = await ctx.db.get(args.teamId)
    if (team) {
      await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
        userId: team.ownerId,
        type: "team_application",
        title: "New Team Application",
        message: `${user.name} has applied to join ${team.name}`,
        link: `/motorsports/teams/${args.teamId}`,
        metadata: { applicationId, teamId: args.teamId },
      })
    }

    return applicationId
  },
})

export const updateStatus = mutation({
  args: {
    applicationId: v.id("teamApplications"),
    status: v.union(v.literal("accepted"), v.literal("declined"), v.literal("withdrawn")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const application = await ctx.db.get(args.applicationId)

    if (!application) {
      throw new Error("Application not found")
    }

    // Only team owner can accept/decline, driver can withdraw
    if (args.status === "withdrawn") {
      if (application.driverId !== user.externalId) {
        throw new Error("Not authorized to withdraw this application")
      }
    } else {
      const team = await ctx.db.get(application.teamId)
      if (!team || team.ownerId !== user.externalId) {
        throw new Error("Not authorized to update this application status")
      }
    }

    await ctx.db.patch(args.applicationId, {
      status: args.status,
      updatedAt: Date.now(),
    })

    // Auto-create team member on acceptance
    if (args.status === "accepted") {
      const driverProfile = await ctx.db
        .query("driverProfiles")
        .withIndex("by_user", (q) => q.eq("userId", application.driverId))
        .first()

      const now = Date.now()
      await ctx.db.insert("teamMembers", {
        teamId: application.teamId,
        driverProfileId: driverProfile?._id,
        userId: application.driverId,
        role: "driver",
        joinedAt: now,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
    }

    // Notify driver of status change
    if (args.status !== "withdrawn") {
      const team = await ctx.db.get(application.teamId)
      await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
        userId: application.driverId,
        type: "application_status_change",
        title: `Application ${args.status === "accepted" ? "Accepted" : "Declined"}`,
        message: `Your application to ${team?.name || "the team"} has been ${args.status}`,
        link: `/motorsports/applications`,
        metadata: { applicationId: args.applicationId, status: args.status },
      })
    }

    return args.applicationId
  },
})

export const getByTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const team = await ctx.db.get(args.teamId)

    if (!team || team.ownerId !== user.externalId) {
      throw new Error("Not authorized to view applications for this team")
    }

    return await ctx.db
      .query("teamApplications")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect()
  },
})

export const getPublicByTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const applications = await ctx.db
      .query("teamApplications")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect()

    return applications.map((app) => ({
      _id: app._id,
      status: app.status,
      message: app.message,
      createdAt: app.createdAt,
    }))
  },
})

export const getByDriver = query({
  args: {},
  handler: async (ctx) => {
    try {
      const user = await getCurrentUserOrThrow(ctx)
      const applications = await ctx.db
        .query("teamApplications")
        .withIndex("by_driver", (q) => q.eq("driverId", user.externalId))
        .collect()

      // Enrich with team data
      const enriched = await Promise.all(
        applications.map(async (app) => {
          const team = await ctx.db.get(app.teamId)
          return { ...app, team }
        })
      )

      return enriched
    } catch {
      return []
    }
  },
})

export const getByStatus = query({
  args: {
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("withdrawn")
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    return await ctx.db
      .query("teamApplications")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .filter((q) =>
        q.or(q.eq(q.field("driverId"), user.externalId), q.eq(q.field("teamId"), user.externalId))
      )
      .collect()
  },
})
