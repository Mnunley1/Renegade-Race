import { R2 } from "@convex-dev/r2"
import { v } from "convex/values"
import { components } from "./_generated/api"
import { mutation } from "./_generated/server"
import { getCurrentUser } from "./users"

// Initialize R2 client
export const r2 = new R2(components.r2)

// ImageKit configuration
// These should be set as environment variables in Convex
// IMAGEKIT_URL_ENDPOINT - Your ImageKit URL endpoint (e.g., https://ik.imgkit.net/your_imagekit_id)
// IMAGEKIT_PUBLIC_KEY - Your ImageKit public key (optional, for signed URLs)
// IMAGEKIT_PRIVATE_KEY - Your ImageKit private key (optional, for signed URLs)

/**
 * Generate ImageKit URL with transformations
 * ImageKit must be configured with R2 as an external S3-compatible origin
 * @param key - R2 object key
 * @param options - ImageKit transformation options
 */
export function getImageKitUrl(
  key: string,
  options?: {
    width?: number
    height?: number
    quality?: number
    format?: "auto" | "webp" | "jpeg" | "png"
    focus?: "auto" | "center" | "top" | "left" | "bottom" | "right" | "faces"
    fit?: "inside" | "outside" | "cover" | "contain"
  }
): string {
  // ImageKit URL endpoint - set via: npx convex env set IMAGEKIT_URL_ENDPOINT https://ik.imagekit.io/your_id
  // ImageKit must be configured with your R2 bucket as an external S3-compatible origin
  const imageKitEndpoint = process.env.IMAGEKIT_URL_ENDPOINT

  if (!imageKitEndpoint) {
    console.warn(
      "[R2] IMAGEKIT_URL_ENDPOINT is not configured. Set it via: npx convex env set IMAGEKIT_URL_ENDPOINT https://ik.imagekit.io/your_id"
    )
    // Return a placeholder - won't work but helps with debugging
    return `/api/image/${key}`
  }

  // Build transformation parameters for ImageKit
  const transformations: string[] = []

  if (options?.width) {
    transformations.push(`w-${options.width}`)
  }
  if (options?.height) {
    transformations.push(`h-${options.height}`)
  }
  if (options?.quality) {
    transformations.push(`q-${options.quality}`)
  }
  if (options?.format) {
    transformations.push(`f-${options.format}`)
  }
  if (options?.focus) {
    transformations.push(`fo-${options.focus}`)
  }
  if (options?.fit) {
    transformations.push(`c-${options.fit}`)
  }

  // Default transformations for better performance
  if (transformations.length === 0) {
    transformations.push("f-auto", "q-80")
  }

  const transformString = transformations.join(",")
  return `${imageKitEndpoint}/${key}?tr=${transformString}`
}

/**
 * Preset transformation helpers for common image sizes
 */
export const imagePresets = {
  thumbnail: (key: string) =>
    getImageKitUrl(key, { width: 240, height: 160, quality: 70, format: "auto" }),
  card: (key: string) =>
    getImageKitUrl(key, { width: 600, height: 400, quality: 80, format: "auto" }),
  detail: (key: string) =>
    getImageKitUrl(key, { width: 1600, height: 900, quality: 80, format: "auto" }),
  hero: (key: string) =>
    getImageKitUrl(key, { width: 1920, height: 1080, quality: 75, format: "auto" }),
  original: (key: string) => getImageKitUrl(key, { quality: 90, format: "auto" }),
  avatar: (key: string) =>
    getImageKitUrl(key, { width: 200, height: 200, quality: 80, format: "auto", fit: "cover" }),
}

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
    const uploadResult = r2.generateUploadUrl(key)
    // r2.generateUploadUrl returns an object with 'url' property
    return { ...uploadResult, key }
  },
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
