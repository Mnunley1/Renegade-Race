"use client"

import { useSignUp } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardFooter } from "@workspace/ui/components/card"
import { ArrowRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { OtpInput } from "@/components/auth/otp-input"
import { authReturnLink, safeReturnPath } from "@/lib/auth-return"
import { handleError } from "@/lib/error-handler"

type ClerkError = {
  errors?: Array<{ message: string }>
}

function VerifyEmailPageContent() {
  const { signUp, isLoaded, setActive } = useSignUp()
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState("")
  const [resendSuccess, setResendSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = safeReturnPath(searchParams.get("redirect_url"))

  // Redirect if sign-up is not in progress
  useEffect(() => {
    if (isLoaded && !signUp) {
      router.push(authReturnLink("/sign-up", redirectUrl))
    }
  }, [isLoaded, signUp, router, redirectUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!(isLoaded && signUp)) {
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      })

      if (result.status === "complete") {
        // Set the session and redirect
        await setActive({ session: result.createdSessionId })
        router.push(redirectUrl)
      } else {
        setError("Verification incomplete. Please try again.")
        setIsLoading(false)
      }
    } catch (err: unknown) {
      const clerkError = err as ClerkError
      setError(clerkError?.errors?.[0]?.message || "Invalid verification code")
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (!(isLoaded && signUp)) {
      return
    }

    setIsResending(true)
    setError("")

    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" })
      setResendSuccess(true)
      setTimeout(() => setResendSuccess(false), 5000)
    } catch (err: unknown) {
      const clerkError = err as ClerkError
      const errorMessage = clerkError?.errors?.[0]?.message || "Failed to resend code"
      handleError(err, { showToast: false, logError: true })

      // Show helpful message if it's a rate limit or email issue
      if (
        process.env.NODE_ENV === "development" &&
        (errorMessage.includes("limit") || errorMessage.includes("email"))
      ) {
        setError(
          `${errorMessage}. In development mode, Clerk has a limit of 100 emails per month. Try using a test email with +clerk_test (e.g., yourname+clerk_test@example.com) or check your spam folder.`
        )
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsResending(false)
    }
  }

  if (!(isLoaded && signUp)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="text-center">
        <h1 className="mb-1 font-bold text-2xl sm:mb-2 sm:text-3xl">Verify Your Email</h1>
        <p className="text-muted-foreground text-xs sm:text-sm">
          We sent a verification code to <br />
          <span className="font-medium text-foreground">{signUp.emailAddress || "your email"}</span>
        </p>
      </div>

      <Card className="border bg-card shadow-sm">
        <CardContent className="p-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
                {error}
              </div>
            )}

            {resendSuccess && (
              <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-green-700 text-sm dark:text-green-400">
                Verification code sent! Please check your email.
              </div>
            )}

            <div className="space-y-2">
              <OtpInput
                autoFocus
                disabled={isLoading}
                hasError={Boolean(error)}
                onChange={(v) => setCode(v)}
                value={code}
              />
              {process.env.NODE_ENV === "development" &&
                signUp.emailAddress?.includes("+clerk_test") && (
                  <p className="text-center font-medium text-primary text-xs">
                    Using test email? Use code: <span className="font-mono">424242</span>
                  </p>
                )}
            </div>

            <Button
              className="w-full"
              disabled={isLoading || code.length !== 6}
              size="lg"
              type="submit"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify email
                  <ArrowRight className="ml-2 size-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 sm:space-y-4">
          <div className="text-center text-xs sm:text-sm">
            <p className="mb-2 text-muted-foreground">Didn't receive the code?</p>
            <Button
              className="w-full"
              disabled={isResending || !isLoaded}
              onClick={handleResendCode}
              type="button"
              variant="outline"
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Resend verification code"
              )}
            </Button>
          </div>

          <div className="text-center text-xs sm:text-sm">
            <span className="text-muted-foreground">Wrong email? </span>
            <Link
              className="font-medium text-primary transition-colors hover:text-primary/80"
              href={authReturnLink("/sign-up", redirectUrl)}
            >
              Go back
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <VerifyEmailPageContent />
    </Suspense>
  )
}
