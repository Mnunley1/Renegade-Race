"use client"

import { useQuery, useMutation } from "convex/react"
import { useParams, useRouter } from "next/navigation"
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
import { Badge } from "@workspace/ui/components/badge"
import { Textarea } from "@workspace/ui/components/textarea"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import type { Id } from "@/lib/convex"

export default function DisputeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const disputeId = params.id as Id<"disputes">
  const dispute = useQuery(api.disputes.getById, { id: disputeId })
  const resolveDispute = useMutation(api.admin.resolveDisputeAsAdmin)
  const addMessage = useMutation(api.disputes.addMessage)

  const [resolution, setResolution] = useState("")
  const [resolutionType, setResolutionType] = useState<
    "resolved_in_favor_renter" | "resolved_in_favor_owner" | "resolved_compromise" | "dismissed"
  >("resolved_compromise")
  const [adminMessage, setAdminMessage] = useState("")
  const [isResolving, setIsResolving] = useState(false)
  const [isAddingMessage, setIsAddingMessage] = useState(false)

  const handleResolve = async () => {
    if (!resolution.trim()) {
      toast.error("Please provide a resolution")
      return
    }

    setIsResolving(true)
    try {
      await resolveDispute({
        disputeId,
        resolution,
        resolutionType,
      })
      toast.success("Dispute resolved successfully")
      router.push("/disputes")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to resolve dispute"
      )
    } finally {
      setIsResolving(false)
    }
  }

  const handleAddMessage = async () => {
    if (!adminMessage.trim()) {
      toast.error("Please enter a message")
      return
    }

    setIsAddingMessage(true)
    try {
      await addMessage({
        disputeId,
        message: adminMessage,
      })
      toast.success("Message added")
      setAdminMessage("")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add message"
      )
    } finally {
      setIsAddingMessage(false)
    }
  }

  if (dispute === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading dispute...</div>
      </div>
    )
  }

  if (dispute === null) {
    return (
      <div className="space-y-6">
        <Link href="/disputes">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 size-4" />
            Back to Disputes
          </Button>
        </Link>
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Dispute not found
          </CardContent>
        </Card>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive">Open</Badge>
      case "resolved":
        return <Badge variant="default">Resolved</Badge>
      case "closed":
        return <Badge variant="secondary">Closed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/disputes">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 size-4" />
              Back to Disputes
            </Button>
          </Link>
          <h1 className="font-bold text-3xl">Dispute Details</h1>
          <p className="text-muted-foreground mt-2">Dispute ID: {dispute._id}</p>
        </div>
        {getStatusBadge(dispute.status)}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dispute Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Reason</Label>
              <p className="mt-1">{dispute.reason}</p>
            </div>
            <div>
              <Label>Description</Label>
              <p className="mt-1 whitespace-pre-wrap">{dispute.description}</p>
            </div>
            <div>
              <Label>Requested Resolution</Label>
              <p className="mt-1">{dispute.requestedResolution || "N/A"}</p>
            </div>
            <div>
              <Label>Created</Label>
              <p className="mt-1">
                {new Date(dispute.createdAt).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parties Involved</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Renter</Label>
              <p className="mt-1">{dispute.renter?.name || "Unknown"}</p>
              <p className="text-muted-foreground text-sm">
                {dispute.renter?.email || "N/A"}
              </p>
            </div>
            <div>
              <Label>Owner</Label>
              <p className="mt-1">{dispute.owner?.name || "Unknown"}</p>
              <p className="text-muted-foreground text-sm">
                {dispute.owner?.email || "N/A"}
              </p>
            </div>
            <div>
              <Label>Vehicle</Label>
              <p className="mt-1">
                {dispute.vehicle?.make} {dispute.vehicle?.model} ({dispute.vehicle?.year})
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {dispute.messages && dispute.messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dispute Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dispute.messages.map((msg) => (
                <div key={msg.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {msg.senderId === dispute.renterId
                        ? dispute.renter?.name || "Renter"
                        : dispute.owner?.name || "Owner"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {dispute.status === "open" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Add Admin Message</CardTitle>
              <CardDescription>
                Add a message to the dispute conversation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="adminMessage">Message</Label>
                <Textarea
                  id="adminMessage"
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  placeholder="Enter your message..."
                  rows={4}
                />
              </div>
              <Button
                onClick={handleAddMessage}
                disabled={isAddingMessage}
              >
                {isAddingMessage ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Message"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resolve Dispute</CardTitle>
              <CardDescription>
                Provide a resolution and close this dispute
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="resolutionType">Resolution Type</Label>
                <Select
                  value={resolutionType}
                  onValueChange={(value: any) => setResolutionType(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resolved_in_favor_renter">
                      Resolved in Favor of Renter
                    </SelectItem>
                    <SelectItem value="resolved_in_favor_owner">
                      Resolved in Favor of Owner
                    </SelectItem>
                    <SelectItem value="resolved_compromise">Compromise</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="resolution">Resolution Details</Label>
                <Textarea
                  id="resolution"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Enter resolution details..."
                  rows={6}
                  required
                />
              </div>
              <Button
                onClick={handleResolve}
                disabled={isResolving || !resolution.trim()}
                size="lg"
                className="w-full"
              >
                {isResolving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Resolving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 size-4" />
                    Resolve Dispute
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {dispute.status === "resolved" && dispute.resolution && (
        <Card>
          <CardHeader>
            <CardTitle>Resolution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label>Resolution Type</Label>
              <p className="mt-1 capitalize">
                {dispute.resolutionType?.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <Label>Resolution Details</Label>
              <p className="mt-1 whitespace-pre-wrap">{dispute.resolution}</p>
            </div>
            {dispute.resolvedAt && (
              <div>
                <Label>Resolved At</Label>
                <p className="mt-1">
                  {new Date(dispute.resolvedAt).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

