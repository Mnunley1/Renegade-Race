import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { Send } from "lucide-react"

export default function MessagesPage() {
  const conversations = [
    {
      id: "1",
      name: "Mike Johnson",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
      preview: "Hey! Looking forward to hosting you...",
      time: "Just now",
      unread: true,
    },
    {
      id: "2",
      name: "Sarah Williams",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
      preview: "The vehicle is ready for pickup at...",
      time: "2 hours ago",
      unread: false,
    },
    {
      id: "3",
      name: "David Chen",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
      preview: "Thanks for the great experience!",
      time: "1 day ago",
      unread: false,
    },
  ]

  const messages = [
    {
      id: "1",
      text: "Hi! I'm interested in renting your Porsche 911 GT3 for track day.",
      sender: "user",
      time: "2:30 PM",
    },
    {
      id: "2",
      text: "Hey! Great to hear from you. The car is available and track ready. What dates are you looking at?",
      sender: "host",
      time: "2:31 PM",
    },
    {
      id: "3",
      text: "Looking at this weekend, Friday to Sunday.",
      sender: "user",
      time: "2:32 PM",
    },
    {
      id: "4",
      text: "Perfect! I have availability. I'll send you the booking link. The vehicle will be ready for pickup at 9 AM on Friday.",
      sender: "host",
      time: "2:35 PM",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 font-bold text-3xl">Messages</h1>

      <div className="grid gap-8 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-4">
              <div className="mb-4">
                <Input className="w-full" placeholder="Search messages..." />
              </div>
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <button
                    className={`w-full rounded-lg p-3 text-left transition-colors hover:bg-muted ${
                      conversation.unread ? "bg-muted" : ""
                    }`}
                    key={conversation.id}
                    type="button"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={conversation.avatar} />
                        <AvatarFallback>{conversation.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="truncate font-semibold text-sm">{conversation.name}</p>
                          <span className="text-muted-foreground text-xs">{conversation.time}</span>
                        </div>
                        <p className="truncate text-muted-foreground text-sm">
                          {conversation.preview}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              <div className="flex h-[600px] flex-col">
                <div className="border-b p-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Mike" />
                      <AvatarFallback>M</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">Mike Johnson</p>
                      <p className="text-muted-foreground text-sm">Porsche 911 GT3</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {messages.map((message) => (
                    <div
                      className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                      key={message.id}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.sender === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p>{message.text}</p>
                        <span className="mt-1 block text-xs opacity-70">{message.time}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="p-4">
                  <div className="flex gap-2">
                    <Input className="flex-1" placeholder="Type a message..." />
                    <button
                      className="rounded-md bg-primary p-2 text-primary-foreground hover:bg-primary/90"
                      type="button"
                    >
                      <Send className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
