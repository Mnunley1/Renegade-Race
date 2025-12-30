"use client"

import { useUser } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { api } from "@/lib/convex"
import { OnboardingFlow } from "@/components/onboarding-flow"

export default function HostOnboardingPage() {
  const { user } = useUser()
  const router = useRouter()
  const onboardingStatus = useQuery(api.users.getHostOnboardingStatus, user?.id ? {} : "skip")
  const draft = useQuery(api.users.getOnboardingDraft, user?.id ? {} : "skip")

  useEffect(() => {
    // Wait for user to be loaded
    if (!user?.id) {
      return
    }

    // Wait for queries to complete (undefined means still loading, null means no data)
    if (onboardingStatus === undefined || draft === undefined) {
      return
    }

    // If already completed, redirect to dashboard
    if (onboardingStatus?.status === "completed") {
      router.push("/host/dashboard")
      return
    }
  }, [onboardingStatus, draft, user?.id, router])

  // Determine initial step
  const getInitialStep = () => {
    if (draft?.currentStep) {
      // Ensure step is within valid range (1-5)
      return Math.max(1, Math.min(draft.currentStep, 5))
    }
    return 1
  }

  if (onboardingStatus === undefined || draft === undefined) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading onboarding...</p>
          </div>
        </div>
      </div>
    )
  }

  return <OnboardingFlow initialStep={getInitialStep()} />
}
