"use client"

import { Input } from "@workspace/ui/components/input"
import { Search } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserMenu } from "@/components/user-menu"

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link className="flex items-center gap-2" href="/">
              <Image
                alt="Renegade"
                className="rounded-full"
                height={40}
                src="/logo.png"
                width={40}
              />
              <span className="font-bold text-black text-xl dark:text-white">Renegade</span>
            </Link>
            <div className="hidden items-center gap-4 md:flex">
              <Link
                className={cn(
                  "font-medium text-sm transition-colors hover:text-primary",
                  pathname === "/vehicles" && "text-primary"
                )}
                href="/vehicles"
              >
                Search Vehicles
              </Link>
              <Link
                className={cn(
                  "font-medium text-sm transition-colors hover:text-primary",
                  (pathname === "/motorsports" || pathname?.startsWith("/motorsports")) &&
                    "text-primary"
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

        <div className="mb-4 flex items-center gap-2 md:hidden">
          <div className="relative flex-1">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              onClick={() => {
                window.location.href = "/vehicles"
              }}
              placeholder="Search vehicles..."
            />
          </div>
        </div>
      </div>
    </nav>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
