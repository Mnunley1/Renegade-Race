"use client"

import { cn } from "@workspace/ui/lib/utils"
import { User, Users } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function MotorsportsNav() {
  const pathname = usePathname()
  const isTeams = pathname.startsWith("/motorsports/teams")
  const isDrivers = pathname.startsWith("/motorsports/drivers")

  return (
    <nav className="mb-6 flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
      <Link
        className={cn(
          "flex items-center gap-2 rounded-md px-4 py-2 font-medium text-sm transition-colors",
          isTeams
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        href="/motorsports/teams"
      >
        <Users className="size-4" />
        Teams
      </Link>
      <Link
        className={cn(
          "flex items-center gap-2 rounded-md px-4 py-2 font-medium text-sm transition-colors",
          isDrivers
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        href="/motorsports/drivers"
      >
        <User className="size-4" />
        Drivers
      </Link>
    </nav>
  )
}
