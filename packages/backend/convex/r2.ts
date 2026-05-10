import { R2 } from "@convex-dev/r2"
import { v } from "convex/values"
import { components } from "./_generated/api"
import { mutation } from "./_generated/server"
import { getCurrentUser } from "./users"

// Initialize R2 client
export const r2 = new R2(components.r2)

// R2 Client API with validation
export const { generateUploadUrl, syncMetadata } = r2.clientApi({
  checkUpload: async (ctx, _bucket) => {
    // Verify user is authenticated
    // @ts-expect-error - GenericQueryCtx type mismatch with QueryCtx
    const user = await getCurrentUser(ctx)
    if (!user) {
      throw new Error("Not authenticated")
    }

    // Additional validation can be added here (file size, type, etc.)
    // The actual file validation happens client-side before upload
  },
  onUpload: async (_ctx, _bucket, _key) => {
    // Optional: Log upload or perform additional actions
    // This runs after the file is uploaded to R2 and metadata is synced
  },
})

// Custom mutation to generate upload URL with organized key structure
export const generateUploadUrlWithKey = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) {
      throw new Error("Not authenticated")
    }

    // Generate organized key structure: images/{type}/{userId}/{uuid}.{ext}
    // For now, we'll use a simple UUID - the extension will be determined by the file
    const key = `images/uploads/${user._id}/${crypto.randomUUID()}`
    return r2.generateUploadUrl(key)
  },
})

// Mutation to generate vehicle image upload URL with organized structure
export const generateVehicleImageUploadUrl = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    imageIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) {
      throw new Error("Not authenticated")
    }

    // Verify user owns the vehicle
    const vehicle = await ctx.db.get(args.vehicleId)
    if (!vehicle || vehicle.ownerId !== user.externalId) {
      throw new Error("Not authorized to upload images for this vehicle")
    }

    // Generate organized key: images/vehicles/{vehicleId}/{index}-{uuid}
    const key = `images/vehicles/${args.vehicleId}/${args.imageIndex}-${crypto.randomUUID()}`
    return r2.generateUploadUrl(key)
  },
})

// Mutation to generate profile image upload URL
export const generateProfileImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) {
      throw new Error("Not authenticated")
    }

    // Generate organized key: images/profiles/{userId}/{uuid}
    const key = `images/profiles/${user._id}/${crypto.randomUUID()}`
    const uploadResult = await r2.generateUploadUrl(key)
    return { ...uploadResult, key }
  },
})

// Sensitive-content uploads: prefixed by context so a future split into a
// private bucket (or a per-kind ACL change) can filter on the key prefix.
async function generateReservationPhotoUploadUrl(
  ctx: Parameters<typeof getCurrentUser>[0],
  reservationId: string,
  prefix: "disputes" | "reviews" | "damage" | "returns"
) {
  const user = await getCurrentUser(ctx)
  if (!user) {
    throw new Error("Not authenticated")
  }
  const key = `images/${prefix}/${reservationId}/${user._id}-${crypto.randomUUID()}`
  const uploadResult = await r2.generateUploadUrl(key)
  return { ...uploadResult, key }
}

export const generateDisputePhotoUploadUrl = mutation({
  args: { reservationId: v.id("reservations") },
  handler: (ctx, args) => generateReservationPhotoUploadUrl(ctx, args.reservationId, "disputes"),
})

export const generateReviewPhotoUploadUrl = mutation({
  args: { reservationId: v.id("reservations") },
  handler: (ctx, args) => generateReservationPhotoUploadUrl(ctx, args.reservationId, "reviews"),
})

export const generateDamagePhotoUploadUrl = mutation({
  args: { reservationId: v.id("reservations") },
  handler: (ctx, args) => generateReservationPhotoUploadUrl(ctx, args.reservationId, "damage"),
})

export const generateReturnPhotoUploadUrl = mutation({
  args: { reservationId: v.id("reservations") },
  handler: (ctx, args) => generateReservationPhotoUploadUrl(ctx, args.reservationId, "returns"),
})

// Diagnostic mutation to test R2 configuration
export const testR2Configuration = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) {
      throw new Error("Not authenticated")
    }

    try {
      // Try to generate a test upload URL
      const testKey = `test/${user._id}/${crypto.randomUUID()}`
      const uploadUrl = await r2.generateUploadUrl(testKey)

      return {
        success: true,
        message: "R2 configuration appears to be working",
        testKey,
        uploadUrl: `${(uploadUrl.url || String(uploadUrl)).substring(0, 100)}...`, // Truncate for security
      }
    } catch (error) {
      return {
        success: false,
        message: "R2 configuration error",
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
})
