import { v } from "convex/values"
import { internal } from "./_generated/api"
import { mutation, query } from "./_generated/server"
import { getCurrentUser, getCurrentUserOrThrow } from "./users"

export const requestConnection = mutation({
  args: {
    driverProfileId: v.id("driverProfiles"),
    teamId: v.id("teams"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    // Verify team ownership
    const team = await ctx.db.get(args.teamId)
    if (!team || team.ownerId !== user.externalId) {
      throw new Error("Not authorized to request connection from this team")
    }

    // Check if connection already exists
    const existingConnection = await ctx.db
      .query("teamDriverConnections")
      .withIndex("by_team_driver", (q) =>
        q.eq("teamId", args.teamId).eq("driverProfileId", args.driverProfileId)
      )
      .first()

    if (existingConnection) {
      throw new Error("Connection request already exists")
    }

    const connectionId = await ctx.db.insert("teamDriverConnections", {
      teamId: args.teamId,
      driverProfileId: args.driverProfileId,
      status: "pending",
      message: args.message,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Notify the driver
    const driverProfile = await ctx.db.get(args.driverProfileId)
    if (driverProfile) {
      await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
        userId: driverProfile.userId,
        type: "connection_request",
        title: "New Connection Request",
        message: `${team.name} wants to connect with you`,
        link: `/motorsports/drivers/${args.driverProfileId}`,
        metadata: { teamId: args.teamId, connectionId },
      })
    }

    return connectionId
  },
})

export const updateConnectionStatus = mutation({
  args: {
    connectionId: v.id("teamDriverConnections"),
    status: v.union(v.literal("accepted"), v.literal("declined")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const connection = await ctx.db.get(args.connectionId)

    if (!connection) {
      throw new Error("Connection not found")
    }

    // Verify driver ownership
    const driverProfile = await ctx.db.get(connection.driverProfileId)
    if (!driverProfile || driverProfile.userId !== user.externalId) {
      throw new Error("Not authorized to update this connection")
    }

    await ctx.db.patch(args.connectionId, {
      status: args.status,
      updatedAt: Date.now(),
    })

    // Notify the team owner
    const team = await ctx.db.get(connection.teamId)
    if (team) {
      await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
        userId: team.ownerId,
        type: "connection_request",
        title: `Connection ${args.status === "accepted" ? "Accepted" : "Declined"}`,
        message: `${user.name} has ${args.status} your connection request`,
        link: `/motorsports/teams/${connection.teamId}`,
        metadata: { connectionId: args.connectionId },
      })
    }

    return args.connectionId
  },
})

export const getByDriver = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) {
      return []
    }

    // Get driver profile for current user
    const driverProfile = await ctx.db
      .query("driverProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user.externalId))
      .first()

    if (!driverProfile) {
      return []
    }

    return await ctx.db
      .query("teamDriverConnections")
      .withIndex("by_driver", (q) => q.eq("driverProfileId", driverProfile._id))
      .collect()
  },
})

export const getByTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    // Verify team ownership
    const team = await ctx.db.get(args.teamId)
    if (!team || team.ownerId !== user.externalId) {
      throw new Error("Not authorized to view connections for this team")
    }

    return await ctx.db
      .query("teamDriverConnections")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect()
  },
})

export const checkConnection = query({
  args: {
    driverProfileId: v.id("driverProfiles"),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) {
      return null
    }

    // Verify team ownership
    const team = await ctx.db.get(args.teamId)
    if (!team || team.ownerId !== user.externalId) {
      return null
    }

    const connection = await ctx.db
      .query("teamDriverConnections")
      .withIndex("by_team_driver", (q) =>
        q.eq("teamId", args.teamId).eq("driverProfileId", args.driverProfileId)
      )
      .first()

    return connection
  },
})
