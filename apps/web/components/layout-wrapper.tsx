"use client"

import { usePathname } from "next/navigation"
import type * as React from "react"
import { Footer } from "@/components/footer"
import { Navigation } from "@/components/navigation"

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage =
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up") ||
    pathname?.startsWith("/reset-password")

  return (
    <div className="flex min-h-screen flex-col">
      {!isAuthPage && <Navigation />}
      <main className="flex-1">{children}</main>
      {!isAuthPage && <Footer />}
    </div>
  )
}
