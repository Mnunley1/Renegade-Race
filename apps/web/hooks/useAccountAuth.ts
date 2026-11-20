"use client"

import { useAuth, useUser } from "@clerk/nextjs"
import { useConvexAuth } from "convex/react"
import { useCallback, useLayoutEffect, useRef } from "react"

type AccountAuthState = {
  user: { id: string } | null
  isLoading: boolean
  isSignedIn: boolean
  isReady: boolean
  accountKey: string
}

export function useAccountAuth(): AccountAuthState {
  const { user, isLoaded, isSignedIn } = useUser()
  const auth = useAuth()
  const convex = useConvexAuth()
  const identityPending = !!(auth.isSignedIn && (!auth.sessionId || user?.id !== auth.userId))
  const isLoading = !(isLoaded && auth.isLoaded) || convex.isLoading || identityPending
  const isReady = !!(
    !isLoading &&
    isSignedIn &&
    auth.isSignedIn &&
    auth.sessionId &&
    user?.id === auth.userId &&
    convex.isAuthenticated
  )
  return {
    user: user ?? null,
    isLoading,
    isSignedIn: !!(isSignedIn && user),
    isReady,
    accountKey: JSON.stringify([auth.userId, auth.sessionId]),
  }
}

/** Ignore responses from work started by an account component that has unmounted. */
export function useAccountActivity() {
  const active = useRef(true)
  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  return useCallback(() => active.current, [])
}
