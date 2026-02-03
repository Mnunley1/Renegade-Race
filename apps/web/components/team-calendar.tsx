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
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { Calendar, MapPin, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface TeamCalendarProps {
  teamId: Id<"teams">
  isOwner: boolean
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  race: "Race",
  practice: "Practice",
  meeting: "Meeting",
  social: "Social",
  other: "Other",
}

export function TeamCalendar({ teamId, isOwner }: TeamCalendarProps) {
  const events = useQuery(api.teamEvents.getByTeam, { teamId })
  const rsvpMutation = useMutation(api.teamEvents.rsvp)
  const createEvent = useMutation(api.teamEvents.create)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    type: "race" as "race" | "practice" | "meeting" | "social" | "other",
  })

  const handleRsvp = async (
    eventId: Id<"teamEvents">,
    status: "going" | "not_going"
  ) => {
    try {
      await rsvpMutation({ eventId, status })
      toast.success("RSVP updated")
    } catch {
      toast.error("Failed to update RSVP")
    }
  }

  const handleCreateEvent = async () => {
    if (!formData.title || !formData.date) {
      toast.error("Please fill in title and date")
      return
    }

    try {
      await createEvent({
        teamId,
        title: formData.title,
        description: formData.description || undefined,
        date: formData.date,
        time: formData.time || undefined,
        location: formData.location || undefined,
        type: formData.type,
      })
      toast.success("Event created")
      setIsDialogOpen(false)
      setFormData({
        title: "",
        description: "",
        date: "",
        time: "",
        location: "",
        type: "race",
      })
    } catch {
      toast.error("Failed to create event")
    }
  }

  if (events === undefined) {
    return null
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Sort events by date, upcoming first
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Team Events
          </CardTitle>
          {isOwner && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 size-4" />
                  Add Event
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Team Event</DialogTitle>
                  <DialogDescription>
                    Schedule a new event for your team
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      placeholder="Event title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          type: value as typeof formData.type,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) =>
                          setFormData({ ...formData, date: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="time">Time</Label>
                      <Input
                        id="time"
                        type="time"
                        value={formData.time}
                        onChange={(e) =>
                          setFormData({ ...formData, time: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      placeholder="Event location"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Optional description"
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
                  <Button onClick={handleCreateEvent}>Create Event</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sortedEvents.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground text-sm">
            No upcoming events
          </p>
        ) : (
          <div className="space-y-3">
            {sortedEvents.map((event) => {
              const eventDate = new Date(event.date)
              eventDate.setHours(0, 0, 0, 0)
              const isPast = eventDate < today

              return (
                <div
                  key={event._id}
                  className={isPast ? "rounded-lg border p-4 opacity-60" : "rounded-lg border p-4"}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <h4 className="font-semibold">{event.title}</h4>
                    <Badge variant="secondary">
                      {EVENT_TYPE_LABELS[event.type] || event.type}
                    </Badge>
                    {isPast && (
                      <Badge variant="outline" className="text-muted-foreground text-xs">
                        Past
                      </Badge>
                    )}
                  </div>
                  {event.description && (
                    <p className="mb-2 text-muted-foreground text-sm">
                      {event.description}
                    </p>
                  )}
                  <div className="mb-3 space-y-1 text-muted-foreground text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4" />
                      <span>
                        {new Date(event.date).toLocaleDateString()}
                        {event.time && ` at ${event.time}`}
                      </span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4" />
                        <span>{event.location}</span>
                      </div>
                    )}
                  </div>
                  {!isPast && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRsvp(event._id, "going")}
                      >
                        Going
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRsvp(event._id, "not_going")}
                      >
                        Not Going
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
