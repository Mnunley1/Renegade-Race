"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useMutation } from "convex/react"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"
import type { TeamSeatOfferingView } from "@/lib/team-seat-offerings"

type DriverExperience = "beginner" | "intermediate" | "advanced" | "professional"

type TeamSeatRequestDialogProps = {
  offering: TeamSeatOfferingView
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TeamSeatRequestDialog({
  offering,
  open,
  onOpenChange,
}: TeamSeatRequestDialogProps) {
  const requestSeat = useMutation(api.seatBookings.request)
  const [availableStartDate, setAvailableStartDate] = useState(offering.event?.startDate ?? "")
  const [availableEndDate, setAvailableEndDate] = useState(offering.event?.endDate ?? "")
  const [driverExperience, setDriverExperience] = useState<DriverExperience>("intermediate")
  const [budgetBand, setBudgetBand] = useState("")
  const [seriesClass, setSeriesClass] = useState("")
  const [whyBuying, setWhyBuying] = useState("")
  const [note, setNote] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setAvailableStartDate(offering.event?.startDate ?? "")
    setAvailableEndDate(offering.event?.endDate ?? "")
  }, [offering.event?.endDate, offering.event?.startDate, open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const result = await requestSeat({
        offeringId: offering._id,
        availableStartDate,
        availableEndDate,
        driverExperience,
        budgetBand: budgetBand.trim(),
        seriesClass: seriesClass.trim(),
        whyBuying: whyBuying.trim(),
        note: note.trim() || undefined,
      })
      toast.success(
        result.status === "waitlisted"
          ? "You're on the waitlist. The team has received your request."
          : "Seat request sent to the team."
      )
      setBudgetBand("")
      setSeriesClass("")
      setWhyBuying("")
      setNote("")
      onOpenChange(false)
    } catch (error) {
      handleErrorWithContext(error, {
        action: "request race seat",
        customMessages: {
          generic: "We couldn't send this seat request. Please review the form and try again.",
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request {offering.title}</DialogTitle>
          <DialogDescription>
            Tell the team about your availability and experience. The team must approve the request
            before you can pay.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`seat-start-${offering._id}`}>Available from</Label>
              <Input
                id={`seat-start-${offering._id}`}
                max={offering.event?.endDate}
                min={offering.event?.startDate}
                onChange={(event) => setAvailableStartDate(event.target.value)}
                required
                type="date"
                value={availableStartDate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`seat-end-${offering._id}`}>Available through</Label>
              <Input
                id={`seat-end-${offering._id}`}
                max={offering.event?.endDate}
                min={availableStartDate || offering.event?.startDate}
                onChange={(event) => setAvailableEndDate(event.target.value)}
                required
                type="date"
                value={availableEndDate}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`seat-experience-${offering._id}`}>Racing experience</Label>
              <Select
                onValueChange={(value) => setDriverExperience(value as DriverExperience)}
                value={driverExperience}
              >
                <SelectTrigger id={`seat-experience-${offering._id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`seat-budget-${offering._id}`}>Budget</Label>
              <Input
                id={`seat-budget-${offering._id}`}
                onChange={(event) => setBudgetBand(event.target.value)}
                placeholder="Example: $10,000–$15,000"
                required
                value={budgetBand}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`seat-class-${offering._id}`}>Series or class</Label>
            <Input
              id={`seat-class-${offering._id}`}
              onChange={(event) => setSeriesClass(event.target.value)}
              placeholder="Which class are you targeting?"
              required
              value={seriesClass}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`seat-why-${offering._id}`}>Why do you want this seat?</Label>
            <Textarea
              className="min-h-28"
              id={`seat-why-${offering._id}`}
              onChange={(event) => setWhyBuying(event.target.value)}
              placeholder="Share your goals, relevant results, and what makes this event a fit."
              required
              value={whyBuying}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`seat-note-${offering._id}`}>Additional note (optional)</Label>
            <Textarea
              id={`seat-note-${offering._id}`}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Licensing, scheduling, coaching, or other details"
              value={note}
            />
          </div>

          <DialogFooter>
            <Button
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {offering.inventory.remaining > 0 ? "Send request" : "Join waitlist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
