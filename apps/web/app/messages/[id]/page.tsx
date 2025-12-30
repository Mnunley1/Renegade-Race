"use client"

import { useUser } from "@clerk/nextjs"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import {
  Archive,
  ArrowLeft,
  Copy,
  Edit,
  MessageSquare,
  MoreVertical,
  Reply,
  Send,
  Trash2,
  X,
} from "lucide-react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"

export default function ChatPage() {
  const { user, isSignedIn } = useUser()
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const conversationId = params.id as string | undefined

  const [newMessage, setNewMessage] = useState("")
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Track which conversation has been marked as read to prevent duplicate calls
  const markedAsReadRef = useRef<string | null>(null)
  // Track previous conversationId to detect actual changes
  const prevConversationIdRef = useRef<string | undefined>(undefined)

  // Edit message states
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [editMessageContent, setEditMessageContent] = useState("")
  const [isEditingMessage, setIsEditingMessage] = useState(false)

  // Reply message states
  const [replyingToMessage, setReplyingToMessage] = useState<Id<"messages"> | undefined>(undefined)

  // Dialog states
  const [showDeleteMessageDialog, setShowDeleteMessageDialog] = useState(false)
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null)
  const [isDeletingMessage, setIsDeletingMessage] = useState(false)

  const [showDeleteConversationDialog, setShowDeleteConversationDialog] = useState(false)
  const [showArchiveConversationDialog, setShowArchiveConversationDialog] = useState(false)
  const [isDeletingConversation, setIsDeletingConversation] = useState(false)
  const [isArchivingConversation, setIsArchivingConversation] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isNavigatingAway, setIsNavigatingAway] = useState(false)

  // Handle pending conversation from URL parameters
  const [pendingConversation, setPendingConversation] = useState<{
    vehicleId: string
    renterId: string
    ownerId: string
  } | null>(null)

  useEffect(() => {
    const vehicleId = searchParams.get("vehicleId")
    const renterId = searchParams.get("renterId")
    const ownerId = searchParams.get("ownerId")

    if (vehicleId && renterId && ownerId && !conversationId) {
      setPendingConversation({ vehicleId, renterId, ownerId })
    }
  }, [searchParams, conversationId])

  // Fetch conversation details - skip if navigating away to prevent errors
  const conversation = useQuery(
    api.conversations.getById,
    conversationId && user?.id && !isNavigatingAway
      ? { conversationId: conversationId as Id<"conversations">, userId: user.id }
      : "skip"
  )

  // Fetch messages for the conversation - skip if navigating away to prevent errors
  const messages = useQuery(
    api.messages.getByConversation,
    conversationId && user?.id && !isNavigatingAway
      ? { conversationId: conversationId as Id<"conversations">, userId: user.id }
      : "skip"
  )

  // Compute the external ID of the other user to stabilize the query
  const otherUserExternalId = useMemo(() => {
    if (!(conversation && user?.id)) return
    if (user.id === conversation.renterId) return conversation.ownerId
    if (user.id === conversation.ownerId) return conversation.renterId
    return
  }, [conversation, user?.id])

  // Fetch participant details
  const otherUser = useQuery(
    api.users.getByExternalId,
    otherUserExternalId ? { externalId: otherUserExternalId } : "skip"
  )

  // Fetch vehicle details
  const vehicle = useQuery(
    api.vehicles.getById,
    conversation ? { id: conversation.vehicleId as Id<"vehicles"> } : "skip"
  )

  // Fetch recipient user data for pending conversations
  const recipientUser = useQuery(
    api.users.getByExternalId,
    pendingConversation && user?.id === pendingConversation.renterId
      ? { externalId: pendingConversation.ownerId }
      : pendingConversation && user?.id === pendingConversation.ownerId
        ? { externalId: pendingConversation.renterId }
        : "skip"
  )

  // Fetch vehicle data for pending conversations
  const pendingVehicle = useQuery(
    api.vehicles.getById,
    pendingConversation ? { id: pendingConversation.vehicleId as Id<"vehicles"> } : "skip"
  )

  // Mutations
  const sendMessageMutation = useMutation(api.messages.send)
  const deleteMessageMutation = useMutation(api.messages.deleteMessage)
  const editMessageMutation = useMutation(api.messages.editMessage)
  const deleteConversationMutation = useMutation(api.conversations.deleteConversation)
  const archiveConversationMutation = useMutation(api.conversations.archive)
  const markAsRead = useMutation(api.messages.markConversationAsRead)

  // Mark conversation as read when viewing - only once per conversation
  // This prevents websocket reconnections by avoiding repeated mutation calls
  useEffect(() => {
    // Reset ref only when conversationId actually changes (user navigates to different conversation)
    if (conversationId !== prevConversationIdRef.current) {
      markedAsReadRef.current = null
      prevConversationIdRef.current = conversationId
    }

    // Only mark as read if:
    // 1. We have all required data
    // 2. We haven't already marked this conversation as read
    // 3. Messages have loaded (so we know the user is actually viewing)
    if (
      conversation &&
      user?.id &&
      conversationId &&
      messages !== undefined &&
      markedAsReadRef.current !== conversationId
    ) {
      markedAsReadRef.current = conversationId
      markAsRead({
        conversationId: conversationId as Id<"conversations">,
        userId: user.id,
      }).catch(console.error)
    }
  }, [conversation, user?.id, conversationId, messages, markAsRead])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Navigate away if conversation is deleted (query fails or returns null)
  useEffect(() => {
    if (isNavigatingAway) {
      // Already navigating, don't re-navigate
      return
    }

    if (conversationId && conversation === null && messages === undefined && user?.id) {
      // Conversation was deleted or not found, navigate to messages page
      setIsNavigatingAway(true)
      router.replace("/messages")
    }
  }, [conversation, conversationId, messages, router, isNavigatingAway, user?.id])

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

  if (!(conversationId || pendingConversation)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="mb-2 font-semibold text-foreground text-xl">
                No conversation selected
              </h2>
              <p className="text-muted-foreground">
                Please select a conversation to view messages.
              </p>
              <Button className="mt-4" onClick={() => router.push("/messages")}>
                Back to Messages
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Don't render if navigating away to prevent errors
  if (isNavigatingAway) {
    return null
  }

  if (!pendingConversation && (conversation === undefined || messages === undefined)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-[#EF1C25] border-b-2" />
              <p className="text-muted-foreground">Loading conversation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!(pendingConversation || conversation)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="mb-2 font-semibold text-foreground text-xl">Conversation not found</h2>
              <p className="text-muted-foreground">
                This conversation may have been deleted or you don't have access to it.
              </p>
              <Button className="mt-4" onClick={() => router.push("/messages")}>
                Back to Messages
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return

    try {
      if (conversationId) {
        // Send message to existing conversation
        await sendMessageMutation({
          conversationId: conversationId as Id<"conversations">,
          content: newMessage.trim(),
          replyTo: replyingToMessage,
        })
      } else if (pendingConversation) {
        // Create conversation and send first message
        const result = await sendMessageMutation({
          vehicleId: pendingConversation.vehicleId as Id<"vehicles">,
          renterId: pendingConversation.renterId,
          ownerId: pendingConversation.ownerId,
          content: newMessage.trim(),
          replyTo: replyingToMessage,
        })

        // Transition from pending to actual conversation
        if (result && result.conversationId) {
          setPendingConversation(null)
          // Update URL to reflect the new conversation
          router.replace(`/messages/${result.conversationId}`)
        }
      } else {
        console.error("No conversation selected and no pending conversation")
        return
      }
      setNewMessage("")
      setReplyingToMessage(undefined)
    } catch (error) {
      console.error("Error sending message:", error)
    }
  }

  const handleDeleteMessage = (messageId: string) => {
    setMessageToDelete(messageId)
    setShowDeleteMessageDialog(true)
  }

  const confirmDeleteMessage = async () => {
    if (!messageToDelete) return

    setIsDeletingMessage(true)
    setDeleteError(null)
    try {
      await deleteMessageMutation({ messageId: messageToDelete as Id<"messages"> })
      setShowDeleteMessageDialog(false)
      setMessageToDelete(null)
    } catch (error) {
      console.error("Failed to delete message:", error)
      setDeleteError("An error occurred")
    } finally {
      setIsDeletingMessage(false)
    }
  }

  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success("Copied!", {
        description: "Message copied to clipboard",
      })
    } catch (error) {
      console.error("Failed to copy message:", error)
      toast.error("Failed to copy", {
        description: "Could not copy message to clipboard",
      })
    }
  }

  const handleEditMessage = (messageId: string, currentContent: string) => {
    setEditingMessage(messageId)
    setEditMessageContent(currentContent)
  }

  const handleSaveEdit = async () => {
    if (!(editingMessage && editMessageContent.trim())) return

    setIsEditingMessage(true)
    try {
      await editMessageMutation({
        messageId: editingMessage as Id<"messages">,
        content: editMessageContent.trim(),
      })
      setEditingMessage(null)
      setEditMessageContent("")
    } catch (error) {
      console.error("Failed to edit message:", error)
    } finally {
      setIsEditingMessage(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingMessage(null)
    setEditMessageContent("")
  }

  const canEditMessage = (message: { senderId: string; createdAt: number }) => {
    if (message.senderId !== user?.id) return false
    const editWindow = 15 * 60 * 1000 // 15 minutes
    const now = Date.now()
    return now - message.createdAt <= editWindow
  }

  const handleReplyToMessage = (message: { _id: Id<"messages">; content: string }) => {
    setReplyingToMessage(message._id)
  }

  const handleCancelReply = () => {
    setReplyingToMessage(undefined)
  }

  const handleDeleteConversation = () => {
    setShowDeleteConversationDialog(true)
  }

  const confirmDeleteConversation = async () => {
    if (!conversationId) return

    setIsDeletingConversation(true)
    setDeleteError(null)
    // Mark as navigating away immediately to skip queries and prevent errors
    setIsNavigatingAway(true)
    try {
      await deleteConversationMutation({
        conversationId: conversationId as Id<"conversations">,
      })
      setShowDeleteConversationDialog(false)
      // Navigate immediately after successful deletion
      router.replace("/messages")
    } catch (error) {
      // If deletion fails, reset the navigation flag
      setIsNavigatingAway(false)
      console.error("Failed to delete conversation:", error)
      setDeleteError("An error occurred")
      console.error("Failed to delete conversation:", error)
    } finally {
      setIsDeletingConversation(false)
    }
  }

  const handleArchiveConversation = () => {
    setShowArchiveConversationDialog(true)
  }

  const confirmArchiveConversation = async () => {
    if (!conversationId) return

    setIsArchivingConversation(true)
    try {
      await archiveConversationMutation({
        conversationId: conversationId as Id<"conversations">,
      })
      setShowArchiveConversationDialog(false)
      router.replace("/messages")
    } catch (error) {
      console.error("Failed to archive conversation:", error)
    } finally {
      setIsArchivingConversation(false)
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
      return `${diffInMinutes}m ago`
    }
    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    }
    return date.toLocaleDateString()
  }

  return (
    <div className="bg-background py-6">
      <div className="mx-auto max-w-4xl px-6">
        <Card className="flex h-[calc(100vh-12rem)] max-h-[800px] flex-col">
          {/* Header */}
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button className="mb-6" onClick={() => router.push("/messages")} variant="outline">
                  <ArrowLeft className="mr-2 size-4" />
                  Back to Messages
                </Button>
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EF1C25] font-medium text-white">
                    {(pendingConversation ? recipientUser : otherUser)?.name?.[0]?.toUpperCase() ||
                      "U"}
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">
                      {(pendingConversation ? recipientUser : otherUser)?.name || "Unknown User"}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {(pendingConversation ? pendingVehicle : vehicle)
                        ? `${
                            (pendingConversation ? pendingVehicle : vehicle)?.year
                          } ${(pendingConversation ? pendingVehicle : vehicle)?.make} ${
                            (pendingConversation ? pendingVehicle : vehicle)?.model
                          }`
                        : "Vehicle conversation"}
                    </p>
                  </div>
                </div>
              </div>
              {!pendingConversation && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleArchiveConversation}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive Conversation
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={handleDeleteConversation}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Conversation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardHeader>

          {/* Messages */}
          <CardContent className="flex-1 overflow-y-auto p-4">
            {pendingConversation ? (
              // Pending conversation - show recipient info
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 font-semibold text-foreground text-lg">
                    Start a conversation
                  </h3>
                  <p className="mb-4 text-muted-foreground text-sm">
                    Send your first message to {recipientUser?.name || "this user"} about the{" "}
                    {pendingVehicle
                      ? `${pendingVehicle.year} ${pendingVehicle.make} ${pendingVehicle.model}`
                      : "vehicle"}
                    .
                  </p>
                </div>
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    className={cn(
                      "group flex items-start gap-2",
                      message.senderId === user.id ? "justify-end" : "justify-start"
                    )}
                    key={message._id}
                    onMouseEnter={() => setHoveredMessage(message._id)}
                    onMouseLeave={() => setHoveredMessage(null)}
                  >
                    {/* Message action menu for user's own messages - positioned to the left */}
                    <div
                      className={cn(
                        "mt-1 overflow-hidden transition-all duration-200",
                        message.senderId === user.id &&
                          hoveredMessage === message._id &&
                          editingMessage !== message._id
                          ? "w-auto"
                          : "w-0"
                      )}
                    >
                      {message.senderId === user.id &&
                        hoveredMessage === message._id &&
                        editingMessage !== message._id && (
                          <div className="flex gap-1 whitespace-nowrap">
                            <Button
                              className="h-6 w-6 p-0"
                              onClick={() => handleCopyMessage(message.content)}
                              size="sm"
                              title="Copy message"
                              variant="ghost"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            {canEditMessage(message) && (
                              <Button
                                className="h-6 w-6 p-0"
                                onClick={() => handleEditMessage(message._id, message.content)}
                                size="sm"
                                title="Edit message"
                                variant="ghost"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteMessage(message._id)}
                              size="sm"
                              title="Delete message"
                              variant="ghost"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                    </div>
                    <div className="relative max-w-xs lg:max-w-md">
                      {editingMessage === message._id ? (
                        <div
                          className={cn(
                            "rounded-lg p-3",
                            message.senderId === user.id
                              ? "bg-[#EF1C25] text-white"
                              : "bg-muted text-foreground"
                          )}
                        >
                          <Input
                            className="mb-2"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setEditMessageContent(e.target.value)
                            }
                            placeholder="Edit your message..."
                            value={editMessageContent}
                          />
                          <div className="flex gap-2">
                            <Button
                              disabled={isEditingMessage || !editMessageContent.trim()}
                              onClick={handleSaveEdit}
                              size="sm"
                            >
                              {isEditingMessage ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              disabled={isEditingMessage}
                              onClick={handleCancelEdit}
                              size="sm"
                              variant="outline"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            className={cn(
                              "rounded-lg p-3",
                              message.senderId === user.id
                                ? "bg-[#EF1C25] text-white"
                                : "bg-muted text-foreground"
                            )}
                          >
                            {/* Show replied-to message if this is a reply */}
                            {message.repliedToMessage && (
                              <div
                                className={cn(
                                  "mb-2 truncate border-l-2 pb-2 pl-2 text-xs",
                                  message.senderId === user.id
                                    ? "border-white/30 text-white/80"
                                    : "border-muted-foreground/30 text-muted-foreground"
                                )}
                              >
                                <div className="font-medium">
                                  {message.repliedToMessage.sender?.name || "Unknown"}
                                </div>
                                <div className="truncate">{message.repliedToMessage.content}</div>
                              </div>
                            )}
                            <p className="text-sm">{message.content}</p>
                          </div>
                          <p className="mt-1 px-1 text-muted-foreground text-xs">
                            {formatTime(message.createdAt)}
                          </p>
                        </>
                      )}
                    </div>
                    {/* Reply button for other user's messages - positioned to the right */}
                    <div
                      className={cn(
                        "mt-1 overflow-hidden transition-all duration-200",
                        message.senderId !== user.id && hoveredMessage === message._id
                          ? "w-auto"
                          : "w-0"
                      )}
                    >
                      {message.senderId !== user.id && hoveredMessage === message._id && (
                        <div className="flex gap-1 whitespace-nowrap">
                          <Button
                            className="h-6 w-6 p-0"
                            onClick={() => handleReplyToMessage(message)}
                            size="sm"
                            title="Reply to message"
                            variant="ghost"
                          >
                            <Reply className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 font-semibold text-foreground text-lg">No messages yet</h3>
                  <p className="text-muted-foreground text-sm">
                    Start the conversation by sending a message.
                  </p>
                </div>
              </div>
            )}
          </CardContent>

          {/* Message Input */}
          <div className="border-t p-4">
            {/* Reply indicator */}
            {replyingToMessage && (
              <div className="mb-3 rounded-lg border-[#EF1C25] border-l-4 bg-muted p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="mb-1 text-muted-foreground text-xs">Replying to:</p>
                    <p className="truncate text-foreground text-sm">
                      {messages?.find((m) => m._id === replyingToMessage)?.content}
                    </p>
                  </div>
                  <Button
                    className="ml-2 h-6 w-6 p-0"
                    onClick={handleCancelReply}
                    size="sm"
                    variant="ghost"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex space-x-2">
              <Input
                className="flex-1"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
                onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") {
                    handleSendMessage()
                  }
                }}
                placeholder={replyingToMessage ? "Type your reply..." : "Type a message..."}
                value={newMessage}
              />
              <Button disabled={!newMessage.trim()} onClick={handleSendMessage} size="sm">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Confirmation Dialogs */}
      <Dialog
        onOpenChange={(open) => {
          setShowDeleteMessageDialog(open)
          if (!open) setDeleteError(null)
        }}
        open={showDeleteMessageDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Message</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                setShowDeleteMessageDialog(false)
                setDeleteError(null)
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isDeletingMessage}
              onClick={confirmDeleteMessage}
              variant="destructive"
            >
              {isDeletingMessage ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          setShowDeleteConversationDialog(open)
          if (!open) setDeleteError(null)
        }}
        open={showDeleteConversationDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this conversation? This will remove it from your
              messages list. The other participant will still be able to see the conversation. If
              both participants delete the conversation, it will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                setShowDeleteConversationDialog(false)
                setDeleteError(null)
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isDeletingConversation}
              onClick={confirmDeleteConversation}
              variant="destructive"
            >
              {isDeletingConversation ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setShowArchiveConversationDialog} open={showArchiveConversationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive this conversation? You can unarchive it later from
              your archived conversations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowArchiveConversationDialog(false)} variant="outline">
              Cancel
            </Button>
            <Button disabled={isArchivingConversation} onClick={confirmArchiveConversation}>
              {isArchivingConversation ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
