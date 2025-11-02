"use client"

import { useQuery } from "convex/react"
import { useUser } from "@clerk/nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import { MessageSquare, Search, Car } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/convex"
import { useMemo, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"

export default function MessagesPage() {
  const { user } = useUser()
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch user's conversations from Convex (as both renter and owner)
  const renterConversations = useQuery(
    api.conversations.getByUser,
    user?.id ? { userId: user.id, role: "renter" as const } : "skip"
  )

  const ownerConversations = useQuery(
    api.conversations.getByUser,
    user?.id ? { userId: user.id, role: "owner" as const } : "skip"
  )

  // Combine conversations from both roles and sort by last message
  const allConversationsData = useMemo(() => {
    const renter = renterConversations || []
    const owner = ownerConversations || []
    // Merge and deduplicate by conversation ID
    const all = [...renter, ...owner]
    const unique = all.filter(
      (conv, index, self) => index === self.findIndex((c) => c._id === conv._id)
    )
    // Sort by last message time (most recent first)
    return unique.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
  }, [renterConversations, ownerConversations])

  // Map conversations to the format expected by the UI
  const conversations = useMemo(() => {
    if (!allConversationsData || !allConversationsData.length) return []
    return allConversationsData.map((conv) => {
      const otherPerson = conv.renter?.externalId === user?.id ? conv.owner : conv.renter
      const unreadCount = user?.id === conv.renter?.externalId ? conv.unreadCountRenter : conv.unreadCountOwner
      return {
        id: conv._id,
        name: otherPerson?.name || "Unknown",
        avatar: otherPerson?.profileImage || "",
        preview: conv.lastMessageText || "No messages yet",
        unread: unreadCount > 0,
        unreadCount,
        vehicle: conv.vehicle ? `${conv.vehicle.year} ${conv.vehicle.make} ${conv.vehicle.model}` : "",
        lastMessageAt: conv.lastMessageAt,
      }
    })
  }, [allConversationsData, user?.id])

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const query = searchQuery.toLowerCase()
    return conversations.filter(
      (conv) =>
        conv.name.toLowerCase().includes(query) ||
        conv.vehicle.toLowerCase().includes(query) ||
        conv.preview.toLowerCase().includes(query)
    )
  }, [conversations, searchQuery])

  // Format timestamp for display
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const isLoading = renterConversations === undefined || ownerConversations === undefined

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 font-bold text-3xl">Messages</h1>
        <p className="text-muted-foreground">
          Connect with hosts and renters to manage your conversations
        </p>
      </div>

      <Card className="border-2 shadow-lg">
        <CardHeader className="border-b pb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-12 pl-11 text-base"
              placeholder="Search conversations by name, vehicle, or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex min-h-[400px] items-center justify-center py-12">
              <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center py-16 text-center">
              <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="size-10 text-muted-foreground" />
              </div>
              <h3 className="mb-2 font-semibold text-xl">
                {searchQuery ? "No conversations found" : "No conversations yet"}
              </h3>
              <p className="mx-auto max-w-md text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search terms to find conversations."
                  : "Start a conversation with a vehicle owner or renter to begin messaging."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredConversations.map((conversation) => (
                <Link
                  className={cn(
                    "block border-l-4 p-6 transition-colors hover:bg-accent/50",
                    conversation.unread
                      ? "border-primary bg-primary/5"
                      : "border-transparent"
                  )}
                  href={`/messages/${conversation.id}`}
                  key={conversation.id}
                >
                  <div className="flex gap-4">
                    <div className="relative shrink-0">
                      <Avatar className="size-14">
                        <AvatarImage src={conversation.avatar} />
                        <AvatarFallback className="text-base font-semibold">
                          {conversation.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      {conversation.unread && (
                        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                          {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate font-semibold text-lg">{conversation.name}</h3>
                            {conversation.unread && (
                              <Badge className="h-5 px-1.5 text-xs" variant="default">
                                New
                              </Badge>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 text-muted-foreground text-sm">
                          {formatTimestamp(conversation.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Car className="size-4 shrink-0" />
                        <p className="truncate font-medium text-sm">{conversation.vehicle}</p>
                      </div>
                      <p
                        className={cn(
                          "truncate text-sm",
                          conversation.unread
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {conversation.preview}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
