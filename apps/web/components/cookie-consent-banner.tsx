"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { useCookieConsent } from "@/hooks/useCookieConsent"
import { loadSentry } from "@/lib/sentry-loader"
import { cn } from "@workspace/ui/lib/utils"

export function CookieConsentBanner() {
  const { needsConsent, acceptCookies, rejectCookies, isLoading } = useCookieConsent()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Only show banner if consent is needed and not loading
    if (!isLoading && needsConsent) {
      setIsVisible(true)
    }
  }, [needsConsent, isLoading])

  if (!isVisible) {
    return null
  }

  const handleAccept = async () => {
    acceptCookies()
    setIsVisible(false)
    // Initialize Sentry after consent is given
    await loadSentry()
  }

  const handleReject = () => {
    rejectCookies()
    setIsVisible(false)
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300",
        "border-border border-t bg-background/95 backdrop-blur-sm shadow-lg"
      )}
      role="dialog"
      aria-label="Cookie consent"
      aria-modal="false"
    >
      <Card className="border-0 rounded-none shadow-none">
        <div className="container mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 space-y-2">
              <p className="text-sm text-foreground">
                We use cookies to enhance your experience, analyze site usage, and assist in our
                error tracking efforts. By clicking "Accept", you consent to our use of cookies.{" "}
                <Link
                  href="/privacy"
                  className="text-primary underline hover:text-primary/80"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Learn more in our Privacy Policy
                </Link>
                .
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReject}
                className="w-full sm:w-auto"
              >
                Decline
              </Button>
              <Button
                size="sm"
                onClick={handleAccept}
                className="w-full sm:w-auto"
              >
                Accept
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
