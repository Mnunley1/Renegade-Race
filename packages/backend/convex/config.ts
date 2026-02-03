/**
 * Environment Configuration Validation
 *
 * This module validates that all required environment variables are set.
 * Import this in your main entry points to fail fast if configuration is missing.
 *
 * Required environment variables for production:
 * - STRIPE_SECRET_KEY: Must start with sk_live_ in production
 * - STRIPE_WEBHOOK_SECRET: For verifying Stripe webhook signatures
 * - CLERK_SECRET_KEY: For Clerk authentication
 * - CLERK_WEBHOOK_SECRET: For verifying Clerk webhook signatures
 * - WEB_URL: The frontend URL (e.g., https://renegaderentals.com)
 * - RESEND_API_KEY: For sending transactional emails
 * - RESEND_TEST_MODE: Set to "false" in production to send real emails
 * - GOOGLE_MAPS_API_KEY: For geocoding addresses
 * - IMAGEKIT_URL_ENDPOINT: For image transformations
 */

export interface EnvConfig {
  // Stripe
  stripeSecretKey: string
  stripeWebhookSecret: string
  // Clerk
  clerkSecretKey: string
  clerkWebhookSecret: string
  // App URLs
  webUrl: string
  // Email
  resendApiKey: string
  resendTestMode: boolean
  // Maps
  googleMapsApiKey: string
  // Images
  imagekitUrlEndpoint: string
}

/**
 * Validates that a required environment variable is set
 */
function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/**
 * Validates environment configuration and returns typed config object.
 * Call this at application startup to fail fast if config is missing.
 */
export function validateConfig(): EnvConfig {
  // Check if we're in production mode
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")

  // Validate Stripe
  const stripeSecretKey = requireEnv("STRIPE_SECRET_KEY")
  if (isProduction && !stripeSecretKey.startsWith("sk_live_")) {
    console.warn(
      "WARNING: Using test Stripe key in what appears to be production. Set STRIPE_SECRET_KEY to a live key."
    )
  }
  const stripeWebhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET")

  // Validate Clerk
  const clerkSecretKey = requireEnv("CLERK_SECRET_KEY")
  const clerkWebhookSecret = requireEnv("CLERK_WEBHOOK_SECRET")

  // Validate App URLs
  const webUrl = requireEnv("WEB_URL", "http://localhost:3000")
  if (isProduction && webUrl.includes("localhost")) {
    console.warn("WARNING: WEB_URL contains localhost in production. Set to your production URL.")
  }

  // Validate Email
  const resendApiKey = requireEnv("RESEND_API_KEY")
  const resendTestMode = process.env.RESEND_TEST_MODE !== "false"
  if (isProduction && resendTestMode) {
    console.warn(
      "WARNING: RESEND_TEST_MODE is not explicitly set to 'false'. Emails will be sent to test addresses only. Set RESEND_TEST_MODE=false for production."
    )
  }

  // Validate Maps (optional in dev)
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || ""
  if (isProduction && !googleMapsApiKey) {
    console.warn("WARNING: GOOGLE_MAPS_API_KEY is not set. Geocoding will not work.")
  }

  // Validate Images (optional in dev)
  const imagekitUrlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || ""
  if (isProduction && !imagekitUrlEndpoint) {
    console.warn("WARNING: IMAGEKIT_URL_ENDPOINT is not set. Image transformations will not work.")
  }

  return {
    stripeSecretKey,
    stripeWebhookSecret,
    clerkSecretKey,
    clerkWebhookSecret,
    webUrl,
    resendApiKey,
    resendTestMode,
    googleMapsApiKey,
    imagekitUrlEndpoint,
  }
}

/**
 * Get the web URL for generating links
 */
export function getWebUrl(): string {
  return process.env.WEB_URL || "http://localhost:3000"
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return (
    process.env.NODE_ENV === "production" || (process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ?? false)
  )
}

/**
 * Check if email test mode is enabled
 */
export function isEmailTestMode(): boolean {
  return process.env.RESEND_TEST_MODE !== "false"
}
