"use client"

import * as Sentry from "@sentry/nextjs"
import { AlertTriangle, Home, RefreshCw } from "lucide-react"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Send to Sentry in production
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error)
    }
  }, [error])

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
          <div className="w-full max-w-2xl rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="size-6 text-destructive" />
                </div>
                <div>
                  <h1 className="font-header font-semibold text-2xl leading-none tracking-tight">
                    Something went wrong
                  </h1>
                  <p className="mt-1 text-muted-foreground text-sm">
                    We encountered an unexpected error. Please try again.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-6 pt-0">
              {process.env.NODE_ENV === "development" && (
                <div className="rounded-lg border bg-muted p-4">
                  <p className="mb-2 font-medium text-sm">Error Details (Development Only):</p>
                  <pre className="overflow-auto rounded bg-background p-2 text-xs">
                    {error.message}
                    {error.stack && `\n\n${error.stack}`}
                    {error.digest && `\n\nDigest: ${error.digest}`}
                  </pre>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  onClick={reset}
                  type="button"
                >
                  <RefreshCw className="size-4" />
                  Try Again
                </button>
                <a
                  className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 font-medium text-sm ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  href="/"
                >
                  <Home className="size-4" />
                  Go Home
                </a>
              </div>

              <p className="text-muted-foreground text-xs">
                If this problem persists, please{" "}
                <a className="text-primary underline" href="/contact">
                  contact support
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
