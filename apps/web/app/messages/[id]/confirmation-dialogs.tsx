"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

interface ConfirmationDialogsProps {
  // Delete message
  showDeleteMessage: boolean
  onShowDeleteMessageChange: (open: boolean) => void
  onConfirmDeleteMessage: () => void
  isDeletingMessage: boolean

  // Delete conversation
  showDeleteConversation: boolean
  onShowDeleteConversationChange: (open: boolean) => void
  onConfirmDeleteConversation: () => void
  isDeletingConversation: boolean

  // Archive conversation
  showArchiveConversation: boolean
  onShowArchiveConversationChange: (open: boolean) => void
  onConfirmArchiveConversation: () => void
  isArchivingConversation: boolean

  deleteError: string | null
  onClearDeleteError: () => void
}

export function ConfirmationDialogs({
  showDeleteMessage,
  onShowDeleteMessageChange,
  onConfirmDeleteMessage,
  isDeletingMessage,
  showDeleteConversation,
  onShowDeleteConversationChange,
  onConfirmDeleteConversation,
  isDeletingConversation,
  showArchiveConversation,
  onShowArchiveConversationChange,
  onConfirmArchiveConversation,
  isArchivingConversation,
  deleteError,
  onClearDeleteError,
}: ConfirmationDialogsProps) {
  return (
    <>
      {/* Delete Message Dialog */}
      <Dialog
        onOpenChange={(open) => {
          onShowDeleteMessageChange(open)
          if (!open) onClearDeleteError()
        }}
        open={showDeleteMessage}
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
                onShowDeleteMessageChange(false)
                onClearDeleteError()
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isDeletingMessage}
              onClick={onConfirmDeleteMessage}
              variant="destructive"
            >
              {isDeletingMessage ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Conversation Dialog */}
      <Dialog
        onOpenChange={(open) => {
          onShowDeleteConversationChange(open)
          if (!open) onClearDeleteError()
        }}
        open={showDeleteConversation}
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
                onShowDeleteConversationChange(false)
                onClearDeleteError()
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isDeletingConversation}
              onClick={onConfirmDeleteConversation}
              variant="destructive"
            >
              {isDeletingConversation ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Conversation Dialog */}
      <Dialog onOpenChange={onShowArchiveConversationChange} open={showArchiveConversation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive this conversation? You can unarchive it later from
              your archived conversations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onShowArchiveConversationChange(false)} variant="outline">
              Cancel
            </Button>
            <Button disabled={isArchivingConversation} onClick={onConfirmArchiveConversation}>
              {isArchivingConversation ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
