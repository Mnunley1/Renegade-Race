"use client"

import { useAuth, useReverification } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useAction, useQuery } from "convex/react"
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { useAccountActivity } from "@/hooks/useAccountAuth"
import { api } from "@/lib/convex"
import { openStripeSetup } from "@/lib/payout-navigation"

export type PayoutRecoveryStatus = {
  state: "held" | "setup_in_progress" | "ready_for_review"
  canStart: boolean
  canContinue: boolean
  message: string
}

function recoveryTitle(status: PayoutRecoveryStatus) {
  return status.state === "ready_for_review"
    ? "Payment setup ready for review"
    : "Finish payment setup"
}

/** A navigation prompt only: viewing a dashboard must never start onboarding. */
export function PayoutRecoveryNotice({ status }: { status: PayoutRecoveryStatus }) {
  return (
    <section
      aria-label="Payment setup"
      className="mb-6 flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <h2 className="font-semibold">{recoveryTitle(status)}</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            {status.state === "ready_for_review"
              ? "Your setup is ready for review. New rental payments remain on hold."
              : "Verify your payment setup before accepting rental payments. Your reservations and history stay available."}
          </p>
        </div>
      </div>
      <Button asChild className="shrink-0" size="sm">
        <Link href="/host/onboarding/payout">
          {status.state === "ready_for_review" ? "View payment setup" : "Finish payment setup"}
          <ArrowRight aria-hidden="true" className="ml-2 size-4" />
        </Link>
      </Button>
    </section>
  )
}

/** Mounted inside AccountAuthBoundary so callbacks and state belong to one session. */
export function PayoutSetupContent({ userId }: { userId: string }) {
  const status = useQuery(api.payoutRecovery.getMyStatus, {})
  const searchParams = useSearchParams()
  const stripeReturn = searchParams.get("stripe_return") === "1"
  const stripeRefresh = searchParams.get("stripe_refresh") === "1"
  let content: ReactNode
  if (status === undefined) {
    content = (
      <output className="flex items-center gap-2 text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        Loading payment setup...
      </output>
    )
  } else if (status) {
    content = (
      <PayoutRecoveryPanel
        status={status}
        stripeRefresh={stripeRefresh}
        stripeReturn={stripeReturn}
      />
    )
  } else {
    content = <LegacyPayoutSetup userId={userId} />
  }
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <Link
        className="mb-6 inline-block text-muted-foreground text-sm hover:text-foreground"
        href="/host/dashboard"
      >
        ← Back to dashboard
      </Link>
      <h1 className="mb-2 font-bold text-3xl tracking-tight">Payment setup</h1>
      <p className="mb-6 text-muted-foreground">
        Manage the account used for your Renegade rental payments.
      </p>
      {content}
    </div>
  )
}

function PayoutRecoveryPanel({
  status,
  stripeReturn,
  stripeRefresh,
}: {
  status: PayoutRecoveryStatus
  stripeReturn: boolean
  stripeRefresh: boolean
}) {
  const { getToken } = useAuth()
  const isCurrentAccount = useAccountActivity()
  const startOnboarding = useAction(api.payoutRecovery.startOnboarding)
  const refreshStatus = useAction(api.payoutRecovery.refreshMyStatus)
  const inFlight = useRef(false)
  const returnChecked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startWithVerification = useReverification(async () => {
    if (!isCurrentAccount()) throw new Error("Account session changed")
    const reauthToken = await getToken({ skipCache: true })
    if (!isCurrentAccount()) throw new Error("Account session changed")
    if (!reauthToken) throw new Error("Account verification unavailable")
    const result = await startOnboarding({ reauthToken })
    if (!isCurrentAccount()) throw new Error("Account session changed")
    // Returning Clerk's response unchanged lets the SDK own verification and retry.
    return result
  })

  const checkStatus = useCallback(async () => {
    if (inFlight.current || !isCurrentAccount()) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      await refreshStatus({})
    } catch {
      if (isCurrentAccount())
        setError("We couldn’t check your setup. Payments remain on hold. Please try again.")
    } finally {
      inFlight.current = false
      if (isCurrentAccount()) setBusy(false)
    }
  }, [refreshStatus, isCurrentAccount])

  // Return flags are hints to re-read provider state, never proof of verification.
  // An expired link is recreated only by the explicit Continue setup button.
  useEffect(() => {
    if (!stripeReturn || returnChecked.current) return
    returnChecked.current = true
    void checkStatus()
  }, [stripeReturn, checkStatus])

  async function start() {
    if (inFlight.current || !isCurrentAccount()) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await startWithVerification()
      if (!isCurrentAccount()) return
      if (result && "url" in result) {
        openStripeSetup(result.url)
      }
    } catch {
      if (isCurrentAccount())
        setError("We couldn’t open payment setup. Payments remain on hold. Please try again.")
    } finally {
      inFlight.current = false
      if (isCurrentAccount()) setBusy(false)
    }
  }

  const setupAllowed =
    status.state !== "ready_for_review" && (status.canStart || status.canContinue)
  return (
    <Card>
      <CardHeader>
        <Badge className="mb-3 w-fit" variant="secondary">
          Payments on hold
        </Badge>
        <CardTitle>{recoveryTitle(status)}</CardTitle>
        <CardDescription>{status.message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {status.state === "ready_for_review" ? (
          <p className="text-sm">
            Your payment setup is ready for review. Payments remain on hold until the review and
            approval are complete.
          </p>
        ) : (
          <p className="text-sm">
            Complete payment setup securely with Stripe. We may ask you to verify your sign-in
            first. Your existing reservations and account history stay in place.
          </p>
        )}
        {stripeRefresh && (
          <output className="block text-muted-foreground text-sm">
            Your Stripe link expired or was already used. Payments remain on hold.
          </output>
        )}
        {stripeReturn && (
          <p className="text-muted-foreground text-sm">
            We’re checking the setup you returned from. Returning from Stripe does not automatically
            enable payments.
          </p>
        )}
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {setupAllowed && (
            <Button disabled={busy} onClick={start}>
              {busy ? <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" /> : null}
              {status.canContinue ? "Continue setup" : "Start secure setup"}
            </Button>
          )}
          <Button disabled={busy} onClick={checkStatus} variant="outline">
            {busy && !setupAllowed ? (
              <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
            ) : null}
            Check status
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Completing setup does not automatically lift the payment hold. Enter bank details only on
          Stripe. Never send passwords or verification codes to support.
        </p>
      </CardContent>
    </Card>
  )
}

function LegacyPayoutSetup({ userId }: { userId: string }) {
  const isCurrentAccount = useAccountActivity()
  const fetchStatus = useAction(api.stripe.getConnectAccountStatus)
  const begin = useAction(api.stripe.createConnectAccount)
  const dashboard = useAction(api.stripe.createConnectLoginLink)
  const [status, setStatus] = useState<{ hasAccount: boolean; isComplete: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  useEffect(() => {
    void fetchStatus({ ownerId: userId })
      .then((result) => {
        if (isCurrentAccount()) setStatus(result)
      })
      .catch(() => {
        if (isCurrentAccount())
          setError("We couldn’t load your payment setup. Please refresh the page.")
      })
  }, [fetchStatus, userId, isCurrentAccount])

  async function open() {
    if (inFlight.current || !isCurrentAccount()) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const result = status?.isComplete
        ? await dashboard({ ownerId: userId })
        : await begin({ ownerId: userId, returnUrlBase: window.location.origin })
      if (!isCurrentAccount()) return
      const target = "url" in result ? result.url : result.onboardingUrl
      if (target) {
        openStripeSetup(target)
      } else {
        const latest = await fetchStatus({ ownerId: userId })
        if (isCurrentAccount()) setStatus(latest)
      }
    } catch {
      if (isCurrentAccount()) setError("We couldn’t open Stripe. Please try again.")
    } finally {
      inFlight.current = false
      if (isCurrentAccount()) setBusy(false)
    }
  }
  let buttonLabel = "Set up payouts"
  if (busy) buttonLabel = "Working..."
  else if (status?.isComplete) buttonLabel = "Open Stripe dashboard"
  else if (status?.hasAccount) buttonLabel = "Continue setup"
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stripe payment account</CardTitle>
        <CardDescription>Set up or manage your connected Stripe account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button disabled={busy || !status} onClick={open}>
          {buttonLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
