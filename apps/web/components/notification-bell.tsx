"use client"

import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { useMutation, useQuery } from "convex/react"
import { formatDistanceToNow } from "date-fns"
import { Bell } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { api } from "@/lib/convex"
import type { Id } from "@renegade/backend/convex/_generated/dataModel"

export function NotificationBell() {
  const { user, isSignedIn } = useUser()
  const router = useRouter()

  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    isSignedIn && user?.id ? { userId: user.id } : "skip"
  )

  const notifications = useQuery(
    api.notifications.getUserNotifications,
    isSignedIn && user?.id ? { userId: user.id, limit: 5 } : "skip"
  )

  const markAsRead = useMutation(api.notifications.markAsRead)
  const markAllAsRead = useMutation(api.notifications.markAllAsRead)

  const handleNotificationClick = async (
    notificationId: Id<"notifications">,
    link?: string
  ) => {
    await markAsRead({ notificationId })
    if (link) {
      router.push(link)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (user?.id) {
      await markAllAsRead({ userId: user.id })
    }
  }

  if (!isSignedIn) {
    return null
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="relative" size="icon" variant="ghost">
          <Bell className="size-5" />
          {unreadCount !== undefined && unreadCount > 0 && (
            <span className="-right-1 -top-1 absolute flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 py-0.5 font-semibold text-primary-foreground text-xs leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-border border-b p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount !== undefined && unreadCount > 0 && (
              <Button
                className="h-auto p-0 font-medium text-primary text-xs"
                onClick={handleMarkAllAsRead}
                variant="ghost"
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {notifications && notifications.length > 0 ? (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <button
                  className="w-full cursor-pointer p-4 text-left transition-colors hover:bg-accent"
                  key={notification._id}
                  onClick={() =>
                    handleNotificationClick(
                      notification._id,
                      notification.link ?? undefined
                    )
                  }
                  type="button"
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm">
                        {notification.title}
                      </p>
                      {!notification.isRead && (
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {notification.message}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatDistanceToNow(
                        new Date(notification.createdAt),
                        { addSuffix: true }
                      )}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm">No notifications</div>
          )}
        </div>
        <div className="border-border border-t p-2">
          <Link href="/notifications">
            <Button className="w-full justify-center font-medium text-sm" variant="ghost">
              View all notifications
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
