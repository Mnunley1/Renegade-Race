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
import { AlertCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { api, type Id } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"
import { dollarsToCents } from "@/lib/team-seat-offerings"

type UpcomingRaceEvent = {
  _id: Id<"raceEvents">
  name: string
  startDate: string
  endDate: string
  trackName?: string
  series?: { name?: string } | null
}

type TeamSeatListingDialogProps = {
  teamId: Id<"teams">
  events: UpcomingRaceEvent[]
  stripeReady: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

const NEW_EVENT_VALUE = "new-event"

export function TeamSeatListingDialog({
  teamId,
  events,
  stripeReady,
  open,
  onOpenChange,
}: TeamSeatListingDialogProps) {
  const createSeries = useMutation(api.raceSeries.create)
  const createEvent = useMutation(api.raceEvents.create)
  const createCarWithOffering = useMutation(api.teamCars.createWithOffering)

  const [eventSelection, setEventSelection] = useState(events[0]?._id ?? NEW_EVENT_VALUE)
  const [seriesName, setSeriesName] = useState("")
  const [eventName, setEventName] = useState("")
  const [eventStartDate, setEventStartDate] = useState("")
  const [eventEndDate, setEventEndDate] = useState("")
  const [trackName, setTrackName] = useState("")
  const [make, setMake] = useState("")
  const [model, setModel] = useState("")
  const [year, setYear] = useState("")
  const [carNumber, setCarNumber] = useState("")
  const [carClass, setCarClass] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [spotCount, setSpotCount] = useState("1")
  const [price, setPrice] = useState("")
  const [deposit, setDeposit] = useState("")
  const [experienceLevel, setExperienceLevel] = useState<
    "beginner" | "intermediate" | "advanced" | "professional"
  >("intermediate")
  const [stintNotes, setStintNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isCreatingEvent = eventSelection === NEW_EVENT_VALUE

  const resetOfferingFields = () => {
    setMake("")
    setModel("")
    setYear("")
    setCarNumber("")
    setCarClass("")
    setTitle("")
    setDescription("")
    setSpotCount("1")
    setPrice("")
    setDeposit("")
    setExperienceLevel("intermediate")
    setStintNotes("")
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!stripeReady) {
      toast.error("Finish Stripe payout setup before publishing a race seat.")
      return
    }

    const priceCents = dollarsToCents(price)
    const depositCents = dollarsToCents(deposit)
    const spots = Number(spotCount)
    const parsedYear = year ? Number(year) : undefined

    if (!(priceCents && depositCents)) {
      toast.error("Enter a valid seat price and deposit.")
      return
    }
    if (depositCents > priceCents) {
      toast.error("The deposit cannot be greater than the total seat price.")
      return
    }
    if (!(Number.isInteger(spots) && spots > 0)) {
      toast.error("Seat count must be a positive whole number.")
      return
    }
    if (parsedYear !== undefined && !Number.isInteger(parsedYear)) {
      toast.error("Enter a valid model year.")
      return
    }

    setIsSubmitting(true)
    try {
      let raceEventId: Id<"raceEvents">
      if (isCreatingEvent) {
        const seriesId = await createSeries({
          teamId,
          name: seriesName.trim(),
        })
        raceEventId = await createEvent({
          teamId,
          seriesId,
          name: eventName.trim(),
          startDate: eventStartDate,
          endDate: eventEndDate,
          trackName: trackName.trim() || undefined,
        })
      } else {
        raceEventId = eventSelection as Id<"raceEvents">
      }

      await createCarWithOffering({
        teamId,
        raceEventId,
        make: make.trim(),
        model: model.trim(),
        year: parsedYear,
        carNumber: carNumber.trim() || undefined,
        carClass: carClass.trim() || undefined,
        offering: {
          title: title.trim(),
          description: description.trim() || undefined,
          spotCount: spots,
          priceCents,
          depositCents,
          experienceLevel,
          stintNotes: stintNotes.trim() || undefined,
        },
      })

      toast.success("Race seat published on your team profile.")
      resetOfferingFields()
      onOpenChange(false)
    } catch (error) {
      handleErrorWithContext(error, {
        action: "publish race seat",
        customMessages: {
          generic: "We couldn't publish this seat. Please review the details and try again.",
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>List an available race seat</DialogTitle>
          <DialogDescription>
            Add the event, car, price, and number of driver spots available through your team.
          </DialogDescription>
        </DialogHeader>

        {!stripeReady && (
          <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="space-y-2">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Finish payout setup before publishing
              </p>
              <p className="text-amber-800 text-sm dark:text-amber-200">
                Drivers pay the deposit and balance through your connected Stripe account.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/host/dashboard">Set up payouts</Link>
              </Button>
            </div>
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <fieldset className="space-y-4">
            <legend className="font-semibold">Race event</legend>
            <div className="space-y-2">
              <Label htmlFor="seat-race-event">Event</Label>
              <Select onValueChange={setEventSelection} value={eventSelection}>
                <SelectTrigger id="seat-race-event">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {events.map((raceEvent) => (
                    <SelectItem key={raceEvent._id} value={raceEvent._id}>
                      {[raceEvent.series?.name, raceEvent.name].filter(Boolean).join(" · ")}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_EVENT_VALUE}>Create a new event</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isCreatingEvent && (
              <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="seat-series-name">Series name</Label>
                  <Input
                    id="seat-series-name"
                    onChange={(event) => setSeriesName(event.target.value)}
                    placeholder="IMSA Michelin Pilot Challenge"
                    required
                    value={seriesName}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seat-event-name">Event name</Label>
                  <Input
                    id="seat-event-name"
                    onChange={(event) => setEventName(event.target.value)}
                    placeholder="Road Atlanta"
                    required
                    value={eventName}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seat-event-start">Starts</Label>
                  <Input
                    id="seat-event-start"
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setEventStartDate(event.target.value)}
                    required
                    type="date"
                    value={eventStartDate}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seat-event-end">Ends</Label>
                  <Input
                    id="seat-event-end"
                    min={eventStartDate}
                    onChange={(event) => setEventEndDate(event.target.value)}
                    required
                    type="date"
                    value={eventEndDate}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="seat-track-name">Track</Label>
                  <Input
                    id="seat-track-name"
                    onChange={(event) => setTrackName(event.target.value)}
                    placeholder="Michelin Raceway Road Atlanta"
                    value={trackName}
                  />
                </div>
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="font-semibold">Team car</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="seat-car-make">Make</Label>
                <Input
                  id="seat-car-make"
                  onChange={(event) => setMake(event.target.value)}
                  placeholder="Porsche"
                  required
                  value={make}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seat-car-model">Model</Label>
                <Input
                  id="seat-car-model"
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="718 Cayman GT4 RS Clubsport"
                  required
                  value={model}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seat-car-year">Year (optional)</Label>
                <Input
                  id="seat-car-year"
                  max="2100"
                  min="1900"
                  onChange={(event) => setYear(event.target.value)}
                  type="number"
                  value={year}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seat-car-number">Car number (optional)</Label>
                <Input
                  id="seat-car-number"
                  onChange={(event) => setCarNumber(event.target.value)}
                  placeholder="24"
                  value={carNumber}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="seat-car-class">Class (optional)</Label>
                <Input
                  id="seat-car-class"
                  onChange={(event) => setCarClass(event.target.value)}
                  placeholder="GS"
                  value={carClass}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="font-semibold">Seat offering</legend>
            <div className="space-y-2">
              <Label htmlFor="seat-title">Listing title</Label>
              <Input
                id="seat-title"
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Endurance co-driver seat"
                required
                value={title}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seat-description">Description (optional)</Label>
              <Textarea
                id="seat-description"
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the program, support, testing, and what is included."
                value={description}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="seat-count">Available seats</Label>
                <Input
                  id="seat-count"
                  min="1"
                  onChange={(event) => setSpotCount(event.target.value)}
                  required
                  type="number"
                  value={spotCount}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seat-price">Total price</Label>
                <Input
                  id="seat-price"
                  min="0.01"
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="15000"
                  required
                  step="0.01"
                  type="number"
                  value={price}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seat-deposit">Deposit</Label>
                <Input
                  id="seat-deposit"
                  min="0.01"
                  onChange={(event) => setDeposit(event.target.value)}
                  placeholder="5000"
                  required
                  step="0.01"
                  type="number"
                  value={deposit}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seat-experience-level">Recommended experience</Label>
              <Select
                onValueChange={(value) => setExperienceLevel(value as typeof experienceLevel)}
                value={experienceLevel}
              >
                <SelectTrigger id="seat-experience-level">
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
              <Label htmlFor="seat-stint-notes">Stint or schedule notes (optional)</Label>
              <Textarea
                id="seat-stint-notes"
                onChange={(event) => setStintNotes(event.target.value)}
                placeholder="Expected seat time, practice schedule, and driver rotation"
                value={stintNotes}
              />
            </div>
          </fieldset>

          <DialogFooter>
            <Button
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isSubmitting || !stripeReady} type="submit">
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Publish race seat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
