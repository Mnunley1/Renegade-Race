/**
 * Returns the configured web URL. Requires WEB_URL to be set
 * in the Convex deployment environment variables.
 */
export function getWebUrl(): string {
  const url = process.env.WEB_URL
  if (!url) {
    throw new Error("Missing required environment variable: WEB_URL")
  }
  return url
}
