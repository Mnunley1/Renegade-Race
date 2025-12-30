"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { AlertTriangle, ArrowLeft, Loader2, Send } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"

export default function DisputeDetailPage() {
  const { user } = useUser()
  const params = useParams()
  const router = useRouter()
  const disputeId = params.id as string

  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch dispute data
  const dispute = useQuery(api.disputes.getById, disputeId ? { id: disputeId as any } : "skip")

  const addMessage = useMutation(api.disputes.addMessage)

  const handleAddMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    setIsSubmitting(true)
    try {
      await addMessage({
        disputeId: disputeId as any,
        message: message.trim(),
      })
      setMessage("")
      toast.success("Message added successfully")
    } catch (error) {
      console.error("Error adding message:", error)
      toast.error("Failed to add message")
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string | number) => {
    const date = typeof dateString === "string" ? new Date(dateString) : new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  if (!dispute) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const vehicle = dispute.vehicle
  const reservation = dispute.reservation
  const renter = dispute.renter
  const owner = dispute.owner

  if (!(vehicle && reservation)) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Dispute not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
  const isOpen = dispute.status === "open"
  const isUserInvolved = user?.id === dispute.renterId || user?.id === dispute.ownerId

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link href="/trips/disputes">
          <Button className="mb-6" variant="outline">
            <ArrowLeft className="mr-2 size-4" />
            Back to Disputes
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="size-6 text-yellow-500" />
          <h1 className="font-bold text-3xl">Dispute Details</h1>
        </div>
        <p className="text-muted-foreground">{vehicleName}</p>
      </div>

      <div className="space-y-6">
        {/* Dispute Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Dispute Information</CardTitle>
              <Badge
                className={
                  dispute.status === "open"
                    ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                    : "bg-green-500/10 text-green-700 dark:text-green-400"
                }
              >
                {dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Reason</Label>
                <p className="font-semibold capitalize">{dispute.reason.replace(/_/g, " ")}</p>
              </div>
              <div>
                <Label>Created</Label>
                <p className="text-muted-foreground text-sm">{formatDate(dispute.createdAt)}</p>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <p className="mt-1 text-muted-foreground text-sm">{dispute.description}</p>
            </div>
            {dispute.requestedResolution && (
              <div>
                <Label>Requested Resolution</Label>
                <p className="mt-1 text-muted-foreground text-sm">{dispute.requestedResolution}</p>
              </div>
            )}
            {dispute.resolution && (
              <div>
                <Label>Resolution</Label>
                <p className="mt-1 text-muted-foreground text-sm">{dispute.resolution}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vehicle & Reservation Info */}
        <Card>
          <CardHeader>
            <CardTitle>Rental Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Vehicle</Label>
              <p className="font-semibold">{vehicleName}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Rental Period</Label>
                <p className="text-muted-foreground text-sm">
                  {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
                </p>
              </div>
              <div>
                <Label>Participants</Label>
                <p className="text-muted-foreground text-sm">
                  Renter: {renter?.name || "Unknown"} | Owner: {owner?.name || "Unknown"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Messages/Updates */}
        {dispute.messages && dispute.messages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Messages & Updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dispute.messages.map((msg) => {
                const isFromUser = msg.senderId === user?.id
                const sender = msg.senderId === dispute.renterId ? renter : owner

                return (
                  <div
                    className={`rounded-lg border p-4 ${
                      isFromUser ? "border-primary/20 bg-primary/5" : "bg-muted/30"
                    }`}
                    key={msg.id}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-semibold text-sm">
                        {isFromUser ? "You" : sender?.name || "Unknown"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(msg.createdAt)}
                      </p>
                    </div>
                    <p className="text-muted-foreground text-sm">{msg.message}</p>
                    {msg.photos && msg.photos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.photos.map((photo, index) => (
                          <img
                            alt={`Message photo ${index + 1}`}
                            className="h-20 w-20 rounded-lg object-cover"
                            key={index}
                            src={photo}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Add Message Form */}
        {isOpen && isUserInvolved && (
          <Card>
            <CardHeader>
              <CardTitle>Add Message</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleAddMessage}>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add an update or message to this dispute..."
                    rows={4}
                    value={message}
                  />
                </div>
                <Button disabled={isSubmitting || !message.trim()} type="submit">
                  {isSubmitting ? (
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
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
