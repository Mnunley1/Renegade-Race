"use client"

import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { useUser } from "@clerk/nextjs"
import { useMutation, useQuery } from "convex/react"
import { Award } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

interface DriverEndorsementsProps {
  driverProfileId: Id<"driverProfiles">
  isOwner: boolean
}

const ENDORSEMENT_TYPES = {
  racecraft: { label: "Racecraft", color: "bg-blue-500/10 text-blue-600" },
  consistency: { label: "Consistency", color: "bg-green-500/10 text-green-600" },
  qualifying_pace: { label: "Qualifying Pace", color: "bg-purple-500/10 text-purple-600" },
  teamwork: { label: "Teamwork", color: "bg-orange-500/10 text-orange-600" },
  communication: { label: "Communication", color: "bg-pink-500/10 text-pink-600" },
} as const

type EndorsementType = keyof typeof ENDORSEMENT_TYPES

export function DriverEndorsements({
  driverProfileId,
  isOwner,
}: DriverEndorsementsProps) {
  const { user } = useUser()
  const endorsements = useQuery(api.endorsements.getByDriver, { driverProfileId })
  const endorseMutation = useMutation(api.endorsements.endorse)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<EndorsementType>("racecraft")
  const [message, setMessage] = useState("")

  const typeCounts = useMemo(() => {
    if (!endorsements) return {} as Record<string, number>
    const counts: Record<string, number> = {}
    for (const e of endorsements) {
      counts[e.type] = (counts[e.type] || 0) + 1
    }
    return counts
  }, [endorsements])

  const hasEndorsed = useMemo(() => {
    if (!endorsements || !user) return false
    return endorsements.some((e) => e.endorserId === user.id)
  }, [endorsements, user])

  const handleEndorse = async () => {
    try {
      await endorseMutation({
        driverProfileId,
        type: selectedType,
        message: message || undefined,
      })
      toast.success("Endorsement submitted")
      setIsDialogOpen(false)
      setMessage("")
    } catch {
      toast.error("Failed to submit endorsement")
    }
  }

  if (endorsements === undefined) {
    return null
  }

  // Show empty state when no endorsements (with endorse button for non-owners)
  if (endorsements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="size-5" />
            Endorsements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {isOwner
              ? "Share your profile to get endorsements from teammates and fellow drivers."
              : "No endorsements yet. Be the first to endorse this driver!"}
          </p>
          {!isOwner && !hasEndorsed && user && (
            <>
              <Separator />
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Award className="mr-2 size-4" />
                    Endorse Driver
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Endorse This Driver</DialogTitle>
                    <DialogDescription>
                      Share your experience working with this driver
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Endorsement Type</Label>
                      <Select
                        value={selectedType}
                        onValueChange={(v) => setSelectedType(v as EndorsementType)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ENDORSEMENT_TYPES).map(([type, config]) => (
                            <SelectItem key={type} value={type}>
                              {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Message (optional)</Label>
                      <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Share your experience..."
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleEndorse}>Submit</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  // Filter and sort endorsement types by count (descending)
  const sortedTypes = (Object.entries(ENDORSEMENT_TYPES) as [EndorsementType, (typeof ENDORSEMENT_TYPES)[EndorsementType]][])
    .filter(([type]) => (typeCounts[type] || 0) > 0)
    .sort((a, b) => (typeCounts[b[0]] || 0) - (typeCounts[a[0]] || 0))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="size-5" />
          Endorsements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {sortedTypes.map(([type, config]) => (
            <Badge key={type} variant="secondary" className={config.color}>
              {config.label}: {typeCounts[type]}
            </Badge>
          ))}
        </div>

        {!isOwner && !hasEndorsed && user && (
          <>
            <Separator />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Award className="mr-2 size-4" />
                  Endorse Driver
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Endorse This Driver</DialogTitle>
                  <DialogDescription>
                    Share your experience working with this driver
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Endorsement Type</Label>
                    <Select
                      value={selectedType}
                      onValueChange={(v) => setSelectedType(v as EndorsementType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ENDORSEMENT_TYPES).map(([type, config]) => (
                          <SelectItem key={type} value={type}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Message (optional)</Label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Share your experience..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleEndorse}>Submit</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {endorsements.filter((e) => e.message).length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              {endorsements
                .filter((e) => e.message)
                .slice(0, 5)
                .map((endorsement) => (
                  <div key={endorsement._id} className="rounded-lg border p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {endorsement.endorser?.name || "Anonymous"}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {ENDORSEMENT_TYPES[endorsement.type as EndorsementType]?.label ||
                          endorsement.type}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {endorsement.message}
                    </p>
                  </div>
                ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
