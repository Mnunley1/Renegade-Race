"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation } from "convex/react"
import { useUser } from "@clerk/nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { ArrowLeft, Send } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/convex"
import { cn } from "@workspace/ui/lib/utils"

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const conversationId = params.id as string
  const [messageInput, setMessageInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch conversation from Convex
  const conversation = useQuery(
    api.conversations.getById,
    conversationId ? { conversationId: conversationId as any } : "skip"
  )

  // Fetch messages from Convex
  const messages = useQuery(
    api.messages.getByConversation,
    conversationId ? { conversationId: conversationId as any } : "skip"
  )

  // Mutations
  const sendMessage = useMutation(api.messages.send)
  const markAsRead = useMutation(api.messages.markConversationAsRead)

  // Mark conversation as read when viewing
  useEffect(() => {
    if (conversation && user?.id) {
      markAsRead({
        conversationId: conversationId as any,
        userId: user.id,
      }).catch(console.error)
    }
  }, [conversation, user?.id, conversationId, markAsRead])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() || isSending || !conversation) return

    setIsSending(true)
    try {
      await sendMessage({
        conversationId: conversationId as any,
        content: messageInput.trim(),
      })
      setMessageInput("")
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsSending(false)
    }
  }

  // Determine the other person in the conversation
  const otherPerson = conversation
    ? conversation.renter?.externalId === user?.id
      ? conversation.owner
      : conversation.renter
    : null

  // Check if current user is the sender
  const isCurrentUser = (senderId: string) => senderId === user?.id

  // Loading state
  if (conversation === undefined || messages === undefined) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <Button size="sm" variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>
          </div>
          <Card>
            <CardContent className="flex h-[700px] items-center justify-center">
              <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Error state - conversation not found
  if (!conversation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <Button size="sm" variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>
          </div>
          <Card>
            <CardContent className="flex h-[700px] flex-col items-center justify-center">
              <h2 className="mb-2 font-semibold text-xl">Conversation not found</h2>
              <p className="mb-6 text-muted-foreground">This conversation may have been deleted or doesn't exist.</p>
              <Link href="/messages">
                <Button>Go to Messages</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const vehicleName = conversation.vehicle
    ? `${conversation.vehicle.year} ${conversation.vehicle.make} ${conversation.vehicle.model}`
    : "Unknown Vehicle"

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Button size="sm" variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Messages
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="flex h-[700px] flex-col">
              {/* Header */}
              <div className="border-b bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={otherPerson?.profileImage || ""} />
                      <AvatarFallback>{otherPerson?.name?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{otherPerson?.name || "Unknown User"}</p>
                      <p className="text-muted-foreground text-sm">{vehicleName}</p>
                    </div>
                  </div>
                  {conversation.vehicle && (
                    <Link href={`/vehicles/${conversation.vehicle._id}`}>
                      <Button size="sm" variant="outline">
                        View Listing
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-3 overflow-y-auto p-6">
                {messages && messages.length > 0 ? (
                  <>
                    {messages.map((message) => {
                      const isUserMessage = isCurrentUser(message.senderId)
                      return (
                        <div
                          className={cn("flex", isUserMessage ? "justify-end" : "justify-start")}
                          key={message._id}
                        >
                          <div
                            className={cn(
                              "max-w-[70%] rounded-2xl px-4 py-3",
                              isUserMessage
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            <p className="text-sm">{message.content}</p>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-center text-muted-foreground">
                      No messages yet. Start the conversation!
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Input Area */}
              <div className="p-4">
                <form className="flex gap-2" onSubmit={handleSendMessage}>
                  <Input
                    className="flex-1"
                    disabled={isSending}
                    placeholder="Type a message..."
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                  />
                  <Button disabled={isSending || !messageInput.trim()} size="icon" type="submit">
                    {isSending ? (
                      <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
