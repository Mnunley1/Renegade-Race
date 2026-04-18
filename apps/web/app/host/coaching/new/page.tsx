"use client"

import { useUser } from "@clerk/nextjs"
import { useUploadFile } from "@convex-dev/r2/react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Plus, Upload, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

type PricingUnit = "hour" | "half_day" | "full_day" | "session"

type TravelRow = { trackId: string; amountDollars: string; label: string }

export default function NewCoachingProgramPage() {
  const router = useRouter()
  const { user } = useUser()
  const [step, setStep] = useState(1)

  const onboardingStatus = useQuery(api.users.getHostOnboardingStatus, user?.id ? {} : "skip")
  const tracks = useQuery(api.tracks.getAll, {})
  const createWithImages = useMutation(api.coachServices.createWithImages)
  const uploadFile = useUploadFile(api.r2)

  useEffect(() => {
    if (onboardingStatus && onboardingStatus.status !== "completed") {
      router.push("/host/onboarding")
    }
  }, [onboardingStatus, router])

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [trackId, setTrackId] = useState<string>("")
  const [baseRateDollars, setBaseRateDollars] = useState("")
  const [pricingUnit, setPricingUnit] = useState<PricingUnit>("hour")
  const [specialties, setSpecialties] = useState("")
  const [zipCode, setZipCode] = useState("")

  const [images, setImages] = useState<Array<{ file: File; preview: string }>>([])
  const [uploading, setUploading] = useState(false)

  const [addOns, setAddOns] = useState<
    Array<{
      name: string
      price: string
      description: string
      priceType: "daily" | "one-time"
    }>
  >([])
  const [newAddOn, setNewAddOn] = useState({
    name: "",
    price: "",
    description: "",
    priceType: "one-time" as "daily" | "one-time",
  })

  const [travelRows, setTravelRows] = useState<TravelRow[]>([])

  const [ack, setAck] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = [...prev]
      const [removed] = next.splice(index, 1)
      if (removed) URL.revokeObjectURL(removed.preview)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!user || !ack) return
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required")
      return
    }
    const rateCents = Math.round(Number.parseFloat(baseRateDollars) * 100)
    if (!Number.isFinite(rateCents) || rateCents < 100) {
      toast.error("Enter a base rate of at least $1.00")
      return
    }
    if (images.length === 0) {
      toast.error("Add at least one photo")
      return
    }

    setUploading(true)
    setSubmitting(true)
    try {
      const uploaded: Array<{
        r2Key: string
        isPrimary: boolean
        order: number
        metadata?: {
          fileName: string
          originalSize: number
          processedSizes: {
            thumbnail: number
            card: number
            detail: number
            hero: number
          }
        }
      }> = []

      for (let i = 0; i < images.length; i++) {
        const slot = images[i]
        if (!slot) continue
        const { file } = slot
        const key = await uploadFile(file)
        uploaded.push({
          r2Key: key,
          isPrimary: i === 0,
          order: i,
          metadata: {
            fileName: file.name,
            originalSize: file.size,
            processedSizes: { thumbnail: 0, card: 0, detail: 0, hero: 0 },
          },
        })
      }

      const specs = specialties
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)

      const addOnPayload = addOns.map((a) => ({
        name: a.name.trim(),
        price: Math.round(Number.parseFloat(a.price) * 100),
        description: a.description.trim() || undefined,
        priceType: a.priceType,
      }))

      const travelSurcharges =
        travelRows.length > 0
          ? travelRows
              .filter((r) => r.trackId && r.amountDollars)
              .map((r) => ({
                trackId: r.trackId as Id<"tracks">,
                amount: Math.round(Number.parseFloat(r.amountDollars) * 100),
                label: r.label.trim() || undefined,
              }))
          : undefined

      const id = await createWithImages({
        trackId:
          trackId && trackId !== "none" ? (trackId as Id<"tracks">) : undefined,
        title: title.trim(),
        description: description.trim(),
        baseRate: rateCents,
        pricingUnit,
        addOns: addOnPayload.length ? addOnPayload : undefined,
        specialties: specs,
        address: zipCode.trim() ? { zipCode: zipCode.trim() } : undefined,
        travelSurcharges,
        images: uploaded,
      })

      toast.success("Program submitted — pending admin approval")
      router.push(`/host/coaching/${id}/edit`)
    } catch (e) {
      handleErrorWithContext(e, { action: "create coaching program" })
    } finally {
      setUploading(false)
      setSubmitting(false)
    }
  }

  if (!onboardingStatus || onboardingStatus.status !== "completed") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Link href="/host/coaching/list">
        <Button className="mb-6" variant="ghost">
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
      </Link>

      <div className="mb-8 flex items-center gap-2 text-muted-foreground text-sm">
        {[1, 2, 3, 4].map((s) => (
          <span
            className={step >= s ? "font-semibold text-foreground" : ""}
            key={s}
          >{`Step ${s}`}</span>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Program basics</CardTitle>
            <CardDescription>Describe what you offer and your base rate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. GT4 coaching — Thunderhill"
                value={title}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                value={description}
              />
            </div>
            <div className="space-y-2">
              <Label>Home track (optional)</Label>
              <Select onValueChange={setTrackId} value={trackId || "none"}>
                <SelectTrigger>
                  <SelectValue placeholder="Select track" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default (first active track)</SelectItem>
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
                <Label htmlFor="rate">Base rate (USD)</Label>
                <Input
                  id="rate"
                  min={1}
                  onChange={(e) => setBaseRateDollars(e.target.value)}
                  placeholder="250"
                  step={1}
                  type="number"
                  value={baseRateDollars}
                />
              </div>
              <div className="space-y-2">
                <Label>Billing unit</Label>
                <Select
                  onValueChange={(v) => setPricingUnit(v as PricingUnit)}
                  value={pricingUnit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hour">Per hour</SelectItem>
                    <SelectItem value="half_day">Half day</SelectItem>
                    <SelectItem value="full_day">Full day</SelectItem>
                    <SelectItem value="session">Session</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="spec">Specialties (comma-separated)</Label>
              <Input
                id="spec"
                onChange={(e) => setSpecialties(e.target.value)}
                placeholder="HPDE, Time attack, Data"
                value={specialties}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">Service ZIP (for discovery)</Label>
              <Input
                id="zip"
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="94510"
                value={zipCode}
              />
            </div>
            <Button className="w-full" onClick={() => setStep(2)} type="button">
              Next
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
            <CardDescription>Upload at least one image for your listing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {images.map((im, i) => (
                <div className="relative size-28 overflow-hidden rounded-md border" key={im.preview}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="size-full object-cover" src={im.preview} />
                  <button
                    className="absolute top-1 right-1 rounded-full bg-background/90 p-1"
                    onClick={() => removeImage(i)}
                    type="button"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              <label className="flex size-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed">
                <Upload className="mb-1 size-5 text-muted-foreground" />
                <span className="text-muted-foreground text-xs">Add</span>
                <input
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setImages((prev) => [...prev, { file: f, preview: URL.createObjectURL(f) }])
                  }}
                  type="file"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setStep(1)} type="button" variant="outline">
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={images.length === 0}
                onClick={() => setStep(3)}
                type="button"
              >
                Next
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Pricing extras</CardTitle>
            <CardDescription>Optional add-ons and travel surcharges by track.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Add-ons</Label>
              {addOns.map((a, i) => (
                <div className="flex items-center justify-between rounded border p-2 text-sm" key={i}>
                  <span>
                    {a.name} — ${a.price} ({a.priceType})
                  </span>
                  <Button
                    onClick={() => setAddOns((prev) => prev.filter((_, j) => j !== i))}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  onChange={(e) => setNewAddOn((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Name"
                  value={newAddOn.name}
                />
                <Input
                  onChange={(e) => setNewAddOn((p) => ({ ...p, price: e.target.value }))}
                  placeholder="Price USD"
                  type="number"
                  value={newAddOn.price}
                />
                <Input
                  className="sm:col-span-2"
                  onChange={(e) => setNewAddOn((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Description (optional)"
                  value={newAddOn.description}
                />
                <Select
                  onValueChange={(v) =>
                    setNewAddOn((p) => ({ ...p, priceType: v as "daily" | "one-time" }))
                  }
                  value={newAddOn.priceType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one-time">One-time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    if (!newAddOn.name || !newAddOn.price) return
                    setAddOns((prev) => [...prev, { ...newAddOn }])
                    setNewAddOn({
                      name: "",
                      price: "",
                      description: "",
                      priceType: "one-time",
                    })
                  }}
                  type="button"
                  variant="secondary"
                >
                  <Plus className="mr-2 size-4" />
                  Add add-on
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Travel surcharges (optional)</Label>
              {travelRows.map((row, i) => (
                <div className="grid gap-2 rounded border p-3 sm:grid-cols-3" key={i}>
                  <Select
                    onValueChange={(v) => {
                      setTravelRows((prev) => {
                        const next = [...prev]
                        const cur = next[i] ?? { trackId: "", amountDollars: "", label: "" }
                        next[i] = { ...cur, trackId: v }
                        return next
                      })
                    }}
                    value={row.trackId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Track" />
                    </SelectTrigger>
                    <SelectContent>
                      {(tracks ?? []).map((t: { _id: string; name: string }) => (
                        <SelectItem key={t._id} value={t._id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    onChange={(e) => {
                      setTravelRows((prev) => {
                        const next = [...prev]
                        const cur = next[i] ?? { trackId: "", amountDollars: "", label: "" }
                        next[i] = { ...cur, amountDollars: e.target.value }
                        return next
                      })
                    }}
                    placeholder="Amount USD"
                    type="number"
                    value={row.amountDollars}
                  />
                  <Input
                    onChange={(e) => {
                      setTravelRows((prev) => {
                        const next = [...prev]
                        const cur = next[i] ?? { trackId: "", amountDollars: "", label: "" }
                        next[i] = { ...cur, label: e.target.value }
                        return next
                      })
                    }}
                    placeholder="Label"
                    value={row.label}
                  />
                </div>
              ))}
              <Button
                onClick={() =>
                  setTravelRows((prev) => [...prev, { trackId: "", amountDollars: "", label: "" }])
                }
                type="button"
                variant="outline"
              >
                Add travel row
              </Button>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => setStep(2)} type="button" variant="outline">
                Back
              </Button>
              <Button className="flex-1" onClick={() => setStep(4)} type="button">
                Next
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & publish</CardTitle>
            <CardDescription>
              Listings go live after admin approval. You use the same Stripe Connect account as
              vehicle hosting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={ack} onCheckedChange={(c) => setAck(c === true)} />
              <span>
                I confirm this program is accurate and I agree to platform policies for coaching
                services.
              </span>
            </label>
            <div className="flex gap-2">
              <Button onClick={() => setStep(3)} type="button" variant="outline">
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={!ack || submitting || uploading}
                onClick={handleSubmit}
                type="button"
              >
                {submitting || uploading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Publishing…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 size-4" />
                    Submit program
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
