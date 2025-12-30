"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { useMutation, useQuery } from "convex/react"
import { RotateCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { useOnboardingProtection } from "@/hooks/useOnboardingProtection"
import { SimpleOnboardingProgress } from "@/components/simple-onboarding-progress"
import { api } from "@/lib/convex"

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [showStartOverDialog, setShowStartOverDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const startOver = useMutation(api.users.startOverOnboarding)
  const draft = useQuery(api.users.getOnboardingDraft, {})
  const { showWarningDialog, handleConfirmLeave, handleCancelLeave } = useOnboardingProtection({
    enabled: true,
  })

  // Get current step from draft
  const currentStep = draft?.currentStep ? Math.max(1, Math.min(draft.currentStep, 5)) : 1

  const handleStartOver = async () => {
    setIsResetting(true)
    try {
      await startOver()
      toast.success("Onboarding reset. Starting fresh...")
      setShowStartOverDialog(false)
      router.push("/host/onboarding")
    } catch (error) {
      console.error("Failed to reset onboarding:", error)
      toast.error("An error occurred")
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <>
      <div className="container mx-auto max-w-2xl px-4 pt-4 md:pt-8">
        <div className="mb-0 flex flex-col gap-1.5 md:mb-2 md:flex-row md:gap-3 md:items-center md:justify-between">
          <div className="flex-1">
            <SimpleOnboardingProgress currentStep={currentStep} />
          </div>
          <div className="flex justify-center md:block">
            <Button
              onClick={() => setShowStartOverDialog(true)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <RotateCcw className="mr-2 size-4" />
              <span className="hidden sm:inline">Start Over</span>
              <span className="sm:hidden">Reset</span>
            </Button>
          </div>
        </div>
      </div>
      {children}
      {/* Start Over Confirmation Dialog */}
      <Dialog onOpenChange={setShowStartOverDialog} open={showStartOverDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Over?</DialogTitle>
            <DialogDescription>
              This will delete all your progress, including uploaded photos. You'll need to start
              from the beginning. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={isResetting}
              onClick={() => setShowStartOverDialog(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isResetting} onClick={handleStartOver} type="button" variant="destructive">
              {isResetting ? "Resetting..." : "Start Over"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Warning Dialog for Leaving Onboarding */}
      <Dialog onOpenChange={handleCancelLeave} open={showWarningDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Onboarding?</DialogTitle>
            <DialogDescription>
              All your progress will be lost if you leave now. Are you sure you want to continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleCancelLeave} type="button" variant="outline">
              Cancel
            </Button>
            <Button onClick={handleConfirmLeave} type="button" variant="destructive">
              Leave and Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}



