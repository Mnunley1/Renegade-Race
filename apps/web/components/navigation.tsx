"use client"

import { cn } from "@workspace/ui/lib/utils"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserMenu } from "@/components/user-menu"

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link className="flex items-center gap-2.5 transition-opacity hover:opacity-80" href="/">
              <Image
                alt="Renegade"
                className="rounded-full"
                height={32}
                src="/logo.png"
                width={32}
              />
              <span className="font-semibold text-foreground text-lg tracking-tight">Renegade</span>
            </Link>
            <div className="hidden items-center gap-8 md:flex">
              <Link
                className={cn(
                  "text-sm font-medium transition-colors hover:text-foreground",
                  pathname === "/vehicles" ? "text-foreground" : "text-muted-foreground"
                )}
                href="/vehicles"
              >
                Vehicles
              </Link>
              <Link
                className={cn(
                  "text-sm font-medium transition-colors hover:text-foreground",
                  (pathname === "/motorsports" || pathname?.startsWith("/motorsports"))
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
  )
}
