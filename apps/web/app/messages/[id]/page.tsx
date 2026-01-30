"use client"

import { useUser } from "@clerk/nextjs"
import type { Id } from "@/lib/convex"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { handleError, handleErrorWithContext } from "@/lib/error-handler"
import { useMutation, useQuery } from "convex/react"
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  Clock,
  MessageSquare,
  RefreshCw,
} from "lucide-react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { ChatHeader } from "./chat-header"
import { MessageList } from "./message-list"
import { MessageInput } from "./message-input"
import { ConfirmationDialogs } from "./confirmation-dialogs"
import type { MessageData } from "./message-bubble"

function ChatPageContent() {
  const { user, isSignedIn } = useUser()
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const conversationId = params.id as string | undefined

  const [newMessage, setNewMessage] = useState("")
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)
  // Track which conversation has been marked as read to prevent duplicate calls
  const markedAsReadRef = useRef<string | null>(null)
  // Track previous conversationId to detect actual changes
  const prevConversationIdRef = useRef<string | undefined>(undefined)

  // Optimistic messages
  const [optimisticMessages, setOptimisticMessages] = useState<Array<{
    _id: string
    content: string
    senderId: string
    createdAt: number
    status: "sending" | "failed"
    replyTo?: string
  }>>([])

  // Smart scroll state
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const prevMessagesLengthRef = useRef<number>(0)

  const MESSAGE_MAX_LENGTH = 2000
  const MESSAGE_WARN_THRESHOLD = 1800

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
    conversation?.vehicleId ? { id: conversation.vehicleId as Id<"vehicles"> } : "skip"
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
    pendingConversation?.vehicleId ? { id: pendingConversation.vehicleId as Id<"vehicles"> } : "skip"
  )

  // Mutations
  const sendMessageMutation = useMutation(api.messages.send)
  const deleteMessageMutation = useMutation(api.messages.deleteMessage)
  const editMessageMutation = useMutation(api.messages.editMessage)
  const deleteConversationMutation = useMutation(api.conversations.deleteConversation)
  const archiveConversationMutation = useMutation(api.conversations.archive)
  const markAsRead = useMutation(api.messages.markConversationAsRead)

  // Mark conversation as read when viewing
  // Reset markedAsReadRef when conversationId changes, messages.length changes, or tab regains visibility
  useEffect(() => {
    if (conversationId !== prevConversationIdRef.current) {
      markedAsReadRef.current = null
      prevConversationIdRef.current = conversationId
    }
  }, [conversationId])

  // Reset mark-as-read when new messages arrive
  useEffect(() => {
    if (messages && messages.length !== prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = messages.length
      markedAsReadRef.current = null
    }
  }, [messages])

  // Reset mark-as-read when tab regains visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markedAsReadRef.current = null
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  // Actually mark as read
  useEffect(() => {
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
      }).catch((error) => {
        handleErrorWithContext(error, {
          action: "mark conversation as read",
        })
      })
    }
  }, [conversation, user?.id, conversationId, messages, markAsRead])

  // Smart scroll: track if user is near bottom
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const threshold = 100
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    setIsNearBottom(distanceFromBottom <= threshold)
    if (distanceFromBottom <= threshold) {
      setHasNewMessages(false)
    }
  }, [])

  // Smart scroll: auto-scroll or show pill when new messages arrive
  useEffect(() => {
    if (!messages) return
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    } else if (messages.length > 0) {
      setHasNewMessages(true)
    }
  }, [messages, isNearBottom])

  // Clear optimistic messages that now appear in real messages
  useEffect(() => {
    if (!messages || optimisticMessages.length === 0) return
    setOptimisticMessages((prev) =>
      prev.filter((opt) => {
        if (opt.status === "failed") return true
        return !messages.some(
          (real: any) =>
            real.content === opt.content && real.senderId === opt.senderId
        )
      })
    )
  }, [messages])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    setHasNewMessages(false)
  }, [])

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
    const content = newMessage.trim()
    if (!content) return
    if (content.length > MESSAGE_MAX_LENGTH) return

    const optimisticId = `optimistic-${Date.now()}-${Math.random()}`
    const optimisticMsg = {
      _id: optimisticId,
      content,
      senderId: user.id,
      createdAt: Date.now(),
      status: "sending" as const,
      replyTo: replyingToMessage as string | undefined,
    }

    // Add optimistic message and clear input immediately
    setOptimisticMessages((prev) => [...prev, optimisticMsg])
    setNewMessage("")
    const savedReplyTo = replyingToMessage
    setReplyingToMessage(undefined)

    // Return focus to input
    messageInputRef.current?.focus()

    // Scroll to bottom for own message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 0)

    try {
      if (conversationId) {
        await sendMessageMutation({
          conversationId: conversationId as Id<"conversations">,
          content,
          replyTo: savedReplyTo,
        })
      } else if (pendingConversation) {
        const result = await sendMessageMutation({
          vehicleId: pendingConversation.vehicleId as Id<"vehicles">,
          renterId: pendingConversation.renterId,
          ownerId: pendingConversation.ownerId,
          content,
          replyTo: savedReplyTo,
        })

        if (result && result.conversationId) {
          setPendingConversation(null)
          router.replace(`/messages/${result.conversationId}`)
        }
      } else {
        return
      }
      // Optimistic message will be cleared by the useEffect that watches real messages
    } catch (error) {
      // Mark optimistic message as failed
      setOptimisticMessages((prev) =>
        prev.map((msg) =>
          msg._id === optimisticId ? { ...msg, status: "failed" as const } : msg
        )
      )
      handleErrorWithContext(error, {
        action: "send message",
        customMessages: {
          generic: "Failed to send message. Please try again.",
        },
      })
    }
  }

  const handleRetryMessage = async (failedMsg: {
    _id: string
    content: string
    replyTo?: string
  }) => {
    // Remove the failed message and re-send
    setOptimisticMessages((prev) =>
      prev.map((msg) =>
        msg._id === failedMsg._id ? { ...msg, status: "sending" as const } : msg
      )
    )

    try {
      if (conversationId) {
        await sendMessageMutation({
          conversationId: conversationId as Id<"conversations">,
          content: failedMsg.content,
          replyTo: failedMsg.replyTo as Id<"messages"> | undefined,
        })
      }
      // Will be cleaned up by the real-message sync effect
    } catch {
      setOptimisticMessages((prev) =>
        prev.map((msg) =>
          msg._id === failedMsg._id ? { ...msg, status: "failed" as const } : msg
        )
      )
    }
  }

  const handleDismissFailedMessage = (msgId: string) => {
    setOptimisticMessages((prev) => prev.filter((msg) => msg._id !== msgId))
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
      toast.success("Message deleted")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "delete message",
        customMessages: {
          generic: "Failed to delete message. Please try again.",
        },
      })
      setDeleteError("Failed to delete message. Please try again.")
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
      // Log error but don't show duplicate toast (toast.error already called below)
      void handleError(error, { showToast: false })
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
      toast.success("Message updated")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "update message",
        customMessages: {
          generic: "Failed to update message. Please try again.",
        },
      })
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
      handleErrorWithContext(error, {
        action: "delete conversation",
      })
      setDeleteError("Failed to delete conversation. Please try again.")
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
      toast.success("Conversation archived")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "archive conversation",
        customMessages: {
          generic: "Failed to archive conversation. Please try again.",
        },
      })
    } finally {
      setIsArchivingConversation(false)
    }
  }

  return (
    <div className="bg-background py-6">
      <div className="mx-auto max-w-4xl px-6">
        {/* Breadcrumb navigation — outside the card */}
        <nav className="mb-3 flex items-center gap-1.5 text-sm">
          <button
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => router.push("/messages")}
            type="button"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Messages
          </button>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate text-foreground">
            {(pendingConversation ? recipientUser : otherUser)?.name || "Conversation"}
          </span>
        </nav>

        <Card className="flex h-[calc(100dvh-14rem)] max-h-[800px] flex-col">
          {/* Header */}
          <CardHeader className="border-b py-3">
            <ChatHeader
              isPending={!!pendingConversation}
              onArchive={handleArchiveConversation}
              onDelete={handleDeleteConversation}
              participant={pendingConversation ? recipientUser : otherUser}
              vehicle={pendingConversation ? pendingVehicle : vehicle}
            />
          </CardHeader>

          {/* Messages */}
          <CardContent
            className="relative flex-1 overflow-y-auto p-4"
            onScroll={handleScroll}
            ref={messagesContainerRef}
          >
            <MessageList
              canEditMessage={canEditMessage}
              currentUserId={user.id}
              editingMessage={editingMessage}
              editMessageContent={editMessageContent}
              isEditingMessage={isEditingMessage}
              isPending={!!pendingConversation}
              messages={messages as MessageData[] | undefined}
              messagesEndRef={messagesEndRef}
              onCancelEdit={handleCancelEdit}
              onCopy={handleCopyMessage}
              onDelete={handleDeleteMessage}
              onEdit={handleEditMessage}
              onEditContentChange={setEditMessageContent}
              onReply={handleReplyToMessage}
              onSaveEdit={handleSaveEdit}
              pendingRecipientName={recipientUser?.name}
              pendingVehicleLabel={
                pendingVehicle
                  ? `${pendingVehicle.year} ${pendingVehicle.make} ${pendingVehicle.model}`
                  : undefined
              }
            />

            {/* Optimistic messages */}
            {!pendingConversation && optimisticMessages.length > 0 && (
              <div className="space-y-4">
                {optimisticMessages.map((msg) => (
                  <div
                    className="group flex items-start gap-2 justify-end"
                    key={msg._id}
                  >
                    <div className="relative max-w-xs lg:max-w-md">
                      <div
                        className={cn(
                          "rounded-lg p-3 bg-[#EF1C25] text-white",
                          msg.status === "sending" && "opacity-70",
                          msg.status === "failed" && "opacity-80 ring-2 ring-destructive"
                        )}
                      >
                        <p className="text-sm">{msg.content}</p>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 px-1">
                        {msg.status === "sending" && (
                          <span className="flex items-center gap-1 text-muted-foreground text-xs">
                            <Clock className="h-3 w-3" />
                            Sending
                          </span>
                        )}
                        {msg.status === "failed" && (
                          <span className="flex items-center gap-1 text-destructive text-xs">
                            <AlertCircle className="h-3 w-3" />
                            Failed
                            <button
                              aria-label="Retry sending message"
                              className="ml-1 inline-flex items-center gap-0.5 text-destructive underline underline-offset-2 hover:text-destructive/80"
                              onClick={() => handleRetryMessage(msg)}
                              type="button"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Retry
                            </button>
                            <button
                              aria-label="Dismiss failed message"
                              className="ml-1 text-muted-foreground underline underline-offset-2 hover:text-foreground"
                              onClick={() => handleDismissFailedMessage(msg._id)}
                              type="button"
                            >
                              Dismiss
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Screen reader announcement for new messages */}
            <div aria-live="polite" className="sr-only">
              {messages && messages.length > 0 && messages[messages.length - 1]?.senderId !== user.id
                ? `New message from ${otherUser?.name || "User"}: ${messages[messages.length - 1]?.content}`
                : ""}
            </div>

            {/* New messages pill */}
            {hasNewMessages && (
              <div className="sticky bottom-2 flex justify-center">
                <button
                  aria-label="Scroll to new messages"
                  className="flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-background text-sm font-medium shadow-lg transition-transform hover:scale-105"
                  onClick={scrollToBottom}
                  type="button"
                >
                  New messages
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </CardContent>

          {/* Message Input */}
          <MessageInput
            inputRef={messageInputRef}
            maxLength={MESSAGE_MAX_LENGTH}
            onChange={setNewMessage}
            onCancelReply={handleCancelReply}
            onSend={handleSendMessage}
            replyingTo={
              replyingToMessage
                ? { content: messages?.find((m: any) => m._id === replyingToMessage)?.content || "" }
                : undefined
            }
            value={newMessage}
            warnThreshold={MESSAGE_WARN_THRESHOLD}
          />
        </Card>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmationDialogs
        deleteError={deleteError}
        isArchivingConversation={isArchivingConversation}
        isDeletingConversation={isDeletingConversation}
        isDeletingMessage={isDeletingMessage}
        onClearDeleteError={() => setDeleteError(null)}
        onConfirmArchiveConversation={confirmArchiveConversation}
        onConfirmDeleteConversation={confirmDeleteConversation}
        onConfirmDeleteMessage={confirmDeleteMessage}
        onShowArchiveConversationChange={setShowArchiveConversationDialog}
        onShowDeleteConversationChange={(open) => {
          setShowDeleteConversationDialog(open)
          if (!open) setDeleteError(null)
        }}
        onShowDeleteMessageChange={(open) => {
          setShowDeleteMessageDialog(open)
          if (!open) setDeleteError(null)
        }}
        showArchiveConversation={showArchiveConversationDialog}
        showDeleteConversation={showDeleteConversationDialog}
        showDeleteMessage={showDeleteMessageDialog}
      />
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Loading conversation...</p>
          </div>
        </div>
      }
    >
      <ChatPageContent />
    </Suspense>
  )
}
