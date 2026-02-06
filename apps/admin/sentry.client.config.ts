// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Higher sample rate for admin since traffic volume is much lower
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.5 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NEXT_PUBLIC_SENTRY_DEBUG === "true",

  // Capture all errors in admin dashboard
  replaysOnErrorSampleRate: 1.0,

  // Higher session sample rate for admin dashboard due to lower traffic
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 0.5,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Filter out sensitive data
  beforeSend(event, _hint) {
    // Don't send events in development unless explicitly testing
    // Note: In client-side code, only NEXT_PUBLIC_* env vars are available
    const isDebugMode = process.env.NEXT_PUBLIC_SENTRY_DEBUG === "true"
    if (process.env.NODE_ENV === "development" && !isDebugMode) {
      return null
    }
    return event
  },
})
