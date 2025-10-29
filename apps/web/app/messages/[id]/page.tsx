import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { ArrowLeft, Send } from "lucide-react"
import Link from "next/link"

type ChatPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { id } = await params

  // TODO: Replace with Convex query to fetch conversation by ID
  const conversation = {
    id,
    name: "Mike Johnson",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
    vehicle: "Porsche 911 GT3",
    vehicleId: "1",
  }

  const messages = [
    {
      id: "1",
      text: "Hi! I'm interested in renting your Porsche 911 GT3 for track day.",
      sender: "user",
    },
    {
      id: "2",
      text: "Hey! Great to hear from you. The car is available and track ready. What dates are you looking at?",
      sender: "host",
    },
    {
      id: "3",
      text: "Looking at this weekend, Friday to Sunday.",
      sender: "user",
    },
    {
      id: "4",
      text: "Perfect! I have availability. I'll send you the booking link. The vehicle will be ready for pickup at 9 AM on Friday.",
      sender: "host",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link href="/messages">
            <Button size="sm" variant="ghost">
              <ArrowLeft className="mr-2 size-4" />
              Back to Messages
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="flex h-[700px] flex-col">
              {/* Header */}
              <div className="border-b bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={conversation.avatar} />
                      <AvatarFallback>{conversation.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{conversation.name}</p>
                      <p className="text-muted-foreground text-sm">{conversation.vehicle}</p>
                    </div>
                  </div>
                  <Link href={`/vehicles/${conversation.vehicleId}`}>
                    <Button size="sm" variant="outline">
                      View Listing
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-3 overflow-y-auto p-6">
                {messages.map((message) => (
                  <div
                    className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                    key={message.id}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                        message.sender === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm">{message.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Input Area */}
              <div className="p-4">
                <div className="flex gap-2">
                  <Input className="flex-1" placeholder="Type a message..." type="text" />
                  <Button size="icon">
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
