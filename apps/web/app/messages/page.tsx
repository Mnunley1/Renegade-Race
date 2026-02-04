"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { MessageSquare, Search } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { UserAvatar } from "@/components/user-avatar"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"
import { formatTime } from "@/lib/format-time"

type FilterTab = "all" | "unread" | "archived"

function MessagesPageContent() {
  const { user, isSignedIn } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTab, setFilterTab] = useState<FilterTab>("all")
  const searchParams = useSearchParams()
  const router = useRouter()

  // Bulk operations states
  const [selectedConversations, setSelectedConversations] = useState<string[]>([])
  const [isBulkMode, setIsBulkMode] = useState(false)
  const [isPerformingBulkAction, setIsPerformingBulkAction] = useState(false)

  // Handle query parameters - redirect to chat page if needed
  useEffect(() => {
    const conversationId = searchParams.get("conversationId")
    const vehicleId = searchParams.get("vehicleId")
    const renterId = searchParams.get("renterId")
    const ownerId = searchParams.get("ownerId")

    if (conversationId) {
      // If there's a conversationId, navigate to the chat page
      router.replace(`/messages/${conversationId}`)
    } else if (vehicleId && renterId && ownerId) {
      // If there are pending conversation parameters, navigate to chat page
      router.replace(`/messages?vehicleId=${vehicleId}&renterId=${renterId}&ownerId=${ownerId}`)
    }
  }, [searchParams, router])

  // Fetch user's conversations
  const renterConversations = useQuery(
    api.conversations.getByUser,
    user?.id ? { userId: user.id, role: "renter" as const } : "skip"
  )

  const ownerConversations = useQuery(
    api.conversations.getByUser,
    user?.id ? { userId: user.id, role: "owner" as const } : "skip"
  )

  // Combine conversations
  const conversations = [...(renterConversations || []), ...(ownerConversations || [])].sort(
    (a, b) => b.lastMessageAt - a.lastMessageAt
  )

  // Filter conversations based on filter tab
  const tabFilteredConversations = conversations.filter((conversation) => {
    const unreadCount =
      user?.id === conversation.renterId
        ? conversation.unreadCountRenter
        : conversation.unreadCountOwner

    if (filterTab === "unread") return unreadCount > 0
    if (filterTab === "archived") return conversation.isActive === false
    // "all" = active non-deleted
    return conversation.isActive !== false
  })

  // Filter conversations based on search query
  const filteredConversations = tabFilteredConversations.filter((conversation) => {
    if (!searchQuery.trim()) return true

    const otherUser = user?.id === conversation.renterId ? conversation.owner : conversation.renter

    const searchLower = searchQuery.toLowerCase()
    return (
      otherUser?.name?.toLowerCase().includes(searchLower) ||
      conversation.vehicle?.make?.toLowerCase().includes(searchLower) ||
      conversation.vehicle?.model?.toLowerCase().includes(searchLower) ||
      conversation.lastMessageText?.toLowerCase().includes(searchLower) ||
      conversation.team?.name?.toLowerCase().includes(searchLower)
    )
  })

  // Mutations
  const bulkConversationActions = useMutation(api.conversations.bulkHostConversationActions)

  if (!(isSignedIn && user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="mb-2 font-semibold text-foreground text-xl">Please sign in</h2>
              <p className="text-muted-foreground">
                You need to be signed in to view conversations.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Bulk operations handlers
  const handleBulkSelect = (conversationId: string) => {
    setSelectedConversations((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId]
    )
  }

  const handleSelectAll = () => {
    if (selectedConversations.length === conversations.length) {
      setSelectedConversations([])
    } else {
      setSelectedConversations(conversations.map((c) => c._id))
    }
  }

  const handleBulkAction = async (action: "archive" | "delete" | "mark_read") => {
    if (selectedConversations.length === 0) return
    setIsPerformingBulkAction(true)
    try {
      await bulkConversationActions({
        hostId: user?.id || "",
        conversationIds: selectedConversations.map((id) => id as Id<"conversations">),
        action,
      })
      setSelectedConversations([])
      setIsBulkMode(false)
    } catch (error) {
      handleErrorWithContext(error, {
        action: `${action} conversations`,
        customMessages: {
          generic: `Failed to ${action.replace("_", " ")} conversations. Please try again.`,
        },
      })
    } finally {
      setIsPerformingBulkAction(false)
    }
  }

  const isLoading = renterConversations === undefined || ownerConversations === undefined

  const filterTabs: { label: string; value: FilterTab }[] = [
    { label: "All", value: "all" },
    { label: "Unread", value: "unread" },
    { label: "Archived", value: "archived" },
  ]

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-6">
          <h1 className="font-bold text-3xl text-foreground">Messages</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your conversations and stay connected with other users.
          </p>
        </div>

        <Card className="h-[calc(100dvh-16rem)] max-h-[700px]">
          <CardHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle>Conversations</CardTitle>
                <div className="flex gap-2">
                  {isBulkMode ? (
                    <>
                      <Button
                        onClick={() => {
                          setIsBulkMode(false)
                          setSelectedConversations([])
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSelectAll} size="sm">
                        {selectedConversations.length === conversations.length
                          ? "Deselect All"
                          : "Select All"}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setIsBulkMode(true)} size="sm" variant="outline">
                      Select
                    </Button>
                  )}
                </div>
              </div>

              {/* Bulk actions bar */}
              {isBulkMode && selectedConversations.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                  <span className="text-muted-foreground text-sm">
                    {selectedConversations.length} selected
                  </span>
                  <div className="flex gap-1">
                    <Button
                      disabled={isPerformingBulkAction}
                      onClick={() => handleBulkAction("mark_read")}
                      size="sm"
                      variant="outline"
                    >
                      Mark Read
                    </Button>
                    <Button
                      disabled={isPerformingBulkAction}
                      onClick={() => handleBulkAction("archive")}
                      size="sm"
                      variant="outline"
                    >
                      Archive
                    </Button>
                    <Button
                      disabled={isPerformingBulkAction}
                      onClick={() => handleBulkAction("delete")}
                      size="sm"
                      variant="destructive"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}

              {/* Filter tabs */}
              <div className="flex gap-4 border-border border-b">
                {filterTabs.map((tab) => (
                  <button
                    className={cn(
                      "pb-2 font-medium text-sm transition-colors",
                      filterTab === tab.value
                        ? "border-[#EF1C25] border-b-2 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    key={tab.value}
                    onClick={() => setFilterTab(tab.value)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                <Input
                  className="pl-10"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchQuery(e.target.value)
                  }
                  placeholder="Search conversations..."
                  value={searchQuery}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-y-auto p-0">
            {isLoading ? (
              // Loading state
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    className="flex animate-pulse items-center space-x-3 rounded-lg bg-muted p-3"
                    key={index}
                  >
                    <div className="h-12 w-12 rounded-full bg-muted-foreground/20" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 rounded bg-muted-foreground/20" />
                      <div className="h-3 w-1/2 rounded bg-muted-foreground/20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              // Empty state
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                  <h3 className="mb-2 font-semibold text-foreground text-xl">
                    {searchQuery ? "No conversations found" : "No conversations yet"}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {searchQuery
                      ? "Try a different search term."
                      : "Start a conversation by booking a vehicle, listing one, or connecting with drivers and teams."}
                  </p>
                  {!searchQuery && (
                    <Button
                      className="mt-4"
                      onClick={() => router.push("/vehicles")}
                      variant="outline"
                    >
                      Browse Vehicles
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              // Conversations list
              <div className="space-y-1">
                {filteredConversations.map((conversation) => {
                  // Determine the other user (if current user is renter, show owner; if owner, show renter)
                  const otherUser =
                    user?.id === conversation.renterId ? conversation.owner : conversation.renter

                  const unreadCount =
                    user?.id === conversation.renterId
                      ? conversation.unreadCountRenter
                      : conversation.unreadCountOwner

                  const conversationContent = (
                    <div className="flex items-start space-x-3">
                      <UserAvatar
                        imageUrl={otherUser?.profileImage}
                        name={otherUser?.name || "Unknown"}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-start justify-between">
                          <h4 className="truncate font-semibold text-foreground text-sm">
                            {otherUser?.name || "Unknown User"}
                          </h4>
                          <div className="ml-2 flex flex-shrink-0 items-center space-x-2">
                            <span className="text-muted-foreground text-xs">
                              {formatTime(conversation.lastMessageAt)}
                            </span>
                            {unreadCount > 0 && (
                              <Badge className="flex h-[18px] min-w-[18px] items-center justify-center bg-[#EF1C25] px-1.5 py-0.5 text-white text-xs">
                                {unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="mb-1 truncate text-muted-foreground text-xs">
                          {conversation.vehicle
                            ? `${conversation.vehicle.year} ${conversation.vehicle.make} ${conversation.vehicle.model}`
                            : conversation.team
                              ? `Team: ${conversation.team.name}`
                              : conversation.driverProfile
                                ? "Driver conversation"
                                : "Conversation"}
                        </p>
                        <p
                          className={cn(
                            "truncate text-xs",
                            unreadCount > 0
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {conversation.lastMessageText || "No messages yet"}
                        </p>
                      </div>
                    </div>
                  )

                  return (
                    <div key={conversation._id}>
                      {isBulkMode ? (
                        <div
                          className={cn(
                            "flex w-full items-center space-x-3 p-4 text-left transition-colors hover:bg-muted/50 active:bg-muted/70",
                            unreadCount > 0 && "border-[#EF1C25] border-l-2 bg-[#EF1C25]/5"
                          )}
                        >
                          <input
                            checked={selectedConversations.includes(conversation._id)}
                            className="h-4 w-4 flex-shrink-0 rounded border-border text-[#EF1C25] focus:ring-[#EF1C25]"
                            onChange={() => handleBulkSelect(conversation._id)}
                            type="checkbox"
                          />
                          <div className="flex-1">{conversationContent}</div>
                        </div>
                      ) : (
                        <Link
                          className={cn(
                            "block w-full p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/70",
                            unreadCount > 0 && "border-[#EF1C25] border-l-2 bg-[#EF1C25]/5"
                          )}
                          href={`/messages/${conversation._id}`}
                        >
                          {conversationContent}
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background">
          <div className="mx-auto max-w-6xl p-6">
            <div className="mb-6">
              <h1 className="font-bold text-3xl text-foreground">Messages</h1>
              <p className="mt-2 text-muted-foreground">
                Manage your conversations and stay connected with other users.
              </p>
            </div>
            <Card className="h-[calc(100dvh-16rem)] max-h-[700px]">
              <CardContent className="p-6">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      className="flex animate-pulse items-center space-x-3 rounded-lg bg-muted p-3"
                      key={index}
                    >
                      <div className="h-12 w-12 flex-shrink-0 rounded-full bg-muted-foreground/20" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 rounded bg-muted-foreground/20" />
                        <div className="h-3 w-1/2 rounded bg-muted-foreground/20" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <MessagesPageContent />
    </Suspense>
  )
}
