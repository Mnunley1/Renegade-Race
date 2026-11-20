"use client"

import { Card, CardContent } from "@workspace/ui/components/card"
import { MessageSquare } from "lucide-react"
import { Fragment, type ReactNode } from "react"
import { useAccountAuth } from "@/hooks/useAccountAuth"

export function AccountAuthBoundary({
  children,
  loadingLabel,
}: {
  children: (user: { id: string }) => ReactNode
  loadingLabel: string
}) {
  const auth = useAccountAuth()
  if (auth.isReady && auth.user) {
    // Query subscriptions, drafts, selections and pending callbacks belong to one session.
    return <Fragment key={auth.accountKey}>{children(auth.user)}</Fragment>
  }
  let content: ReactNode
  if (auth.isLoading) {
    content = <output className="text-muted-foreground">{loadingLabel}</output>
  } else if (auth.isSignedIn) {
    content = (
      <p className="text-muted-foreground" role="alert">
        Unable to connect to your account. Please refresh the page or sign in again.
      </p>
    )
  } else {
    content = (
      <>
        <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="mb-2 font-semibold text-foreground text-xl">Please sign in</h2>
        <p className="text-muted-foreground">You need to be signed in to view conversations.</p>
      </>
    )
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">{content}</CardContent>
      </Card>
    </div>
  )
}
