"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { useCookieConsent } from "@/hooks/useCookieConsent"
import { loadSentry } from "@/lib/sentry-loader"

export default function CookiePreferencesPage() {
  const router = useRouter()
  const { consentStatus, acceptCookies, rejectCookies, isLoading } = useCookieConsent()
  const [hasChanged, setHasChanged] = useState(false)

  const handleAccept = async () => {
    acceptCookies()
    setHasChanged(true)
    // Initialize Sentry if consent was given
    await loadSentry()
    // Reload page to ensure Sentry is fully initialized
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  const handleReject = () => {
    rejectCookies()
    setHasChanged(true)
    // Reload page to ensure Sentry is disabled
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="mb-4 font-bold text-4xl md:text-5xl">Cookie Preferences</h1>
        <p className="text-lg text-muted-foreground">
          Manage your cookie preferences for this website
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cookie Settings</CardTitle>
          <CardDescription>
            We use cookies to enhance your experience and help us improve our service. You can
            choose to accept or decline non-essential cookies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 font-semibold text-lg">Essential Cookies</h3>
              <p className="text-muted-foreground text-sm">
                These cookies are necessary for the website to function properly. They include
                authentication cookies, session management, and security features. These cookies
                cannot be disabled.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="mb-2 font-semibold text-lg">Analytics & Error Tracking</h3>
              <p className="mb-4 text-muted-foreground text-sm">
                We use these cookies to track errors and improve our service. This helps us identify
                and fix issues that users encounter. You can choose to disable these cookies below.
              </p>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">Error Tracking (Sentry)</p>
                    <p className="text-muted-foreground text-sm">
                      Helps us identify and fix bugs and errors
                    </p>
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {isLoading ? (
                      "Loading..."
                    ) : consentStatus === "accepted" ? (
                      <span className="text-green-600">Enabled</span>
                    ) : (
                      <span className="text-muted-foreground">Disabled</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={consentStatus === "rejected"}
            >
              Decline All Non-Essential Cookies
            </Button>
            <Button onClick={handleAccept} disabled={consentStatus === "accepted"}>
              Accept All Cookies
            </Button>
          </div>

          {hasChanged && (
            <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
              <p className="text-green-700 text-sm dark:text-green-400">
                Your cookie preferences have been saved. The page will refresh to apply changes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Learn More</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            For more information about how we use cookies and handle your data, please read our{" "}
            <a href="/privacy" className="text-primary underline hover:text-primary/80">
              Privacy Policy
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
