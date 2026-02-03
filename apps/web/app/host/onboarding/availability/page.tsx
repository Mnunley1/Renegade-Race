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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useMutation, useQuery } from "convex/react"
import { ArrowRight, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

const ADVANCE_NOTICE_OPTIONS = [
  { value: "same-day", label: "Same day" },
  { value: "1-day", label: "1 day (recommended)" },
  { value: "2-days", label: "2 days" },
  { value: "3-days", label: "3 days" },
  { value: "1-week", label: "1 week" },
]

const TRIP_DURATION_OPTIONS = [
  { value: "1-day", label: "1 day (recommended)" },
  { value: "2-days", label: "2 days" },
  { value: "3-days", label: "3 days" },
  { value: "1-week", label: "1 week" },
  { value: "2-weeks", label: "2 weeks" },
  { value: "3-weeks", label: "3 weeks (recommended)" },
  { value: "1-month", label: "1 month" },
  { value: "2-months", label: "2 months" },
  { value: "3-months", label: "3 months" },
  { value: "unlimited", label: "Unlimited" },
]

export default function AvailabilityPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const draft = useQuery(api.users.getOnboardingDraft, {})
  const saveDraft = useMutation(api.users.saveOnboardingDraft)

  const [advanceNotice, setAdvanceNotice] = useState("1-day")
  const [minTripDuration, setMinTripDuration] = useState("1-day")
  const [maxTripDuration, setMaxTripDuration] = useState("3-weeks")
  const [requireWeekendMin, setRequireWeekendMin] = useState(false)

  // Load existing settings from draft
  useEffect(() => {
    if (draft?.vehicleData) {
      if (draft.vehicleData.advanceNotice) {
        setAdvanceNotice(draft.vehicleData.advanceNotice)
      }
      if (draft.vehicleData.minTripDuration) {
        setMinTripDuration(draft.vehicleData.minTripDuration)
      }
      if (draft.vehicleData.maxTripDuration) {
        setMaxTripDuration(draft.vehicleData.maxTripDuration)
      }
      if (draft.vehicleData.requireWeekendMin !== undefined) {
        setRequireWeekendMin(draft.vehicleData.requireWeekendMin)
      }
    }
  }, [draft])

  const handleContinue = async () => {
    if (!(draft?.vehicleData && draft?.address)) {
      toast.error("Missing vehicle data. Please go back and complete previous steps.")
      return
    }

    setIsSubmitting(true)
    try {
      // Update draft with availability settings
      await saveDraft({
        vehicleData: {
          ...draft.vehicleData,
          advanceNotice,
          minTripDuration,
          maxTripDuration,
          requireWeekendMin,
        },
        currentStep: 5, // Save next step (safety)
      })

      router.push("/host/onboarding/safety")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "save availability",
        customMessages: {
          generic: "Failed to save availability. Please try again.",
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-4 md:py-16">
      <div className="mb-4 md:mb-8">
        <h1 className="mb-2 font-bold text-3xl">Availability</h1>
        <p className="text-muted-foreground">
          Set when your vehicle is available for rent. You can update this anytime from your
          dashboard.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default Availability Settings</CardTitle>
          <CardDescription>
            Configure your vehicle's default availability rules. You can update these anytime from
            your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Advance Notice */}
          <div className="space-y-4">
            <div>
              <h3 className="mb-1 font-semibold">Advance notice</h3>
              <p className="text-muted-foreground text-sm">
                How much advance notice do you need before a trip starts?
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="advanceNotice">Advance notice</Label>
              <Select onValueChange={setAdvanceNotice} value={advanceNotice}>
                <SelectTrigger id="advanceNotice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADVANCE_NOTICE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Trip Duration */}
          <div className="space-y-4">
            <div>
              <h3 className="mb-1 font-semibold">Trip duration</h3>
              <p className="text-muted-foreground text-sm">
                What's the shortest and longest possible trip you'll accept?
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="minTripDuration">Minimum trip duration</Label>
                <Select onValueChange={setMinTripDuration} value={minTripDuration}>
                  <SelectTrigger id="minTripDuration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIP_DURATION_OPTIONS.filter((opt) => opt.value !== "unlimited").map(
                      (option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                <Checkbox
                  checked={requireWeekendMin}
                  id="requireWeekendMin"
                  onCheckedChange={(checked) => setRequireWeekendMin(checked === true)}
                />
                <Label
                  className="cursor-pointer font-normal leading-tight"
                  htmlFor="requireWeekendMin"
                >
                  Require a 2-day minimum for trips that start Friday, Saturday, or Sunday
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxTripDuration">Maximum trip duration</Label>
                <Select onValueChange={setMaxTripDuration} value={maxTripDuration}>
                  <SelectTrigger id="maxTripDuration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIP_DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Button disabled={isSubmitting} onClick={handleContinue}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue to Safety
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
