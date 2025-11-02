"use client"

import type * as React from "react"
import { ConvexProvider, ConvexReactClient } from "convex/react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || ""

if (!convexUrl) {
  console.warn("NEXT_PUBLIC_CONVEX_URL is not set")
}

const convex = new ConvexReactClient(convexUrl)

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        enableColorScheme
      >
        {children}
      </NextThemesProvider>
    </ConvexProvider>
  )
}
