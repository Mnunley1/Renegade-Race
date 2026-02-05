"use client"

import { useAuth } from "@clerk/nextjs"
import { Toaster } from "@workspace/ui/components/sonner"
import { ConvexReactClient } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type * as React from "react"
import { useEffect } from "react"
import { useCookieConsent } from "@/hooks/useCookieConsent"
import { loadSentry } from "@/lib/sentry-loader"
import { CookieConsentBanner } from "./cookie-consent-banner"
import { ErrorBoundary } from "./error-boundary"

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL in your .env file")
}

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL)

export function Providers({ children }: { children: React.ReactNode }) {
  const { hasConsented, isLoading } = useCookieConsent()

  // Load Sentry conditionally based on consent
  useEffect(() => {
    if (!isLoading && hasConsented) {
      loadSentry()
    }
  }, [hasConsented, isLoading])

  return (
    <ErrorBoundary>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <NextThemesProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
          enableColorScheme
          enableSystem
        >
          {children}
          <Toaster />
          <CookieConsentBanner />
        </NextThemesProvider>
      </ConvexProviderWithClerk>
    </ErrorBoundary>
  )
}
