"use client"

import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import Link from "next/link"
import { api } from "@/lib/convex"

export function HostNavLink({ className }: { className?: string }) {
  const { isSignedIn } = useUser()

  const onboardingStatus = useQuery(api.users.getHostOnboardingStatus, isSignedIn ? {} : "skip")

  if (!isSignedIn) {
    return null
  }

  if (!onboardingStatus || onboardingStatus.status === "not_started") {
    return (
      <Button asChild className={cn(className)} variant="outline">
        <Link href="/host/onboarding">Become a Host</Link>
      </Button>
    )
  }

  if (onboardingStatus.status === "in_progress") {
    return (
      <Button asChild className={cn("gap-2", className)} variant="outline">
        <Link href="/host/onboarding">
          Continue Setup
          <span className="size-2 rounded-full bg-amber-500" />
        </Link>
      </Button>
    )
  }

  return (
    <Link
      className={cn(
        "font-medium text-muted-foreground text-sm transition-colors hover:text-foreground",
        className
      )}
      href="/host/dashboard"
    >
      Host Dashboard
    </Link>
  )
}
