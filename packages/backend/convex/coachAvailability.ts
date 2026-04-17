import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { generateDateRange } from "./dateUtils"
import { ErrorCode, throwError } from "./errors"

export const getByService = query({
  args: {
    coachServiceId: v.id("coachServices"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let queryBuilder = ctx.db
      .query("coachAvailability")
      .withIndex("by_coach_service_date", (q) => q.eq("coachServiceId", args.coachServiceId))

    const { startDate, endDate } = args
    if (startDate !== undefined && endDate !== undefined) {
      queryBuilder = queryBuilder.filter((f) =>
        f.and(f.gte(f.field("date"), startDate), f.lte(f.field("date"), endDate))
      )
    }

    return await queryBuilder.order("asc").collect()
  },
})

export const checkRange = query({
  args: {
    coachServiceId: v.id("coachServices"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const availability = await ctx.db
      .query("coachAvailability")
      .withIndex("by_coach_service_date", (q) => q.eq("coachServiceId", args.coachServiceId))
      .filter((q) =>
        q.and(q.gte(q.field("date"), args.startDate), q.lte(q.field("date"), args.endDate))
      )
      .collect()

    const blockedDates = availability.filter((a) => !a.isAvailable)

    const conflictingBookings = await ctx.db
      .query("coachBookings")
      .withIndex("by_coach_service", (q) => q.eq("coachServiceId", args.coachServiceId))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "confirmed"),
          q.and(
            q.lte(q.field("startDate"), args.endDate),
            q.gte(q.field("endDate"), args.startDate)
          )
        )
      )
      .collect()

    return {
      isAvailable: blockedDates.length === 0 && conflictingBookings.length === 0,
      blockedDates,
      conflictingBookings,
    }
  },
})

async function assertCoachOwnsService(
  ctx: MutationCtx,
  coachServiceId: Id<"coachServices">,
  coachId: string
) {
  const service = await ctx.db.get(coachServiceId)
  if (!service || service.deletedAt) {
    throwError(ErrorCode.NOT_FOUND, "Coach service not found")
  }
  if (service.coachId !== coachId) {
    throwError(ErrorCode.FORBIDDEN, "Not authorized to modify this coach service")
  }
}

export const setDay = mutation({
  args: {
    coachServiceId: v.id("coachServices"),
    date: v.string(),
    isAvailable: v.boolean(),
    reason: v.optional(v.string()),
    price: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }
    await assertCoachOwnsService(ctx, args.coachServiceId, identity.subject)

    const existing = await ctx.db
      .query("coachAvailability")
      .withIndex("by_coach_service_date", (q) =>
        q.eq("coachServiceId", args.coachServiceId).eq("date", args.date)
      )
      .first()

    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        isAvailable: args.isAvailable,
        reason: args.reason,
        price: args.price,
      })
      return existing._id
    }

    return await ctx.db.insert("coachAvailability", {
      coachServiceId: args.coachServiceId,
      date: args.date,
      isAvailable: args.isAvailable,
      reason: args.reason,
      price: args.price,
      createdAt: now,
    })
  },
})

export const blockDateRange = mutation({
  args: {
    coachServiceId: v.id("coachServices"),
    startDate: v.string(),
    endDate: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }
    await assertCoachOwnsService(ctx, args.coachServiceId, identity.subject)

    const dates = generateDateRange(args.startDate, args.endDate)
    const now = Date.now()

    for (const date of dates) {
      const existing = await ctx.db
        .query("coachAvailability")
        .withIndex("by_coach_service_date", (q) =>
          q.eq("coachServiceId", args.coachServiceId).eq("date", date)
        )
        .first()

      if (existing) {
        await ctx.db.patch(existing._id, {
          isAvailable: false,
          reason: args.reason,
        })
      } else {
        await ctx.db.insert("coachAvailability", {
          coachServiceId: args.coachServiceId,
          date,
          isAvailable: false,
          reason: args.reason,
          createdAt: now,
        })
      }
    }

    return { count: dates.length }
  },
})
