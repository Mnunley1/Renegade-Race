/**
 * Migration script to import data from Adalo to Convex
 * 
 * This script provides functions to migrate:
 * - Users (with Clerk account creation)
 * - Vehicles
 * - Vehicle Images (with R2 migration)
 * - Reservations
 * - Reviews
 * - Tracks
 * - Other related data
 * 
 * USAGE:
 * 1. Export data from Adalo (CSV/JSON)
 * 2. Transform data to match Convex schema
 * 3. Call migration functions in batches
 * 4. Verify data integrity
 */

import { v } from "convex/values"
import { internalMutation, mutation } from "./_generated/server"
import { r2 } from "./r2"

// ============================================================================
// Type Definitions for Adalo Data
// ============================================================================

type AdaloUser = {
  id: string // Adalo user ID
  email: string
  name: string
  phone?: string
  profileImageUrl?: string
  bio?: string
  location?: string
  createdAt?: string
  // Add other Adalo user fields as needed
}

type AdaloVehicle = {
  id: string // Adalo vehicle ID
  ownerId: string // Adalo user ID
  make: string
  model: string
  year: number
  dailyRate: number
  description: string
  trackId?: string // Adalo track ID (will need mapping)
  trackName?: string // Fallback if trackId not available
  images?: Array<{
    url: string
    isPrimary: boolean
    order: number
  }>
  // Add other vehicle fields
  horsepower?: number
  transmission?: string
  drivetrain?: string
  engineType?: string
  mileage?: number
  amenities?: string[]
  address?: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
  }
  createdAt?: string
}

type AdaloReservation = {
  id: string
  vehicleId: string // Adalo vehicle ID
  renterId: string // Adalo user ID
  ownerId: string // Adalo user ID
  startDate: string
  endDate: string
  totalAmount: number
  status: "pending" | "confirmed" | "cancelled" | "completed"
  createdAt?: string
}

type AdaloReview = {
  id: string
  reservationId: string
  reviewerId: string
  reviewedId: string
  rating: number
  review: string
  createdAt?: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Download image from URL and upload to R2
 * Returns the R2 key
 */
async function migrateImageToR2(
  ctx: any,
  imageUrl: string,
  prefix: string = "migrated"
): Promise<string> {
  try {
    // Fetch image from Adalo URL
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }

    const imageBlob = await response.blob()
    const arrayBuffer = await imageBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate R2 key with timestamp and random string
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const extension = imageUrl.split(".").pop()?.split("?")[0] || "jpg"
    const r2Key = `${prefix}/${timestamp}-${randomStr}.${extension}`

    // Upload to R2
    await r2.upload(ctx, r2Key, buffer, {
      contentType: imageBlob.type || "image/jpeg",
    })

    return r2Key
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logError } = require("./logger")
    logError(error, `Failed to migrate image ${imageUrl}`)
    throw error
  }
}

/**
 * Map Adalo track name to Convex track ID
 * Creates track if it doesn't exist
 */
async function getOrCreateTrack(
  ctx: any,
  trackName: string,
  location?: string
): Promise<string> {
  // First, try to find existing track by name
  const existingTrack = await ctx.db
    .query("tracks")
    .filter((q) => q.eq(q.field("name"), trackName))
    .first()

  if (existingTrack) {
    return existingTrack._id
  }

  // Create new track if not found
  const trackId = await ctx.db.insert("tracks", {
    name: trackName,
    location: location || "Unknown",
    isActive: true,
  })

  return trackId
}

// ============================================================================
// Migration Mutations
// ============================================================================

/**
 * Migrate a single user from Adalo
 * Note: This creates the user in Convex but does NOT create Clerk account
 * You'll need to create Clerk accounts separately and map externalId
 */
export const migrateUser = internalMutation({
  args: {
    adaloUser: v.any(), // AdaloUser type
    clerkExternalId: v.string(), // Clerk user ID (must be created first)
  },
  handler: async (ctx, args) => {
    const adaloUser = args.adaloUser as AdaloUser

    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.clerkExternalId))
      .first()

    if (existing) {
      return existing._id
    }

    // Migrate profile image if available
    let profileImageR2Key: string | undefined
    if (adaloUser.profileImageUrl) {
      try {
        profileImageR2Key = await migrateImageToR2(ctx, adaloUser.profileImageUrl, "profiles")
      } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { logError } = require("./logger")
        logError(error, `Failed to migrate profile image for user ${adaloUser.id}`)
        // Continue without profile image
      }
    }

    // Create user in Convex
    const userId = await ctx.db.insert("users", {
      externalId: args.clerkExternalId, // Use Clerk ID, not Adalo ID
      name: adaloUser.name,
      email: adaloUser.email,
      phone: adaloUser.phone,
      bio: adaloUser.bio,
      location: adaloUser.location,
      profileImageR2Key,
      memberSince: adaloUser.createdAt
        ? new Date(adaloUser.createdAt).getFullYear().toString()
        : undefined,
      // Set isHost based on whether they have vehicles (will be updated later)
      isHost: false,
    })

    return userId
  },
})

/**
 * Migrate a single vehicle from Adalo
 * Requires: owner must already be migrated, track must exist or be created
 */
export const migrateVehicle = internalMutation({
  args: {
    adaloVehicle: v.any(), // AdaloVehicle type
    ownerClerkId: v.string(), // Clerk ID of the owner (mapped from Adalo ownerId)
    trackId: v.optional(v.id("tracks")), // Convex track ID (if known)
    trackName: v.optional(v.string()), // Track name (if trackId not provided)
  },
  handler: async (ctx, args) => {
    const adaloVehicle = args.adaloVehicle as AdaloVehicle

    // Verify owner exists
    const owner = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.ownerClerkId))
      .first()

    if (!owner) {
      throw new Error(`Owner ${args.ownerClerkId} not found. Migrate user first.`)
    }

    // Get or create track
    let trackId: string
    if (args.trackId) {
      trackId = args.trackId
    } else if (args.trackName) {
      trackId = await getOrCreateTrack(ctx, args.trackName)
    } else {
      // Default to first active track
      const defaultTrack = await ctx.db
        .query("tracks")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .first()
      if (!defaultTrack) {
        throw new Error("No active tracks available")
      }
      trackId = defaultTrack._id
    }

    const now = Date.now()

    // Create vehicle
    const vehicleId = await ctx.db.insert("vehicles", {
      ownerId: args.ownerClerkId,
      trackId: trackId as any,
      make: adaloVehicle.make,
      model: adaloVehicle.model,
      year: adaloVehicle.year,
      dailyRate: adaloVehicle.dailyRate,
      description: adaloVehicle.description,
      horsepower: adaloVehicle.horsepower,
      transmission: adaloVehicle.transmission,
      drivetrain: adaloVehicle.drivetrain,
      engineType: adaloVehicle.engineType,
      mileage: adaloVehicle.mileage,
      amenities: adaloVehicle.amenities || [],
      addOns: [],
      address: adaloVehicle.address,
      isActive: true,
      isApproved: true, // Auto-approve migrated vehicles, or set to false for review
      createdAt: adaloVehicle.createdAt
        ? new Date(adaloVehicle.createdAt).getTime()
        : now,
      updatedAt: now,
    })

    // Migrate vehicle images
    if (adaloVehicle.images && adaloVehicle.images.length > 0) {
      await Promise.all(
        adaloVehicle.images.map(async (image, index) => {
          try {
            const r2Key = await migrateImageToR2(ctx, image.url, `vehicles/${vehicleId}`)
            await ctx.db.insert("vehicleImages", {
              vehicleId,
              r2Key,
              isPrimary: image.isPrimary || index === 0,
              order: image.order ?? index,
            })
          } catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { logError } = require("./logger")
            logError(error, `Failed to migrate image ${image.url} for vehicle ${vehicleId}`)
            // Continue with other images
          }
        })
      )
    }

    // Update owner's isHost status
    await ctx.db.patch(owner._id, {
      isHost: true,
    })

    return vehicleId
  },
})

/**
 * Migrate a reservation from Adalo
 * Requires: vehicle, renter, and owner must already be migrated
 */
export const migrateReservation = internalMutation({
  args: {
    adaloReservation: v.any(), // AdaloReservation type
    vehicleConvexId: v.id("vehicles"), // Convex vehicle ID (mapped from Adalo vehicleId)
    renterClerkId: v.string(), // Clerk ID of renter
    ownerClerkId: v.string(), // Clerk ID of owner
  },
  handler: async (ctx, args) => {
    const adaloReservation = args.adaloReservation as AdaloReservation

    // Verify vehicle exists
    const vehicle = await ctx.db.get(args.vehicleConvexId)
    if (!vehicle) {
      throw new Error(`Vehicle ${args.vehicleConvexId} not found`)
    }

    // Verify renter exists
    const renter = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.renterClerkId))
      .first()
    if (!renter) {
      throw new Error(`Renter ${args.renterClerkId} not found`)
    }

    // Verify owner exists
    const owner = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.ownerClerkId))
      .first()
    if (!owner) {
      throw new Error(`Owner ${args.ownerClerkId} not found`)
    }

    // Calculate total days
    const startDate = new Date(adaloReservation.startDate)
    const endDate = new Date(adaloReservation.endDate)
    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    const createdAt = adaloReservation.createdAt
      ? new Date(adaloReservation.createdAt).getTime()
      : Date.now()

    // Create reservation
    const reservationId = await ctx.db.insert("reservations", {
      vehicleId: args.vehicleConvexId,
      renterId: args.renterClerkId,
      ownerId: args.ownerClerkId,
      startDate: adaloReservation.startDate.split("T")[0], // YYYY-MM-DD format
      endDate: adaloReservation.endDate.split("T")[0],
      totalDays,
      dailyRate: vehicle.dailyRate,
      totalAmount: adaloReservation.totalAmount,
      status: adaloReservation.status,
      createdAt,
      updatedAt: createdAt,
    })

    return reservationId
  },
})

/**
 * Migrate a review from Adalo
 * Requires: reservation must already be migrated
 */
export const migrateReview = internalMutation({
  args: {
    adaloReview: v.any(), // AdaloReview type
    reservationConvexId: v.id("reservations"), // Convex reservation ID
    reviewerClerkId: v.string(), // Clerk ID of reviewer
    reviewedClerkId: v.string(), // Clerk ID of reviewed user
    vehicleConvexId: v.id("vehicles"), // Convex vehicle ID
  },
  handler: async (ctx, args) => {
    const adaloReview = args.adaloReview as AdaloReview

    // Get reservation to determine review type
    const reservation = await ctx.db.get(args.reservationConvexId)
    if (!reservation) {
      throw new Error(`Reservation ${args.reservationConvexId} not found`)
    }

    // Determine review type
    const reviewType =
      reservation.renterId === args.reviewerClerkId
        ? ("renter_to_owner" as const)
        : ("owner_to_renter" as const)

    const createdAt = adaloReview.createdAt
      ? new Date(adaloReview.createdAt).getTime()
      : Date.now()

    // Create review
    const reviewId = await ctx.db.insert("rentalReviews", {
      reservationId: args.reservationConvexId,
      vehicleId: args.vehicleConvexId,
      reviewerId: args.reviewerClerkId,
      reviewedId: args.reviewedClerkId,
      reviewType,
      rating: adaloReview.rating,
      title: adaloReview.review.substring(0, 100), // Truncate for title
      review: adaloReview.review,
      isPublic: true,
      isModerated: false,
      createdAt,
      updatedAt: createdAt,
    })

    return reviewId
  },
})

/**
 * Batch migration helper - migrate multiple users at once
 */
export const migrateUsersBatch = internalMutation({
  args: {
    users: v.array(
      v.object({
        adaloUser: v.any(),
        clerkExternalId: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results = []
    const errors = []

    for (const { adaloUser, clerkExternalId } of args.users) {
      try {
        const userId = await migrateUser.handler(ctx, {
          adaloUser,
          clerkExternalId,
        })
        results.push({ userId, clerkExternalId, success: true })
      } catch (error) {
        errors.push({ clerkExternalId, error: String(error) })
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { logError } = require("./logger")
        logError(error, `Failed to migrate user ${clerkExternalId}`)
      }
    }

    return {
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors,
    }
  },
})

// ============================================================================
// Public Migration Endpoint (for testing)
// ============================================================================

/**
 * Test migration endpoint - migrate a single user
 * This is a public mutation for testing purposes
 * In production, use internalMutation and call from a script
 */
export const testMigrateUser = mutation({
  args: {
    adaloUser: v.any(),
    clerkExternalId: v.string(),
  },
  handler: async (ctx, args) => {
    // In production, add admin check here
    return await migrateUser.handler(ctx, args)
  },
})
