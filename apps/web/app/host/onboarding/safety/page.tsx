"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import { useMutation, useQuery } from "convex/react"
import { ArrowRight, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import type { Id } from "@/lib/convex"

export default function SafetyPage() {
  const router = useRouter()
  const [acknowledged, setAcknowledged] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const draft = useQuery(api.users.getOnboardingDraft, {})
  const createVehicleWithImages = useMutation(api.vehicles.createVehicleWithImages)
  const updateOnboardingStep = useMutation(api.users.updateHostOnboardingStep)
  const completeOnboarding = useMutation(api.users.completeHostOnboarding)

  const handleSubmit = async () => {
    if (!(acknowledged && termsAccepted)) {
      toast.error("Please acknowledge all requirements")
      return
    }

    if (!draft?.vehicleData || !draft?.address) {
      toast.error("Missing vehicle data. Please go back and complete previous steps.")
      return
    }

    // Get images from draft (preferred) or sessionStorage (fallback for backward compatibility)
    let images: Array<{ r2Key: string; isPrimary: boolean; order: number }> = []
    if (draft.images && draft.images.length > 0) {
      images = draft.images
    } else if (typeof window !== "undefined") {
      // Fallback to sessionStorage for backward compatibility
      const imagesStr = sessionStorage.getItem("onboarding_images")
      if (imagesStr) {
        try {
          images = JSON.parse(imagesStr)
        } catch {
          // Invalid JSON
        }
      }
    }

    if (images.length === 0) {
      toast.error("Please upload at least one photo")
      router.push("/host/onboarding/photos")
      return
    }

    setIsSubmitting(true)
    try {
      // Create vehicle with all data
      const vehicleId = await createVehicleWithImages({
        trackId: draft.vehicleData.trackId
          ? (draft.vehicleData.trackId as Id<"tracks">)
          : undefined,
        make: draft.vehicleData.make,
        model: draft.vehicleData.model,
        year: draft.vehicleData.year,
        dailyRate: draft.vehicleData.dailyRate,
        description: draft.vehicleData.description,
        amenities: draft.vehicleData.amenities || [],
        addOns: draft.vehicleData.addOns || [],
        address: draft.address,
        advanceNotice: draft.vehicleData.advanceNotice,
        minTripDuration: draft.vehicleData.minTripDuration,
        maxTripDuration: draft.vehicleData.maxTripDuration,
        requireWeekendMin: draft.vehicleData.requireWeekendMin,
        images,
      })


      // Mark steps as complete
      await updateOnboardingStep({
        step: "vehicleAdded",
        completed: true,
      })

      await updateOnboardingStep({
        step: "safetyStandards",
        completed: true,
      })

      // Complete onboarding
      await completeOnboarding()

      // Clear sessionStorage
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("onboarding_images")
      }

      toast.success("Vehicle listing submitted successfully!")
      router.push("/host/onboarding/complete")
    } catch (error) {
      console.error("Failed to submit listing:", error)
      toast.error("An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (draft === undefined) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-4 md:py-16">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!draft?.vehicleData || !draft?.address) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-4 md:py-16">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">
              Please complete the previous steps first.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-4 md:py-16">
      <div className="mb-4 md:mb-8">
        <h1 className="mb-2 font-bold text-3xl">Safety & Quality Standards</h1>
        <p className="text-muted-foreground">
          Review and acknowledge our safety requirements and quality standards.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Host Requirements</CardTitle>
          <CardDescription>
            Ensure your vehicle meets our safety and quality standards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Vehicle Requirements</h3>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>Vehicle must be in good working condition</li>
              <li>All safety equipment must be functional</li>
              <li>Vehicle must be properly insured</li>
              <li>Track-ready vehicles must meet track safety standards</li>
              <li>All modifications must be disclosed</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Photo Requirements</h3>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>At least one high-quality photo required</li>
              <li>Photos must accurately represent the vehicle</li>
              <li>Include photos of any damage or wear</li>
              <li>Show interior, exterior, and key features</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Host Responsibilities</h3>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>Respond to booking requests promptly</li>
              <li>Maintain vehicle in listed condition</li>
              <li>Provide accurate vehicle information</li>
              <li>Follow all platform policies and guidelines</li>
            </ul>
          </div>

          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={acknowledged}
                id="acknowledged"
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
              />
              <Label className="cursor-pointer font-normal" htmlFor="acknowledged">
                I acknowledge that my vehicle meets all safety and quality requirements listed above
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                checked={termsAccepted}
                id="terms"
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              />
              <Label className="cursor-pointer font-normal" htmlFor="terms">
                I have read and agree to the{" "}
                <a className="text-primary underline" href="/terms" rel="noopener" target="_blank">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  className="text-primary underline"
                  href="/privacy"
                  rel="noopener"
                  target="_blank"
                >
                  Privacy Policy
                </a>
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Button disabled={!(acknowledged && termsAccepted) || isSubmitting} onClick={handleSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit Listing
                  <ArrowRight className="ml-2 size-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

