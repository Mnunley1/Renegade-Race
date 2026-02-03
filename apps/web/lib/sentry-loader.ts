/**
 * Conditionally loads Sentry based on cookie consent
 * This function initializes Sentry only if user has consented to cookies
 */

export async function loadSentry() {
  // Only load Sentry if user has consented to cookies
  if (typeof window === "undefined") {
    return
  }

  try {
    const consentKey = "cookie-consent"
    const stored = localStorage.getItem(consentKey)

    if (stored) {
      const data = JSON.parse(stored)
      // Only load Sentry if user has accepted cookies
      if (data.status === "accepted") {
        // Dynamically import and initialize Sentry
        const { initSentry } = await import("../sentry.client.config")
        initSentry()
      }
    }
  } catch {
    // If there's an error reading consent, don't load Sentry
    // This is a fail-safe to respect user privacy
  }
}
