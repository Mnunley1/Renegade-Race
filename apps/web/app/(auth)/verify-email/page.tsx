"use client"

import { useSignUp } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { ArrowRight, Loader2, Mail } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type ClerkError = {
  errors?: Array<{ message: string }>
}

export default function VerifyEmailPage() {
  const { signUp, isLoaded, setActive } = useSignUp()
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState("")
  const [resendSuccess, setResendSuccess] = useState(false)
  const router = useRouter()

  // Redirect if sign-up is not in progress
  useEffect(() => {
    if (isLoaded && !signUp) {
      router.push("/sign-up")
    }
  }, [isLoaded, signUp, router])

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
        router.push("/")
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
      console.error("Resend verification code error:", clerkError)
      const errorMessage = clerkError?.errors?.[0]?.message || "Failed to resend code"
      setError(errorMessage)

      // Show helpful message if it's a rate limit or email issue
      if (errorMessage.includes("limit") || errorMessage.includes("email")) {
        setError(
          `${errorMessage}. In development mode, Clerk has a limit of 100 emails per month. Try using a test email with +clerk_test (e.g., yourname+clerk_test@example.com) or check your spam folder.`
        )
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
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="mb-2 font-bold text-3xl">Verify Your Email</h1>
        <p className="text-muted-foreground text-sm">
          We sent a verification code to <br />
          <span className="font-medium text-foreground">{signUp.emailAddress || "your email"}</span>
        </p>
      </div>

      <Card className="border-2 shadow-xl">
        <CardHeader>
          <CardTitle>Enter verification code</CardTitle>
          <CardDescription>
            Check your email for the 6-digit code and enter it below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
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
              <Label htmlFor="code">Verification Code</Label>
              <div className="relative">
                <Mail className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
                <Input
                  className="pl-10 text-center font-mono text-lg tracking-widest"
                  disabled={isLoading}
                  id="code"
                  maxLength={6}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  required
                  type="text"
                  value={code}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Enter the 6-digit code sent to your email
              </p>
              {signUp.emailAddress?.includes("+clerk_test") && (
                <p className="font-medium text-primary text-xs">
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

        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm">
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

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Wrong email? </span>
            <Link
              className="font-medium text-primary transition-colors hover:text-primary/80"
              href="/sign-up"
            >
              Go back
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
