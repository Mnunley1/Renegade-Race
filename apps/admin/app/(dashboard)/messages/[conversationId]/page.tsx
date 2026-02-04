"use client"

import { api } from "@renegade/backend/convex/_generated/api"
import type { Id } from "@renegade/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import {
  Archive,
  ArchiveRestore,
  Car,
  ExternalLink,
  Info,
  MessageSquare,
  Send,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { LoadingState } from "@/components/loading-state"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { UserAvatar } from "@/components/user-avatar"

export default function ConversationPage() {
  const { conversationId } = useParams()
  const [replyContent, setReplyContent] = useState("")
  const [sending, setSending] = useState(false)
  const [deleteMessageId, setDeleteMessageId] = useState<Id<"messages"> | null>(null)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const data = useQuery(api.admin.getAdminConversationDetail, {
    conversationId: conversationId as Id<"conversations">,
  })

  const sendAdminMessageMutation = useMutation(api.admin.sendAdminMessage)
  const deleteMessage = useMutation(api.messages.deleteMessage)
  const archiveConversationMutation = useMutation(api.admin.archiveConversation)
  const unarchiveConversationMutation = useMutation(api.admin.unarchiveConversation)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [data])

  const handleSendReply = async () => {
    if (!(replyContent.trim() && data)) return
    setSending(true)
    try {
      const targetUserId = data.conversation.renterId
      await sendAdminMessageMutation({
        userId: targetUserId,
        content: replyContent.trim(),
        vehicleId: data.conversation.vehicleId ?? undefined,
      })
      setReplyContent("")
      toast.success("Admin message sent")
    } catch (_err) {
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
    } catch (_err) {
      toast.error("Failed to delete message")
    } finally {
      setDeleteMessageId(null)
    }
  }

  const handleToggleArchive = async () => {
    if (!data) return
    try {
      if (data.conversation.isActive) {
        await archiveConversationMutation({
          conversationId: conversationId as Id<"conversations">,
        })
        toast.success("Conversation archived")
      } else {
        await unarchiveConversationMutation({
          conversationId: conversationId as Id<"conversations">,
        })
        toast.success("Conversation unarchived")
      }
    } catch (_err) {
      toast.error("Failed to update conversation")
    } finally {
      setShowArchiveConfirm(false)
    }
  }

  if (data === undefined) return <LoadingState message="Loading conversation..." />
  if (data === null) {
    return (
      <div>
        <PageHeader
          breadcrumbs={[{ label: "Messages", href: "/messages" }]}
          title="Conversation Not Found"
        />
        <p className="text-muted-foreground">This conversation could not be found.</p>
      </div>
    )
  }

  const conversation = data.conversation
  const messages = data.messages
  const renter = data.renter
  const owner = data.owner
  const vehicle = data.vehicle

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Messages", href: "/messages" }, { label: "Conversation" }]}
        title="Conversation"
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
                    const isRenter =
                      msg.senderId ===
                      (conversation as typeof conversation & { renterId?: string })?.renterId
                    return (
                      <div
                        className={`group relative rounded-lg border p-3 ${
                          isSystem
                            ? "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950"
                            : "bg-card"
                        }`}
                        key={msg._id}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <UserAvatar email={msg.sender.email} name={msg.sender.name} size="sm" />
                            {isSystem && (
                              <Badge className="bg-blue-600 text-xs" variant="default">
                                Admin
                              </Badge>
                            )}
                            {!isSystem && (
                              <Badge className="text-[10px]" variant="outline">
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
                              className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={() => setDeleteMessageId(msg._id)}
                              size="sm"
                              variant="ghost"
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
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Type your admin message..."
                rows={3}
                value={replyContent}
              />
              <Button disabled={!replyContent.trim() || sending} onClick={handleSendReply}>
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
                <UserAvatar email={renter.email} name={renter.name} />
                <Link href={`/users/${renter._id}`}>
                  <Button className="mt-3 w-full" size="sm" variant="outline">
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
                <UserAvatar email={owner.email} name={owner.name} />
                <Link href={`/users/${owner._id}`}>
                  <Button className="mt-3 w-full" size="sm" variant="outline">
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
                  <Button className="mt-3 w-full" size="sm" variant="outline">
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
                className="w-full"
                onClick={() => setShowArchiveConfirm(true)}
                variant="outline"
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
        confirmLabel="Delete"
        description="This will permanently delete this message. This action cannot be undone."
        onConfirm={handleDeleteMessage}
        onOpenChange={(open) => {
          if (!open) setDeleteMessageId(null)
        }}
        open={deleteMessageId !== null}
        title="Delete Message"
        variant="destructive"
      />

      {/* Archive/Unarchive Confirmation */}
      <ConfirmDialog
        confirmLabel={conversation.isActive ? "Archive" : "Unarchive"}
        description={
          conversation.isActive
            ? "This will archive the conversation. Participants will still be able to see past messages."
            : "This will reactivate the conversation."
        }
        onConfirm={handleToggleArchive}
        onOpenChange={setShowArchiveConfirm}
        open={showArchiveConfirm}
        title={conversation.isActive ? "Archive Conversation" : "Unarchive Conversation"}
      />
    </div>
  )
}
