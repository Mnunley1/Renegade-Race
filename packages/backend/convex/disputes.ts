import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import {
  getDisputeCreatedEmailTemplate,
  getDisputeResolvedEmailTemplate,
  getSupportEmail,
  sendTransactionalEmail,
} from "./emails"
import { getWebUrl } from "./helpers"
import { rateLimiter } from "./rateLimiter"

// Create a dispute for a rental completion
export const create = mutation({
  args: {
    completionId: v.id("rentalCompletions"),
    reason: v.string(),
    description: v.string(),
    photos: v.optional(v.array(v.string())),
    requestedResolution: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    // Rate limit: 5 disputes per day per user
    await rateLimiter.limit(ctx, "createDispute", {
      key: identity.subject,
      throws: true,
    })

    const completion = await ctx.db.get(args.completionId)
    if (!completion) {
      throw new Error("Rental completion not found")
    }

    // Check if user is either renter or owner
    if (completion.renterId !== identity.subject && completion.ownerId !== identity.subject) {
      throw new Error("Not authorized to create dispute")
    }

    // Check if completion is in a state that allows disputes
    if (completion.status === "disputed") {
      throw new Error("Dispute already exists for this rental completion")
    }

    if (completion.status !== "pending_owner" && completion.status !== "completed") {
      throw new Error("Disputes can only be created for pending or completed rentals")
    }

    // Update completion status to disputed
    await ctx.db.patch(args.completionId, {
      status: "disputed",
      updatedAt: Date.now(),
    })

    // Create dispute record
    const disputeId = await ctx.db.insert("disputes", {
      completionId: args.completionId,
      reservationId: completion.reservationId,
      vehicleId: completion.vehicleId,
      renterId: completion.renterId,
      ownerId: completion.ownerId,
      createdBy: identity.subject,
      reason: args.reason,
      description: args.description,
      photos: args.photos || [],
      requestedResolution: args.requestedResolution,
      status: "open",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Send emails to both parties and admin about dispute creation
    try {
      const [vehicle, renter, owner] = await Promise.all([
        ctx.db.get(completion.vehicleId),
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", completion.renterId))
          .first(),
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", completion.ownerId))
          .first(),
      ])

      if (vehicle) {
        const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        const webUrl = getWebUrl()
        const disputeUrl = `${webUrl}/disputes/${disputeId}`

        // Email to renter
        if (renter?.email) {
          const template = getDisputeCreatedEmailTemplate({
            userName: renter.name || "Guest",
            vehicleName,
            role: "renter",
            disputeUrl,
          })
          await sendTransactionalEmail(ctx, renter.email, template)
        }

        // Email to owner
        if (owner?.email) {
          const template = getDisputeCreatedEmailTemplate({
            userName: owner.name || "Owner",
            vehicleName,
            role: "owner",
            disputeUrl,
          })
          await sendTransactionalEmail(ctx, owner.email, template)
        }

        // Email to admin
        const supportEmail = getSupportEmail()
        if (supportEmail) {
          const template = getDisputeCreatedEmailTemplate({
            userName: "Admin",
            vehicleName,
            role: "admin",
            disputeUrl: `${webUrl}/admin/disputes/${disputeId}`,
          })
          await sendTransactionalEmail(ctx, supportEmail, template)
        }
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logError } = require("./logger")
      logError(error, "Failed to send dispute created emails")
      // Don't fail the mutation if email fails
    }

    return disputeId
  },
})

// Get dispute by ID
export const getById = query({
  args: { id: v.id("disputes") },
  handler: async (ctx, args) => {
    const dispute = await ctx.db.get(args.id)
    if (!dispute) return null

    // Get related data
    const [completion, reservation, vehicle, renter, owner] = await Promise.all([
      ctx.db.get(dispute.completionId),
      ctx.db.get(dispute.reservationId),
      ctx.db.get(dispute.vehicleId),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", dispute.renterId))
        .first(),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", dispute.ownerId))
        .first(),
    ])

    return {
      ...dispute,
      completion,
      reservation,
      vehicle,
      renter,
      owner,
    }
  },
})

// Get dispute by reservation ID
export const getByReservation = query({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const dispute = await ctx.db
      .query("disputes")
      .withIndex("by_reservation", (q) => q.eq("reservationId", args.reservationId))
      .first()

    if (!dispute) return null

    // Get related data
    const [completion, reservation, vehicle, renter, owner] = await Promise.all([
      ctx.db.get(dispute.completionId),
      ctx.db.get(dispute.reservationId),
      ctx.db.get(dispute.vehicleId),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", dispute.renterId))
        .first(),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", dispute.ownerId))
        .first(),
    ])

    return {
      ...dispute,
      completion,
      reservation,
      vehicle,
      renter,
      owner,
    }
  },
})

// Get disputes for a user
export const getByUser = query({
  args: {
    userId: v.string(),
    role: v.optional(v.union(v.literal("renter"), v.literal("owner"))),
  },
  handler: async (ctx, args) => {
    const { userId, role } = args

    let disputes
    if (role === "renter") {
      disputes = await ctx.db
        .query("disputes")
        .withIndex("by_renter", (q) => q.eq("renterId", userId))
        .order("desc")
        .collect()
    } else if (role === "owner") {
      disputes = await ctx.db
        .query("disputes")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .order("desc")
        .collect()
    } else {
      // Get all disputes where user is either renter or owner
      const renterDisputes = await ctx.db
        .query("disputes")
        .withIndex("by_renter", (q) => q.eq("renterId", userId))
        .collect()
      const ownerDisputes = await ctx.db
        .query("disputes")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .collect()

      // Combine and deduplicate
      const allDisputes = [...renterDisputes, ...ownerDisputes]
      disputes = Array.from(new Map(allDisputes.map((d) => [d._id, d])).values())
      // Sort by creation date descending
      disputes.sort((a, b) => b.createdAt - a.createdAt)
    }

    // Get related data
    const disputesWithDetails = await Promise.all(
      disputes.map(async (dispute) => {
        const [completion, reservation, vehicle, renter, owner] = await Promise.all([
          ctx.db.get(dispute.completionId),
          ctx.db.get(dispute.reservationId),
          ctx.db.get(dispute.vehicleId),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", dispute.renterId))
            .first(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", dispute.ownerId))
            .first(),
        ])

        return {
          ...dispute,
          completion,
          reservation,
          vehicle,
          renter,
          owner,
        }
      })
    )

    return disputesWithDetails
  },
})

// Add a message/update to a dispute
export const addMessage = mutation({
  args: {
    disputeId: v.id("disputes"),
    message: v.string(),
    photos: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const dispute = await ctx.db.get(args.disputeId)
    if (!dispute) {
      throw new Error("Dispute not found")
    }

    // Check if user is involved in the dispute
    if (dispute.renterId !== identity.subject && dispute.ownerId !== identity.subject) {
      throw new Error("Not authorized to add message to this dispute")
    }

    // Check if dispute is still open
    if (dispute.status !== "open") {
      throw new Error("Cannot add messages to a closed dispute")
    }

    // Get existing messages or initialize
    const existingMessages = dispute.messages || []

    // Add new message
    const newMessage = {
      id: Date.now().toString(),
      senderId: identity.subject,
      message: args.message,
      photos: args.photos || [],
      createdAt: Date.now(),
    }

    await ctx.db.patch(args.disputeId, {
      messages: [...existingMessages, newMessage],
      updatedAt: Date.now(),
    })

    return args.disputeId
  },
})

// Resolve a dispute (admin or involved party can resolve)
export const resolve = mutation({
  args: {
    disputeId: v.id("disputes"),
    resolution: v.string(),
    resolutionType: v.union(
      v.literal("resolved_in_favor_renter"),
      v.literal("resolved_in_favor_owner"),
      v.literal("resolved_compromise"),
      v.literal("dismissed")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const dispute = await ctx.db.get(args.disputeId)
    if (!dispute) {
      throw new Error("Dispute not found")
    }

    // Check if user is involved in the dispute or admin
    // For now, allow either party to resolve (in production, you'd want admin-only)
    if (dispute.renterId !== identity.subject && dispute.ownerId !== identity.subject) {
      throw new Error("Not authorized to resolve this dispute")
    }

    if (dispute.status !== "open") {
      throw new Error("Dispute is already resolved")
    }

    // Update dispute status
    await ctx.db.patch(args.disputeId, {
      status: "resolved",
      resolution: args.resolution,
      resolutionType: args.resolutionType,
      resolvedAt: Date.now(),
      resolvedBy: identity.subject,
      updatedAt: Date.now(),
    })

    // Update completion status back to completed if resolved
    if (args.resolutionType === "resolved_compromise" || args.resolutionType === "dismissed") {
      await ctx.db.patch(dispute.completionId, {
        status: "completed",
        updatedAt: Date.now(),
      })
    }

    // Send emails to both parties about dispute resolution
    try {
      const [vehicle, renter, owner] = await Promise.all([
        ctx.db.get(dispute.vehicleId),
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", dispute.renterId))
          .first(),
        ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", dispute.ownerId))
          .first(),
      ])

      if (vehicle) {
        const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        const webUrl = getWebUrl()
        const disputeUrl = `${webUrl}/disputes/${args.disputeId}`

        // Email to renter
        if (renter?.email) {
          const template = getDisputeResolvedEmailTemplate({
            userName: renter.name || "Guest",
            vehicleName,
            resolution: args.resolution,
            disputeUrl,
          })
          await sendTransactionalEmail(ctx, renter.email, template)
        }

        // Email to owner
        if (owner?.email) {
          const template = getDisputeResolvedEmailTemplate({
            userName: owner.name || "Owner",
            vehicleName,
            resolution: args.resolution,
            disputeUrl,
          })
          await sendTransactionalEmail(ctx, owner.email, template)
        }
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logError } = require("./logger")
      logError(error, "Failed to send dispute resolved emails")
      // Don't fail the mutation if email fails
    }

    return args.disputeId
  },
})
