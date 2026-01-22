/**
 * Centralized logging utility for Convex backend functions
 * Handles error logging with Sentry integration
 */

// Note: Sentry is imported dynamically to avoid issues in Convex environment
// Convex functions run in a serverless environment where some packages may not be available

/**
 * Logs an error with optional context
 * Sends to Sentry in production if available
 */
export function logError(error: unknown, context?: string): void {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const logMessage = context ? `${context}: ${errorMessage}` : errorMessage

  // Log to console in all environments for debugging
  console.error(logMessage, error)

  // Try to send to Sentry in production (if available)
  // Note: Sentry may not be available in Convex environment
  if (process.env.NODE_ENV === "production") {
    try {
      // Dynamic import to avoid issues if Sentry is not available
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require("@sentry/nextjs")
      if (Sentry && typeof Sentry.captureException === "function") {
        Sentry.captureException(error, {
          extra: {
            context,
          },
        })
      }
    } catch {
      // Sentry not available or failed to import - continue without it
    }
  }
}
