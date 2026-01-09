/**
 * ImageKit URL helper for frontend
 * Generates ImageKit URLs with transformations for R2-stored images
 */

// Get ImageKit URL endpoint from environment
// This should be set in your .env.local file
const IMAGEKIT_URL_ENDPOINT =
  process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "https://ik.imgkit.net/default"

export interface ImageKitOptions {
  width?: number
  height?: number
  quality?: number
  format?: "auto" | "webp" | "jpeg" | "png"
  focus?: "auto" | "center" | "top" | "left" | "bottom" | "right" | "faces"
  fit?: "inside" | "outside" | "cover" | "contain"
}

/**
 * Generate ImageKit URL with transformations
 * @param key - R2 object key
 * @param options - ImageKit transformation options
 */
export function getImageKitUrl(key: string, options?: ImageKitOptions): string {
  // Build transformation parameters
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
  return `${IMAGEKIT_URL_ENDPOINT}/${key}?tr=${transformString}`
}

/**
 * Preset transformation helpers for common image sizes
 */
export const imagePresets = {
  avatar: (key: string) =>
    getImageKitUrl(key, {
      width: 224,
      height: 224,
      quality: 85,
      format: "auto",
      fit: "cover",
      focus: "faces",
    }),
  thumbnail: (key: string) =>
    getImageKitUrl(key, { width: 240, height: 160, quality: 70, format: "auto" }),
  card: (key: string) =>
    getImageKitUrl(key, { width: 600, height: 400, quality: 80, format: "auto" }),
  detail: (key: string) =>
    getImageKitUrl(key, { width: 1600, height: 900, quality: 80, format: "auto" }),
  hero: (key: string) =>
    getImageKitUrl(key, { width: 1920, height: 1080, quality: 75, format: "auto" }),
  original: (key: string) => getImageKitUrl(key, { quality: 90, format: "auto" }),
}



