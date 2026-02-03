"use client"

import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useMutation, useQuery } from "convex/react"
import { formatDistanceToNow, isToday, isYesterday } from "date-fns"
import {
  AlertCircle,
  Bell,
  Calendar,
  Car,
  CheckCircle2,
  MessageSquare,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/convex"
import type { Id } from "@renegade/backend/convex/_generated/dataModel"

type Notification = {
  _id: Id<"notifications">
  title: string
  message: string
  type: string
  isRead: boolean
  link?: string | null
  createdAt: number
}

export default function NotificationsPage() {
  const { user, isSignedIn } = useUser()
  const router = useRouter()

  const notifications = useQuery(
    api.notifications.getUserNotifications,
    isSignedIn && user?.id ? { userId: user.id, limit: 50 } : "skip"
  ) as Notification[] | undefined

  const markAsRead = useMutation(api.notifications.markAsRead)
  const markAllAsRead = useMutation(api.notifications.markAllAsRead)

  const handleNotificationClick = async (
    notificationId: Id<"notifications">,
    link?: string | null,
    isRead?: boolean
  ) => {
    if (!isRead) {
      await markAsRead({ notificationId })
    }
    if (link) {
      router.push(link)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (user?.id) {
      await markAllAsRead({ userId: user.id })
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "reservation_approved":
      case "reservation_declined":
      case "reservation_cancelled":
      case "reservation_completed":
        return <Calendar className="size-5 text-blue-500" />
      case "new_message":
        return <MessageSquare className="size-5 text-green-500" />
      case "payment_success":
      case "payment_failed":
        return <CheckCircle2 className="size-5 text-emerald-500" />
      default:
        return <Bell className="size-5 text-muted-foreground" />
    }
  }

  const groupNotificationsByDate = (items: Notification[]) => {
    const groups = {
      Today: [] as Notification[],
      Yesterday: [] as Notification[],
      Earlier: [] as Notification[],
    }

    for (const notification of items) {
      const date = new Date(notification.createdAt)
      if (isToday(date)) {
        groups.Today.push(notification)
      } else if (isYesterday(date)) {
        groups.Yesterday.push(notification)
      } else {
        groups.Earlier.push(notification)
      }
    }

    return groups
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <AlertCircle className="mb-4 size-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              Please sign in to view notifications
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (notifications === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">
          Loading notifications...
        </div>
      </div>
    )
  }

  const groupedNotifications = groupNotificationsByDate(notifications)
  const hasUnread = notifications.some((n) => !n.isRead)

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-bold text-3xl md:text-4xl">Notifications</h1>
        <p className="mt-2 text-muted-foreground">
          Stay updated on your rentals and messages
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Notifications</CardTitle>
              <CardDescription>
                {notifications.length} notification(s) total
              </CardDescription>
            </div>
            {hasUnread && (
              <Button onClick={handleMarkAllAsRead} variant="outline">
                Mark all as read
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length > 0 ? (
            <div className="space-y-6">
              {Object.entries(groupedNotifications).map(
                ([groupName, groupNotifications]) =>
                  groupNotifications.length > 0 && (
                    <div key={groupName}>
                      <h3 className="mb-3 font-semibold text-muted-foreground text-sm">
                        {groupName}
                      </h3>
                      <div className="space-y-2">
                        {groupNotifications.map((notification) => (
                          <button
                            className="w-full cursor-pointer rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent"
                            key={notification._id}
                            onClick={() =>
                              handleNotificationClick(
                                notification._id,
                                notification.link,
                                notification.isRead
                              )
                            }
                            type="button"
                          >
                            <div className="flex gap-4">
                              <div className="shrink-0">
                                {getNotificationIcon(notification.type)}
                              </div>
                              <div className="flex-1 space-y-1">
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
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Bell className="mb-4 size-12 text-muted-foreground" />
              <p className="text-muted-foreground">No notifications yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
