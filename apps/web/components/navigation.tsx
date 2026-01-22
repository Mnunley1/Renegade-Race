"use client"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { Menu, X } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { UserMenu } from "@/components/user-menu"

export function Navigation() {
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <>
      <nav className="sticky top-0 z-50 border-border border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto w-full max-w-7xl px-2 sm:px-4 lg:px-6">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile menu button - visible on small screens */}
              <Button
                className="md:hidden"
                onClick={() => setIsSidebarOpen(true)}
                size="icon"
                variant="ghost"
              >
                <Menu className="size-5" />
                <span className="sr-only">Open menu</span>
              </Button>
              <Link
                className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
                href="/"
              >
                <Image
                  alt="Renegade"
                  className="rounded-full"
                  height={32}
                  src="/logo.png"
                  width={32}
                />
                <span
                  className="font-semibold text-foreground text-lg tracking-tight"
                  style={{ fontFamily: "var(--font-header), sans-serif" }}
                >
                  Renegade
                </span>
              </Link>
              <div className="hidden items-center gap-8 md:flex">
                <Link
                  className={cn(
                    "font-medium text-sm transition-colors hover:text-foreground",
                    pathname === "/vehicles" ? "text-foreground" : "text-muted-foreground"
                  )}
                  href="/vehicles"
                >
                  Vehicles
                </Link>
                <Link
                  className={cn(
                    "font-medium text-sm transition-colors hover:text-foreground",
                    pathname === "/motorsports" || pathname?.startsWith("/motorsports")
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                  href="/motorsports"
                >
                  Motorsports
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <UserMenu />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar */}
      {isSidebarOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
          {/* Sidebar */}
          <div className="fixed inset-y-0 left-0 z-50 w-64 border-border border-r bg-background p-6 md:hidden">
            <div className="mb-8 flex items-center justify-between">
              <Link
                className="flex items-center gap-2.5"
                href="/"
                onClick={() => setIsSidebarOpen(false)}
              >
                <Image
                  alt="Renegade"
                  className="rounded-full"
                  height={32}
                  src="/logo.png"
                  width={32}
                />
                <span
                  className="font-semibold text-foreground text-lg tracking-tight"
                  style={{ fontFamily: "var(--font-header), sans-serif" }}
                >
                  Renegade
                </span>
              </Link>
              <Button onClick={() => setIsSidebarOpen(false)} size="icon" variant="ghost">
                <X className="size-5" />
                <span className="sr-only">Close menu</span>
              </Button>
            </div>
            <nav className="flex flex-col gap-4">
              <Link
                className={cn(
                  "py-2 font-medium text-base transition-colors hover:text-foreground",
                  pathname === "/vehicles" ? "text-foreground" : "text-muted-foreground"
                )}
                href="/vehicles"
                onClick={() => setIsSidebarOpen(false)}
              >
                Vehicles
              </Link>
              <Link
                className={cn(
                  "py-2 font-medium text-base transition-colors hover:text-foreground",
                  pathname === "/motorsports" || pathname?.startsWith("/motorsports")
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
                href="/motorsports"
                onClick={() => setIsSidebarOpen(false)}
              >
                Motorsports
              </Link>
            </nav>
          </div>
        </>
      )}
    </>
  )
}
