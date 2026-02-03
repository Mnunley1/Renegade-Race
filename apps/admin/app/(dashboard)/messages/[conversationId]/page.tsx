"use client"

import { useState, useRef, useEffect } from "react"
import { useParams } from "next/navigation"
import { useMutation } from "convex/react"
import { api } from "@renegade/backend/convex/_generated/api"
import type { Id } from "@renegade/backend/convex/_generated/dataModel"
import { toast } from "sonner"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { UserAvatar } from "@/components/user-avatar"
import { StatusBadge } from "@/components/status-badge"
import { LoadingState } from "@/components/loading-state"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { Badge } from "@workspace/ui/components/badge"
import {
  Send,
  Trash2,
  Archive,
  ArchiveRestore,
  ExternalLink,
  Car,
  MessageSquare,
  Info,
} from "lucide-react"

export default function ConversationPage() {
  const { conversationId } = useParams()
  const [replyContent, setReplyContent] = useState("")
  const [sending, setSending] = useState(false)
  const [deleteMessageId, setDeleteMessageId] = useState<Id<"messages"> | null>(null)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // TODO: Create admin-specific query for viewing any conversation
  const data = undefined

  const sendAdminMessage = useMutation(api.messages.sendAdminMessage)
  const deleteMessage = useMutation(api.messages.deleteMessage)
  // TODO: Implement archiveConversation and unarchiveConversation mutations
  const archiveConversation = useMutation(api.messages.deleteMessage)
  const unarchiveConversation = useMutation(api.messages.deleteMessage)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [data])

  const handleSendReply = async () => {
    if (!replyContent.trim()) return
    setSending(true)
    try {
      // TODO: Implement proper admin message sending
      toast.error("Admin message sending not yet implemented")
    } catch (err) {
      toast.error("Failed to send message")
    } finally {
      setSending(false)
    }
  }

  const handleDeleteMessage = async () => {
    if (!deleteMessageId) return
    try {
      await deleteMessage({ messageId: deleteMessageId })
      toast.success("Message deleted")
    } catch (err) {
      toast.error("Failed to delete message")
    } finally {
      setDeleteMessageId(null)
    }
  }

  const handleToggleArchive = async () => {
    try {
      // TODO: Implement admin archive/unarchive conversation
      toast.error("Archive/unarchive not yet implemented")
    } catch (err) {
      toast.error("Failed to update conversation")
    } finally {
      setShowArchiveConfirm(false)
    }
  }

  if (data === undefined) return <LoadingState message="Loading conversation..." />

  // TODO: Implement admin conversation view
  const conversation: any = {
    renterId: "",
    ownerId: "",
    isActive: true,
    createdAt: 0,
    lastMessageAt: 0,
  }
  const messages: any[] = []
  const renter: any = null
  const owner: any = null
  const vehicle: any = null

  return (
    <div>
      <PageHeader
        title="Conversation"
        breadcrumbs={[{ label: "Messages", href: "/messages" }, { label: "Conversation" }]}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left Column: Message Thread + Reply */}
        <div className="space-y-4">
          {/* Messages */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">
                Message Thread ({messages.length} messages)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] space-y-4 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <MessageSquare className="mx-auto mb-2 h-8 w-8" />
                    <p>No messages in this conversation</p>
                  </div>
                ) : (
                  messages.map((msg: any) => {
                    const isSystem = msg.messageType === "system"
                    const isRenter = msg.senderId === (conversation as any)?.renterId
                    return (
                      <div
                        key={msg._id}
                        className={`group relative rounded-lg border p-3 ${
                          isSystem
                            ? "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950"
                            : "bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <UserAvatar name={msg.sender.name} email={msg.sender.email} size="sm" />
                            {isSystem && (
                              <Badge variant="default" className="bg-blue-600 text-xs">
                                Admin
                              </Badge>
                            )}
                            {!isSystem && (
                              <Badge variant="outline" className="text-[10px]">
                                {isRenter ? "Renter" : "Owner"}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                              {new Date(msg.createdAt).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={() => setDeleteMessageId(msg._id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm">{msg.content}</p>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </CardContent>
          </Card>

          {/* Admin Reply */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Send as Admin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <p className="text-blue-700 text-xs dark:text-blue-300">
                    Messages sent here appear as system messages visible to both participants.
                  </p>
                </div>
              </div>
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Type your admin message..."
                rows={3}
              />
              <Button onClick={handleSendReply} disabled={!replyContent.trim() || sending}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Sending..." : "Send as Admin"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Sidebar */}
        <div className="space-y-4">
          {/* Conversation Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversation Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={conversation.isActive ? "active" : "archived"} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Messages</span>
                <span className="font-medium">{messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(conversation.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Message</span>
                <span>{new Date(conversation.lastMessageAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Renter Card */}
          {renter && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Renter</CardTitle>
              </CardHeader>
              <CardContent>
                <UserAvatar name={renter.name} email={renter.email} />
                <Link href={`/users/${renter._id}`}>
                  <Button variant="outline" size="sm" className="mt-3 w-full">
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    View Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Owner Card */}
          {owner && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Owner</CardTitle>
              </CardHeader>
              <CardContent>
                <UserAvatar name={owner.name} email={owner.email} />
                <Link href={`/users/${owner._id}`}>
                  <Button variant="outline" size="sm" className="mt-3 w-full">
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    View Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Vehicle Card */}
          {vehicle && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vehicle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </span>
                </div>
                <Link href={`/vehicles/${vehicle._id}`}>
                  <Button variant="outline" size="sm" className="mt-3 w-full">
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    View Vehicle
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowArchiveConfirm(true)}
              >
                {conversation.isActive ? (
                  <>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive Conversation
                  </>
                ) : (
                  <>
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    Unarchive Conversation
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Message Confirmation */}
      <ConfirmDialog
        open={deleteMessageId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteMessageId(null)
        }}
        title="Delete Message"
        description="This will permanently delete this message. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteMessage}
      />

      {/* Archive/Unarchive Confirmation */}
      <ConfirmDialog
        open={showArchiveConfirm}
        onOpenChange={setShowArchiveConfirm}
        title={conversation.isActive ? "Archive Conversation" : "Unarchive Conversation"}
        description={
          conversation.isActive
            ? "This will archive the conversation. Participants will still be able to see past messages."
            : "This will reactivate the conversation."
        }
        confirmLabel={conversation.isActive ? "Archive" : "Unarchive"}
        onConfirm={handleToggleArchive}
      />
    </div>
  )
}
