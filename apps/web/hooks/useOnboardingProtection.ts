"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type UseOnboardingProtectionOptions = {
  enabled: boolean
}

export function useOnboardingProtection({ enabled }: UseOnboardingProtectionOptions) {
  const router = useRouter()
  const pathname = usePathname()
  const [showWarningDialog, setShowWarningDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }

    // Warn on browser navigation (refresh, close tab, etc.)
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [enabled])

  const handleCancelLeave = () => {
    setShowWarningDialog(false)
    setPendingNavigation(null)
  }

  const handleConfirmLeave = () => {
    setShowWarningDialog(false)
    if (pendingNavigation) {
      router.push(pendingNavigation)
    } else {
      router.push("/host/dashboard")
    }
    setPendingNavigation(null)
  }

  // Check if user is trying to navigate away from onboarding
  const checkNavigation = (targetPath: string) => {
    if (!enabled) return true

    const onboardingPaths = [
      "/host/onboarding",
      "/host/onboarding/personal-info",
      "/host/onboarding/goals",
      "/host/onboarding/location",
      "/host/onboarding/vehicle",
      "/host/onboarding/new-vehicle",
      "/host/onboarding/availability",
      "/host/onboarding/payout",
      "/host/onboarding/safety",
      "/host/onboarding/wizard",
    ]

    const isOnboardingPath = onboardingPaths.some((path) => pathname.startsWith(path))
    const isTargetOnboardingPath = onboardingPaths.some((path) => targetPath.startsWith(path))

    // Allow navigation within onboarding flow
    if (isOnboardingPath && isTargetOnboardingPath) {
      return true
    }

    // Allow navigation to completion page
    if (targetPath === "/host/onboarding/complete") {
      return true
    }

    // Block navigation away from onboarding
    if (isOnboardingPath && !isTargetOnboardingPath) {
      setPendingNavigation(targetPath)
      setShowWarningDialog(true)
      return false
    }

    return true
  }

  return {
    showWarningDialog,
    handleConfirmLeave,
    handleCancelLeave,
    checkNavigation,
  }
}
