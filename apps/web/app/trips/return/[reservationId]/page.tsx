"use client"

import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
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
import { ArrowLeft, Calendar, Loader2, Upload, X } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { usePhotoUpload } from "@/hooks/usePhotoUpload"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"
import { getImageKitUrl } from "@/lib/imagekit"

export default function ReturnSubmissionPage() {
  const { user } = useUser()
  const params = useParams()
  const router = useRouter()
  const reservationId = params.reservationId as string

  const [returnDate, setReturnDate] = useState("")
  const [vehicleCondition, setVehicleCondition] = useState<
    "excellent" | "good" | "fair" | "poor" | "damaged"
  >("excellent")
  const [fuelLevel, setFuelLevel] = useState<"full" | "3/4" | "1/2" | "1/4" | "empty">("full")
  const [mileage, setMileage] = useState("")
  const [notes, setNotes] = useState("")
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

  const submitReturnForm = useMutation(api.rentalCompletions.submitRenterReturnForm)
  const createCompletion = useMutation(api.rentalCompletions.create)

  // Initialize completion if needed
  const handleInitializeCompletion = async () => {
    if (!(reservationId && reservation)) return

    try {
      await createCompletion({ reservationId: reservationId as Id<"reservations"> })
      toast.success("Return process started")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "start return process",
        customMessages: {
          generic: "Failed to start return process. Please try again.",
        },
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!completion?._id) {
      await handleInitializeCompletion()
      return
    }

    if (!(returnDate && mileage)) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)
    try {
      await submitReturnForm({
        completionId: completion._id,
        returnDate,
        vehicleCondition,
        fuelLevel,
        mileage: Number.parseFloat(mileage),
        notes: notes || undefined,
        photos,
      })
      toast.success("Return form submitted successfully")
      router.push("/trips")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "submit return form",
        customMessages: {
          generic: "Failed to submit return form. Please try again.",
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
  const isAlreadySubmitted =
    completion?.status === "pending_owner" || completion?.status === "completed"

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link href="/trips">
          <Button className="mb-6" variant="outline">
            <ArrowLeft className="mr-2 size-4" />
            Back to Trips
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="mb-2 font-bold text-3xl">Return Vehicle</h1>
        <p className="text-muted-foreground">Submit your return form for {vehicleName}</p>
      </div>

      {isAlreadySubmitted ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="mx-auto mb-4 size-12 text-muted-foreground" />
            <p className="mb-2 font-semibold text-lg">Return Form Already Submitted</p>
            <p className="mb-6 text-muted-foreground">
              Your return form has been submitted and is awaiting owner review.
            </p>
            <Link href="/trips">
              <Button>Back to Trips</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
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

          {/* Return Form Card */}
          <Card>
            <CardHeader>
              <CardTitle>Return Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="returnDate">
                  Return Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="returnDate"
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setReturnDate(e.target.value)}
                  required
                  type="date"
                  value={returnDate}
                />
              </div>

              <div>
                <Label htmlFor="vehicleCondition">
                  Vehicle Condition <span className="text-red-500">*</span>
                </Label>
                <Select
                  onValueChange={(value: any) => setVehicleCondition(value)}
                  value={vehicleCondition}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="fuelLevel">
                  Fuel Level <span className="text-red-500">*</span>
                </Label>
                <Select onValueChange={(value: any) => setFuelLevel(value)} value={fuelLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="3/4">3/4</SelectItem>
                    <SelectItem value="1/2">1/2</SelectItem>
                    <SelectItem value="1/4">1/4</SelectItem>
                    <SelectItem value="empty">Empty</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="mileage">
                  Current Mileage <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="mileage"
                  min={0}
                  onChange={(e) => setMileage(e.target.value)}
                  placeholder="Enter current mileage"
                  required
                  type="number"
                  value={mileage}
                />
              </div>

              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional information about the vehicle condition..."
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
                        alt={`Return photo ${index + 1}`}
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
                  Upload photos of the vehicle condition (max 10MB per photo)
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button className="flex-1" disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Return Form"
              )}
            </Button>
            <Link href="/trips">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
