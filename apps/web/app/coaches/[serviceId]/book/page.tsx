"use client"

import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

function todayISO() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export default function CoachBookPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isSignedIn } = useUser()
  const serviceId = params.serviceId as string

  const service = useQuery(
    api.coachServices.getPublicById,
    serviceId ? { coachServiceId: serviceId as Id<"coachServices"> } : "skip"
  )
  const tracks = useQuery(api.tracks.getAll, {})

  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(todayISO())
  const [totalHours, setTotalHours] = useState("2")
  const [eventTrackId, setEventTrackId] = useState<string>("")
  const [clientMessage, setClientMessage] = useState("")
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)

  const addOnPayload = useMemo(() => {
    if (!service?.addOns?.length) return undefined
    const out: Array<{
      name: string
      price: number
      description?: string
      priceType?: "daily" | "one-time"
    }> = []
    for (const a of service.addOns) {
      if (a.isRequired || selectedAddOns[a.name]) {
        out.push({
          name: a.name,
          price: a.price,
          description: a.description,
          priceType: a.priceType,
        })
      }
    }
    return out.length ? out : undefined
  }, [service?.addOns, selectedAddOns])

  const quote = useQuery(
    api.coachBookings.previewBookingQuote,
    service && startDate && endDate
      ? {
          coachServiceId: service._id,
          startDate,
          endDate,
          totalHours:
            service.pricingUnit === "hour" ? Number.parseFloat(totalHours || "0") : undefined,
          eventTrackId: eventTrackId ? (eventTrackId as Id<"tracks">) : undefined,
          addOns: addOnPayload,
        }
      : "skip"
  )

  const createBooking = useMutation(api.coachBookings.create)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!service || !user) return
    setSubmitting(true)
    try {
      const { conversationId } = await createBooking({
        coachServiceId: service._id,
        startDate,
        endDate,
        totalHours: service.pricingUnit === "hour" ? Number.parseFloat(totalHours) : undefined,
        eventTrackId:
          eventTrackId && eventTrackId !== "none"
            ? (eventTrackId as Id<"tracks">)
            : undefined,
        clientMessage: clientMessage.trim() || undefined,
        addOns: addOnPayload,
      })
      toast.success("Booking request sent")
      router.push(`/messages/${conversationId}`)
    } catch (err) {
      handleErrorWithContext(err, { action: "create coach booking" })
    } finally {
      setSubmitting(false)
    }
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-muted-foreground">Sign in to book coaching.</p>
        <Button asChild className="mt-4">
          <Link
            href={`/sign-in?redirect_url=${encodeURIComponent(`/coaches/${serviceId}/book`)}`}
          >
            Sign in
          </Link>
        </Button>
      </div>
    )
  }

  if (service === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (service === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="font-medium">This listing is not available.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/coaches">Back to coaches</Link>
        </Button>
      </div>
    )
  }

  const surchargeTrackOptions =
    service.travelSurcharges?.map(
      (r: { trackId: Id<"tracks">; amount: number; label?: string }) => {
        const t = tracks?.find((tr: { _id: string; name: string }) => tr._id === r.trackId)
        return { ...r, trackName: t?.name ?? "Track" }
      }
    ) ?? []

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/coaches/${serviceId}`}>
        <Button className="mb-6" type="button" variant="ghost">
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Book: {service.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start">Start date</Label>
                <Input
                  id="start"
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  type="date"
                  value={startDate}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End date</Label>
                <Input
                  id="end"
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  type="date"
                  value={endDate}
                />
              </div>
            </div>

            {service.pricingUnit === "hour" ? (
              <div className="space-y-2">
                <Label htmlFor="hours">Total hours</Label>
                <Input
                  id="hours"
                  min={0.5}
                  onChange={(e) => setTotalHours(e.target.value)}
                  required
                  step={0.5}
                  type="number"
                  value={totalHours}
                />
              </div>
            ) : null}

            {surchargeTrackOptions.length > 0 ? (
              <div className="space-y-2">
                <Label>Event track (optional travel fee)</Label>
                <Select onValueChange={setEventTrackId} value={eventTrackId || "none"}>
                  <SelectTrigger>
                    <SelectValue placeholder="No travel fee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No travel surcharge</SelectItem>
                    {surchargeTrackOptions.map(
                      (row: { trackId: Id<"tracks">; amount: number; trackName: string }) => (
                      <SelectItem key={row.trackId} value={row.trackId}>
                        {row.trackName} — ${(row.amount / 100).toFixed(2)}
                      </SelectItem>
                    )
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {service.addOns?.some((a: { isRequired?: boolean }) => !a.isRequired) ? (
              <div className="space-y-2">
                <Label>Optional add-ons</Label>
                <div className="space-y-2">
                  {service.addOns
                    .filter((a: { isRequired?: boolean }) => !a.isRequired)
                    .map((a: { name: string; price: number; priceType?: string }) => (
                      <label className="flex items-center gap-2 text-sm" key={a.name}>
                        <Checkbox
                          checked={!!selectedAddOns[a.name]}
                          onCheckedChange={(c) =>
                            setSelectedAddOns((prev) => ({ ...prev, [a.name]: c === true }))
                          }
                        />
                        <span>
                          {a.name} (${(a.price / 100).toFixed(2)}
                          {a.priceType === "daily" ? "/day" : ""})
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="msg">Message to coach (optional)</Label>
              <Textarea
                id="msg"
                onChange={(e) => setClientMessage(e.target.value)}
                placeholder="Goals, car class, prior experience…"
                rows={4}
                value={clientMessage}
              />
            </div>

            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="font-medium">Estimated total</p>
              {quote === undefined ? (
                <p className="mt-1 text-muted-foreground text-sm">Enter dates to see pricing…</p>
              ) : quote === null ? (
                <p className="mt-1 text-destructive text-sm">
                  Adjust dates, hours, or travel track — quote unavailable.
                </p>
              ) : (
                <p className="mt-1 font-semibold text-2xl">
                  ${(quote.totalAmount / 100).toFixed(2)}
                </p>
              )}
            </div>

            <Button className="w-full" disabled={submitting || quote === null} type="submit">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Submit request"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
