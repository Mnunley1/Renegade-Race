"use client"

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { authReturnLink, safeReturnPath } from "@/lib/auth-return"

function SsoCallback() {
  const searchParams = useSearchParams()
  const returnPath = safeReturnPath(searchParams.get("redirect_url"))
  return (
    <AuthenticateWithRedirectCallback
      continueSignUpUrl={authReturnLink("/sign-up", returnPath)}
      signInFallbackRedirectUrl={returnPath}
      signInUrl={authReturnLink("/sign-in", returnPath)}
      signUpFallbackRedirectUrl={returnPath}
      signUpUrl={authReturnLink("/sign-up", returnPath)}
      verifyEmailAddressUrl={authReturnLink("/verify-email", returnPath)}
    />
  )
}

export default function SsoCallbackPage() {
  return (
    <Suspense fallback={<p>Completing sign in...</p>}>
      <SsoCallback />
    </Suspense>
  )
}
