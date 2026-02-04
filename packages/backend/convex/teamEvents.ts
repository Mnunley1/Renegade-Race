import { v } from "convex/values"
import { internal } from "./_generated/api"
import { mutation, query } from "./_generated/server"
import { getCurrentUserOrThrow } from "./users"

export const create = mutation({
  args: {
    teamId: v.id("teams"),
    title: v.string(),
    description: v.optional(v.string()),
    date: v.string(),
    endDate: v.optional(v.string()),
    time: v.optional(v.string()),
    location: v.optional(v.string()),
    type: v.union(
      v.literal("race"),
      v.literal("practice"),
      v.literal("meeting"),
      v.literal("social"),
      v.literal("other")
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const team = await ctx.db.get(args.teamId)

    if (!team || team.ownerId !== user.externalId) {
      throw new Error("Not authorized to create events for this team")
    }

    const now = Date.now()
    const eventId = await ctx.db.insert("teamEvents", {
      ...args,
      createdBy: user.externalId,
      createdAt: now,
      updatedAt: now,
    })

    // Notify team members
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_status", (q) => q.eq("teamId", args.teamId).eq("status", "active"))
      .collect()

    for (const member of members) {
      if (member.userId !== user.externalId) {
        await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
          userId: member.userId,
          type: "team_event",
          title: "New Team Event",
          message: `${team.name}: ${args.title} on ${args.date}`,
          link: `/motorsports/teams/${args.teamId}`,
          metadata: { eventId, teamId: args.teamId },
        })
      }
    }

    return eventId
  },
})

export const update = mutation({
  args: {
    eventId: v.id("teamEvents"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    date: v.optional(v.string()),
    endDate: v.optional(v.string()),
    time: v.optional(v.string()),
    location: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("race"),
        v.literal("practice"),
        v.literal("meeting"),
        v.literal("social"),
        v.literal("other")
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const event = await ctx.db.get(args.eventId)

    if (!event) {
      throw new Error("Event not found")
    }

    const team = await ctx.db.get(event.teamId)
    if (!team || team.ownerId !== user.externalId) {
      throw new Error("Not authorized to update this event")
    }

    const { eventId, ...updates } = args
    await ctx.db.patch(eventId, {
      ...updates,
      updatedAt: Date.now(),
    })

    return eventId
  },
})

export const remove = mutation({
  args: { eventId: v.id("teamEvents") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const event = await ctx.db.get(args.eventId)

    if (!event) {
      throw new Error("Event not found")
    }

    const team = await ctx.db.get(event.teamId)
    if (!team || team.ownerId !== user.externalId) {
      throw new Error("Not authorized to delete this event")
    }

    // Delete RSVPs
    const rsvps = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect()

    for (const rsvp of rsvps) {
      await ctx.db.delete(rsvp._id)
    }

    await ctx.db.delete(args.eventId)
    return args.eventId
  },
})

export const getByTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("teamEvents")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect(),
})

export const rsvp = mutation({
  args: {
    eventId: v.id("teamEvents"),
    status: v.union(v.literal("going"), v.literal("maybe"), v.literal("not_going")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    const existing = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user.externalId)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { status: args.status })
      return existing._id
    }

    return await ctx.db.insert("eventRsvps", {
      eventId: args.eventId,
      userId: user.externalId,
      status: args.status,
      createdAt: Date.now(),
    })
  },
})

export const getRsvps = query({
  args: { eventId: v.id("teamEvents") },
  handler: async (ctx, args) => {
    const rsvps = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect()

    return await Promise.all(
      rsvps.map(async (rsvp) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", rsvp.userId))
          .first()
        return { ...rsvp, user }
      })
    )
  },
})
