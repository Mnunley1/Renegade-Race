"use client"

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { AdminLayout } from "@/components/admin-layout"

function UnauthenticatedRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.push("/sign-in")
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-muted-foreground">Redirecting to sign in...</div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Authenticated>
        <AdminLayout>{children}</AdminLayout>
      </Authenticated>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <UnauthenticatedRedirect />
      </Unauthenticated>
    </>
  )
}
