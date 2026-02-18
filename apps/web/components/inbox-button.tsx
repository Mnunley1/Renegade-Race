"use client"

import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { useQuery } from "convex/react"
import { MessageSquare } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/convex"

export function InboxButton() {
  const { user, isSignedIn } = useUser()

  const unreadCount = useQuery(
    api.messages.getUnreadCount,
    isSignedIn && user?.id ? { userId: user.id } : "skip"
  )

  if (!isSignedIn) {
    return null
  }

  return (
    <Button asChild className="relative" size="icon" variant="ghost">
      <Link href="/messages">
        <MessageSquare className="size-5" />
        {unreadCount !== undefined && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 py-0.5 font-semibold text-primary-foreground text-xs leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  )
}
