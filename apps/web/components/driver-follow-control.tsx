"use client"

import { Button } from "@workspace/ui/components/button"
import { useMutation, useQuery } from "convex/react"
import { UserMinus, UserPlus } from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"
import { useAccountActivity, useAccountAuth } from "@/hooks/useAccountAuth"
import { authReturnLink } from "@/lib/auth-return"
import { api } from "@/lib/convex"
import { handleError } from "@/lib/error-handler"
import { ErrorBoundary } from "./error-boundary"

type Props = { followedUserId: string; profileId: string }
type Auth = ReturnType<typeof useAccountAuth>

export function DriverFollowControl(props: Props) {
  const auth = useAccountAuth()
  return (
    <FollowSession
      {...props}
      auth={auth}
      key={JSON.stringify([auth.accountKey, auth.isReady, props.followedUserId, props.profileId])}
    />
  )
}

function FollowSession(props: Props & { auth: Auth }) {
  const [retry, setRetry] = useState(0)
  return (
    <ErrorBoundary
      fallback={
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-destructive text-sm" role="alert">
            Follow information could not be loaded.
          </p>
          <Button onClick={() => setRetry((value) => value + 1)} size="sm" variant="outline">
            Try again
          </Button>
        </div>
      }
      key={retry}
    >
      <FollowDetails {...props} />
    </ErrorBoundary>
  )
}

function FollowDetails({ followedUserId, profileId, auth }: Props & { auth: Auth }) {
  const isSelf = auth.user?.id === followedUserId
  const counts = useQuery(api.follows.getFollowerCounts, { userId: followedUserId })
  const isFollowing = useQuery(
    api.follows.isFollowingUser,
    auth.isReady && !isSelf ? { followedUserId } : "skip"
  )
  const follow = useMutation(api.follows.followUser)
  const unfollow = useMutation(api.follows.unfollowUser)
  const isCurrentAccount = useAccountActivity()
  const inFlight = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function changeFollowing() {
    if (
      !auth.isReady ||
      isSelf ||
      !isCurrentAccount() ||
      inFlight.current ||
      isFollowing === undefined
    )
      return
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      await (isFollowing ? unfollow : follow)({ followedUserId })
      // Both the button state and counts continue to come from the reactive queries.
    } catch (cause) {
      if (!isCurrentAccount()) return
      setError(
        isFollowing
          ? "Could not unfollow this driver. Please try again."
          : "Could not follow this driver. Please try again."
      )
      void handleError(cause, { showToast: false })
    } finally {
      if (isCurrentAccount()) {
        inFlight.current = false
        setPending(false)
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {counts === undefined ? (
          <output className="text-muted-foreground text-sm">Loading follow counts...</output>
        ) : (
          <p aria-live="polite" className="text-muted-foreground text-sm">
            {counts.followers.toLocaleString()} {counts.followers === 1 ? "follower" : "followers"}
            {" · "}
            {counts.following.toLocaleString()} following
          </p>
        )}
        <FollowAction
          auth={auth}
          isFollowing={isFollowing}
          isSelf={isSelf}
          onClick={changeFollowing}
          pending={pending}
          profileId={profileId}
        />
      </div>
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function FollowAction({
  auth,
  isFollowing,
  isSelf,
  onClick,
  pending,
  profileId,
}: {
  auth: Auth
  isFollowing: boolean | undefined
  isSelf: boolean
  onClick: () => void
  pending: boolean
  profileId: string
}) {
  if (isSelf) return null
  if (auth.isLoading)
    return (
      <Button disabled size="sm" variant="outline">
        Loading follow status...
      </Button>
    )
  if (!auth.isSignedIn) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link
          href={authReturnLink("/sign-in", `/motorsports/drivers/${encodeURIComponent(profileId)}`)}
        >
          Sign in to follow
        </Link>
      </Button>
    )
  }
  if (!auth.isReady) {
    return (
      <p className="text-destructive text-sm" role="alert">
        Follow controls are unavailable. Please refresh the page or sign in again.
      </p>
    )
  }
  let label = isFollowing ? "Unfollow" : "Follow"
  if (isFollowing === undefined) label = "Loading follow status..."
  if (pending) label = "Updating..."
  return (
    <Button
      aria-busy={pending}
      disabled={pending || isFollowing === undefined}
      onClick={onClick}
      size="sm"
      variant="outline"
    >
      {isFollowing ? (
        <UserMinus aria-hidden="true" className="mr-2 size-4" />
      ) : (
        <UserPlus aria-hidden="true" className="mr-2 size-4" />
      )}
      {label}
    </Button>
  )
}
