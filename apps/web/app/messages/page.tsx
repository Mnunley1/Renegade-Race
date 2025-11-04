"use client"

import { Suspense } from "react"
import { useUser } from "@clerk/nextjs"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { useMutation, useQuery } from "convex/react"
import { MessageSquare, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { api } from "@/lib/convex"
import { cn } from "@workspace/ui/lib/utils"

function MessagesPageContent() {
  const { user, isSignedIn } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
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
  const conversations = [
    ...(renterConversations || []),
    ...(ownerConversations || []),
  ].sort((a, b) => b.lastMessageAt - a.lastMessageAt)

  // Filter conversations based on search query
  const filteredConversations = conversations.filter((conversation) => {
    if (!searchQuery.trim()) return true

    const otherUser =
      user?.id === conversation.renterId ? conversation.owner : conversation.renter

    const searchLower = searchQuery.toLowerCase()
    return (
      otherUser?.name?.toLowerCase().includes(searchLower) ||
      conversation.vehicle?.make?.toLowerCase().includes(searchLower) ||
      conversation.vehicle?.model?.toLowerCase().includes(searchLower) ||
      conversation.lastMessageText?.toLowerCase().includes(searchLower)
    )
  })

  // Mutations
  const bulkConversationActions = useMutation(api.conversations.bulkHostConversationActions)

  if (!isSignedIn || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Please sign in</h2>
              <p className="text-muted-foreground">You need to be signed in to view conversations.</p>
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

  const handleBulkArchive = async () => {
    if (selectedConversations.length === 0) return

    setIsPerformingBulkAction(true)
    try {
      await bulkConversationActions({
        hostId: user?.id || "",
        conversationIds: selectedConversations.map((id) => id as Id<"conversations">),
        action: "archive",
      })
      setSelectedConversations([])
      setIsBulkMode(false)
    } catch (error) {
      console.error("Failed to archive conversations:", error)
    } finally {
      setIsPerformingBulkAction(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedConversations.length === 0) return

    setIsPerformingBulkAction(true)
    try {
      await bulkConversationActions({
        hostId: user?.id || "",
        conversationIds: selectedConversations.map((id) => id as Id<"conversations">),
        action: "delete",
      })
      setSelectedConversations([])
      setIsBulkMode(false)
    } catch (error) {
      console.error("Failed to delete conversations:", error)
    } finally {
      setIsPerformingBulkAction(false)
    }
  }

  const handleBulkMarkRead = async () => {
    if (selectedConversations.length === 0) return

    setIsPerformingBulkAction(true)
    try {
      await bulkConversationActions({
        hostId: user?.id || "",
        conversationIds: selectedConversations.map((id) => id as Id<"conversations">),
        action: "mark_read",
      })
      setSelectedConversations([])
      setIsBulkMode(false)
    } catch (error) {
      console.error("Failed to mark conversations as read:", error)
    } finally {
      setIsPerformingBulkAction(false)
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
      return `${diffInMinutes}m ago`
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const isLoading = renterConversations === undefined || ownerConversations === undefined

  return (
    <div className="bg-background">
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground mt-2">
            Manage your conversations and stay connected with other users.
          </p>
        </div>

        <Card className="h-[calc(100vh-16rem)] max-h-[700px]">
          <CardHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle>Conversations</CardTitle>
                <div className="flex gap-2">
                  {isBulkMode ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsBulkMode(false)
                          setSelectedConversations([])
                        }}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSelectAll}>
                        {selectedConversations.length === conversations.length
                          ? "Deselect All"
                          : "Select All"}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setIsBulkMode(true)}>
                      Select
                    </Button>
                  )}
                </div>
              </div>

              {/* Bulk actions bar */}
              {isBulkMode && selectedConversations.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground">
                    {selectedConversations.length} selected
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkMarkRead}
                      disabled={isPerformingBulkAction}
                    >
                      Mark Read
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkArchive}
                      disabled={isPerformingBulkAction}
                    >
                      Archive
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleBulkDelete}
                      disabled={isPerformingBulkAction}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchQuery(e.target.value)
                  }
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto">
            {isLoading ? (
              // Loading state
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 rounded-lg bg-muted animate-pulse"
                  >
                    <div className="w-12 h-12 rounded-full bg-muted-foreground/20"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted-foreground/20 rounded w-3/4"></div>
                      <div className="h-3 bg-muted-foreground/20 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              // Empty state
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {searchQuery ? "No conversations found" : "No conversations yet"}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {searchQuery
                      ? "Try a different search term."
                      : "Start a conversation by booking a vehicle or listing one."}
                  </p>
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
                      <div className="w-12 h-12 rounded-full bg-[#EF1C25] flex items-center justify-center text-white font-medium flex-shrink-0">
                        {otherUser?.name?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="font-semibold text-foreground truncate text-sm">
                            {otherUser?.name || "Unknown User"}
                          </h4>
                          <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                            <span className="text-xs text-muted-foreground">
                              {formatTime(conversation.lastMessageAt)}
                            </span>
                            {unreadCount > 0 && (
                              <Badge className="bg-[#EF1C25] text-white text-xs px-1.5 py-0.5 min-w-[18px] h-[18px] flex items-center justify-center">
                                {unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mb-1">
                          {conversation.vehicle
                            ? `${conversation.vehicle.year} ${conversation.vehicle.make} ${conversation.vehicle.model}`
                            : "Vehicle conversation"}
                        </p>
                        <p
                          className={cn(
                            "text-xs truncate",
                            unreadCount > 0
                              ? "text-foreground font-medium"
                              : "text-muted-foreground"
                          )}
                        >
                          {conversation.lastMessageText || "No messages yet"}
                        </p>
                      </div>
                    </div>
                  )

                  return (
                    <div
                      key={conversation._id}
                      className={cn(
                        "w-full text-left hover:bg-muted/50 transition-colors",
                        isBulkMode ? "flex items-center space-x-3 p-4" : "p-4"
                      )}
                    >
                      {isBulkMode && (
                        <input
                          type="checkbox"
                          checked={selectedConversations.includes(conversation._id)}
                          onChange={() => handleBulkSelect(conversation._id)}
                          className="w-4 h-4 text-[#EF1C25] border-border rounded focus:ring-[#EF1C25] flex-shrink-0"
                        />
                      )}
                      {isBulkMode ? (
                        <div className="flex-1">{conversationContent}</div>
                      ) : (
                        <Link href={`/messages/${conversation._id}`} className="w-full text-left">
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
          <div className="max-w-6xl mx-auto p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground">Messages</h1>
              <p className="text-muted-foreground mt-2">
                Manage your conversations and stay connected with other users.
              </p>
            </div>
            <Card className="h-[calc(100vh-16rem)] max-h-[700px]">
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">Loading...</div>
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
