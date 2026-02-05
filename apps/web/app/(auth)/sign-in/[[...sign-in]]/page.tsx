"use client"

import { useSignIn, useUser } from "@clerk/nextjs"
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
import { Separator } from "@workspace/ui/components/separator"
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"

type ClerkError = {
  errors?: Array<{ message: string }>
}

// Helper function to safely get redirect URL
function getRedirectUrl(searchParams: URLSearchParams): string {
  const redirectUrl = searchParams.get("redirect_url")
  if (!redirectUrl) return "/"

  // Decode the URL
  const decoded = decodeURIComponent(redirectUrl)

  // Ensure it's a relative path (starts with /) and doesn't contain protocol
  if (decoded.startsWith("/") && !decoded.includes("://")) {
    // Block protocol-relative URLs and backslash bypasses
    if (
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      decoded.includes("\n") ||
      decoded.includes("\r")
    ) {
      return "/"
    }
    return decoded
  }

  // Fallback to home if invalid
  return "/"
}

function SignInPageContent() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const { isSignedIn, isLoaded: userLoaded } = useUser()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const searchParams = useSearchParams()

  // Memoize redirect URL to avoid recalculating
  const redirectUrl = useMemo(() => getRedirectUrl(searchParams), [searchParams])

  // Redirect if already authenticated
  useEffect(() => {
    if (userLoaded && isSignedIn) {
      window.location.href = redirectUrl
    }
  }, [isSignedIn, userLoaded, redirectUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded) {
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      })

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId })
        // Use window.location for full page navigation to ensure auth state is updated
        window.location.href = redirectUrl
      } else {
        setError("Unable to sign in. Please try again.")
        setIsLoading(false)
      }
    } catch (err: unknown) {
      const clerkError = err as ClerkError
      setError(clerkError?.errors?.[0]?.message || "Failed to sign in")
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="text-center">
        <h1 className="mb-1 font-bold text-2xl sm:mb-2 sm:text-3xl">Welcome Back</h1>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Sign in to access your account and continue your track car rental experience
        </p>
      </div>

      <Card className="border-2 bg-card shadow-xl">
        <CardHeader className="pb-4 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">Sign in to your account</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Enter your credentials below to access your account
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4 sm:pb-6">
          <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2 text-destructive text-xs sm:p-3 sm:text-sm">
                {error}
              </div>
            )}

            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-sm" htmlFor="email">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-10"
                  disabled={isLoading}
                  id="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm" htmlFor="password">
                  Password
                </Label>
                <Link
                  className="font-medium text-primary text-xs transition-colors hover:text-primary/80 sm:text-sm"
                  href="/reset-password"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pr-10 pl-10"
                  disabled={isLoading}
                  id="password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={(e) => {
                    e.preventDefault()
                    setShowPassword(!showPassword)
                  }}
                  type="button"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button className="w-full" disabled={isLoading} size="lg" type="submit">
              {isLoading ? "Signing in..." : "Sign in"}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 sm:space-y-4">
          <div className="relative w-full text-center text-xs sm:text-sm">
            <Separator className="absolute top-1/2 right-0 left-0" />
            <span className="relative z-10 bg-card px-2 text-muted-foreground">Or</span>
          </div>

          <div className="flex w-full flex-col gap-2 sm:gap-3">
            <Button
              className="w-full"
              disabled={isLoading || !isLoaded}
              onClick={() => {
                if (signIn) {
                  signIn.authenticateWithRedirect({
                    strategy: "oauth_google",
                    redirectUrl: "/",
                    redirectUrlComplete: redirectUrl,
                  })
                }
              }}
              type="button"
              variant="outline"
            >
              <svg className="mr-2 size-4" viewBox="0 0 24 24">
                <title>Google logo</title>
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="currentColor"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="currentColor"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="currentColor"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="currentColor"
                />
              </svg>
              <span className="hidden sm:inline">Continue with Google</span>
              <span className="sm:hidden">Google</span>
            </Button>

            <Button
              className="w-full"
              disabled={isLoading || !isLoaded}
              onClick={() => {
                if (signIn) {
                  signIn.authenticateWithRedirect({
                    strategy: "oauth_apple",
                    redirectUrl: "/",
                    redirectUrlComplete: redirectUrl,
                  })
                }
              }}
              type="button"
              variant="outline"
            >
              <svg className="mr-2 size-4" fill="currentColor" viewBox="0 0 24 24">
                <title>Apple logo</title>
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.08-1.85 4.38-3.74 4.25z" />
              </svg>
              <span className="hidden sm:inline">Continue with Apple</span>
              <span className="sm:hidden">Apple</span>
            </Button>
          </div>

          <div className="text-center text-xs sm:text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link
              className="font-medium text-primary transition-colors hover:text-primary/80"
              href="/sign-up"
            >
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3 sm:space-y-4">
          <div className="text-center">
            <h1 className="mb-1 font-bold text-2xl sm:mb-2 sm:text-3xl">Welcome Back</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Sign in to access your account and continue your track car rental experience
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <SignInPageContent />
    </Suspense>
  )
}
