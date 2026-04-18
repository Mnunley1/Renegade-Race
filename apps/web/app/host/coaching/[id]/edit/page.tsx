"use client"

import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { ArrowLeft, Loader2, Trash2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

export default function EditCoachingProgramPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const id = params.id as string

  const service = useQuery(
    api.coachServices.getById,
    id ? { coachServiceId: id as Id<"coachServices"> } : "skip"
  )
  const tracks = useQuery(api.tracks.getAll, {})

  const update = useMutation(api.coachServices.update)
  const softDelete = useMutation(api.coachServices.softDelete)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [baseRate, setBaseRate] = useState("")
  const [pricingUnit, setPricingUnit] = useState<"hour" | "half_day" | "full_day" | "session">(
    "hour"
  )
  const [trackId, setTrackId] = useState<string>("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!service) return
    setTitle(service.title)
    setDescription(service.description)
    setBaseRate(String(service.baseRate / 100))
    setPricingUnit(service.pricingUnit)
    setTrackId(service.trackId ?? "none")
  }, [service])

  const handleSave = async () => {
    if (!service || !user || service.coachId !== user.id) return
    setSaving(true)
    try {
      await update({
        coachServiceId: service._id,
        title: title.trim(),
        description: description.trim(),
        baseRate: Math.round(Number.parseFloat(baseRate) * 100),
        pricingUnit,
        trackId:
          trackId && trackId !== "none" ? (trackId as Id<"tracks">) : undefined,
      })
      toast.success("Saved")
    } catch (e) {
      handleErrorWithContext(e, { action: "update coaching program" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!service || !confirm("Remove this program from the marketplace?")) return
    try {
      await softDelete({ coachServiceId: service._id })
      toast.success("Program removed")
      router.push("/host/coaching/list")
    } catch (e) {
      handleErrorWithContext(e, { action: "delete coaching program" })
    }
  }

  if (service === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (service === null || (user && service.coachId !== user.id)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="font-medium">Program not found</p>
        <Button asChild className="mt-4">
          <Link href="/host/coaching/list">Back to list</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Link href="/host/coaching/list">
        <Button className="mb-6" variant="ghost">
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Edit program</CardTitle>
          <CardDescription>
            Changes to pricing apply to new bookings. Existing requests keep their quoted totals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t">Title</Label>
            <Input id="t" onChange={(e) => setTitle(e.target.value)} value={title} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d">Description</Label>
            <Textarea id="d" onChange={(e) => setDescription(e.target.value)} rows={5} value={description} />
          </div>
          <div className="space-y-2">
            <Label>Track</Label>
            <Select onValueChange={setTrackId} value={trackId || "none"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Default</SelectItem>
                {(tracks ?? []).map((t: { _id: string; name: string }) => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="br">Base rate (USD)</Label>
              <Input
                id="br"
                onChange={(e) => setBaseRate(e.target.value)}
                type="number"
                value={baseRate}
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                onValueChange={(v) =>
                  setPricingUnit(v as "hour" | "half_day" | "full_day" | "session")
                }
                value={pricingUnit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hour">Hour</SelectItem>
                  <SelectItem value="half_day">Half day</SelectItem>
                  <SelectItem value="full_day">Full day</SelectItem>
                  <SelectItem value="session">Session</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={saving} onClick={handleSave} type="button">
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
            </Button>
            <Button
              className="text-destructive"
              onClick={handleDelete}
              type="button"
              variant="outline"
            >
              <Trash2 className="mr-2 size-4" />
              Remove listing
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
