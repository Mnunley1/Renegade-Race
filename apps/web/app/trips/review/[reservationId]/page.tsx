"use client"

import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { ArrowLeft, Loader2, Star, Upload, X } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import type { Id } from "@/lib/convex"
import { getImageKitUrl } from "@/lib/imagekit"
import { handleErrorWithContext } from "@/lib/error-handler"
import { usePhotoUpload } from "@/hooks/usePhotoUpload"

export default function ReviewSubmissionPage() {
  const { user } = useUser()
  const params = useParams()
  const router = useRouter()
  const reservationId = params.reservationId as string

  const [rating, setRating] = useState(0)
  const [communication, setCommunication] = useState(0)
  const [vehicleCondition, setVehicleCondition] = useState(0)
  const [professionalism, setProfessionalism] = useState(0)
  const [overallExperience, setOverallExperience] = useState(0)
  const [title, setTitle] = useState("")
  const [review, setReview] = useState("")
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

  const existingReview = useQuery(
    api.reviews.getByCompletion,
    completion?._id ? { completionId: completion._id as Id<"rentalCompletions"> } : "skip"
  )

  const submitReview = useMutation(api.rentalCompletions.submitReview)
  const updateReview = useMutation(api.reviews.updateReview)

  // Load existing review data if editing
  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating || 0)
      setCommunication(existingReview.communication || 0)
      setVehicleCondition(existingReview.vehicleCondition || 0)
      setProfessionalism(existingReview.professionalism || 0)
      setOverallExperience(existingReview.overallExperience || 0)
      setTitle(existingReview.title || "")
      setReview(existingReview.review || "")
      setPhotos(existingReview.photos || [])
    }
  }, [existingReview])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!completion?._id) {
      toast.error("Completion record not found")
      return
    }

    if (!(title && review)) {
      toast.error("Please fill in all required fields")
      return
    }

    if (rating === 0) {
      toast.error("Please select an overall rating")
      return
    }

    setIsSubmitting(true)
    try {
      if (existingReview) {
        // Update existing review
        await updateReview({
          reviewId: existingReview._id,
          rating,
          communication,
          vehicleCondition,
          professionalism,
          overallExperience,
          title,
          review,
          photos: photos.length > 0 ? photos : undefined,
        })
        toast.success("Review updated successfully")
      } else {
        // Create new review
        await submitReview({
          completionId: completion._id,
          rating,
          communication,
          vehicleCondition,
          professionalism,
          overallExperience,
          title,
          review,
          photos: photos.length > 0 ? photos : undefined,
        })
        toast.success("Review submitted successfully")
      }
      router.push("/trips")
    } catch (error) {
      handleErrorWithContext(error, {
        action: existingReview ? "update review" : "submit review",
        entity: "review",
        customMessages: {
          duplicate: "You have already submitted a review for this rental",
          generic: existingReview
            ? "Failed to update review. Please try again."
            : "Failed to submit review. Please try again.",
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const StarRating = ({
    value,
    onChange,
    label,
  }: {
    value: number
    onChange: (value: number) => void
    label: string
  }) => (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            className="transition-colors hover:opacity-80 focus:outline-none"
            key={star}
            onClick={() => onChange(star)}
            type="button"
          >
            <Star
              className={`size-6 ${
                star <= value ? "fill-primary text-primary" : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  )

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
  // Check if we're editing - wait for completion to load first
  const isEditing = completion !== undefined && !!existingReview

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
        <h1 className="mb-2 font-bold text-3xl">
          {isEditing ? "Edit Your Review" : "Write a Review"}
        </h1>
        <p className="text-muted-foreground">
          {isEditing
            ? "Update your review for this rental"
            : `Share your experience with ${vehicleName}`}
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

        {/* Review Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Your Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <StarRating label="Overall Rating *" onChange={setRating} value={rating} />

            <div className="grid gap-4 md:grid-cols-2">
              <StarRating label="Communication" onChange={setCommunication} value={communication} />
              <StarRating
                label="Vehicle Condition"
                onChange={setVehicleCondition}
                value={vehicleCondition}
              />
              <StarRating
                label="Professionalism"
                onChange={setProfessionalism}
                value={professionalism}
              />
              <StarRating
                label="Overall Experience"
                onChange={setOverallExperience}
                value={overallExperience}
              />
            </div>

            <div>
              <Label htmlFor="title">
                Review Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                maxLength={100}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your review a title"
                required
                value={title}
              />
            </div>

            <div>
              <Label htmlFor="review">
                Review <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="review"
                onChange={(e) => setReview(e.target.value)}
                placeholder="Share your experience..."
                required
                rows={6}
                value={review}
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
                Upload photos from your rental experience (max 10MB per photo)
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button className="flex-1" disabled={isSubmitting} type="submit">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {isEditing ? "Updating..." : "Submitting..."}
              </>
            ) : isEditing ? (
              "Update Review"
            ) : (
              "Submit Review"
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
