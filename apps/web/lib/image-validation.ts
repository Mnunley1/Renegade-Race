export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

export const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const

export const IMAGE_ACCEPT_ATTR = [...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_IMAGE_EXTENSIONS].join(
  ","
)

export function isAllowedImageFile(file: File): boolean {
  if ((ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return true
  }
  const lower = file.name.toLowerCase()
  return ALLOWED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export const ALLOWED_IMAGE_FORMATS_LABEL = "JPEG, PNG, or WebP"
