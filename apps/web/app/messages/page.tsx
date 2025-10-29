import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { MessageSquare } from "lucide-react"
import Link from "next/link"

export default function MessagesPage() {
  // TODO: Replace with Convex query to fetch user's conversations
  const conversations = [
    {
      id: "1",
      name: "Mike Johnson",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
      preview: "Hey! Looking forward to hosting you...",
      unread: true,
      vehicle: "Porsche 911 GT3",
    },
    {
      id: "2",
      name: "Sarah Williams",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
      preview: "The vehicle is ready for pickup at...",
      unread: false,
      vehicle: "Lamborghini Huracán",
    },
    {
      id: "3",
      name: "David Chen",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
      preview: "Thanks for the great experience!",
      unread: false,
      vehicle: "Ferrari F8 Tributo",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 font-bold text-3xl">Messages</h1>
        <p className="text-muted-foreground">Connect with hosts and manage your conversations</p>
      </div>

      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="p-6">
            <div className="mb-4">
              <Input className="w-full" placeholder="Search conversations..." />
            </div>
            <div className="space-y-2">
              {conversations.length === 0 ? (
                <div className="py-12 text-center">
                  <MessageSquare className="mx-auto mb-4 size-12 text-muted-foreground" />
                  <p className="mb-2 font-semibold text-lg">No conversations yet</p>
                  <p className="text-muted-foreground text-sm">
                    Start a conversation with a vehicle owner to begin messaging.
                  </p>
                </div>
              ) : (
                conversations.map((conversation) => (
                  <Link
                    className={`block rounded-lg border p-4 transition-all hover:border-primary/50 hover:bg-accent ${
                      conversation.unread ? "border-primary/20 bg-primary/5" : ""
                    }`}
                    href={`/messages/${conversation.id}`}
                    key={conversation.id}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={conversation.avatar} />
                        <AvatarFallback>{conversation.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{conversation.name}</p>
                          {conversation.unread && (
                            <span className="size-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="truncate text-muted-foreground text-sm">
                          {conversation.vehicle}
                        </p>
                        <p className="truncate text-muted-foreground text-xs">
                          {conversation.preview}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
