"use client"

import { useEffect, useState } from "react"

const COOKIE_CONSENT_KEY = "cookie-consent"
const COOKIE_CONSENT_VERSION = "1.0"

export type CookieConsentStatus = "pending" | "accepted" | "rejected" | null

interface CookieConsentData {
  status: CookieConsentStatus
  version: string
  timestamp: number
}

/**
 * Hook to manage cookie consent state
 * Stores consent preference in localStorage
 */
export function useCookieConsent() {
  const [consentStatus, setConsentStatus] = useState<CookieConsentStatus>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") {
      return
    }

    try {
      const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
      if (stored) {
        const data: CookieConsentData = JSON.parse(stored)
        // Check if consent version matches (allows for future policy updates)
        if (data.version === COOKIE_CONSENT_VERSION) {
          setConsentStatus(data.status)
        } else {
          // Version mismatch - treat as pending (user needs to re-consent)
          setConsentStatus("pending")
        }
      } else {
        // No stored consent - user hasn't made a choice yet
        setConsentStatus("pending")
      }
    } catch {
      // If parsing fails, treat as pending
      setConsentStatus("pending")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const acceptCookies = () => {
    const data: CookieConsentData = {
      status: "accepted",
      version: COOKIE_CONSENT_VERSION,
      timestamp: Date.now(),
    }
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(data))
      setConsentStatus("accepted")
    } catch {
      // If localStorage fails, still update state (graceful degradation)
      setConsentStatus("accepted")
    }
  }

  const rejectCookies = () => {
    const data: CookieConsentData = {
      status: "rejected",
      version: COOKIE_CONSENT_VERSION,
      timestamp: Date.now(),
    }
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(data))
      setConsentStatus("rejected")
    } catch {
      // If localStorage fails, still update state (graceful degradation)
      setConsentStatus("rejected")
    }
  }

  const hasConsented = consentStatus === "accepted"
  const hasRejected = consentStatus === "rejected"
  const needsConsent = consentStatus === "pending"

  return {
    consentStatus,
    isLoading,
    hasConsented,
    hasRejected,
    needsConsent,
    acceptCookies,
    rejectCookies,
  }
}
