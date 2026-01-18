"use client"

import { useQuery, useMutation } from "convex/react"
import { useState } from "react"
import { api } from "@/lib/convex"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { MessageSquare, Send, Search, Loader2, User } from "lucide-react"
import { toast } from "sonner"
import { handleErrorWithContext } from "@/lib/error-handler"

export default function MessagesPage() {
  const [selectedUserId, setSelectedUserId] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [messageContent, setMessageContent] = useState("")
  const [vehicleId, setVehicleId] = useState("")
  
  const users = useQuery(api.admin.getAllUsers, { limit: 100, search: searchQuery })
  const sendAdminMessage = useMutation(api.messages.sendAdminMessage)
  const [isSending, setIsSending] = useState(false)

  const filteredUsers = users?.filter((user) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.externalId?.toLowerCase().includes(query)
    )
  })

  const selectedUser = users?.find((u) => u.externalId === selectedUserId)

  const handleSendMessage = async () => {
    if (!selectedUserId || !messageContent.trim()) {
      toast.error("Please select a user and enter a message")
      return
    }

    setIsSending(true)
    try {
      await sendAdminMessage({
        userId: selectedUserId,
        content: messageContent,
        vehicleId: vehicleId ? (vehicleId as any) : undefined,
      })
      toast.success("Message sent successfully")
      setMessageContent("")
      setVehicleId("")
    } catch (error) {
      handleErrorWithContext(error, { action: "send message", entity: "message" })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl">Direct Messages</h1>
        <p className="text-muted-foreground mt-2">
          Send direct messages to users
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Select User</CardTitle>
            <CardDescription>Search and select a user to message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {filteredUsers && filteredUsers.length > 0 ? (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {filteredUsers.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => setSelectedUserId(user.externalId)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedUserId === user.externalId
                        ? "border-primary bg-primary/10"
                        : "hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">{user.name}</p>
                        <p className="text-muted-foreground text-sm">
                          {user.email || user.externalId}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                {searchQuery ? "No users found" : "Start typing to search users"}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compose Message</CardTitle>
            <CardDescription>
              {selectedUser
                ? `Sending message to ${selectedUser.name}`
                : "Select a user to send a message"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedUser ? (
              <>
                <div>
                  <Label htmlFor="vehicleId">Vehicle ID (Optional)</Label>
                  <Input
                    id="vehicleId"
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                    placeholder="Leave empty for general message"
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    If provided, message will be added to the conversation for
                    that vehicle
                  </p>
                </div>

                <div>
                  <Label htmlFor="messageContent">Message *</Label>
                  <Textarea
                    id="messageContent"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    placeholder="Enter your message..."
                    rows={8}
                    required
                  />
                </div>

                <Button
                  onClick={handleSendMessage}
                  disabled={isSending || !messageContent.trim()}
                  size="lg"
                  className="w-full"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 size-4" />
                      Send Message
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <MessageSquare className="mx-auto mb-4 size-12 opacity-50" />
                <p>Select a user from the list to send a message</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

