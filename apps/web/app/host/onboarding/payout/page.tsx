"use client"

import { Suspense } from "react"
import { AccountAuthBoundary } from "@/components/account-auth-boundary"
import { PayoutSetupContent } from "@/components/payout-recovery"

export default function PayoutSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-12">
          <output>Loading payment setup...</output>
        </div>
      }
    >
      <AccountAuthBoundary
        loadingLabel="Connecting to your payment setup..."
        signedOutDescription="Sign in to manage your payment setup."
      >
        {(user) => <PayoutSetupContent userId={user.id} />}
      </AccountAuthBoundary>
    </Suspense>
  )
}
