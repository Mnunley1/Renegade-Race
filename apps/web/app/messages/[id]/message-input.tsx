"use client"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { Send, X } from "lucide-react"
import { type RefObject, useCallback } from "react"

interface ReplyingToData {
  content: string
}

interface MessageInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  replyingTo: ReplyingToData | null | undefined
  onCancelReply: () => void
  inputRef?: RefObject<HTMLInputElement | null>
  maxLength?: number
  warnThreshold?: number
}

export function MessageInput({
  value,
  onChange,
  onSend,
  replyingTo,
  onCancelReply,
  inputRef,
  maxLength = 2000,
  warnThreshold = 1800,
}: MessageInputProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey && value.trim().length <= maxLength) {
        e.preventDefault()
        onSend()
      }
    },
    [onSend, value, maxLength]
  )

  return (
    <div className="border-t p-4">
      {/* Reply indicator */}
      {replyingTo && (
        <div className="mb-3 rounded-lg border-[#EF1C25] border-l-4 bg-muted p-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="mb-1 text-muted-foreground text-xs">Replying to:</p>
              <p className="truncate text-foreground text-sm">{replyingTo.content}</p>
            </div>
            <Button
              aria-label="Cancel reply"
              className="ml-2 h-6 min-h-[44px] w-6 min-w-[44px] p-0"
              onClick={onCancelReply}
              size="sm"
              variant="ghost"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex space-x-2">
        <div className="relative flex-1">
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-16 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            maxLength={maxLength + 100}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
            ref={inputRef}
            value={value}
          />
          {value.length > warnThreshold && (
            <span
              aria-live="polite"
              className={cn(
                "absolute top-1/2 right-2 -translate-y-1/2 text-xs tabular-nums",
                value.length > maxLength ? "font-medium text-destructive" : "text-muted-foreground"
              )}
            >
              {value.length}/{maxLength}
            </span>
          )}
        </div>
        <Button
          aria-label="Send message"
          className="min-h-[44px] min-w-[44px]"
          disabled={!value.trim() || value.length > maxLength}
          onClick={onSend}
          size="sm"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
