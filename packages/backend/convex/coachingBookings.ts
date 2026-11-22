import { reserveAccountOperation } from "./accountOperations"
import { assertAccountsAvailable } from "./accountDeletionGuards"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalMutation, mutation, query } from "./_generated/server"
import { checkAdmin } from "./admin"
import { calculateDaysBetween } from "./dateUtils"
import { ErrorCode, throwError } from "./errors"
import { isCoachingCancellationRefundable } from "./pricing"
import { rateLimiter } from "./rateLimiter"
import { sanitizeMessage, sanitizeShortText } from "./sanitize"
import { publicUserProfile } from "./userProfile"

const sessionTypeValidator = v.union(
  v.literal("hourly"),
  v.literal("half_day"),
  v.literal("full_day")
)

const MAX_TOTAL_CENTS = 1_000_000 // $10,000
const MIN_TOTAL_CENTS = 100 // $1

function pickRate(
  profile: {
    hourlyRate?: number
    halfDayRate?: number
    fullDayRate?: number
  },
  sessionType: "hourly" | "half_day" | "full_day"
): number {
  const rate =
    sessionType === "hourly"
      ? profile.hourlyRate
      : sessionType === "half_day"
        ? profile.halfDayRate
        : profile.fullDayRate
  if (rate === undefined) {
    throwError(
      ErrorCode.INVALID_INPUT,
      `Coach does not offer ${sessionType.replace("_", "-")} rate`
    )
  }
  return rate
}

export const create = mutation({
  args: {
    coachProfileId: v.id("coachProfiles"),
    sessionType: sessionTypeValidator,
    startDate: v.string(),
    endDate: v.string(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    hours: v.optional(v.number()),
    eventName: v.optional(v.string()),
    renterMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    await rateLimiter.limit(ctx, "createReservation", {
      key: identity.subject,
      throws: true,
    })

    const renterId = identity.subject
    const now = Date.now()

    const profile = await ctx.db.get(args.coachProfileId)
    if (!profile) {
      throwError(ErrorCode.NOT_FOUND, "Coach profile not found")
    }
    if (!profile.isActive) {
      throwError(ErrorCode.INVALID_STATUS, "Coach is not accepting bookings")
    }
    if (profile.userId === renterId) {
      throwError(ErrorCode.CANNOT_BOOK_OWN_VEHICLE, "Cannot book yourself as a coach")
    }

    // Block if either party has blocked the other
    const [block1, block2] = await Promise.all([
      ctx.db
        .query("userBlocks")
        .withIndex("by_blocker_blocked", (q) =>
          q.eq("blockerId", renterId).eq("blockedUserId", profile.userId)
        )
        .first(),
      ctx.db
        .query("userBlocks")
        .withIndex("by_blocker_blocked", (q) =>
          q.eq("blockerId", profile.userId).eq("blockedUserId", renterId)
        )
        .first(),
    ])
    if (block1 || block2) {
      throwError(ErrorCode.USER_BLOCKED, "Cannot book this coach")
    }

    const totalDays = calculateDaysBetween(args.startDate, args.endDate)
    if (totalDays <= 0) {
      throwError(ErrorCode.INVALID_DATE_RANGE, "Invalid date range")
    }

    // Validate hourly specifics
    if (args.sessionType === "hourly") {
      if (totalDays !== 1) {
        throwError(ErrorCode.INVALID_INPUT, "Hourly sessions must start and end on the same day")
      }
      if (!args.hours || args.hours <= 0) {
        throwError(ErrorCode.INVALID_INPUT, "Hours required for hourly sessions")
      }
      if (args.hours > 12) {
        throwError(ErrorCode.INVALID_INPUT, "Hourly sessions cannot exceed 12 hours")
      }
      if (!args.startTime) {
        throwError(ErrorCode.INVALID_INPUT, "Start time required for hourly sessions")
      }
    }

    const rate = pickRate(profile, args.sessionType)

    let totalAmount: number
    if (args.sessionType === "hourly") {
      totalAmount = Math.round(rate * (args.hours as number))
    } else {
      // half-day and full-day are flat per-day
      totalAmount = Math.round(rate * totalDays)
    }

    if (totalAmount < MIN_TOTAL_CENTS || totalAmount > MAX_TOTAL_CENTS) {
      throwError(ErrorCode.INVALID_AMOUNT, "Total amount out of allowed range")
    }

    // Check blocked dates
    const availability = await ctx.db
      .query("coachAvailability")
      .withIndex("by_coach_date", (q) => q.eq("coachProfileId", args.coachProfileId))
      .filter((q) =>
        q.and(q.gte(q.field("date"), args.startDate), q.lte(q.field("date"), args.endDate))
      )
      .collect()
    const blockedDates = availability.filter((a) => !a.isAvailable)
    if (blockedDates.length > 0) {
      throwError(ErrorCode.DATES_UNAVAILABLE, "Coach is unavailable on selected dates", {
        blockedDates: blockedDates.map((d) => d.date),
      })
    }

    // Check conflicting confirmed bookings
    const conflicting = await ctx.db
      .query("coachingBookings")
      .withIndex("by_coach_profile", (q) => q.eq("coachProfileId", args.coachProfileId))
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
    if (conflicting.length > 0) {
      throwError(ErrorCode.DATES_CONFLICT, "Coach already booked for these dates")
    }

    await assertAccountsAvailable(ctx, renterId, profile.userId)
    const bookingId = await ctx.db.insert("coachingBookings", {
      coachProfileId: args.coachProfileId,
      coachUserId: profile.userId,
      renterId,
      startDate: args.startDate,
      endDate: args.endDate,
      startTime: args.startTime,
      endTime: args.endTime,
      sessionType: args.sessionType,
      hours: args.sessionType === "hourly" ? args.hours : undefined,
      totalDays,
      rate,
      totalAmount,
      eventName: args.eventName ? sanitizeShortText(args.eventName) : undefined,
      status: "pending",
      renterMessage: args.renterMessage ? sanitizeMessage(args.renterMessage) : undefined,
      createdAt: now,
      updatedAt: now,
    })

    // Auto-create conversation linked to this booking
    const conversationId = await ctx.db.insert("conversations", {
      conversationType: "coaching",
      coachProfileId: args.coachProfileId,
      coachingBookingId: bookingId,
      renterId,
      ownerId: profile.userId,
      lastMessageAt: now,
      lastMessageText: args.renterMessage ? sanitizeMessage(args.renterMessage) : undefined,
      lastMessageSenderId: args.renterMessage ? renterId : undefined,
      unreadCountRenter: 0,
      unreadCountOwner: args.renterMessage ? 1 : 0,
      isActive: !!args.renterMessage,
      createdAt: now,
      updatedAt: now,
    })

    if (args.renterMessage) {
      await ctx.db.insert("messages", {
        conversationId,
        senderId: renterId,
        content: sanitizeMessage(args.renterMessage),
        messageType: "text",
        isRead: false,
        createdAt: now,
      })
    }

    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: profile.userId,
      type: "coaching_request_pending",
      title: "New coaching request",
      message: "You have a new coaching session request awaiting your response.",
      link: "/coach/dashboard",
      metadata: { bookingId },
    })

    return bookingId
  },
})

export const approve = mutation({
  args: {
    bookingId: v.id("coachingBookings"),
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
    if (booking.coachUserId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized to approve this booking")
    }
    if (booking.status !== "pending") {
      throwError(ErrorCode.INVALID_STATUS, "Booking is not pending")
    }

    await assertAccountsAvailable(ctx, identity.subject, booking.renterId, booking.coachUserId)
    // A coach can only hold one commitment per date span. If an overlapping
    // booking is already approved (awaiting payment) or confirmed, block the
    // approval — otherwise two renters could both pay and double-book.
    const existingCommitment = await ctx.db
      .query("coachingBookings")
      .withIndex("by_coach_profile", (q) => q.eq("coachProfileId", booking.coachProfileId))
      .filter((q) =>
        q.and(
          q.neq(q.field("_id"), args.bookingId),
          q.or(q.eq(q.field("status"), "approved"), q.eq(q.field("status"), "confirmed")),
          q.lte(q.field("startDate"), booking.endDate),
          q.gte(q.field("endDate"), booking.startDate)
        )
      )
      .first()
    if (existingCommitment) {
      throwError(
        ErrorCode.DATES_CONFLICT,
        "You already have an approved or confirmed session that overlaps these dates. Decline or cancel it before approving this one."
      )
    }

    const now = Date.now()
    await ctx.db.patch(args.bookingId, {
      status: "approved",
      approvedAt: now,
      coachMessage: args.coachMessage ? sanitizeMessage(args.coachMessage) : undefined,
      updatedAt: now,
    })

    // Auto-decline overlapping pending bookings for this coach
    const overlapping = await ctx.db
      .query("coachingBookings")
      .withIndex("by_coach_profile", (q) => q.eq("coachProfileId", booking.coachProfileId))
      .filter((q) =>
        q.and(
          q.neq(q.field("_id"), args.bookingId),
          q.eq(q.field("status"), "pending"),
          q.and(
            q.lte(q.field("startDate"), booking.endDate),
            q.gte(q.field("endDate"), booking.startDate)
          )
        )
      )
      .collect()

    for (const other of overlapping) {
      await ctx.db.patch(other._id, {
        status: "declined",
        coachMessage: "Another request for these dates was approved.",
        updatedAt: now,
      })
      await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
        userId: other.renterId,
        type: "coaching_declined",
        title: "Coaching request declined",
        message: "Another request for these dates was approved by the coach.",
        link: `/coaches/${booking.coachProfileId}`,
        metadata: { bookingId: other._id },
      })
    }

    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: booking.renterId,
      type: "coaching_approved",
      title: "Coaching request approved",
      message: "Your coaching request has been approved! Complete payment to confirm.",
      link: `/checkout/pay-coaching?bookingId=${args.bookingId}`,
      metadata: { bookingId: args.bookingId },
    })

    return args.bookingId
  },
})

export const decline = mutation({
  args: {
    bookingId: v.id("coachingBookings"),
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
    if (booking.coachUserId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized to decline this booking")
    }
    if (booking.status !== "pending" && booking.status !== "approved") {
      throwError(ErrorCode.INVALID_STATUS, "Booking cannot be declined in current status")
    }

    await ctx.db.patch(args.bookingId, {
      status: "declined",
      coachMessage: args.coachMessage ? sanitizeMessage(args.coachMessage) : undefined,
      updatedAt: Date.now(),
    })

    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: booking.renterId,
      type: "coaching_declined",
      title: "Coaching request declined",
      message: "Your coaching request has been declined.",
      link: `/coaches/${booking.coachProfileId}`,
      metadata: { bookingId: args.bookingId },
    })

    return args.bookingId
  },
})

export const cancel = mutation({
  args: {
    bookingId: v.id("coachingBookings"),
    cancellationReason: v.optional(v.string()),
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
    if (booking.renterId !== identity.subject && booking.coachUserId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized to cancel this booking")
    }
    if (
      booking.status !== "pending" &&
      booking.status !== "approved" &&
      booking.status !== "confirmed"
    ) {
      throwError(ErrorCode.INVALID_STATUS, "Booking cannot be cancelled in current status")
    }

    // Capture the pre-cancel state to decide on a refund (status flips below).
    const wasPaid = booking.status === "confirmed" && booking.paymentStatus === "paid"
    const cancellerIsCoach = identity.subject === booking.coachUserId

    await ctx.db.patch(args.bookingId, {
      status: "cancelled",
      cancellationReason: args.cancellationReason
        ? sanitizeShortText(args.cancellationReason)
        : undefined,
      updatedAt: Date.now(),
    })

    const otherPartyId =
      identity.subject === booking.coachUserId ? booking.renterId : booking.coachUserId

    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: otherPartyId,
      type: "coaching_cancelled",
      title: "Coaching session cancelled",
      message: "A coaching session has been cancelled.",
      link: cancellerIsCoach ? "/trips" : "/coach/dashboard",
      metadata: { bookingId: args.bookingId },
    })

    // Refund a paid session per the cancellation policy: the coach cancelling
    // always refunds; the renter cancelling only refunds with 24h+ notice.
    if (wasPaid) {
      const refundable = isCoachingCancellationRefundable({
        cancelledByCoach: cancellerIsCoach,
        startDate: booking.startDate,
        startTime: booking.startTime,
        now: Date.now(),
      })

      if (refundable) {
      await reserveAccountOperation(ctx, `coaching-cancellation-refund:${booking._id}`, [booking.renterId, booking.coachUserId])
        await ctx.scheduler.runAfter(0, internal.coachingPayments.refundCoachingBooking, {
          bookingId: args.bookingId,
          reason: cancellerIsCoach
            ? "The coach cancelled this session — refunded in full."
            : "Session cancelled with 24h+ notice — refunded in full.",
        })
        await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
          userId: booking.renterId,
          type: "coaching_cancelled",
          title: "Coaching payment refunded",
          message: `Your payment of $${(booking.totalAmount / 100).toFixed(2)} is being refunded in full.`,
          link: "/trips",
          metadata: { bookingId: args.bookingId },
        })
      } else {
        // Renter cancelled inside the notice window — coach keeps the payment.
        await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
          userId: booking.renterId,
          type: "coaching_cancelled",
          title: "Coaching session cancelled — no refund",
          message:
            "You cancelled within 24 hours of the session, so per the cancellation policy this booking is non-refundable.",
          link: "/trips",
          metadata: { bookingId: args.bookingId },
        })
      }
    }

    return args.bookingId
  },
})

export const complete = mutation({
  args: { bookingId: v.id("coachingBookings") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throwError(ErrorCode.NOT_FOUND, "Booking not found")
    }
    if (booking.coachUserId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Only the coach can mark a session complete")
    }
    if (booking.status !== "confirmed") {
      throwError(ErrorCode.INVALID_STATUS, "Booking is not confirmed")
    }

    await ctx.db.patch(args.bookingId, {
      status: "completed",
      updatedAt: Date.now(),
    })

    for (const userId of [booking.renterId, booking.coachUserId]) {
      await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
        userId,
        type: "coaching_completed",
        title: "Coaching session completed",
        message: "Your coaching session has been marked completed.",
        link: "/trips",
        metadata: { bookingId: args.bookingId },
      })
    }

    return args.bookingId
  },
})

// Either party can flag a problem with a confirmed/completed session. This sets a
// lightweight dispute flag surfaced to admins (who can refund or dismiss). No
// full dispute thread — messaging already exists on the linked conversation.
export const reportIssue = mutation({
  args: {
    bookingId: v.id("coachingBookings"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    await rateLimiter.limit(ctx, "createDispute", { key: identity.subject, throws: true })

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throwError(ErrorCode.NOT_FOUND, "Booking not found")
    }
    if (booking.renterId !== identity.subject && booking.coachUserId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized to report an issue on this booking")
    }
    await assertAccountsAvailable(ctx, identity.subject, booking.renterId, booking.coachUserId)
    if (booking.status !== "confirmed" && booking.status !== "completed") {
      throwError(
        ErrorCode.INVALID_STATUS,
        "Only confirmed or completed sessions can be reported"
      )
    }
    if (booking.disputeStatus === "open") {
      throwError(ErrorCode.ALREADY_EXISTS, "An issue is already open for this booking")
    }
    if (!args.reason.trim()) {
      throwError(ErrorCode.INVALID_INPUT, "Please describe the problem")
    }

    const now = Date.now()
    await ctx.db.patch(args.bookingId, {
      disputeStatus: "open",
      issueReportedAt: now,
      issueReportedBy: identity.subject,
      issueReason: sanitizeMessage(args.reason),
      updatedAt: now,
    })

    const otherPartyId =
      identity.subject === booking.coachUserId ? booking.renterId : booking.coachUserId
    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: otherPartyId,
      type: "dispute_update",
      title: "Issue reported on coaching session",
      message: "A problem was reported with a coaching session. Our team will review it.",
      link: identity.subject === booking.coachUserId ? "/trips" : "/coach/dashboard",
      metadata: { bookingId: args.bookingId },
    })

    return args.bookingId
  },
})

// Auto-expire approved bookings the renter never paid for, freeing the dates for
// other requests. Runs hourly via cron. A booking stays "approved" until payment
// confirms it, so status === "approved" past the window means it lapsed unpaid.
export const expireApprovedUnpaidBookings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const APPROVED_TIMEOUT_MS = 48 * 60 * 60 * 1000 // 48 hours
    const now = Date.now()

    const expired = await ctx.db
      .query("coachingBookings")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .filter((q) => q.lt(q.field("approvedAt"), now - APPROVED_TIMEOUT_MS))
      .collect()

    for (const booking of expired) {
      await ctx.db.patch(booking._id, {
        status: "expired",
        cancellationReason: "Approval expired — payment not completed within 48 hours",
        updatedAt: now,
      })

      await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
        userId: booking.renterId,
        type: "coaching_declined",
        title: "Coaching request expired",
        message:
          "Your approved coaching session expired because payment wasn't completed within 48 hours. Request the dates again if they still work.",
        link: `/coaches/${booking.coachProfileId}`,
        metadata: { bookingId: booking._id },
      })
    }

    return { expired: expired.length }
  },
})

// -------- Queries --------

async function enrichBooking(ctx: any, booking: any) {
  const [profile, coachUser, renter] = await Promise.all([
    ctx.db.get(booking.coachProfileId),
    ctx.db
      .query("users")
      .withIndex("by_external_id", (q: any) => q.eq("externalId", booking.coachUserId))
      .first(),
    ctx.db
      .query("users")
      .withIndex("by_external_id", (q: any) => q.eq("externalId", booking.renterId))
      .first(),
  ])
  return {
    ...booking,
    coachProfile: profile,
    coach: publicUserProfile(coachUser),
    renter: publicUserProfile(renter),
  }
}

export const getById = query({
  args: { id: v.id("coachingBookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.id)
    if (!booking) return null
    return await enrichBooking(ctx, booking)
  },
})

export const getByUser = query({
  args: {
    userId: v.string(),
    role: v.union(v.literal("renter"), v.literal("coach")),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("confirmed"),
        v.literal("cancelled"),
        v.literal("completed"),
        v.literal("declined"),
        v.literal("expired")
      )
    ),
  },
  handler: async (ctx, args) => {
    let q
    if (args.role === "renter") {
      q = ctx.db
        .query("coachingBookings")
        .withIndex("by_renter", (i) => i.eq("renterId", args.userId))
    } else {
      q = ctx.db
        .query("coachingBookings")
        .withIndex("by_coach_user", (i) => i.eq("coachUserId", args.userId))
    }
    if (args.status) {
      const status = args.status
      q = q.filter((f) => f.eq(f.field("status"), status))
    }
    const bookings = await q.order("desc").collect()
    return await Promise.all(bookings.map((b) => enrichBooking(ctx, b)))
  },
})

export const getPendingForCoach = query({
  args: { coachUserId: v.string() },
  handler: async (ctx, args) => {
    const bookings = await ctx.db
      .query("coachingBookings")
      .withIndex("by_coach_user_status", (q) =>
        q.eq("coachUserId", args.coachUserId).eq("status", "pending")
      )
      .order("desc")
      .collect()
    return await Promise.all(bookings.map((b) => enrichBooking(ctx, b)))
  },
})

export const getUpcomingForCoach = query({
  args: { coachUserId: v.string() },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0] as string
    const bookings = await ctx.db
      .query("coachingBookings")
      .withIndex("by_coach_user_status", (q) =>
        q.eq("coachUserId", args.coachUserId).eq("status", "confirmed")
      )
      .filter((q) => q.gte(q.field("startDate"), today))
      .order("asc")
      .collect()
    return await Promise.all(bookings.map((b) => enrichBooking(ctx, b)))
  },
})

// -------- Admin --------

export const getCoachingBookingsForAdmin = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("confirmed"),
        v.literal("cancelled"),
        v.literal("completed"),
        v.literal("declined"),
        v.literal("expired")
      )
    ),
    disputeStatus: v.optional(
      v.union(v.literal("open"), v.literal("resolved"), v.literal("dismissed"))
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)
    const limit = args.limit ?? 100

    let bookings
    if (args.disputeStatus) {
      const disputeStatus = args.disputeStatus
      bookings = await ctx.db
        .query("coachingBookings")
        .withIndex("by_dispute_status", (q) => q.eq("disputeStatus", disputeStatus))
        .order("desc")
        .take(limit)
    } else if (args.status) {
      const status = args.status
      bookings = await ctx.db
        .query("coachingBookings")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(limit)
    } else {
      bookings = await ctx.db.query("coachingBookings").order("desc").take(limit)
    }

    return await Promise.all(bookings.map((b) => enrichBooking(ctx, b)))
  },
})

export const getByIdForAdmin = query({
  args: { id: v.id("coachingBookings") },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)
    const booking = await ctx.db.get(args.id)
    if (!booking) return null
    return await enrichBooking(ctx, booking)
  },
})

export const resolveCoachingDispute = mutation({
  args: {
    bookingId: v.id("coachingBookings"),
    resolution: v.union(v.literal("resolved"), v.literal("dismissed")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await checkAdmin(ctx)
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throwError(ErrorCode.NOT_FOUND, "Booking not found")
    }
    if (booking.disputeStatus !== "open") {
      throwError(ErrorCode.INVALID_STATUS, "No open issue on this booking")
    }

    await ctx.db.patch(args.bookingId, {
      disputeStatus: args.resolution,
      updatedAt: Date.now(),
    })

    await ctx.runMutation(internal.auditLog.create, {
      entityType: "coaching_booking",
      entityId: args.bookingId,
      action: "resolve_coaching_dispute",
      userId: identity.subject,
      previousState: { disputeStatus: "open" },
      newState: { disputeStatus: args.resolution },
      metadata: { notes: args.notes },
    })

    return args.bookingId
  },
})

export const getReviewableByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const completed = await ctx.db
      .query("coachingBookings")
      .withIndex("by_renter_status", (q) => q.eq("renterId", args.userId).eq("status", "completed"))
      .order("desc")
      .collect()
    return await Promise.all(
      completed.map(async (booking) => {
        const review = await ctx.db
          .query("coachingReviews")
          .withIndex("by_booking", (q) => q.eq("coachingBookingId", booking._id))
          .first()
        return { ...booking, hasReview: review !== null }
      })
    )
  },
})
