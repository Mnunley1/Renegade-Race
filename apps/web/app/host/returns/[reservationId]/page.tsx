"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useUploadFile } from "@convex-dev/r2/react"
import { useMutation, useQuery } from "convex/react"
import { ArrowLeft, CheckCircle2, Loader2, Upload, X } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import type { Id } from "@/lib/convex"
import { getImageKitUrl } from "@/lib/imagekit"

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
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadFile = useUploadFile(api.r2)

  // Fetch completion data
  const completion = useQuery(
    api.rentalCompletions.getByReservation,
    reservationId ? { reservationId: reservationId as Id<"reservations"> } : "skip"
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

  // Handle photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      const fileArray = Array.from(files)
      const uploadedKeys: string[] = []

      for (let index = 0; index < fileArray.length; index++) {
        const file = fileArray[index]
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image file`)
          continue
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large. Maximum size is 10MB.`)
          continue
        }

        try {
          // Add a small delay between uploads to avoid rate limiting
          if (index > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500))
          }

          const r2Key = await uploadFile(file)
          uploadedKeys.push(r2Key)
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error)
          toast.error(`Failed to upload ${file.name}`)
        }
      }

      if (uploadedKeys.length > 0) {
        setPhotos((prev) => [...prev, ...uploadedKeys])
        toast.success(`${uploadedKeys.length} photo(s) uploaded successfully`)
      }
    } catch (error) {
      console.error("Error uploading photos:", error)
      toast.error("Failed to upload photos")
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
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

  if (!(vehicle && reservation)) {
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
            <Button className="mb-6" variant="outline">
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
            <Button className="mb-6" variant="outline">
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
          <Button size="sm" variant="ghost">
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

      <form className="space-y-6" onSubmit={handleSubmit}>
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
                <Badge className="mt-1" variant="outline">
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
                <p className="mt-1 text-muted-foreground text-sm">{renterReturnForm.notes}</p>
              </div>
            )}
            {renterReturnForm.photos && renterReturnForm.photos.length > 0 && (
              <div>
                <Label>Photos</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {renterReturnForm.photos.map((photo, index) => (
                    <img
                      alt={`Return photo ${index + 1}`}
                      className="h-24 w-24 rounded-lg object-cover"
                      key={index}
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
                checked={vehicleReceived}
                id="vehicleReceived"
                onCheckedChange={(checked) => setVehicleReceived(checked === true)}
              />
              <Label className="cursor-pointer" htmlFor="vehicleReceived">
                Vehicle has been received
              </Label>
            </div>

            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <h3 className="font-semibold">Verification</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={conditionMatches}
                    id="conditionMatches"
                    onCheckedChange={(checked) => setConditionMatches(checked === true)}
                  />
                  <Label className="cursor-pointer" htmlFor="conditionMatches">
                    Vehicle condition matches renter's report
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={fuelLevelMatches}
                    id="fuelLevelMatches"
                    onCheckedChange={(checked) => setFuelLevelMatches(checked === true)}
                  />
                  <Label className="cursor-pointer" htmlFor="fuelLevelMatches">
                    Fuel level matches renter's report
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={mileageMatches}
                    id="mileageMatches"
                    onCheckedChange={(checked) => setMileageMatches(checked === true)}
                  />
                  <Label className="cursor-pointer" htmlFor="mileageMatches">
                    Mileage matches renter's report
                  </Label>
                </div>
              </div>
            </div>

            {!(conditionMatches && fuelLevelMatches && mileageMatches) && (
              <div>
                <Label htmlFor="damageReported">Damage or Discrepancy Report</Label>
                <Textarea
                  id="damageReported"
                  onChange={(e) => setDamageReported(e.target.value)}
                  placeholder="Describe any damage or discrepancies found..."
                  rows={4}
                  value={damageReported}
                />
              </div>
            )}

            <div>
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about the return..."
                rows={4}
                value={notes}
              />
            </div>

            <div>
              <Label>Photos (Optional)</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {photos.map((photoKey, index) => (
                  <div className="group relative" key={index}>
                    <img
                      alt={`Review photo ${index + 1}`}
                      className="h-24 w-24 rounded-lg object-cover"
                      src={getImageKitUrl(photoKey, { width: 96, height: 96, quality: 80 })}
                    />
                    <button
                      className="absolute right-1 top-1 rounded-full bg-destructive p-1 opacity-0 transition-opacity group-hover:opacity-100"
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
                Upload photos if there are discrepancies or damage (max 10MB per photo)
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button className="flex-1" disabled={isSubmitting || !vehicleReceived} type="submit">
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
