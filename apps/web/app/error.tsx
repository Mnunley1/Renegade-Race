"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Home, RefreshCw, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console for debugging (in development)
    if (process.env.NODE_ENV === "development") {
      console.error("Route error:", error)
    }

    // Send to Sentry in production
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error)
    }
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-6 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-2xl">Something went wrong</CardTitle>
              <p className="mt-1 text-muted-foreground text-sm">
                We encountered an unexpected error. Please try again.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Button onClick={reset} className="flex-1" variant="default">
              <RefreshCw className="mr-2 size-4" />
              Try Again
            </Button>
            <Button asChild className="flex-1" variant="outline">
              <Link href="/">
                <Home className="mr-2 size-4" />
                Go Home
              </Link>
            </Button>
          </div>

          <p className="text-muted-foreground text-xs">
            If this problem persists, please{" "}
            <Link href="/contact" className="text-primary underline">
              contact support
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
