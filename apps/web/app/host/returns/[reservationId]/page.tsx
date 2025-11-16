"use client"

import { useQuery, useMutation } from "convex/react"
import { useUser } from "@clerk/nextjs"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Loader2, ArrowLeft, CheckCircle2, XCircle, Upload } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/convex"
import { toast } from "sonner"

export default function ReturnReviewPage() {
  const { user } = useUser()
  const params = useParams()
  const router = useRouter()
  const reservationId = params.reservationId as string

  const [vehicleReceived, setVehicleReceived] = useState(true)
  const [conditionMatches, setConditionMatches] = useState(true)
  const [fuelLevelMatches, setFuelLevelMatches] = useState(true)
  const [mileageMatches, setMileageMatches] = useState(true)
  const [damageReported, setDamageReported] = useState("")
  const [notes, setNotes] = useState("")
  const [photos, setPhotos] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch completion data
  const completion = useQuery(
    api.rentalCompletions.getByReservation,
    reservationId ? { reservationId: reservationId as any } : "skip"
  )

  const submitReturnReview = useMutation(api.rentalCompletions.submitOwnerReturnReview)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!completion?._id) {
      toast.error("Completion record not found")
      return
    }

    setIsSubmitting(true)
    try {
      await submitReturnReview({
        completionId: completion._id,
        vehicleReceived,
        conditionMatches,
        fuelLevelMatches,
        mileageMatches,
        damageReported: damageReported || undefined,
        photos,
        notes: notes || undefined,
      })
      toast.success("Return review submitted successfully")
      router.push("/host/reservations")
    } catch (error) {
      console.error("Error submitting return review:", error)
      toast.error("Failed to submit return review")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle photo upload (placeholder)
  const handlePhotoUpload = () => {
    // TODO: Implement photo upload to storage
    toast.info("Photo upload functionality coming soon")
  }

  if (!completion) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const vehicle = completion.vehicle
  const reservation = completion.reservation
  const renter = completion.renter

  if (!vehicle || !reservation) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Vehicle or reservation not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
  const renterReturnForm = completion.renterReturnForm
  const isAlreadyReviewed = completion.status === "completed" || completion.status === "disputed"

  if (!renterReturnForm) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <Link href="/host/reservations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 size-4" />
              Back to Reservations
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="mb-2 font-semibold text-lg">No Return Form Submitted</p>
            <p className="mb-6 text-muted-foreground">
              The renter has not yet submitted their return form.
            </p>
            <Link href="/host/reservations">
              <Button>Back to Reservations</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isAlreadyReviewed) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <Link href="/host/reservations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 size-4" />
              Back to Reservations
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="mx-auto mb-4 size-12 text-green-500" />
            <p className="mb-2 font-semibold text-lg">Return Already Reviewed</p>
            <p className="mb-6 text-muted-foreground">
              This return has already been reviewed and processed.
            </p>
            <Link href="/host/reservations">
              <Button>Back to Reservations</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link href="/host/reservations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" />
            Back to Reservations
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="mb-2 font-bold text-3xl">Review Return</h1>
        <p className="text-muted-foreground">
          Review the return form submitted by {renter?.name || "the renter"} for {vehicleName}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Renter's Return Form Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Renter's Return Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Return Date</Label>
                <p className="font-semibold">
                  {new Date(renterReturnForm.returnDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <Label>Vehicle Condition</Label>
                <Badge variant="outline" className="mt-1">
                  {renterReturnForm.vehicleCondition.charAt(0).toUpperCase() +
                    renterReturnForm.vehicleCondition.slice(1)}
                </Badge>
              </div>
              <div>
                <Label>Fuel Level</Label>
                <p className="font-semibold">{renterReturnForm.fuelLevel}</p>
              </div>
              <div>
                <Label>Mileage</Label>
                <p className="font-semibold">{renterReturnForm.mileage.toLocaleString()} miles</p>
              </div>
            </div>
            {renterReturnForm.notes && (
              <div>
                <Label>Notes</Label>
                <p className="mt-1 text-sm text-muted-foreground">{renterReturnForm.notes}</p>
              </div>
            )}
            {renterReturnForm.photos && renterReturnForm.photos.length > 0 && (
              <div>
                <Label>Photos</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {renterReturnForm.photos.map((photo, index) => (
                    <img
                      key={index}
                      alt={`Return photo ${index + 1}`}
                      className="h-24 w-24 rounded-lg object-cover"
                      src={photo}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Owner's Review Form */}
        <Card>
          <CardHeader>
            <CardTitle>Your Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="vehicleReceived"
                checked={vehicleReceived}
                onCheckedChange={(checked) => setVehicleReceived(checked === true)}
              />
              <Label htmlFor="vehicleReceived" className="cursor-pointer">
                Vehicle has been received
              </Label>
            </div>

            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <h3 className="font-semibold">Verification</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="conditionMatches"
                    checked={conditionMatches}
                    onCheckedChange={(checked) => setConditionMatches(checked === true)}
                  />
                  <Label htmlFor="conditionMatches" className="cursor-pointer">
                    Vehicle condition matches renter's report
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="fuelLevelMatches"
                    checked={fuelLevelMatches}
                    onCheckedChange={(checked) => setFuelLevelMatches(checked === true)}
                  />
                  <Label htmlFor="fuelLevelMatches" className="cursor-pointer">
                    Fuel level matches renter's report
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mileageMatches"
                    checked={mileageMatches}
                    onCheckedChange={(checked) => setMileageMatches(checked === true)}
                  />
                  <Label htmlFor="mileageMatches" className="cursor-pointer">
                    Mileage matches renter's report
                  </Label>
                </div>
              </div>
            </div>

            {(!conditionMatches || !fuelLevelMatches || !mileageMatches) && (
              <div>
                <Label htmlFor="damageReported">Damage or Discrepancy Report</Label>
                <Textarea
                  id="damageReported"
                  value={damageReported}
                  onChange={(e) => setDamageReported(e.target.value)}
                  placeholder="Describe any damage or discrepancies found..."
                  rows={4}
                />
              </div>
            )}

            <div>
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about the return..."
                rows={4}
              />
            </div>

            <div>
              <Label>Photos (Optional)</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      alt={`Review photo ${index + 1}`}
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
                Upload photos if there are discrepancies or damage
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting || !vehicleReceived} className="flex-1">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Review"
            )}
          </Button>
          <Link href="/host/reservations">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}

