import { R2 } from "@convex-dev/r2"
import { ConvexError, v } from "convex/values"
import { components } from "./_generated/api"
import type { DataModel, Doc, Id } from "./_generated/dataModel"
import { mutation, type MutationCtx, type QueryCtx } from "./_generated/server"
import { getCurrentUser } from "./users"

// Initialize R2 client
export const r2 = new R2(components.r2)

function findUpload(ctx: QueryCtx, key: string) {
  return ctx.db
    .query("r2Uploads")
    .withIndex("by_bucket_key", (q) => q.eq("bucket", r2.config.bucket).eq("key", key))
    .unique()
}

export async function requireReservationPhotoUploads(
  ctx: QueryCtx,
  { reservationId, uploader, purpose, photos }: {
    reservationId: Id<"reservations">
    uploader: string
    purpose: "disputes" | "reviews" | "damage"
    photos: string[]
  }
) {
  if (photos.length === 0) return
  const user = await getCurrentUser(ctx)
  const reservation = await ctx.db.get(reservationId)
  if (
    !user ||
    user.externalId !== uploader ||
    !reservation ||
    (reservation.ownerId !== uploader &&
      (purpose === "damage" || reservation.renterId !== uploader))
  ) {
    throw new Error("Not authorized to attach photos to this reservation")
  }
  // These server-issued keys record the booking and intended use. Prefix checks
  // alone are insufficient: an upload record must also establish its owner.
  const prefix = `images/${purpose}/${reservationId}/${user._id}-`
  for (const key of new Set(photos)) {
    const upload = await findUpload(ctx, key)
    if (
      !upload ||
      upload.ownerId !== uploader ||
      upload.purpose !== "other" ||
      !upload.key.startsWith(prefix) ||
      upload.imageId
    ) {
      throw new Error(`Upload this ${purpose} photo for this reservation`)
    }
  }
}

async function issueUpload(
  ctx: MutationCtx,
  ownerId: string,
  upload: Pick<Doc<"r2Uploads">, "key" | "purpose" | "targetVehicleId">
) {
  const result = await r2.generateUploadUrl(upload.key)
  await ctx.db.insert("r2Uploads", { bucket: r2.config.bucket, ownerId, ...upload })
  return result
}

async function issueUserUpload(ctx: MutationCtx, purpose: "onboarding" | "vehicle" | "general") {
  const user = await getCurrentUser(ctx)
  if (!user) throw new Error("Not authenticated")
  const key = `images/${purpose}/${user._id}/${crypto.randomUUID()}`
  return issueUpload(ctx, user.externalId, { purpose, key })
}

// Older clients use the shared endpoint for both listings and other media.
// Their verified uploads can be attached, but shared-purpose bytes are retained.
export const generateUploadUrl = mutation({
  args: {},
  handler: (ctx) => issueUserUpload(ctx, "general"),
})

export const generateOnboardingImageUploadUrl = mutation({
  args: {},
  handler: (ctx) => issueUserUpload(ctx, "onboarding"),
})

export const generateListingImageUploadUrl = mutation({
  args: {},
  handler: (ctx) => issueUserUpload(ctx, "vehicle"),
})

export const { syncMetadata } = r2.clientApi<DataModel>({
  onUpload: async (ctx, _bucket, key) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const upload = await findUpload(ctx, key)
    if (upload?.ownerId !== identity.subject)
      throw new Error("Upload ownership could not be verified")
  },
})

export async function requireDraftUpload(ctx: QueryCtx, ownerId: string, key: string) {
  const upload = await findUpload(ctx, key)
  if (
    !upload ||
    upload.ownerId !== ownerId ||
    upload.imageId ||
    (upload.purpose !== "onboarding" && upload.purpose !== "general")
  ) {
    throw new Error("Upload this onboarding photo again to verify ownership")
  }
}

export async function requireProfileUpload(ctx: QueryCtx, user: Doc<"users">, key: string) {
  const upload = await findUpload(ctx, key)
  // Profile and reservation uploads historically share purpose "other". Require
  // the recorded profile namespace as well as ownership; a key prefix alone is
  // not proof that this server issued the upload.
  if (
    !upload ||
    upload.ownerId !== user.externalId ||
    upload.purpose !== "other" ||
    !upload.key.startsWith(`images/profiles/${user._id}/`) ||
    upload.imageId
  ) {
    throw new Error("Upload this profile photo again to verify ownership")
  }
}

export async function clearDraftUploads(
  ctx: MutationCtx,
  user: Doc<"users">,
  keep: ReadonlySet<string> = new Set()
) {
  const keys = new Set(user.hostOnboardingDraft?.images?.map((image) => image.r2Key))
  for (const key of keys) {
    if (keep.has(key)) continue
    const upload = await findUpload(ctx, key)
    if (upload?.ownerId === user.externalId && upload.purpose === "onboarding" && !upload.imageId) {
      // The component schedules its retried R2 delete in this same transaction.
      await r2.deleteObject(ctx, key)
      await ctx.db.delete(upload._id)
    }
  }
}

export async function attachVehicleUpload(
  ctx: MutationCtx,
  ownerId: string,
  {
    vehicleId,
    imageId,
    key,
  }: { vehicleId: Id<"vehicles">; imageId: Id<"vehicleImages">; key: string }
) {
  const upload = await findUpload(ctx, key)
  if (
    !upload ||
    upload.ownerId !== ownerId ||
    upload.purpose === "other" ||
    upload.imageId ||
    (upload.targetVehicleId && upload.targetVehicleId !== vehicleId)
  ) {
    throw new ConvexError({
      code: "REUPLOAD_VEHICLE_PHOTO",
      message: "Upload this vehicle photo again to verify ownership",
    })
  }
  await ctx.db.patch(upload._id, { imageId })
}

export async function removeVehicleUpload(
  ctx: MutationCtx,
  ownerId: string,
  image: Doc<"vehicleImages">
) {
  if (!image.r2Key) return
  const upload = await findUpload(ctx, image.r2Key)
  if (upload?.ownerId !== ownerId || upload.imageId !== image._id) return
  if (upload.purpose === "onboarding" || upload.purpose === "vehicle") {
    await r2.deleteObject(ctx, image.r2Key)
    await ctx.db.delete(upload._id)
  } else {
    await ctx.db.patch(upload._id, { imageId: undefined })
  }
}

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
    return issueUpload(ctx, user.externalId, { purpose: "general", key })
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
    return issueUpload(ctx, user.externalId, {
      purpose: "vehicle",
      key,
      targetVehicleId: args.vehicleId,
    })
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
    return issueUpload(ctx, user.externalId, { purpose: "other", key })
  },
})

// Sensitive-content uploads: prefixed by context so a future split into a
// private bucket (or a per-kind ACL change) can filter on the key prefix.
async function generateReservationPhotoUploadUrl(
  ctx: MutationCtx,
  reservationId: Id<"reservations">,
  prefix: "disputes" | "reviews" | "damage"
) {
  const user = await getCurrentUser(ctx)
  if (!user) {
    throw new Error("Not authenticated")
  }
  const reservation = await ctx.db.get(reservationId)
  const canUpload =
    reservation &&
    (reservation.ownerId === user.externalId ||
      (prefix !== "damage" && reservation.renterId === user.externalId))
  if (!canUpload) {
    throw new Error("Not authorized to upload photos for this reservation")
  }
  const key = `images/${prefix}/${reservationId}/${user._id}-${crypto.randomUUID()}`
  return issueUpload(ctx, user.externalId, { purpose: "other", key })
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
