"use client"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { Copy, Edit, Reply, Trash2 } from "lucide-react"
import type { Id } from "@/lib/convex"
import { formatTime } from "@/lib/format-time"

interface RepliedToMessage {
  sender?: { name?: string } | null
  content: string
}

export interface MessageData {
  _id: Id<"messages">
  senderId: string
  content: string
  createdAt: number
  repliedToMessage?: RepliedToMessage | null
}

interface MessageBubbleProps {
  message: MessageData
  isOwn: boolean
  isHovered: boolean
  isEditing: boolean
  editContent: string
  isSavingEdit: boolean
  canEdit: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onCopy: (content: string) => void
  onEdit: (messageId: string, content: string) => void
  onDelete: (messageId: string) => void
  onReply: (message: { _id: Id<"messages">; content: string }) => void
  onEditContentChange: (value: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
}

export function MessageBubble({
  message,
  isOwn,
  isHovered,
  isEditing,
  editContent,
  isSavingEdit,
  canEdit,
  onMouseEnter,
  onMouseLeave,
  onCopy,
  onEdit,
  onDelete,
  onReply,
  onEditContentChange,
  onSaveEdit,
  onCancelEdit,
}: MessageBubbleProps) {
  const showOwnActions = isOwn && isHovered && !isEditing
  const showReceiverActions = !isOwn && isHovered

  return (
    <div
      className={cn("group flex items-start gap-2", isOwn ? "justify-end" : "justify-start")}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Own message action buttons - left side */}
      <div className="mt-1 flex items-center">
        <div
          className={cn(
            "flex gap-1 transition-all duration-200",
            showOwnActions ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
          )}
        >
          {isOwn && (
            <>
              <Button
                aria-label="Copy message"
                className="h-7 min-h-[44px] w-7 min-w-[44px] p-0"
                onClick={() => onCopy(message.content)}
                size="sm"
                title="Copy message"
                variant="ghost"
              >
                <Copy className="h-3 w-3" />
              </Button>
              {canEdit && (
                <Button
                  aria-label="Edit message"
                  className="h-7 min-h-[44px] w-7 min-w-[44px] p-0"
                  onClick={() => onEdit(message._id, message.content)}
                  size="sm"
                  title="Edit message"
                  variant="ghost"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
              <Button
                aria-label="Delete message"
                className="h-7 min-h-[44px] w-7 min-w-[44px] p-0 text-destructive hover:text-destructive"
                onClick={() => onDelete(message._id)}
                size="sm"
                title="Delete message"
                variant="ghost"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Message bubble */}
      <div className="relative max-w-xs lg:max-w-md">
        {isEditing ? (
          <div
            className={cn(
              "rounded-lg p-3",
              isOwn ? "bg-[#EF1C25] text-white" : "bg-muted text-foreground"
            )}
          >
            <Input
              className="mb-2"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onEditContentChange(e.target.value)
              }
              placeholder="Edit your message..."
              value={editContent}
            />
            <div className="flex gap-2">
              <Button disabled={isSavingEdit || !editContent.trim()} onClick={onSaveEdit} size="sm">
                {isSavingEdit ? "Saving..." : "Save"}
              </Button>
              <Button disabled={isSavingEdit} onClick={onCancelEdit} size="sm" variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "rounded-lg p-3",
                isOwn ? "bg-[#EF1C25] text-white" : "bg-muted text-foreground"
              )}
            >
              {message.repliedToMessage && (
                <div
                  className={cn(
                    "mb-2 truncate border-l-2 pb-2 pl-2 text-xs",
                    isOwn
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

      {/* Receiver message reply button - right side */}
      <div className="mt-1 flex items-center">
        <div
          className={cn(
            "flex gap-1 transition-all duration-200",
            showReceiverActions ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
          )}
        >
          {!isOwn && (
            <Button
              aria-label="Reply to message"
              className="h-7 min-h-[44px] w-7 min-w-[44px] p-0"
              onClick={() => onReply(message)}
              size="sm"
              title="Reply to message"
              variant="ghost"
            >
              <Reply className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
