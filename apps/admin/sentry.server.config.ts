// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Higher sample rate for admin since traffic volume is much lower
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.5 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.SENTRY_DEBUG === "true",

  // Filter out sensitive data
  beforeSend(event, _hint) {
    // Don't send events in development unless explicitly testing
    if (process.env.NODE_ENV === "development" && !process.env.SENTRY_DEBUG) {
      return null
    }
    return event
  },
})
