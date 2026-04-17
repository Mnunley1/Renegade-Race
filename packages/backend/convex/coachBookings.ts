import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { assertValidCoachDateOrder, validateHourlyTotalHours } from "./coachBookingValidation"
import { calculateBillingUnits, calculateCoachBookingTotal } from "./coachPricing"
import { ErrorCode, throwError } from "./errors"
import { sanitizeMessage } from "./sanitize"

const addOnArg = v.optional(
  v.array(
    v.object({
      name: v.string(),
      price: v.number(),
      description: v.optional(v.string()),
      priceType: v.optional(v.union(v.literal("daily"), v.literal("one-time"))),
    })
  )
)

export const getByUser = query({
  args: {
    userId: v.string(),
    role: v.union(v.literal("client"), v.literal("coach")),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("confirmed"),
        v.literal("cancelled"),
        v.literal("completed"),
        v.literal("declined")
      )
    ),
  },
  handler: async (ctx, args) => {
    let bookingQuery =
      args.role === "client"
        ? ctx.db
            .query("coachBookings")
            .withIndex("by_client", (iq) => iq.eq("clientId", args.userId))
        : ctx.db.query("coachBookings").withIndex("by_coach", (iq) => iq.eq("coachId", args.userId))

    if (args.status) {
      bookingQuery = bookingQuery.filter((f) => f.eq(f.field("status"), args.status))
    }

    const bookings = await bookingQuery.order("desc").collect()

    return await Promise.all(
      bookings.map(async (booking) => {
        const [service, client, coach] = await Promise.all([
          ctx.db.get(booking.coachServiceId),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (uq) => uq.eq("externalId", booking.clientId))
            .first(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (uq) => uq.eq("externalId", booking.coachId))
            .first(),
        ])
        return { ...booking, coachService: service, client, coach }
      })
    )
  },
})

export const getById = query({
  args: { id: v.id("coachBookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.id)
    if (!booking) {
      return null
    }
    const [service, client, coach] = await Promise.all([
      ctx.db.get(booking.coachServiceId),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", booking.clientId))
        .first(),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", booking.coachId))
        .first(),
    ])
    return {
      ...booking,
      coachService: service,
      client,
      coach,
    }
  },
})

export const create = mutation({
  args: {
    coachServiceId: v.id("coachServices"),
    startDate: v.string(),
    endDate: v.string(),
    totalHours: v.optional(v.number()),
    clientMessage: v.optional(v.string()),
    addOns: addOnArg,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const clientId = identity.subject
    const now = Date.now()

    const service = await ctx.db.get(args.coachServiceId)
    if (!service || service.deletedAt) {
      throwError(ErrorCode.NOT_FOUND, "Coach service not found")
    }

    if (!service.isActive || service.isSuspended || !service.isApproved) {
      throwError(ErrorCode.INVALID_INPUT, "This coach service is not available for booking")
    }

    if (service.coachId === clientId) {
      throwError(ErrorCode.CANNOT_BOOK_OWN_COACH_SERVICE, "Cannot book your own coaching service")
    }

    const coachUser = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", service.coachId))
      .first()

    if (!coachUser?.stripeAccountId || coachUser.stripeAccountStatus !== "enabled") {
      throwError(ErrorCode.STRIPE_ACCOUNT_INCOMPLETE, "Coach payouts are not fully set up yet")
    }

    const block1 = await ctx.db
      .query("userBlocks")
      .withIndex("by_blocker_blocked", (q) =>
        q.eq("blockerId", clientId).eq("blockedUserId", service.coachId)
      )
      .first()
    const block2 = await ctx.db
      .query("userBlocks")
      .withIndex("by_blocker_blocked", (q) =>
        q.eq("blockerId", service.coachId).eq("blockedUserId", clientId)
      )
      .first()
    if (block1 || block2) {
      throwError(ErrorCode.USER_BLOCKED, "Cannot book coaching from blocked users")
    }

    const hourlyErr = validateHourlyTotalHours(service.pricingUnit, args.totalHours)
    if (hourlyErr) {
      throwError(ErrorCode.INVALID_INPUT, "Hourly coaching requires a positive totalHours value")
    }

    assertValidCoachDateOrder(args.startDate, args.endDate)

    const billingUnits = calculateBillingUnits(
      service.pricingUnit,
      args.startDate,
      args.endDate,
      args.totalHours
    )
    if (billingUnits <= 0) {
      throwError(ErrorCode.INVALID_DATE_RANGE, "Invalid booking span for this pricing type")
    }

    const selectedAddOns = args.addOns ?? []
    for (const addOn of selectedAddOns) {
      if (addOn.price < 0) {
        throwError(ErrorCode.INVALID_AMOUNT, `Add-on price for ${addOn.name} cannot be negative`)
      }
      if (addOn.price > 100_000) {
        throwError(
          ErrorCode.INVALID_AMOUNT,
          `Add-on price for ${addOn.name} cannot exceed $1,000.00`
        )
      }
    }

    const totalAmount = calculateCoachBookingTotal({
      baseRate: service.baseRate,
      pricingUnit: service.pricingUnit,
      startDate: args.startDate,
      endDate: args.endDate,
      totalHours: args.totalHours,
      addOns: selectedAddOns,
    })

    const MAX_TOTAL_AMOUNT_CENTS = 1_000_000
    const MIN_TOTAL_AMOUNT_CENTS = 100
    if (totalAmount < MIN_TOTAL_AMOUNT_CENTS) {
      throwError(ErrorCode.INVALID_AMOUNT, "Total amount must be at least $1.00", { totalAmount })
    }
    if (totalAmount > MAX_TOTAL_AMOUNT_CENTS) {
      throwError(ErrorCode.INVALID_AMOUNT, "Total amount cannot exceed $10,000.00", { totalAmount })
    }

    const availability = await ctx.db
      .query("coachAvailability")
      .withIndex("by_coach_service_date", (q) => q.eq("coachServiceId", args.coachServiceId))
      .filter((f) =>
        f.and(f.gte(f.field("date"), args.startDate), f.lte(f.field("date"), args.endDate))
      )
      .collect()

    const blockedDates = availability.filter((a) => !a.isAvailable)
    if (blockedDates.length > 0) {
      throwError(ErrorCode.DATES_UNAVAILABLE, "Selected dates are not available", {
        blockedDates: blockedDates.map((d) => d.date),
      })
    }

    const conflicting = await ctx.db
      .query("coachBookings")
      .withIndex("by_coach_service", (q) => q.eq("coachServiceId", args.coachServiceId))
      .filter((f) =>
        f.and(
          f.eq(f.field("status"), "confirmed"),
          f.and(
            f.lte(f.field("startDate"), args.endDate),
            f.gte(f.field("endDate"), args.startDate)
          )
        )
      )
      .collect()

    if (conflicting.length > 0) {
      throwError(ErrorCode.DATES_CONFLICT, "Selected dates conflict with an existing booking")
    }

    const bookingId = await ctx.db.insert("coachBookings", {
      coachServiceId: args.coachServiceId,
      clientId,
      coachId: service.coachId,
      startDate: args.startDate,
      endDate: args.endDate,
      totalHours: args.totalHours,
      billingUnits,
      baseRate: service.baseRate,
      pricingUnit: service.pricingUnit,
      totalAmount,
      addOns: selectedAddOns.length > 0 ? selectedAddOns : undefined,
      status: "pending",
      clientMessage: args.clientMessage ? sanitizeMessage(args.clientMessage) : undefined,
      createdAt: now,
      updatedAt: now,
    })

    return bookingId
  },
})

export const updateStatus = mutation({
  args: {
    bookingId: v.id("coachBookings"),
    status: v.union(
      v.literal("approved"),
      v.literal("declined"),
      v.literal("confirmed"),
      v.literal("cancelled"),
      v.literal("completed")
    ),
    coachMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throwError(ErrorCode.NOT_FOUND, "Booking not found")
    }

    if (booking.coachId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Only the coach can update this booking")
    }

    const now = Date.now()
    await ctx.db.patch(args.bookingId, {
      status: args.status,
      updatedAt: now,
      ...(args.coachMessage ? { coachMessage: sanitizeMessage(args.coachMessage) } : {}),
      ...(args.status === "approved" ? { approvedAt: now } : {}),
    })
    return args.bookingId
  },
})
