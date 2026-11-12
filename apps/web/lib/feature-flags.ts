/**
 * When false, vehicle listing flows allow continuing without photos.
 *
 * Skipped automatically when:
 * - local `next dev` (NODE_ENV === "development")
 * - Vercel Preview deployments (NEXT_PUBLIC_VERCEL_ENV === "preview")
 *
 * Override anytime with NEXT_PUBLIC_SKIP_REQUIRED_PHOTOS=true|false
 */
export function areVehiclePhotosRequired(): boolean {
  if (process.env.NEXT_PUBLIC_SKIP_REQUIRED_PHOTOS === "true") {
    return false
  }
  if (process.env.NEXT_PUBLIC_SKIP_REQUIRED_PHOTOS === "false") {
    return true
  }
  if (process.env.NODE_ENV === "development") {
    return false
  }
  // System env exposed by Vercel for Next.js client bundles
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "preview") {
    return false
  }
  return true
}
