import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import { checkAdmin } from "./admin"
import { ErrorCode, throwError } from "./errors"
import { imagePresets } from "./r2"

const addOnValidator = v.array(
  v.object({
    name: v.string(),
    price: v.number(),
    description: v.optional(v.string()),
    isRequired: v.optional(v.boolean()),
    priceType: v.optional(v.union(v.literal("daily"), v.literal("one-time"))),
  })
)

const pricingUnitValidator = v.union(
  v.literal("hour"),
  v.literal("half_day"),
  v.literal("full_day"),
  v.literal("session")
)

const imageArgs = v.array(
  v.object({
    r2Key: v.string(),
    isPrimary: v.boolean(),
    order: v.number(),
    metadata: v.optional(
      v.object({
        fileName: v.string(),
        originalSize: v.number(),
        processedSizes: v.object({
          thumbnail: v.number(),
          card: v.number(),
          detail: v.number(),
          hero: v.number(),
        }),
      })
    ),
  })
)

/** Public coach listings (active + approved + Stripe-enabled coach), with images. */
export const listPublic = query({
  args: {
    trackId: v.optional(v.id("tracks")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { trackId, limit = 50 } = args
    const identity = await ctx.auth.getUserIdentity()
    const currentUserId = identity?.subject

    let rows: Doc<"coachServices">[]
    if (trackId) {
      rows = await ctx.db
        .query("coachServices")
        .withIndex("by_track", (q) => q.eq("trackId", trackId))
        .filter((q) =>
          q.and(
            q.eq(q.field("isActive"), true),
            q.eq(q.field("isApproved"), true),
            q.eq(q.field("deletedAt"), undefined),
            q.neq(q.field("isSuspended"), true)
          )
        )
        .order("desc")
        .take(limit)
    } else {
      rows = await ctx.db
        .query("coachServices")
        .withIndex("by_active_approved", (q) => q.eq("isActive", true).eq("isApproved", true))
        .filter((q) =>
          q.and(q.eq(q.field("deletedAt"), undefined), q.neq(q.field("isSuspended"), true))
        )
        .order("desc")
        .take(limit)
    }

    if (currentUserId) {
      rows = rows.filter((s) => s.coachId !== currentUserId)
    }

    const withDetails = await Promise.all(
      rows.map(async (service) => {
        const [images, coach, track] = await Promise.all([
          ctx.db
            .query("coachServiceImages")
            .withIndex("by_coach_service", (q) => q.eq("coachServiceId", service._id))
            .order("asc")
            .collect(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", service.coachId))
            .first(),
          service.trackId ? ctx.db.get(service.trackId) : Promise.resolve(null),
        ])

        if (!coach?.stripeAccountId || coach.stripeAccountStatus !== "enabled") {
          return null
        }

        const optimizedImages = images
          .filter((image) => image.r2Key)
          .map((image) => ({
            ...image,
            thumbnailUrl: imagePresets.thumbnail(image.r2Key as string),
            cardUrl: imagePresets.card(image.r2Key as string),
            detailUrl: imagePresets.detail(image.r2Key as string),
            heroUrl: imagePresets.hero(image.r2Key as string),
            originalUrl: imagePresets.original(image.r2Key as string),
          }))

        return {
          ...service,
          images: optimizedImages,
          coach,
          track,
        }
      })
    )

    return withDetails.filter((x) => x !== null)
  },
})

export const getById = query({
  args: { coachServiceId: v.id("coachServices") },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.coachServiceId)
    if (!service || service.deletedAt) {
      return null
    }

    const [images, coach, track] = await Promise.all([
      ctx.db
        .query("coachServiceImages")
        .withIndex("by_coach_service", (q) => q.eq("coachServiceId", service._id))
        .order("asc")
        .collect(),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", service.coachId))
        .first(),
      service.trackId ? ctx.db.get(service.trackId) : Promise.resolve(null),
    ])

    const optimizedImages = images
      .filter((image) => image.r2Key)
      .map((image) => ({
        ...image,
        thumbnailUrl: imagePresets.thumbnail(image.r2Key as string),
        cardUrl: imagePresets.card(image.r2Key as string),
        detailUrl: imagePresets.detail(image.r2Key as string),
        heroUrl: imagePresets.hero(image.r2Key as string),
        originalUrl: imagePresets.original(image.r2Key as string),
      }))

    return {
      ...service,
      images: optimizedImages,
      coach,
      track,
    }
  },
})

/** Public marketplace detail: active, approved, Stripe-enabled coach only. */
export const getPublicById = query({
  args: { coachServiceId: v.id("coachServices") },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.coachServiceId)
    if (
      !service ||
      service.deletedAt ||
      !service.isActive ||
      service.isSuspended ||
      !service.isApproved
    ) {
      return null
    }

    const [images, coach, track] = await Promise.all([
      ctx.db
        .query("coachServiceImages")
        .withIndex("by_coach_service", (q) => q.eq("coachServiceId", service._id))
        .order("asc")
        .collect(),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", service.coachId))
        .first(),
      service.trackId ? ctx.db.get(service.trackId) : Promise.resolve(null),
    ])

    if (!coach?.stripeAccountId || coach.stripeAccountStatus !== "enabled") {
      return null
    }

    const optimizedImages = images
      .filter((image) => image.r2Key)
      .map((image) => ({
        ...image,
        thumbnailUrl: imagePresets.thumbnail(image.r2Key as string),
        cardUrl: imagePresets.card(image.r2Key as string),
        detailUrl: imagePresets.detail(image.r2Key as string),
        heroUrl: imagePresets.hero(image.r2Key as string),
        originalUrl: imagePresets.original(image.r2Key as string),
      }))

    return {
      ...service,
      images: optimizedImages,
      coach,
      track,
    }
  },
})

export const listByCoach = query({
  args: {
    coachId: v.string(),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let rows = await ctx.db
      .query("coachServices")
      .withIndex("by_coach_active", (q) => q.eq("coachId", args.coachId).eq("isActive", true))
      .order("desc")
      .collect()

    if (!args.includeDeleted) {
      rows = rows.filter((s) => !s.deletedAt)
    }

    return await Promise.all(
      rows.map(async (service) => {
        const [images, track] = await Promise.all([
          ctx.db
            .query("coachServiceImages")
            .withIndex("by_coach_service", (q) => q.eq("coachServiceId", service._id))
            .order("asc")
            .collect(),
          service.trackId ? ctx.db.get(service.trackId) : Promise.resolve(null),
        ])

        const optimizedImages = images
          .filter((image) => image.r2Key)
          .map((image) => ({
            ...image,
            thumbnailUrl: imagePresets.thumbnail(image.r2Key as string),
            cardUrl: imagePresets.card(image.r2Key as string),
            detailUrl: imagePresets.detail(image.r2Key as string),
            heroUrl: imagePresets.hero(image.r2Key as string),
            originalUrl: imagePresets.original(image.r2Key as string),
          }))

        return { ...service, images: optimizedImages, track }
      })
    )
  },
})

export const createWithImages = mutation({
  args: {
    trackId: v.optional(v.id("tracks")),
    title: v.string(),
    description: v.string(),
    baseRate: v.number(),
    pricingUnit: pricingUnitValidator,
    addOns: v.optional(addOnValidator),
    specialties: v.array(v.string()),
    certifications: v.optional(v.array(v.string())),
    maxParticipants: v.optional(v.number()),
    languages: v.optional(v.array(v.string())),
    address: v.optional(
      v.object({
        street: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        zipCode: v.string(),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
      })
    ),
    cancellationPolicy: v.optional(
      v.union(v.literal("flexible"), v.literal("moderate"), v.literal("strict"))
    ),
    travelSurcharges: v.optional(
      v.array(
        v.object({
          trackId: v.id("tracks"),
          amount: v.number(),
          label: v.optional(v.string()),
        })
      )
    ),
    images: imageArgs,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const coachId = identity.subject
    const now = Date.now()

    let trackId = args.trackId
    if (!trackId) {
      const defaultTrack = await ctx.db
        .query("tracks")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .first()
      if (!defaultTrack) {
        throwError(ErrorCode.NOT_FOUND, "No active tracks available. Please select a track.")
      }
      trackId = defaultTrack._id
    }

    const coachServiceId = await ctx.db.insert("coachServices", {
      coachId,
      trackId,
      title: args.title.trim(),
      description: args.description.trim(),
      baseRate: args.baseRate,
      pricingUnit: args.pricingUnit,
      addOns: args.addOns ?? [],
      specialties: args.specialties,
      certifications: args.certifications,
      maxParticipants: args.maxParticipants,
      languages: args.languages,
      address: args.address,
      cancellationPolicy: args.cancellationPolicy ?? "moderate",
      travelSurcharges: args.travelSurcharges,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })

    await Promise.all(
      args.images.map((image) =>
        ctx.db.insert("coachServiceImages", {
          coachServiceId,
          r2Key: image.r2Key,
          isPrimary: image.isPrimary,
          order: image.order,
          metadata: image.metadata,
        })
      )
    )

    const user = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", coachId))
      .first()

    if (user) {
      await ctx.db.patch(user._id, {
        isCoach: true,
        coachOnboardingStatus:
          user.coachOnboardingStatus === "not_started" || !user.coachOnboardingStatus
            ? "in_progress"
            : user.coachOnboardingStatus,
      })
    }

    return coachServiceId
  },
})

export const update = mutation({
  args: {
    coachServiceId: v.id("coachServices"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    baseRate: v.optional(v.number()),
    pricingUnit: v.optional(pricingUnitValidator),
    addOns: v.optional(addOnValidator),
    specialties: v.optional(v.array(v.string())),
    certifications: v.optional(v.array(v.string())),
    maxParticipants: v.optional(v.number()),
    languages: v.optional(v.array(v.string())),
    trackId: v.optional(v.id("tracks")),
    address: v.optional(
      v.object({
        street: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        zipCode: v.string(),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
      })
    ),
    cancellationPolicy: v.optional(
      v.union(v.literal("flexible"), v.literal("moderate"), v.literal("strict"))
    ),
    travelSurcharges: v.optional(
      v.array(
        v.object({
          trackId: v.id("tracks"),
          amount: v.number(),
          label: v.optional(v.string()),
        })
      )
    ),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const existing = await ctx.db.get(args.coachServiceId)
    if (!existing || existing.deletedAt) {
      throwError(ErrorCode.NOT_FOUND, "Coach service not found")
    }
    if (existing.coachId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized to update this coach service")
    }

    const { coachServiceId: _id, ...rest } = args
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (rest.title !== undefined) patch.title = rest.title.trim()
    if (rest.description !== undefined) patch.description = rest.description.trim()
    if (rest.baseRate !== undefined) patch.baseRate = rest.baseRate
    if (rest.pricingUnit !== undefined) patch.pricingUnit = rest.pricingUnit
    if (rest.addOns !== undefined) patch.addOns = rest.addOns
    if (rest.specialties !== undefined) patch.specialties = rest.specialties
    if (rest.certifications !== undefined) patch.certifications = rest.certifications
    if (rest.maxParticipants !== undefined) patch.maxParticipants = rest.maxParticipants
    if (rest.languages !== undefined) patch.languages = rest.languages
    if (rest.trackId !== undefined) patch.trackId = rest.trackId
    if (rest.address !== undefined) patch.address = rest.address
    if (rest.cancellationPolicy !== undefined) patch.cancellationPolicy = rest.cancellationPolicy
    if (rest.travelSurcharges !== undefined) patch.travelSurcharges = rest.travelSurcharges
    if (rest.isActive !== undefined) patch.isActive = rest.isActive

    await ctx.db.patch(args.coachServiceId, patch as Partial<typeof existing>)
    return args.coachServiceId
  },
})

export const softDelete = mutation({
  args: { coachServiceId: v.id("coachServices") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const existing = await ctx.db.get(args.coachServiceId)
    if (!existing) {
      throwError(ErrorCode.NOT_FOUND, "Coach service not found")
    }
    if (existing.coachId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized")
    }

    const now = Date.now()
    await ctx.db.patch(args.coachServiceId, {
      deletedAt: now,
      isActive: false,
      updatedAt: now,
    })
    return args.coachServiceId
  },
})

export const approveCoachService = mutation({
  args: { coachServiceId: v.id("coachServices") },
  handler: async (ctx, args) => {
    const identity = await checkAdmin(ctx)

    const service = await ctx.db.get(args.coachServiceId)
    if (!service) {
      throw new Error("Coach service not found")
    }

    await ctx.db.patch(args.coachServiceId, {
      isApproved: true,
      updatedAt: Date.now(),
    })

    await ctx.runMutation(internal.auditLog.create, {
      entityType: "coach_service",
      entityId: args.coachServiceId,
      action: "approve_coach_service",
      userId: identity.subject,
      previousState: { isApproved: service.isApproved ?? false },
      newState: { isApproved: true },
      metadata: {
        coachId: service.coachId,
        title: service.title,
      },
    })

    return args.coachServiceId
  },
})

export const rejectCoachService = mutation({
  args: {
    coachServiceId: v.id("coachServices"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await checkAdmin(ctx)

    const service = await ctx.db.get(args.coachServiceId)
    if (!service) {
      throw new Error("Coach service not found")
    }

    await ctx.db.patch(args.coachServiceId, {
      isApproved: false,
      updatedAt: Date.now(),
    })

    await ctx.runMutation(internal.auditLog.create, {
      entityType: "coach_service",
      entityId: args.coachServiceId,
      action: "reject_coach_service",
      userId: identity.subject,
      previousState: { isApproved: service.isApproved ?? false },
      newState: { isApproved: false },
      metadata: {
        reason: args.reason || "Did not meet approval criteria",
        coachId: service.coachId,
        title: service.title,
      },
    })

    return args.coachServiceId
  },
})
