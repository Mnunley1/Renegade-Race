"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { useQuery } from "convex/react"
import { CheckCircle2, Circle } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/convex"

type HostOnboardingChecklistProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ONBOARDING_STEPS = [
  { id: "location", label: "Vehicle Location", route: "/host/onboarding/location" },
  { id: "personalInfo", label: "Personal Information", route: "/host/onboarding/personal-info" },
  { id: "vehicleAdded", label: "Add Vehicle", route: "/host/onboarding/new-vehicle" },
  { id: "availability", label: "Set Availability", route: "/host/onboarding/availability" },
  { id: "payoutSetup", label: "Payout Setup", route: "/host/onboarding/payout" },
  { id: "safetyStandards", label: "Safety & Quality Standards", route: "/host/onboarding/safety" },
]

export function HostOnboardingChecklist({ open, onOpenChange }: HostOnboardingChecklistProps) {
  const onboardingStatus = useQuery(api.users.getHostOnboardingStatus, {})

  if (!onboardingStatus) {
    return null
  }

  const { status, steps } = onboardingStatus

  // Determine which steps are complete based on backend tracking
  const stepStatus = {
    location: steps.personalInfo, // If personalInfo is done, location is likely done
    personalInfo: steps.personalInfo,
    vehicleAdded: steps.vehicleAdded,
    availability: steps.vehicleAdded, // Availability is optional, mark complete if vehicle added
    payoutSetup: steps.payoutSetup, // Optional step
    safetyStandards: steps.safetyStandards,
  }

  // Find the first incomplete step
  const firstIncompleteStep = ONBOARDING_STEPS.find(
    (step) => !stepStatus[step.id as keyof typeof stepStatus]
  )

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-bold text-2xl">List your car</DialogTitle>
          <DialogDescription>
            Complete these steps to start hosting on Renegade Rentals
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-3">
          {ONBOARDING_STEPS.map((step, index) => {
            const isComplete = stepStatus[step.id as keyof typeof stepStatus]
            const isCurrent = firstIncompleteStep?.id === step.id

            return (
              <div
                className={`flex items-center gap-3 rounded-lg border p-4 transition-colors ${
                  isCurrent ? "border-primary bg-primary/5" : ""
                }`}
                key={step.id}
              >
                <div className="shrink-0">
                  {isComplete ? (
                    <CheckCircle2 className="size-6 text-green-600" />
                  ) : (
                    <Circle className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{index + 1}.</span>
                    <span className={isComplete ? "text-muted-foreground line-through" : ""}>
                      {step.label}
                    </span>
                  </div>
                </div>
                {!isComplete && isCurrent && (
                  <Link href={step.route}>
                    <Button size="sm" variant="default">
                      Start
                    </Button>
                  </Link>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Close
          </Button>
          {firstIncompleteStep && (
            <Link href={firstIncompleteStep.route}>
              <Button>Continue to {firstIncompleteStep.label}</Button>
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}



