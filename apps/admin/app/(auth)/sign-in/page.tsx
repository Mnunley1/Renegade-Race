"use client"

import { useSignIn, useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useEffect, useState, useMemo } from "react"
import Image from "next/image"

type ClerkError = {
  errors?: Array<{ message: string }>
}

function getRedirectUrl(searchParams: URLSearchParams): string {
  const redirectUrl = searchParams.get("redirect_url")
  if (!redirectUrl) return "/"
  
  const decoded = decodeURIComponent(redirectUrl)
  
  if (decoded.startsWith("/") && !decoded.includes("://")) {
    return decoded
  }
  
  return "/"
}

function AdminSignInPageContent() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const { isSignedIn, isLoaded: userLoaded } = useUser()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const redirectUrl = useMemo(() => getRedirectUrl(searchParams), [searchParams])
  const errorParam = searchParams.get("error")

  useEffect(() => {
    if (errorParam === "admin_required") {
      setError("Admin access required. Please sign in with an admin account.")
      // Remove error parameter from URL without page reload
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.delete("error")
      const newUrl = newSearchParams.toString()
        ? `${window.location.pathname}?${newSearchParams.toString()}`
        : window.location.pathname
      router.replace(newUrl, { scroll: false })
    }
  }, [errorParam, searchParams, router])

  // Redirect if already authenticated (but only if no error - meaning they're admin)
  useEffect(() => {
    if (userLoaded && isSignedIn && !error) {
      // Use window.location for full page navigation to ensure auth state is updated
      window.location.href = redirectUrl
    }
  }, [isSignedIn, userLoaded, redirectUrl, error])

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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <Image
              src="/logo.png"
              alt="Renegade Rentals Logo"
              width={120}
              height={120}
              className="rounded-full"
              priority
            />
          </div>
          <h1 className="mb-2 font-bold text-3xl">Admin Portal</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to access the admin dashboard
          </p>
        </div>

        <Card className="border-2 shadow-xl bg-card transition-none hover:shadow-xl">
          <CardHeader>
            <CardTitle>Admin Sign In</CardTitle>
            <CardDescription>Enter your admin credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    disabled={isLoading}
                    id="email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
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
                    className="pl-10 pr-10"
                    disabled={isLoading}
                    id="password"
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
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
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button className="w-full" disabled={isLoading} size="lg" type="submit">
                {isLoading ? "Signing in..." : "Sign in"}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function AdminSignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <Image
                  src="/logo.png"
                  alt="Renegade Rentals Logo"
                  width={120}
                  height={120}
                  className="rounded-full"
                  priority
                />
              </div>
              <h1 className="mb-2 font-bold text-3xl">Admin Portal</h1>
              <p className="text-muted-foreground text-sm">
                Sign in to access the admin dashboard
              </p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <AdminSignInPageContent />
    </Suspense>
  )
}

