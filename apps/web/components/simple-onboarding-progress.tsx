"use client"

import { CheckCircle2 } from "lucide-react"

const SIMPLE_STEPS = [
  { id: "vehicle", label: "Vehicle & Location" },
  { id: "photos", label: "Photos" },
  { id: "addons", label: "Add-ons" },
  { id: "availability", label: "Availability" },
  { id: "safety", label: "Safety & Terms" },
]

type SimpleOnboardingProgressProps = {
  currentStep?: number
}

export function SimpleOnboardingProgress({ currentStep = 1 }: SimpleOnboardingProgressProps) {
  // Use provided currentStep (1-indexed) and convert to 0-indexed for array access
  const currentStepIndex = Math.max(0, Math.min(currentStep - 1, SIMPLE_STEPS.length - 1))

  return (
    <div className="mb-2 md:mb-8">
      {/* Mobile: Compact view with smaller circles and no labels */}
      <div className="flex items-center justify-between md:hidden">
        {SIMPLE_STEPS.map((step, index) => {
          const isComplete = index < currentStepIndex
          const isCurrent = index === currentStepIndex

          return (
            <div className="flex flex-1 items-center" key={step.id}>
              <div className="flex flex-col items-center w-full">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 font-semibold transition-colors ${
                    isComplete
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted bg-muted text-muted-foreground"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <span className="text-xs">{index + 1}</span>
                  )}
                </div>
              </div>
              {index < SIMPLE_STEPS.length - 1 && (
                <div className="relative flex items-center px-1 flex-1 mx-1">
                  <div
                    className={`h-0.5 w-full transition-colors ${
                      isComplete ? "bg-primary" : "bg-muted"
                    }`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Desktop: Full view with labels */}
      <div className="hidden md:flex items-start">
        {SIMPLE_STEPS.map((step, index) => {
          const isComplete = index < currentStepIndex
          const isCurrent = index === currentStepIndex

          return (
            <div className="flex flex-1 items-start" key={step.id}>
              <div className="flex flex-col items-center w-full">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 font-semibold transition-colors ${
                    isComplete
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted bg-muted text-muted-foreground"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <span className="text-sm">{index + 1}</span>
                  )}
                </div>
                <div className="mt-2 text-center w-full px-1">
                  <p
                    className={`font-medium text-xs leading-tight ${
                      isCurrent || isComplete ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
              {index < SIMPLE_STEPS.length - 1 && (
                <div className="relative flex items-center px-2">
                  <div
                    className={`h-0.5 w-full transition-colors ${
                      isComplete ? "bg-primary" : "bg-muted"
                    }`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile: Show current step label below */}
      <div className="mt-3 text-center md:hidden">
        <p className="font-medium text-sm text-foreground">
          Step {currentStepIndex + 1} of {SIMPLE_STEPS.length}: {SIMPLE_STEPS[currentStepIndex]?.label}
        </p>
      </div>
    </div>
  )
}

