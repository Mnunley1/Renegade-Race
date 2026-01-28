import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import { calculateDaysBetween } from "./dateUtils"
import {
  getReservationCancelledEmailTemplate,
  getReservationCompletedEmailTemplate,
  getReservationConfirmedRenterEmailTemplate,
  getReservationDeclinedRenterEmailTemplate,
  getReservationPendingOwnerEmailTemplate,
  sendTransactionalEmail,
} from "./emails"
import { rateLimiter } from "./rateLimiter"
import { sanitizeMessage, sanitizeShortText } from "./sanitize"

// Get reservations for a user (as renter or owner)
export const getByUser = query({
  args: {
    userId: v.string(),
    role: v.union(v.literal("renter"), v.literal("owner")),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("cancelled"),
        v.literal("completed"),
        v.literal("declined")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { userId, role, status } = args

    let reservationsQuery
    if (role === "renter") {
      reservationsQuery = ctx.db
        .query("reservations")
        .withIndex("by_renter", (q) => q.eq("renterId", userId))
    } else {
      reservationsQuery = ctx.db
        .query("reservations")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    }

    if (status) {
      reservationsQuery = reservationsQuery.filter((q) => q.eq(q.field("status"), status))
    }

    const reservations = await reservationsQuery.order("desc").collect()

    // Get vehicle and user details
    const reservationsWithDetails = await Promise.all(
      reservations.map(async (reservation) => {
        const [vehicle, renter, owner] = await Promise.all([
          ctx.db.get(reservation.vehicleId),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", reservation.renterId))
            .first(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", reservation.ownerId))
            .first(),
        ])

        // Get vehicle images if vehicle exists
        let vehicleWithImages = vehicle
        if (vehicle) {
          const images = await ctx.db
            .query("vehicleImages")
            .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicle._id as Id<"vehicles">))
            .order("asc")
            .collect()

          vehicleWithImages = {
            ...vehicle,
            images,
          } as typeof vehicle & { images: typeof images }
        }

        return {
          ...reservation,
          vehicle: vehicleWithImages,
          renter,
          owner,
        }
      })
    )

    return reservationsWithDetails
  },
})

// Get reservation by ID
export const getById = query({
  args: { id: v.id("reservations") },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.id)
    if (!reservation) {
      return null
    }

    const [vehicle, renter, owner] = await Promise.all([
      ctx.db.get(reservation.vehicleId),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", reservation.renterId))
        .first(),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", reservation.ownerId))
        .first(),
    ])

    // Get vehicle images if vehicle exists
    let vehicleWithImages = vehicle
    if (vehicle) {
      const images = await ctx.db
        .query("vehicleImages")
        .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicle._id))
        .order("asc")
        .collect()

      vehicleWithImages = {
        ...vehicle,
        images,
      } as typeof vehicle & { images: typeof images }
    }

    return {
      ...reservation,
      vehicle: vehicleWithImages,
      renter,
      owner,
    }
  },
})

// Create a new reservation
export const create = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    startDate: v.string(),
    endDate: v.string(),
    pickupTime: v.optional(v.string()),
    dropoffTime: v.optional(v.string()),
    renterMessage: v.optional(v.string()),
    addOns: v.optional(
      v.array(
        v.object({
          name: v.string(),
          price: v.number(),
          description: v.optional(v.string()),
          priceType: v.optional(v.union(v.literal("daily"), v.literal("one-time"))),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    // Rate limit: 10 reservations per hour per user
    await rateLimiter.limit(ctx, "createReservation", {
      key: identity.subject,
      throws: true,
    })

    const renterId = identity.subject
    const now = Date.now()

    // Get vehicle details
    const vehicle = await ctx.db.get(args.vehicleId)
    if (!vehicle) {
      throw new Error("Vehicle not found")
    }

    if (vehicle.ownerId === renterId) {
      throw new Error("Cannot book your own vehicle")
    }

    // Check if either party has blocked the other
    const block1 = await ctx.db
      .query("userBlocks")
      .withIndex("by_blocker_blocked", (q) =>
        q.eq("blockerId", renterId).eq("blockedUserId", vehicle.ownerId)
      )
      .first()

    const block2 = await ctx.db
      .query("userBlocks")
      .withIndex("by_blocker_blocked", (q) =>
        q.eq("blockerId", vehicle.ownerId).eq("blockedUserId", renterId)
      )
      .first()

    if (block1 || block2) {
      throw new Error("Cannot book vehicles from blocked users")
    }

    // Calculate total days and amount
    // Use date utility to avoid timezone issues
    const totalDays = calculateDaysBetween(args.startDate, args.endDate)

    if (totalDays <= 0) {
      throw new Error("Invalid date range")
    }

    // Monetary validation for daily rate
    const MAX_DAILY_RATE_CENTS = 5_000_000 // $50,000 per day max
    const MIN_DAILY_RATE_CENTS = 100 // $1 per day min

    if (vehicle.dailyRate <= 0 || vehicle.dailyRate < MIN_DAILY_RATE_CENTS) {
      throw new Error("Daily rate must be at least $1.00")
    }

    if (vehicle.dailyRate > MAX_DAILY_RATE_CENTS) {
      throw new Error("Daily rate cannot exceed $50,000.00 per day")
    }

    // Calculate base amount from daily rate
    const baseAmount = totalDays * vehicle.dailyRate

    // Add add-ons to total amount
    let addOnsTotal = 0
    if (args.addOns && args.addOns.length > 0) {
      // Validate all add-on prices are non-negative
      for (const addOn of args.addOns) {
        if (addOn.price < 0) {
          throw new Error(`Add-on price for ${addOn.name} cannot be negative`)
        }
        // Validate reasonable max for add-ons
        if (addOn.price > 100_000) {
          // $1,000 max per add-on
          throw new Error(`Add-on price for ${addOn.name} cannot exceed $1,000.00`)
        }
      }
      addOnsTotal = args.addOns.reduce((sum, addOn) => sum + addOn.price, 0)
    }

    const totalAmount = baseAmount + addOnsTotal

    // Validate total amount
    const MAX_TOTAL_AMOUNT_CENTS = 1_000_000 // $10,000 max
    const MIN_TOTAL_AMOUNT_CENTS = 100 // $1 min

    if (totalAmount < MIN_TOTAL_AMOUNT_CENTS) {
      throw new Error("Total amount must be at least $1.00")
    }

    if (totalAmount > MAX_TOTAL_AMOUNT_CENTS) {
      throw new Error("Total amount cannot exceed $10,000.00")
    }

    // Check availability
    const availability = await ctx.db
      .query("availability")
      .withIndex("by_vehicle_date", (q) => q.eq("vehicleId", args.vehicleId))
      .filter((q) =>
        q.and(q.gte(q.field("date"), args.startDate), q.lte(q.field("date"), args.endDate))
      )
      .collect()

    const blockedDates = availability.filter((a) => !a.isAvailable)
    if (blockedDates.length > 0) {
      throw new Error("Selected dates are not available")
    }

    // Check for conflicting reservations
    // Two date ranges overlap if: existingStart <= newEnd AND existingEnd >= newStart
    const potentialConflicts = await ctx.db
      .query("reservations")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .filter((q) =>
        q.and(
          // Only check active reservations (pending or confirmed)
          q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "confirmed")),
          // Check for date overlap: existing reservation overlaps if
          // existingStart <= newEnd AND existingEnd >= newStart
          q.and(
            q.lte(q.field("startDate"), args.endDate),
            q.gte(q.field("endDate"), args.startDate)
          )
        )
      )
      .collect()

    // Filter out stale pending reservations without payment
    // For pending reservations without payment, only block if created recently (15 min grace period)
    // This prevents abandoned checkouts from permanently blocking vehicles
    const PENDING_GRACE_PERIOD_MS = 15 * 60 * 1000 // 15 minutes

    const conflictingReservations = potentialConflicts.filter((reservation) => {
      // Confirmed reservations always block
      if (reservation.status === "confirmed") {
        return true
      }

      // Pending reservations with payment always block
      if (reservation.paymentId) {
        return true
      }

      // Pending reservations without payment only block if created recently
      const age = now - reservation.createdAt
      return age < PENDING_GRACE_PERIOD_MS
    })

    if (conflictingReservations.length > 0) {
      throw new Error("Selected dates conflict with existing reservations")
    }

    // Create the reservation with sanitized content
    const reservationId = await ctx.db.insert("reservations", {
      vehicleId: args.vehicleId,
      renterId,
      ownerId: vehicle.ownerId,
      startDate: args.startDate,
      endDate: args.endDate,
      pickupTime: args.pickupTime,
      dropoffTime: args.dropoffTime,
      totalDays,
      dailyRate: vehicle.dailyRate,
      totalAmount,
      status: "pending",
      renterMessage: args.renterMessage ? sanitizeMessage(args.renterMessage) : undefined,
      addOns: args.addOns,
      createdAt: now,
      updatedAt: now,
    })

    // Re-check for conflicts after insert to prevent race conditions
    // This handles the case where two users book the same dates simultaneously
    // Fetch our own reservation to get its _creationTime (set by Convex during insert)
    const ourReservation = await ctx.db.get(reservationId)
    if (!ourReservation) {
      throw new Error("Failed to create reservation")
    }
    const ourCreationTime = ourReservation._creationTime

    const concurrentConflicts = await ctx.db
      .query("reservations")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .filter((q) =>
        q.and(
          // Exclude our own reservation
          q.neq(q.field("_id"), reservationId),
          // Only check active reservations
          q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "confirmed")),
          // Check for date overlap
          q.and(
            q.lte(q.field("startDate"), args.endDate),
            q.gte(q.field("endDate"), args.startDate)
          )
        )
      )
      .collect()

    // Check if any concurrent reservation was created after our initial check
    // Use Convex _creationTime for reliable ordering (set atomically by database)
    const actualConflicts = concurrentConflicts.filter((reservation) => {
      if (reservation.status === "confirmed") {
        return true
      }
      if (reservation.paymentId) {
        return true
      }
      // For pending without payment, only conflict if created before our reservation
      // using _creationTime (set by Convex) for reliable ordering
      return reservation._creationTime < ourCreationTime
    })

    if (actualConflicts.length > 0) {
      // Roll back our reservation - another user won the race
      await ctx.db.delete(reservationId)
      throw new Error(
        "Selected dates conflict with a reservation that was just created. Please try different dates."
      )
    }

    // Send email to owner about new reservation request
    try {
      const [owner, renter] = await Promise.all([
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", vehicle.ownerId))
          .first(),
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", renterId))
          .first(),
      ])

      const ownerEmail = owner?.email || (identity as any).email
      const renterName = renter?.name || identity.name || "Guest"
      const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`

      if (ownerEmail) {
        const webUrl = process.env.WEB_URL || "https://renegaderentals.com"
        const template = getReservationPendingOwnerEmailTemplate({
          ownerName: owner?.name || "Owner",
          renterName,
          vehicleName,
          startDate: args.startDate,
          endDate: args.endDate,
          totalAmount,
          renterMessage: args.renterMessage,
          reservationUrl: `${webUrl}/host/reservations`,
        })
        await sendTransactionalEmail(ctx, ownerEmail, template)
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logError } = require("./logger")
      logError(error, "Failed to send reservation created email")
      // Don't fail the mutation if email fails
    }

    return reservationId
  },
})

// Approve a reservation
export const approve = mutation({
  args: {
    reservationId: v.id("reservations"),
    ownerMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const reservation = await ctx.db.get(args.reservationId)
    if (!reservation) {
      throw new Error("Reservation not found")
    }

    if (reservation.ownerId !== identity.subject) {
      throw new Error("Not authorized to approve this reservation")
    }

    if (reservation.status !== "pending") {
      throw new Error("Reservation is not pending")
    }

    await ctx.db.patch(args.reservationId, {
      status: "confirmed",
      ownerMessage: args.ownerMessage ? sanitizeMessage(args.ownerMessage) : undefined,
      updatedAt: Date.now(),
    })

    // Trigger notification for renter
    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: reservation.renterId,
      type: "reservation_approved",
      title: "Reservation Approved",
      message: "Your reservation has been approved by the host.",
      link: "/trips",
      metadata: {
        reservationId: args.reservationId,
      },
    })

    // Send email to renter about confirmed reservation
    try {
      const [vehicle, renter] = await Promise.all([
        ctx.db.get(reservation.vehicleId),
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", reservation.renterId))
          .first(),
      ])

      if (vehicle && renter) {
        const renterEmail = renter.email
        const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`

        if (renterEmail) {
          const webUrl = process.env.WEB_URL || "https://renegaderentals.com"
          const template = getReservationConfirmedRenterEmailTemplate({
            renterName: renter.name || "Guest",
            vehicleName,
            startDate: reservation.startDate,
            endDate: reservation.endDate,
            totalAmount: reservation.totalAmount,
            ownerMessage: args.ownerMessage,
            reservationUrl: `${webUrl}/trips`,
          })
          await sendTransactionalEmail(ctx, renterEmail, template)
        }
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logError } = require("./logger")
      logError(error, "Failed to send reservation confirmed email")
      // Don't fail the mutation if email fails
    }

    return args.reservationId
  },
})

// Decline a reservation
export const decline = mutation({
  args: {
    reservationId: v.id("reservations"),
    ownerMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const reservation = await ctx.db.get(args.reservationId)
    if (!reservation) {
      throw new Error("Reservation not found")
    }

    if (reservation.ownerId !== identity.subject) {
      throw new Error("Not authorized to decline this reservation")
    }

    if (reservation.status !== "pending") {
      throw new Error("Reservation is not pending")
    }

    await ctx.db.patch(args.reservationId, {
      status: "declined",
      ownerMessage: args.ownerMessage ? sanitizeMessage(args.ownerMessage) : undefined,
      updatedAt: Date.now(),
    })

    // Trigger notification for renter
    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: reservation.renterId,
      type: "reservation_declined",
      title: "Reservation Declined",
      message: "Your reservation request has been declined.",
      link: `/vehicles/${reservation.vehicleId}`,
      metadata: {
        reservationId: args.reservationId,
      },
    })

    // Send email to renter about declined reservation
    try {
      const [vehicle, renter] = await Promise.all([
        ctx.db.get(reservation.vehicleId),
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", reservation.renterId))
          .first(),
      ])

      if (vehicle && renter) {
        const renterEmail = renter.email
        const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`

        if (renterEmail) {
          const template = getReservationDeclinedRenterEmailTemplate({
            renterName: renter.name || "Guest",
            vehicleName,
            ownerMessage: args.ownerMessage,
          })
          await sendTransactionalEmail(ctx, renterEmail, template)
        }
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logError } = require("./logger")
      logError(error, "Failed to send reservation declined email")
      // Don't fail the mutation if email fails
    }

    return args.reservationId
  },
})

// Cancel a reservation
export const cancel = mutation({
  args: {
    reservationId: v.id("reservations"),
    cancellationReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const reservation = await ctx.db.get(args.reservationId)
    if (!reservation) {
      throw new Error("Reservation not found")
    }

    if (reservation.renterId !== identity.subject && reservation.ownerId !== identity.subject) {
      throw new Error("Not authorized to cancel this reservation")
    }

    if (reservation.status !== "pending" && reservation.status !== "confirmed") {
      throw new Error("Reservation cannot be cancelled")
    }

    await ctx.db.patch(args.reservationId, {
      status: "cancelled",
      cancellationReason: args.cancellationReason
        ? sanitizeShortText(args.cancellationReason)
        : undefined,
      updatedAt: Date.now(),
    })

    // Detect if the canceller is the owner
    const isOwnerCancelling = identity.subject === reservation.ownerId

    // Trigger notification for the other party
    const otherPartyId = isOwnerCancelling ? reservation.renterId : reservation.ownerId
    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: otherPartyId,
      type: "reservation_cancelled",
      title: "Reservation Cancelled",
      message: "A reservation has been cancelled.",
      link: isOwnerCancelling ? "/trips" : "/host/reservations",
      metadata: {
        reservationId: args.reservationId,
      },
    })

    // Process automatic refund if payment exists and is paid
    if (reservation.paymentId) {
      try {
        const payment = await ctx.db.get(reservation.paymentId)
        if (payment && payment.status === "succeeded" && payment.stripeChargeId) {
          // If owner is cancelling a confirmed reservation, force 100% refund
          const forceFullRefund = isOwnerCancelling && reservation.status === "confirmed"

          // Schedule refund processing (use scheduler to call internal action)
          await ctx.scheduler.runAfter(0, internal.stripe.processRefundOnCancellation, {
            paymentId: reservation.paymentId,
            reservationId: args.reservationId,
            reason: args.cancellationReason || "Reservation cancelled",
            forceFullRefund,
          })

          // If owner cancelled a confirmed reservation, increment their cancellation count
          if (forceFullRefund) {
            const owner = await ctx.db
              .query("users")
              .withIndex("by_external_id", (q) => q.eq("externalId", reservation.ownerId))
              .first()

            if (owner) {
              await ctx.db.patch(owner._id, {
                ownerCancellationCount: (owner.ownerCancellationCount || 0) + 1,
              })
            }
          }
        }
      } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { logError } = require("./logger")
        logError(error, "Failed to initiate refund on cancellation")
        // Don't fail the cancellation if refund initiation fails
        // The refund can be processed manually later
      }
    }

    // Send emails to both parties about cancelled reservation
    try {
      const [vehicle, renter, owner] = await Promise.all([
        ctx.db.get(reservation.vehicleId),
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", reservation.renterId))
          .first(),
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", reservation.ownerId))
          .first(),
      ])

      if (vehicle) {
        const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        const _isRenter = reservation.renterId === identity.subject

        // Email to renter
        if (renter?.email) {
          const template = getReservationCancelledEmailTemplate({
            userName: renter.name || "Guest",
            vehicleName,
            role: "renter",
            cancellationReason: args.cancellationReason,
          })
          await sendTransactionalEmail(ctx, renter.email, template)
        }

        // Email to owner
        if (owner?.email) {
          const template = getReservationCancelledEmailTemplate({
            userName: owner.name || "Owner",
            vehicleName,
            role: "owner",
            cancellationReason: args.cancellationReason,
          })
          await sendTransactionalEmail(ctx, owner.email, template)
        }
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logError } = require("./logger")
      logError(error, "Failed to send reservation cancelled emails")
      // Don't fail the mutation if email fails
    }

    return args.reservationId
  },
})

// Complete a reservation
export const complete = mutation({
  args: {
    reservationId: v.id("reservations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const reservation = await ctx.db.get(args.reservationId)
    if (!reservation) {
      throw new Error("Reservation not found")
    }

    if (reservation.ownerId !== identity.subject) {
      throw new Error("Not authorized to complete this reservation")
    }

    if (reservation.status !== "confirmed") {
      throw new Error("Reservation is not confirmed")
    }

    await ctx.db.patch(args.reservationId, {
      status: "completed",
      updatedAt: Date.now(),
    })

    // Trigger notifications for both parties
    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: reservation.renterId,
      type: "reservation_completed",
      title: "Reservation Completed",
      message: "Your reservation has been completed. Please leave a review!",
      link: `/review/${args.reservationId}`,
      metadata: {
        reservationId: args.reservationId,
      },
    })

    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: reservation.ownerId,
      type: "reservation_completed",
      title: "Reservation Completed",
      message: "A reservation has been completed. Please leave a review!",
      link: `/review/${args.reservationId}`,
      metadata: {
        reservationId: args.reservationId,
      },
    })

    // Send emails to both parties about completed reservation (prompt for review)
    try {
      const [vehicle, renter, owner] = await Promise.all([
        ctx.db.get(reservation.vehicleId),
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", reservation.renterId))
          .first(),
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", reservation.ownerId))
          .first(),
      ])

      if (vehicle) {
        const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        const webUrl = process.env.WEB_URL || "https://renegaderentals.com"

        // Email to renter (prompt to review owner/vehicle)
        if (renter?.email) {
          const template = getReservationCompletedEmailTemplate({
            userName: renter.name || "Guest",
            vehicleName,
            role: "renter",
            reviewUrl: `${webUrl}/review/${reservation._id}`,
          })
          await sendTransactionalEmail(ctx, renter.email, template)
        }

        // Email to owner (prompt to review renter)
        if (owner?.email) {
          const template = getReservationCompletedEmailTemplate({
            userName: owner.name || "Owner",
            vehicleName,
            role: "owner",
            reviewUrl: `${webUrl}/review/${reservation._id}`,
          })
          await sendTransactionalEmail(ctx, owner.email, template)
        }
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logError } = require("./logger")
      logError(error, "Failed to send reservation completed emails")
      // Don't fail the mutation if email fails
    }

    return args.reservationId
  },
})

// Get pending reservations for an owner
export const getPendingForOwner = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_owner_status", (q) => q.eq("ownerId", args.ownerId).eq("status", "pending"))
      .order("desc")
      .collect()

    // Get vehicle and renter details
    const reservationsWithDetails = await Promise.all(
      reservations.map(async (reservation) => {
        const [vehicle, renter] = await Promise.all([
          ctx.db.get(reservation.vehicleId),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", reservation.renterId))
            .first(),
        ])

        return {
          ...reservation,
          vehicle,
          renter,
        }
      })
    )

    return reservationsWithDetails
  },
})

// Get confirmed reservations for an owner
export const getConfirmedForOwner = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_owner_status", (q) => q.eq("ownerId", args.ownerId).eq("status", "confirmed"))
      .order("desc")
      .collect()

    // Get vehicle and renter details
    const reservationsWithDetails = await Promise.all(
      reservations.map(async (reservation) => {
        const [vehicle, renter] = await Promise.all([
          ctx.db.get(reservation.vehicleId),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", reservation.renterId))
            .first(),
        ])

        return {
          ...reservation,
          vehicle,
          renter,
        }
      })
    )

    return reservationsWithDetails
  },
})

// Get upcoming reservations for a user
export const getUpcoming = query({
  args: {
    userId: v.string(),
    role: v.union(v.literal("renter"), v.literal("owner")),
  },
  handler: async (ctx, args) => {
    const { userId, role } = args
    const today = new Date().toISOString().split("T")[0] as string

    let reservationsQuery
    if (role === "renter") {
      reservationsQuery = ctx.db
        .query("reservations")
        .withIndex("by_renter_status", (q) => q.eq("renterId", userId).eq("status", "confirmed"))
    } else {
      reservationsQuery = ctx.db
        .query("reservations")
        .withIndex("by_owner_status", (q) => q.eq("ownerId", userId).eq("status", "confirmed"))
    }

    const reservations = await reservationsQuery
      .filter((q) => q.gte(q.field("startDate"), today))
      .order("asc")
      .collect()

    // Get vehicle and user details
    const reservationsWithDetails = await Promise.all(
      reservations.map(async (reservation) => {
        const [vehicle, renter, owner] = await Promise.all([
          ctx.db.get(reservation.vehicleId),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", reservation.renterId))
            .first(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", reservation.ownerId))
            .first(),
        ])

        return {
          ...reservation,
          vehicle,
          renter,
          owner,
        }
      })
    )

    return reservationsWithDetails
  },
})

// Get completed reservation for a specific vehicle by a user (for review purposes)
export const getCompletedReservationForVehicle = query({
  args: {
    userId: v.string(),
    vehicleId: v.id("vehicles"),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db
      .query("reservations")
      .withIndex("by_renter_status", (q) => q.eq("renterId", args.userId).eq("status", "completed"))
      .filter((q) => q.eq(q.field("vehicleId"), args.vehicleId))
      .order("desc")
      .first()

    if (!reservation) {
      return null
    }

    // Get related data
    const [vehicle, renter, owner] = await Promise.all([
      ctx.db.get(reservation.vehicleId),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", reservation.renterId))
        .first(),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", reservation.ownerId))
        .first(),
    ])

    return {
      ...reservation,
      vehicle,
      renter,
      owner,
    }
  },
})

// ============================================================================
// Cleanup Functions for Stale Pending Reservations
// ============================================================================

/**
 * Clean up stale pending reservations without payment.
 * This should be called periodically (e.g., by a cron job) to:
 * - Cancel pending reservations without payment that are older than 15 minutes
 * - This frees up vehicle availability for other users
 *
 * Called via: ctx.scheduler or cron.ts
 */
export const cleanupStalePendingReservations = mutation({
  args: {},
  handler: async (ctx) => {
    const STALE_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutes
    const now = Date.now()
    const cutoffTime = now - STALE_THRESHOLD_MS

    // Find all pending reservations without payment that are older than 15 minutes
    const staleReservations = await ctx.db
      .query("reservations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .filter((q) =>
        q.and(
          // No payment associated
          q.eq(q.field("paymentId"), undefined),
          // Created more than 15 minutes ago
          q.lt(q.field("createdAt"), cutoffTime)
        )
      )
      .collect()

    // Cancel each stale reservation
    const cancelledIds: Id<"reservations">[] = []
    for (const reservation of staleReservations) {
      await ctx.db.patch(reservation._id, {
        status: "cancelled",
        cancellationReason: "Automatically cancelled - checkout not completed within 15 minutes",
        updatedAt: now,
      })
      cancelledIds.push(reservation._id)
    }

    return {
      cleanedUp: cancelledIds.length,
      reservationIds: cancelledIds,
    }
  },
})
