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
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { handleError } from "@/lib/error-handler"
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, Shield, Star, User, Zap } from "lucide-react"
import Image from "next/image"
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
  const [termsAccepted, setTermsAccepted] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded) {
      return
    }

    if (!termsAccepted) {
      setError("You must accept the Terms of Service and Privacy Policy to create an account.")
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

      // Check if email verification is needed
      if (result.status === "missing_requirements") {
        // Check if email verification is actually needed
        const needsEmailVerification =
          signUp.unverifiedFields?.includes("email_address") ||
          signUp.status === "missing_requirements"

        if (needsEmailVerification) {
          // Send email verification
          try {
            await signUp.prepareEmailAddressVerification({
              strategy: "email_code",
            })
            // Redirect to verification page
            router.push("/verify-email")
          } catch (verifyErr: unknown) {
            const verifyError = verifyErr as ClerkError
            handleError(verifyError, { showToast: false })
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
        router.push("/verify-email")
      }
    } catch (err: unknown) {
      const clerkError = err as ClerkError
      handleError(clerkError, { showToast: false })
      setError(clerkError?.errors?.[0]?.message || "Failed to create account")
      setIsLoading(false)
    }
  }

  const features = [
    {
      icon: Zap,
      title: "High-Performance Vehicles",
      description: "Access premium track cars from verified hosts",
    },
    {
      icon: Shield,
      title: "Verified Hosts",
      description: "All vehicles are from trusted, verified owners",
    },
    {
      icon: Star,
      title: "World-Class Tracks",
      description: "Experience racing on premier tracks nationwide",
    },
    {
      icon: CheckCircle2,
      title: "Easy Booking",
      description: "Simple, secure booking process",
    },
  ]

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      <div className="grid w-full max-w-6xl grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-12">
        {/* Left Column - Logo & Features */}
        <div className="flex flex-col justify-center space-y-3 px-4 sm:px-6 lg:space-y-8 lg:px-8">
          <div className="space-y-2 text-center lg:text-left">
            <div className="flex justify-center lg:justify-start">
              <Link className="inline-block transition-opacity hover:opacity-80" href="/">
                <Image
                  alt="Renegade Rentals"
                  className="rounded-full"
                  height={64}
                  src="/logo.png"
                  width={64}
                />
              </Link>
            </div>
            
            <div className="space-y-2">
              <h1 className="mb-1 font-bold text-2xl leading-tight tracking-tight sm:mb-2 sm:text-3xl lg:text-4xl">
                Experience the ultimate thrill of racing
              </h1>
              <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm lg:text-base">
                Rent high-performance track cars from verified hosts. Book your dream car today and
                feel the adrenaline rush on the world's best tracks.
              </p>
            </div>
          </div>

          <div className="hidden space-y-4 md:block">
            <h2 className="font-semibold text-lg sm:text-xl">Why choose Renegade?</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {features.map((feature) => {
                const Icon = feature.icon
                return (
                  <div className="flex items-start gap-3" key={feature.title}>
                    <div className="mt-0.5 flex-shrink-0">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium text-sm sm:text-base">{feature.title}</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column - Sign Up Form */}
        <div className="flex items-center justify-center">
          <Card className="w-full border-2 bg-card shadow-xl max-w-md">
            <CardHeader className="pb-4 sm:pb-6">
              <CardTitle className="text-lg sm:text-xl">Create Your Account</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Sign up to start renting track cars</CardDescription>
            </CardHeader>
            <CardContent className="pb-4 sm:pb-6">
              <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2 text-destructive text-xs sm:p-3 sm:text-sm">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="firstName" className="text-sm">First Name</Label>
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
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="lastName" className="text-sm">Last Name</Label>
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

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="email" className="text-sm">Email</Label>
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

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="password" className="text-sm">Password</Label>
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
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    Must be at least 8 characters with a mix of letters and numbers
                  </p>
                </div>

                {/* Clerk CAPTCHA widget */}
                <div data-cl-theme="auto" id="clerk-captcha" />

                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={termsAccepted}
                      id="terms"
                      onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                      required
                    />
                    <Label className="cursor-pointer text-xs sm:text-sm" htmlFor="terms">
                      I have read and agree to the{" "}
                      <Link
                        className="text-primary underline hover:text-primary/80"
                        href="/terms"
                        rel="noopener"
                        target="_blank"
                      >
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link
                        className="text-primary underline hover:text-primary/80"
                        href="/privacy"
                        rel="noopener"
                        target="_blank"
                      >
                        Privacy Policy
                      </Link>
                    </Label>
                  </div>
                </div>

                <Button className="w-full" disabled={isLoading || !termsAccepted} size="lg" type="submit">
                  {isLoading ? "Creating account..." : "Create account"}
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </form>
            </CardContent>

            <CardFooter className="flex flex-col space-y-3 sm:space-y-4">
              <div className="relative w-full text-center text-xs sm:text-sm">
                <Separator className="absolute top-1/2 right-0 left-0" />
                <span className="relative z-10 bg-card px-2 text-muted-foreground">
                  Or sign up with
                </span>
              </div>

              <div className="flex w-full flex-col gap-2 sm:gap-3">
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
                  <span className="hidden sm:inline">Continue with Google</span>
                  <span className="sm:hidden">Google</span>
                </Button>

                <Button
                  className="w-full"
                  disabled={isLoading || !isLoaded}
                  onClick={() => {
                    if (signUp) {
                      signUp.authenticateWithRedirect({
                        strategy: "oauth_apple",
                        redirectUrl: "/",
                        redirectUrlComplete: "/",
                      })
                    }
                  }}
                  type="button"
                  variant="outline"
                >
                  <svg className="mr-2 size-4" viewBox="0 0 24 24" fill="currentColor">
                    <title>Apple logo</title>
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.08-1.85 4.38-3.74 4.25z" />
                  </svg>
                  <span className="hidden sm:inline">Continue with Apple</span>
                  <span className="sm:hidden">Apple</span>
                </Button>
              </div>

              <div className="space-y-3 text-center">
                <div className="text-xs sm:text-sm">
                  <span className="text-muted-foreground">Already have an account? </span>
                  <Link
                    className="font-medium text-primary transition-colors hover:text-primary/80"
                    href="/sign-in"
                  >
                    Sign in
                  </Link>
                </div>
                <div className="text-xs text-muted-foreground">
                  By creating an account, you agree to our{" "}
                  <Link
                    className="text-primary underline hover:text-primary/80"
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    className="text-primary underline hover:text-primary/80"
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </Link>
                </div>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
