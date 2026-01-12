"use client"

import { useAuth } from "@clerk/nextjs"
import { ConvexReactClient } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { Toaster } from "@workspace/ui/components/sonner"
import type * as React from "react"
import { ErrorBoundary } from "./error-boundary"

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL in your .env file")
}

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL)

export function Providers({ children }: { children: React.ReactNode }) {
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
        </NextThemesProvider>
      </ConvexProviderWithClerk>
    </ErrorBoundary>
  )
}
