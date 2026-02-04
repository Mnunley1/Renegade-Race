"use client"

import { MessageSquare } from "lucide-react"
import type { RefObject } from "react"
import { useState } from "react"
import type { Id } from "@/lib/convex"
import type { MessageData } from "./message-bubble"
import { MessageBubble } from "./message-bubble"

interface MessageListProps {
  messages: MessageData[] | undefined
  currentUserId: string
  isPending: boolean
  pendingRecipientName?: string | null
  pendingVehicleLabel?: string | null
  messagesEndRef: RefObject<HTMLDivElement | null>
  editingMessage: string | null
  editMessageContent: string
  isEditingMessage: boolean
  onEditContentChange: (value: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onCopy: (content: string) => void
  onEdit: (messageId: string, content: string) => void
  onDelete: (messageId: string) => void
  onReply: (message: { _id: Id<"messages">; content: string }) => void
  canEditMessage: (message: { senderId: string; createdAt: number }) => boolean
}

function getDateLabel(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (messageDay.getTime() === today.getTime()) return "Today"
  if (messageDay.getTime() === yesterday.getTime()) return "Yesterday"
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

function isSameDay(a: number, b: number): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

export function MessageList({
  messages,
  currentUserId,
  isPending,
  pendingRecipientName,
  pendingVehicleLabel,
  messagesEndRef,
  editingMessage,
  editMessageContent,
  isEditingMessage,
  onEditContentChange,
  onSaveEdit,
  onCancelEdit,
  onCopy,
  onEdit,
  onDelete,
  onReply,
  canEditMessage,
}: MessageListProps) {
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null)

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 font-semibold text-foreground text-lg">Start a conversation</h3>
          <p className="mb-4 text-muted-foreground text-sm">
            Send your first message to {pendingRecipientName || "this user"} about the{" "}
            {pendingVehicleLabel || "vehicle"}.
          </p>
        </div>
      </div>
    )
  }

  if (messages && messages.length > 0) {
    return (
      <div className="space-y-4">
        {messages.map((message: MessageData, index: number) => {
          const prevMessage = messages[index - 1]
          const showDateDivider =
            index === 0 || (prevMessage && !isSameDay(message.createdAt, prevMessage.createdAt))

          return (
            <div key={message._id}>
              {showDateDivider && (
                <div className="flex items-center gap-4 py-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="font-medium text-muted-foreground text-xs">
                    {getDateLabel(message.createdAt)}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              <MessageBubble
                canEdit={canEditMessage(message)}
                editContent={editMessageContent}
                isEditing={editingMessage === message._id}
                isHovered={hoveredMessage === message._id}
                isOwn={message.senderId === currentUserId}
                isSavingEdit={isEditingMessage}
                message={message}
                onCancelEdit={onCancelEdit}
                onCopy={onCopy}
                onDelete={onDelete}
                onEdit={onEdit}
                onEditContentChange={onEditContentChange}
                onMouseEnter={() => setHoveredMessage(message._id)}
                onMouseLeave={() => setHoveredMessage(null)}
                onReply={onReply}
                onSaveEdit={onSaveEdit}
              />
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 font-semibold text-foreground text-lg">No messages yet</h3>
        <p className="text-muted-foreground text-sm">
          Start the conversation by sending a message.
        </p>
      </div>
    </div>
  )
}
