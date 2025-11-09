"use client"

import { useQuery, useMutation } from "convex/react"
import { useUser } from "@clerk/nextjs"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Badge } from "@workspace/ui/components/badge"
import { Loader2, ArrowLeft, AlertTriangle, Upload } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/convex"
import { toast } from "sonner"

export default function DisputeCreationPage() {
  const { user } = useUser()
  const params = useParams()
  const router = useRouter()
  const reservationId = params.reservationId as string

  const [reason, setReason] = useState("")
  const [description, setDescription] = useState("")
  const [requestedResolution, setRequestedResolution] = useState("")
  const [photos, setPhotos] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch reservation and completion data
  const reservation = useQuery(
    api.reservations.getById,
    reservationId ? { id: reservationId as any } : "skip"
  )

  const completion = useQuery(
    api.rentalCompletions.getByReservation,
    reservationId ? { reservationId: reservationId as any } : "skip"
  )

  const existingDispute = useQuery(
    api.disputes.getByReservation,
    reservationId ? { reservationId: reservationId as any } : "skip"
  )

  const createDispute = useMutation(api.disputes.create)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!completion?._id) {
      toast.error("Completion record not found")
      return
    }

    if (!reason || !description) {
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
      console.error("Error creating dispute:", error)
      toast.error("Failed to create dispute")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle photo upload (placeholder)
  const handlePhotoUpload = () => {
    // TODO: Implement photo upload to storage
    toast.info("Photo upload functionality coming soon")
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
        <div className="mb-6">
          <Link href="/trips/disputes">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 size-4" />
              Back to Disputes
            </Button>
          </Link>
        </div>
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
      <div className="mb-6">
        <Link href="/trips">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" />
            Back to Trips
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="size-6 text-yellow-500" />
          <h1 className="font-bold text-3xl">Create Dispute</h1>
        </div>
        <p className="text-muted-foreground">
          File a dispute for {vehicleName} if there are any issues with the rental
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                <p className="text-sm text-muted-foreground">
                  {new Date(reservation.startDate).toLocaleDateString()} -{" "}
                  {new Date(reservation.endDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <Label>Total Days</Label>
                <p className="text-sm text-muted-foreground">{reservation.totalDays} days</p>
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
              <Select value={reason} onValueChange={setReason}>
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please provide a detailed description of the issue..."
                rows={6}
                required
              />
            </div>

            <div>
              <Label htmlFor="requestedResolution">Requested Resolution</Label>
              <Textarea
                id="requestedResolution"
                value={requestedResolution}
                onChange={(e) => setRequestedResolution(e.target.value)}
                placeholder="What resolution are you seeking? (e.g., refund, partial refund, etc.)"
                rows={4}
              />
            </div>

            <div>
              <Label>Supporting Evidence (Photos)</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      alt={`Dispute photo ${index + 1}`}
                      className="h-24 w-24 rounded-lg object-cover"
                      src={photo}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePhotoUpload}
                  className="h-24 w-24"
                >
                  <Upload className="size-4" />
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Upload photos as evidence for your dispute
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
          <Button type="submit" disabled={isSubmitting} className="flex-1">
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

