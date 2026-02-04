"use client"

import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
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
import { AlertTriangle, ArrowLeft, Loader2, Upload, X } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { usePhotoUpload } from "@/hooks/usePhotoUpload"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"
import { getImageKitUrl } from "@/lib/imagekit"

export default function DisputeCreationPage() {
  const { user } = useUser()
  const params = useParams()
  const router = useRouter()
  const reservationId = params.reservationId as string

  const [reason, setReason] = useState("")
  const [description, setDescription] = useState("")
  const [requestedResolution, setRequestedResolution] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { photos, setPhotos, isUploading, fileInputRef, handlePhotoUpload, handleRemovePhoto } =
    usePhotoUpload()

  // Fetch reservation and completion data
  const reservation = useQuery(
    api.reservations.getById,
    reservationId ? { id: reservationId as Id<"reservations"> } : "skip"
  )

  const completion = useQuery(
    api.rentalCompletions.getByReservation,
    reservationId ? { reservationId: reservationId as Id<"reservations"> } : "skip"
  )

  const existingDispute = useQuery(
    api.disputes.getByReservation,
    reservationId ? { reservationId: reservationId as Id<"reservations"> } : "skip"
  )

  const createDispute = useMutation(api.disputes.create)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!completion?._id) {
      toast.error("Completion record not found")
      return
    }

    if (!(reason && description)) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)
    try {
      await createDispute({
        completionId: completion._id,
        reason,
        description,
        requestedResolution: requestedResolution || undefined,
        photos: photos.length > 0 ? photos : undefined,
      })
      toast.success("Dispute created successfully")
      router.push("/trips/disputes")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "create dispute",
        entity: "dispute",
        customMessages: {
          duplicate: "A dispute already exists for this reservation",
          generic: "Failed to create dispute. Please try again or contact support.",
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!reservation) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const vehicle = reservation.vehicle
  if (!vehicle) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Vehicle not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
  const isAlreadyDisputed = !!existingDispute

  if (isAlreadyDisputed) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <nav className="mb-3 flex items-center gap-1.5 text-sm">
          <Link
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            href="/trips/disputes"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Disputes
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate text-foreground">Already Disputed</span>
        </nav>
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="mx-auto mb-4 size-12 text-yellow-500" />
            <p className="mb-2 font-semibold text-lg">Dispute Already Created</p>
            <p className="mb-6 text-muted-foreground">
              A dispute has already been created for this rental.
            </p>
            <Link href="/trips/disputes">
              <Button>View Disputes</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-3 flex items-center gap-1.5 text-sm">
        <Link
          className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          href="/trips"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Trips
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="truncate text-foreground">Create Dispute</span>
      </nav>

      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="size-6 text-yellow-500" />
          <h1 className="font-bold text-3xl">Create Dispute</h1>
        </div>
        <p className="text-muted-foreground">
          File a dispute for {vehicleName} if there are any issues with the rental
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Vehicle Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Information</CardTitle>
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
                  {new Date(reservation.startDate).toLocaleDateString()} -{" "}
                  {new Date(reservation.endDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <Label>Total Days</Label>
                <p className="text-muted-foreground text-sm">{reservation.totalDays} days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dispute Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Dispute Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="reason">
                Reason for Dispute <span className="text-red-500">*</span>
              </Label>
              <Select onValueChange={setReason} value={reason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vehicle_condition">Vehicle Condition Mismatch</SelectItem>
                  <SelectItem value="damage">Damage Not Reported</SelectItem>
                  <SelectItem value="fuel_level">Fuel Level Discrepancy</SelectItem>
                  <SelectItem value="mileage">Mileage Discrepancy</SelectItem>
                  <SelectItem value="payment">Payment Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please provide a detailed description of the issue..."
                required
                rows={6}
                value={description}
              />
            </div>

            <div>
              <Label htmlFor="requestedResolution">Requested Resolution</Label>
              <Textarea
                id="requestedResolution"
                onChange={(e) => setRequestedResolution(e.target.value)}
                placeholder="What resolution are you seeking? (e.g., refund, partial refund, etc.)"
                rows={4}
                value={requestedResolution}
              />
            </div>

            <div>
              <Label>Supporting Evidence (Photos)</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {photos.map((photoKey, index) => (
                  <div className="group relative" key={index}>
                    <img
                      alt={`Dispute photo ${index + 1}`}
                      className="h-24 w-24 rounded-lg object-cover"
                      src={getImageKitUrl(photoKey, { width: 96, height: 96, quality: 80 })}
                    />
                    <button
                      className="absolute top-1 right-1 rounded-full bg-destructive p-1 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => handleRemovePhoto(index)}
                      type="button"
                    >
                      <X className="size-3 text-destructive-foreground" />
                    </button>
                  </div>
                ))}
                <label className="cursor-pointer">
                  <input
                    accept="image/*"
                    className="hidden"
                    disabled={isUploading}
                    multiple
                    onChange={handlePhotoUpload}
                    ref={fileInputRef}
                    type="file"
                  />
                  <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed transition-colors hover:border-primary">
                    {isUploading ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Upload className="size-4 text-muted-foreground" />
                    )}
                  </div>
                </label>
              </div>
              <p className="mt-2 text-muted-foreground text-xs">
                Upload photos as evidence for your dispute (max 10MB per photo)
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
            <div className="text-sm">
              <p className="mb-1 font-semibold">Important Information</p>
              <p className="text-muted-foreground">
                Disputes will be reviewed by our support team. Please provide as much detail as
                possible to help us resolve the issue quickly.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <Button className="flex-1" disabled={isSubmitting} type="submit">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Dispute"
            )}
          </Button>
          <Link href="/trips">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
