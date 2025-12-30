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
import { Separator } from "@workspace/ui/components/separator"
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

type ClerkError = {
  errors?: Array<{ message: string }>
}

export default function SignUpPage() {
  const { signUp, isLoaded, setActive } = useSignUp()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded) {
      return
    }

    setIsLoading(true)
    setError("")

    try {
      // Create the sign-up
      const result = await signUp.create({
        firstName,
        lastName,
        emailAddress: email,
        password,
      })

      console.log("Sign-up result status:", result.status)
      console.log("Sign-up object:", {
        status: signUp.status,
        emailAddress: signUp.emailAddress,
        unverifiedFields: signUp.unverifiedFields,
      })

      // Check if email verification is needed
      if (result.status === "missing_requirements") {
        // Check if email verification is actually needed
        const needsEmailVerification =
          signUp.unverifiedFields?.includes("email_address") ||
          signUp.status === "missing_requirements"

        if (needsEmailVerification) {
          // Send email verification
          try {
            console.log("Preparing email verification...")
            const verifyResult = await signUp.prepareEmailAddressVerification({
              strategy: "email_code",
            })
            console.log("Email verification prepared:", verifyResult)
            // Redirect to verification page
            router.push("/verify-email")
          } catch (verifyErr: unknown) {
            const verifyError = verifyErr as ClerkError
            console.error("Email verification error:", verifyError)
            console.error("Full error details:", JSON.stringify(verifyError, null, 2))
            setError(
              verifyError?.errors?.[0]?.message ||
                "Account created but failed to send verification email. Please try resending from the verification page."
            )
            setIsLoading(false)
            // Still redirect to verification page so user can resend
            setTimeout(() => router.push("/verify-email"), 2000)
          }
        } else {
          // If sign-up is complete, redirect to home
          router.push("/")
        }
      } else if (result.status === "complete") {
        // Sign-up is complete, set active session
        if (result.createdSessionId && setActive) {
          await setActive({ session: result.createdSessionId })
        }
        router.push("/")
      } else {
        // Unknown status, redirect to verification page as fallback
        console.warn("Unknown sign-up status:", result.status)
        router.push("/verify-email")
      }
    } catch (err: unknown) {
      const clerkError = err as ClerkError
      console.error("Sign-up error:", clerkError)
      console.error("Full error details:", JSON.stringify(clerkError, null, 2))
      setError(clerkError?.errors?.[0]?.message || "Failed to create account")
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="mb-2 font-bold text-3xl">Create Your Account</h1>
        <p className="text-muted-foreground text-sm">
          Join Renegade and start experiencing track cars today
        </p>
      </div>

      <Card className="border-2 bg-card shadow-xl">
        <CardHeader>
          <CardTitle>Sign up for free</CardTitle>
          <CardDescription>Create your account to start renting track cars</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <div className="relative">
                  <User className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    disabled={isLoading}
                    id="firstName"
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    required
                    type="text"
                    value={firstName}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  disabled={isLoading}
                  id="lastName"
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                  type="text"
                  value={lastName}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
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

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
                <Input
                  className="pr-10 pl-10"
                  disabled={isLoading}
                  id="password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={(e) => {
                    e.preventDefault()
                    setShowPassword(!showPassword)
                  }}
                  type="button"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-muted-foreground text-sm">
                Must be at least 8 characters with a mix of letters and numbers
              </p>
            </div>

            {/* Clerk CAPTCHA widget */}
            <div data-cl-theme="auto" id="clerk-captcha" />

            <Button className="w-full" disabled={isLoading} size="lg" type="submit">
              {isLoading ? "Creating account..." : "Create account"}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <div className="relative w-full text-center text-sm">
            <Separator className="absolute top-1/2 right-0 left-0" />
            <span className="relative z-10 bg-card px-2 text-muted-foreground">
              Or sign up with
            </span>
          </div>

          <Button
            className="w-full"
            disabled={isLoading || !isLoaded}
            onClick={() => {
              if (signUp) {
                signUp.authenticateWithRedirect({
                  strategy: "oauth_google",
                  redirectUrl: "/",
                  redirectUrlComplete: "/",
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
            Continue with Google
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link
              className="font-medium text-primary transition-colors hover:text-primary/80"
              href="/sign-in"
            >
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
