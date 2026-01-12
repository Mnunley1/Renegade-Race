import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { imagePresets, r2 } from "./r2"

// Get all active and approved vehicles with optimized images
export const getAllWithOptimizedImages = query({
  args: {
    trackId: v.optional(v.id("tracks")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { trackId, limit = 50 } = args

    // Get current user identity to filter out their own vehicles
    const identity = await ctx.auth.getUserIdentity()
    const currentUserId = identity?.subject

    let vehicles
    if (trackId) {
      vehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_track", (q) => q.eq("trackId", trackId))
        .filter((q) => q.and(q.eq(q.field("isActive"), true), q.eq(q.field("isApproved"), true)))
        .order("desc")
        .take(limit)
    } else {
      vehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_active_approved", (q) => q.eq("isActive", true).eq("isApproved", true))
        .order("desc")
        .take(limit)
    }

    // Filter out vehicles owned by the current user (if authenticated)
    if (currentUserId) {
      vehicles = vehicles.filter((vehicle) => vehicle.ownerId !== currentUserId)
    }

    // Get vehicle images and owner details
    const vehiclesWithDetails = await Promise.all(
      vehicles.map(async (vehicle) => {
        const [images, owner, track] = await Promise.all([
          ctx.db
            .query("vehicleImages")
            .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicle._id))
            .order("asc")
            .collect(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", vehicle.ownerId))
            .first(),
          ctx.db.get(vehicle.trackId),
        ])

        // Filter out vehicles from hosts without complete Stripe setup
        if (!owner?.stripeAccountId || owner.stripeAccountStatus !== "active") {
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
          ...vehicle,
          images: optimizedImages,
          owner,
          track,
        }
      })
    )

    // Filter out null values (vehicles from hosts without Stripe setup)
    return vehiclesWithDetails.filter((v) => v !== null)
  },
})

// Search vehicles with availability filtering (optimal batch query approach)
export const searchWithAvailability = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    trackId: v.optional(v.id("tracks")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { startDate, endDate, trackId, limit = 50 } = args

    // Get current user identity to filter out their own vehicles
    const identity = await ctx.auth.getUserIdentity()
    const currentUserId = identity?.subject

    // Step 1: Get all active/approved vehicles (single query)
    let vehiclesQuery = ctx.db
      .query("vehicles")
      .withIndex("by_active_approved", (q) =>
        q.eq("isActive", true).eq("isApproved", true)
      )

    if (trackId) {
      vehiclesQuery = ctx.db
        .query("vehicles")
        .withIndex("by_track", (q) => q.eq("trackId", trackId))
        .filter((q) =>
          q.and(
            q.eq(q.field("isActive"), true),
            q.eq(q.field("isApproved"), true)
          )
        )
    }

    // Get more vehicles initially to account for filtering
    let vehicles = await vehiclesQuery.order("desc").take(limit * 2)

    // Filter out vehicles owned by the current user (if authenticated)
    if (currentUserId) {
      vehicles = vehicles.filter((vehicle) => vehicle.ownerId !== currentUserId)
    }

    // Step 2: If dates provided, filter by availability using batch queries
    let availableVehicles = vehicles

    if (startDate && endDate) {
      // Batch query 1: Get blocked dates in the range (OPTIMIZED)
      // Query without index and filter by date range and availability status
      // This is still much faster than fetching all records (7.3M -> ~1,000)
      const blockedDatesInRange = await ctx.db
        .query("availability")
        .filter((q) =>
          q.and(
            q.eq(q.field("isAvailable"), false),
            q.gte(q.field("date"), startDate),
            q.lte(q.field("date"), endDate)
          )
        )
        .collect()

      // Create a Set of vehicle IDs with blocked dates for O(1) lookup
      const vehiclesWithBlockedDates = new Set(
        blockedDatesInRange.map((a) => a.vehicleId)
      )

      // Batch query 2: Get conflicting reservations in the range (OPTIMIZED)
      // Use by_dates index to query reservations where startDate <= endDate (requested)
      // Then filter by endDate >= startDate (requested) and status
      // Overlap check: existingStart <= requestedEnd AND existingEnd >= requestedStart
      const overlappingReservations = await ctx.db
        .query("reservations")
        .withIndex("by_dates", (q) => q.lte("startDate", endDate))
        .filter((q) =>
          q.and(
            q.gte(q.field("endDate"), startDate),
            q.or(
              q.eq(q.field("status"), "pending"),
              q.eq(q.field("status"), "confirmed")
            )
          )
        )
        .collect()

      // Additional filter: Ensure reservation actually overlaps
      // (by_dates index might return some false positives, so we verify overlap)
      const conflictingReservations = overlappingReservations.filter(
        (reservation) => {
          // Overlap check: existingStart <= requestedEnd AND existingEnd >= requestedStart
          return (
            reservation.startDate <= endDate &&
            reservation.endDate >= startDate
          )
        }
      )

      // Create a Set of vehicle IDs with conflicting reservations
      const vehiclesWithConflicts = new Set(
        conflictingReservations.map((r) => r.vehicleId)
      )

      // Step 3: Filter vehicles in memory (O(n) where n = vehicles)
      // A vehicle is unavailable if:
      // - It has any blocked dates in the range, OR
      // - It has conflicting reservations
      availableVehicles = vehicles.filter((vehicle) => {
        // Check if vehicle has blocked dates
        if (vehiclesWithBlockedDates.has(vehicle._id)) {
          return false
        }

        // Check if vehicle has conflicting reservations
        if (vehiclesWithConflicts.has(vehicle._id)) {
          return false
        }

        return true
      })

      // Limit results after filtering
      availableVehicles = availableVehicles.slice(0, limit)
    } else {
      // No date filter, just limit
      availableVehicles = vehicles.slice(0, limit)
    }

    // Step 4: Get vehicle details (images, owner, track) - parallel queries
    const vehiclesWithDetails = await Promise.all(
      availableVehicles.map(async (vehicle) => {
        const [images, owner, track] = await Promise.all([
          ctx.db
            .query("vehicleImages")
            .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicle._id))
            .order("asc")
            .collect(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) =>
              q.eq("externalId", vehicle.ownerId)
            )
            .first(),
          ctx.db.get(vehicle.trackId),
        ])

        // Filter out vehicles from hosts without complete Stripe setup
        if (!owner?.stripeAccountId || owner.stripeAccountStatus !== "active") {
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
          ...vehicle,
          images: optimizedImages,
          owner,
          track,
        }
      })
    )

    // Filter out null values (vehicles from hosts without Stripe setup)
    return vehiclesWithDetails.filter((v) => v !== null)
  },
})

// Get all active and approved vehicles (legacy function for backward compatibility)
export const getAll = query({
  args: {
    trackId: v.optional(v.id("tracks")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { trackId, limit = 50 } = args

    // Get current user identity to filter out their own vehicles
    const identity = await ctx.auth.getUserIdentity()
    const currentUserId = identity?.subject

    let vehicles
    if (trackId) {
      vehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_track", (q) => q.eq("trackId", trackId))
        .filter((q) => q.and(q.eq(q.field("isActive"), true), q.eq(q.field("isApproved"), true)))
        .order("desc")
        .take(limit)
    } else {
      vehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_active_approved", (q) => q.eq("isActive", true).eq("isApproved", true))
        .order("desc")
        .take(limit)
    }

    // Filter out vehicles owned by the current user (if authenticated)
    if (currentUserId) {
      vehicles = vehicles.filter((vehicle) => vehicle.ownerId !== currentUserId)
    }

    // Get vehicle images and owner details
    const vehiclesWithDetails = await Promise.all(
      vehicles.map(async (vehicle) => {
        const [images, owner, track] = await Promise.all([
          ctx.db
            .query("vehicleImages")
            .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicle._id))
            .order("asc")
            .collect(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", vehicle.ownerId))
            .first(),
          ctx.db.get(vehicle.trackId),
        ])

        // Filter out vehicles from hosts without complete Stripe setup
        if (!owner?.stripeAccountId || owner.stripeAccountStatus !== "active") {
          return null
        }

        return {
          ...vehicle,
          images,
          owner,
          track,
        }
      })
    )

    // Filter out null values (vehicles from hosts without Stripe setup)
    return vehiclesWithDetails.filter((v) => v !== null)
  },
})

// Get vehicle by ID with all details
export const getById = query({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.id)
    if (vehicle === null) {
      throw new Error("NOT_FOUND")
    }

    const [images, owner, track, availability] = await Promise.all([
      ctx.db
        .query("vehicleImages")
        .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.id))
        .order("asc")
        .collect(),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", vehicle.ownerId))
        .first(),
      ctx.db.get(vehicle.trackId),
      ctx.db
        .query("availability")
        .withIndex("by_vehicle_date", (q) => q.eq("vehicleId", args.id))
        .order("asc")
        .collect(),
    ])

    return {
      ...vehicle,
      images,
      owner,
      track,
      availability,
    }
  },
})

// Get vehicle image by ID
export const getVehicleImageById = query({
  args: { id: v.id("vehicleImages") },
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.id)
    if (!(image && image.r2Key)) return null

    return {
      ...image,
      thumbnailUrl: imagePresets.thumbnail(image.r2Key),
      cardUrl: imagePresets.card(image.r2Key),
      detailUrl: imagePresets.detail(image.r2Key),
      heroUrl: imagePresets.hero(image.r2Key),
      originalUrl: imagePresets.original(image.r2Key),
    }
  },
})

// Get vehicles by owner
export const getByOwner = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_owner_active", (q) => q.eq("ownerId", args.ownerId).eq("isActive", true))
      .order("desc")
      .collect()

    const vehiclesWithDetails = await Promise.all(
      vehicles.map(async (vehicle) => {
        const [images, track] = await Promise.all([
          ctx.db
            .query("vehicleImages")
            .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicle._id))
            .order("asc")
            .collect(),
          ctx.db.get(vehicle.trackId),
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
          ...vehicle,
          images: optimizedImages,
          track,
        }
      })
    )

    return vehiclesWithDetails
  },
})

// Generate upload URL for file storage (legacy - use R2 mutations instead)
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    return await ctx.storage.generateUploadUrl()
  },
})

// Create a new vehicle with processed images
export const createVehicleWithImages = mutation({
  args: {
    trackId: v.optional(v.id("tracks")),
    make: v.string(),
    model: v.string(),
    year: v.number(),
    dailyRate: v.number(),
    description: v.string(),
    horsepower: v.optional(v.number()),
    transmission: v.optional(v.string()),
    drivetrain: v.optional(v.string()),
    engineType: v.optional(v.string()),
    mileage: v.optional(v.number()),
    amenities: v.array(v.string()),
    addOns: v.optional(
      v.array(
        v.object({
          name: v.string(),
          price: v.number(),
          description: v.optional(v.string()),
          isRequired: v.optional(v.boolean()),
        })
      )
    ),
    address: v.optional(
      v.object({
        street: v.string(),
        city: v.string(),
        state: v.string(),
        zipCode: v.string(),
      })
    ),
    advanceNotice: v.optional(v.string()),
    minTripDuration: v.optional(v.string()),
    maxTripDuration: v.optional(v.string()),
    requireWeekendMin: v.optional(v.boolean()),
    images: v.array(
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
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject
    const now = Date.now()

    // If no trackId provided, we need to handle it - but schema requires trackId
    // For now, we'll require it or throw an error
    if (!args.trackId) {
      // Get the first active track as default
      const defaultTrack = await ctx.db
        .query("tracks")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .first()
      if (!defaultTrack) {
        throw new Error("No active tracks available. Please select a track.")
      }
      args.trackId = defaultTrack._id
    }

    // Create the vehicle
    const vehicleId = await ctx.db.insert("vehicles", {
      ownerId: userId,
      trackId: args.trackId,
      make: args.make,
      model: args.model,
      year: args.year,
      dailyRate: args.dailyRate,
      description: args.description,
      horsepower: args.horsepower,
      transmission: args.transmission,
      drivetrain: args.drivetrain,
      engineType: args.engineType,
      mileage: args.mileage,
      amenities: args.amenities,
      addOns: args.addOns || [],
      address: args.address,
      advanceNotice: args.advanceNotice,
      minTripDuration: args.minTripDuration,
      maxTripDuration: args.maxTripDuration,
      requireWeekendMin: args.requireWeekendMin,
      isActive: true,
      isApproved: false,
      createdAt: now,
      updatedAt: now,
    })

    // Create vehicle images (R2 only)
    await Promise.all(
      args.images.map(async (image) =>
        ctx.db.insert("vehicleImages", {
          vehicleId,
          r2Key: image.r2Key,
          isPrimary: image.isPrimary,
          order: image.order,
          metadata: image.metadata,
        })
      )
    )

    // Check if this is the user's first vehicle and update onboarding status
    const existingVehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect()

    // If this is the first vehicle, mark vehicleAdded step as complete
    if (existingVehicles.length === 1) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", userId))
        .first()

      if (user) {
        const currentSteps = user.hostOnboardingSteps || {
          personalInfo: false,
          vehicleAdded: false,
          payoutSetup: false,
          safetyStandards: false,
        }

        const updatedSteps = {
          ...currentSteps,
          vehicleAdded: true,
        }

        // Check if all steps are complete
        const allStepsComplete = Object.values(updatedSteps).every((step) => step === true)

        await ctx.db.patch(user._id, {
          hostOnboardingSteps: updatedSteps,
          hostOnboardingStatus: allStepsComplete
            ? "completed"
            : user.hostOnboardingStatus === "not_started"
              ? "in_progress"
              : user.hostOnboardingStatus || "in_progress",
        })
      }
    }

    return vehicleId
  },
})

// Update vehicle
export const update = mutation({
  args: {
    id: v.id("vehicles"),
    trackId: v.optional(v.id("tracks")),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    year: v.optional(v.number()),
    dailyRate: v.optional(v.number()),
    description: v.optional(v.string()),
    horsepower: v.optional(v.number()),
    transmission: v.optional(v.string()),
    drivetrain: v.optional(v.string()),
    engineType: v.optional(v.string()),
    mileage: v.optional(v.number()),
    fuelType: v.optional(v.string()),
    color: v.optional(v.string()),
    amenities: v.optional(v.array(v.string())),
    performanceSpecs: v.optional(
      v.object({
        torque: v.optional(v.number()),
        acceleration: v.optional(v.number()),
        topSpeed: v.optional(v.number()),
        weight: v.optional(v.number()),
        engineType: v.optional(v.string()),
        displacement: v.optional(v.number()),
        fuelCapacity: v.optional(v.number()),
        tireSize: v.optional(v.string()),
        brakeType: v.optional(v.string()),
        suspensionType: v.optional(v.string()),
        differentialType: v.optional(v.string()),
        coolingSystem: v.optional(v.string()),
      })
    ),
    addOns: v.optional(
      v.array(
        v.object({
          name: v.string(),
          price: v.number(),
          description: v.optional(v.string()),
          isRequired: v.optional(v.boolean()),
        })
      )
    ),
    advanceNotice: v.optional(v.string()),
    minTripDuration: v.optional(v.string()),
    maxTripDuration: v.optional(v.string()),
    requireWeekendMin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const vehicle = await ctx.db.get(args.id)
    if (!vehicle) {
      throw new Error("Vehicle not found")
    }

    if (vehicle.ownerId !== identity.subject) {
      throw new Error("Not authorized to update this vehicle")
    }

    const { id, ...updateData } = args
    void id // Exclude id from updateData
    await ctx.db.patch(args.id, {
      ...updateData,
      updatedAt: Date.now(),
    })

    return args.id
  },
})

// Delete vehicle (soft delete)
export const remove = mutation({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const vehicle = await ctx.db.get(args.id)
    if (!vehicle) {
      throw new Error("Vehicle not found")
    }

    if (vehicle.ownerId !== identity.subject) {
      throw new Error("Not authorized to delete this vehicle")
    }

    // Check for active or upcoming reservations
    const today = new Date().toISOString().split("T")[0]
    const activeReservations = await ctx.db
      .query("reservations")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.id))
      .filter((q) =>
        q.and(
          // Only check pending or confirmed reservations
          q.or(
            q.eq(q.field("status"), "pending"),
            q.eq(q.field("status"), "confirmed")
          ),
          // Check if reservation end date is in the future (active or upcoming)
          q.gte(q.field("endDate"), today)
        )
      )
      .collect()

    if (activeReservations.length > 0) {
      throw new Error(
        "Cannot delete vehicle with active or upcoming reservations. Please wait until all reservations are completed or cancelled."
      )
    }

    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: Date.now(),
    })

    return args.id
  },
})

// Add vehicle image
export const addImage = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    r2Key: v.string(),
    isPrimary: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const vehicle = await ctx.db.get(args.vehicleId)
    if (!vehicle) {
      throw new Error("Vehicle not found")
    }

    if (vehicle.ownerId !== identity.subject) {
      throw new Error("Not authorized to modify this vehicle")
    }

    // Get current image count for order
    const existingImages = await ctx.db
      .query("vehicleImages")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .collect()

    const imageId = await ctx.db.insert("vehicleImages", {
      vehicleId: args.vehicleId,
      r2Key: args.r2Key,
      isPrimary: args.isPrimary,
      order: existingImages.length,
    })

    // If this is primary, unset other primary images
    if (args.isPrimary) {
      await Promise.all(
        existingImages
          .filter((img) => img.isPrimary)
          .map((img) => ctx.db.patch(img._id, { isPrimary: false }))
      )
    }

    return imageId
  },
})

// Remove vehicle image
export const removeImage = mutation({
  args: { imageId: v.id("vehicleImages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const image = await ctx.db.get(args.imageId)
    if (!image) {
      throw new Error("Image not found")
    }

    const vehicle = await ctx.db.get(image.vehicleId)
    if (!vehicle || vehicle.ownerId !== identity.subject) {
      throw new Error("Not authorized to modify this vehicle")
    }

    // Delete from R2 if r2Key exists
    if (image.r2Key) {
      try {
        await r2.deleteObject(ctx, image.r2Key)
      } catch (error) {
        console.error(`Failed to delete R2 object ${image.r2Key}:`, error)
        // Continue with database deletion even if R2 deletion fails
      }
    }

    await ctx.db.delete(args.imageId)
    return args.imageId
  },
})

// Update image order
export const updateImageOrder = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    imageOrders: v.array(
      v.object({
        imageId: v.id("vehicleImages"),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const vehicle = await ctx.db.get(args.vehicleId)
    if (!vehicle) {
      throw new Error("Vehicle not found")
    }

    if (vehicle.ownerId !== identity.subject) {
      throw new Error("Not authorized to modify this vehicle")
    }

    // Update all image orders
    await Promise.all(
      args.imageOrders.map(({ imageId, order }) =>
        ctx.db.patch(imageId, { order })
      )
    )

    return { success: true }
  },
})

// Update image properties (e.g., isPrimary)
export const updateImage = mutation({
  args: {
    imageId: v.id("vehicleImages"),
    isPrimary: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const image = await ctx.db.get(args.imageId)
    if (!image) {
      throw new Error("Image not found")
    }

    const vehicle = await ctx.db.get(image.vehicleId)
    if (!vehicle || vehicle.ownerId !== identity.subject) {
      throw new Error("Not authorized to modify this vehicle")
    }

    // If setting as primary, unset other primary images
    if (args.isPrimary === true) {
      const existingImages = await ctx.db
        .query("vehicleImages")
        .withIndex("by_vehicle", (q) => q.eq("vehicleId", image.vehicleId))
        .collect()

      await Promise.all(
        existingImages
          .filter((img) => img.isPrimary && img._id !== args.imageId)
          .map((img) => ctx.db.patch(img._id, { isPrimary: false }))
      )
    }

    // Update the image
    await ctx.db.patch(args.imageId, {
      isPrimary: args.isPrimary ?? image.isPrimary,
    })

    return args.imageId
  },
})

// Get all tracks
export const getTracks = query({
  handler: async (ctx) =>
    await ctx.db
      .query("tracks")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("asc")
      .collect(),
})

// Helper function to check if user is admin via Clerk metadata
async function checkAdmin(ctx: any) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error("Not authenticated")
  }

  // When session token is configured with { "metadata": "{{user.public_metadata}}" },
  // the metadata is available in identity.metadata
  const role =
    (identity as any).metadata?.role || // From session token (recommended)
    (identity as any).publicMetadata?.role || // Direct from Clerk
    (identity as any).orgRole

  if (role !== "admin") {
    throw new Error("Admin access required")
  }

  return identity
}

// Admin function to approve a vehicle
export const approveVehicle = mutation({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const vehicle = await ctx.db.get(args.vehicleId)
    if (!vehicle) {
      throw new Error("Vehicle not found")
    }

    await ctx.db.patch(args.vehicleId, {
      isApproved: true,
      updatedAt: Date.now(),
    })

    return args.vehicleId
  },
})

// Admin function to reject a vehicle
export const rejectVehicle = mutation({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const vehicle = await ctx.db.get(args.vehicleId)
    if (!vehicle) {
      throw new Error("Vehicle not found")
    }

    await ctx.db.patch(args.vehicleId, {
      isApproved: false,
      updatedAt: Date.now(),
    })

    return args.vehicleId
  },
})

// Admin function to get all pending vehicles for review
export const getPendingVehicles = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const { limit = 50 } = args

    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_active_approved", (q) => q.eq("isActive", true).eq("isApproved", false))
      .order("desc")
      .take(limit)

    // Get vehicle images and owner details
    const vehiclesWithDetails = await Promise.all(
      vehicles.map(async (vehicle) => {
        const [images, owner, track] = await Promise.all([
          ctx.db
            .query("vehicleImages")
            .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicle._id))
            .order("asc")
            .collect(),
          ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", vehicle.ownerId))
            .first(),
          ctx.db.get(vehicle.trackId),
        ])

        return {
          ...vehicle,
          images,
          owner,
          track,
        }
      })
    )

    return vehiclesWithDetails
  },
})
