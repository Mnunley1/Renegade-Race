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
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { ArrowLeft, Camera, Loader2, Upload, X } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { usePhotoUpload } from "@/hooks/usePhotoUpload"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

export default function DamageClaimPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const reservationId = params.reservationId as Id<"reservations">

  const reservation = useQuery(
    api.reservations.getById,
    reservationId ? { id: reservationId } : "skip"
  )

  const existingInvoices = useQuery(
    api.damageInvoices.getByReservation,
    reservationId ? { reservationId } : "skip"
  )

  const createDamageClaim = useMutation(api.damageInvoices.create)

  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { photos, isUploading, fileInputRef, handlePhotoUpload, handleRemovePhoto } =
    usePhotoUpload({ maxFiles: 10 })

  // Check if there's already an open claim
  const hasOpenClaim = existingInvoices?.some(
    (inv) => inv.status === "pending_review" || inv.status === "payment_pending"
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!(amount && description) || photos.length === 0) {
      toast.error("Please fill in all required fields and upload at least one photo")
      return
    }

    const amountCents = Math.round(Number.parseFloat(amount) * 100)
    if (Number.isNaN(amountCents) || amountCents < 100 || amountCents > 2_500_000) {
      toast.error("Amount must be between $1.00 and $25,000.00")
      return
    }

    setIsSubmitting(true)
    try {
      await createDamageClaim({
        reservationId,
        amount: amountCents,
        description,
        photos,
      })
      toast.success("Damage claim submitted successfully. An admin will review it shortly.")
      router.push("/host/reservations")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "submit damage claim",
        customMessages: {
          generic: "Failed to submit damage claim. Please try again.",
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (reservation === undefined || existingInvoices === undefined) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!reservation) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Reservation not found</p>
            <Button asChild className="mt-4">
              <Link href="/host/reservations">Back to Reservations</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Verify current user is the owner
  if (user?.id !== reservation.ownerId) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              You are not authorized to file a claim for this reservation
            </p>
            <Button asChild className="mt-4">
              <Link href="/host/reservations">Back to Reservations</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (reservation.status !== "completed") {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Damage claims can only be filed for completed reservations
            </p>
            <Button asChild className="mt-4">
              <Link href="/host/reservations">Back to Reservations</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (hasOpenClaim) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-2 font-semibold text-lg">Damage Claim Already Filed</p>
            <p className="text-muted-foreground">
              An open damage claim already exists for this reservation.
            </p>
            <Button asChild className="mt-4">
              <Link href="/host/reservations">Back to Reservations</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const vehicle = reservation.vehicle
  const vehicleName = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "Vehicle"

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Link href="/host/reservations">
        <Button className="mb-6" variant="ghost">
          <ArrowLeft className="mr-2 size-4" />
          Back to Reservations
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Report Damage - {vehicleName}</CardTitle>
          <CardDescription>
            File a damage claim for this completed rental. An admin will review your claim and, if
            approved, the renter will be sent a payment link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Damage Amount (USD) *</Label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  className="pl-7"
                  id="amount"
                  max="25000"
                  min="1"
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  step="0.01"
                  type="number"
                  value={amount}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Enter the repair/replacement cost between $1.00 and $25,000.00
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description of Damage *</Label>
              <Textarea
                id="description"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the damage in detail..."
                required
                rows={5}
                value={description}
              />
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>Evidence Photos * (at least 1 required)</Label>
              <div className="rounded-lg border-2 border-dashed p-6">
                <input
                  accept="image/*"
                  className="hidden"
                  multiple
                  onChange={handlePhotoUpload}
                  ref={fileInputRef}
                  type="file"
                />
                <div className="text-center">
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-8 animate-spin text-muted-foreground" />
                      <p className="text-muted-foreground text-sm">Uploading photos...</p>
                    </div>
                  ) : (
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                      variant="outline"
                    >
                      <Upload className="mr-2 size-4" />
                      Upload Photos
                    </Button>
                  )}
                </div>
              </div>

              {/* Photo Preview */}
              {photos.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {photos.map((photo, index) => (
                    <div
                      className="group relative aspect-video overflow-hidden rounded-lg border"
                      key={index}
                    >
                      <Image
                        alt={`Damage photo ${index + 1}`}
                        className="object-cover"
                        fill
                        sizes="(max-width: 768px) 33vw, 200px"
                        src={`https://ik.imagekit.io/renegaderace/${photo}?tr=w-300,h-200,q-80,f-auto`}
                      />
                      <button
                        className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => handleRemovePhoto(index)}
                        type="button"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-muted-foreground text-xs">
                <Camera className="mr-1 inline size-3" />
                Upload clear photos of the damage. Maximum 10 photos.
              </p>
            </div>

            {/* Submit */}
            <Button
              className="w-full"
              disabled={isSubmitting || isUploading || photos.length === 0}
              size="lg"
              type="submit"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Submitting Claim...
                </>
              ) : (
                "Submit Damage Claim"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
