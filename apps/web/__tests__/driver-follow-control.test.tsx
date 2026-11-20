import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { DriverFollowControl } from "@/components/driver-follow-control"

const mock = vi.hoisted(() => ({
  user: { id: "viewer-a" } as { id: string } | null,
  session: "session-a" as string | null,
  clerkLoaded: true,
  convexLoading: false,
  convexAuthenticated: true,
  following: false as boolean | undefined,
  counts: { followers: 7, following: 2 } as { followers: number; following: number } | undefined,
  countsError: false,
  followingError: false,
  queries: vi.fn(),
  follow: vi.fn(),
  unfollow: vi.fn(),
  handleError: vi.fn(),
}))
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: mock.user, isSignedIn: !!mock.user, isLoaded: mock.clerkLoaded }),
  useAuth: () => ({
    userId: mock.user?.id,
    sessionId: mock.session,
    isSignedIn: !!mock.session,
    isLoaded: mock.clerkLoaded,
  }),
}))
vi.mock("@/lib/error-handler", () => ({ handleError: mock.handleError }))
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: mock.convexLoading,
    isAuthenticated: mock.convexAuthenticated,
  }),
  useQuery: (fn: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(fn)
    mock.queries(name, args)
    if (args === "skip") return
    if (name === "follows:getFollowerCounts") {
      if (mock.countsError) throw new Error("synthetic count query failure")
      return mock.counts
    }
    if (mock.followingError) throw new Error("synthetic relationship query failure")
    return mock.following
  },
  useMutation: (fn: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(fn) === "follows:followUser" ? mock.follow : mock.unfollow,
}))

function Control({
  userId = "driver-user",
  profileId = "driver-profile",
}: {
  userId?: string
  profileId?: string
}) {
  return <DriverFollowControl followedUserId={userId} profileId={profileId} />
}
function deferred() {
  let resolve!: () => void
  let reject!: (reason: Error) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.clearAllMocks()
  mock.user = { id: "viewer-a" }
  mock.session = "session-a"
  mock.clerkLoaded = true
  mock.convexLoading = false
  mock.convexAuthenticated = true
  mock.following = false
  mock.counts = { followers: 7, following: 2 }
  mock.countsError = false
  mock.followingError = false
  mock.follow.mockResolvedValue("follow-row")
  mock.unfollow.mockResolvedValue(null)
  mock.handleError.mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it("offers guests a sign-in link back to this driver and only loads public counts", () => {
  mock.user = null
  mock.session = null
  mock.convexAuthenticated = false
  render(<Control />)
  const link = screen.getByRole("link", { name: "Sign in to follow" })
  expect(
    new URL(link.getAttribute("href") ?? "", "https://example.test").searchParams.get(
      "redirect_url"
    )
  ).toBe("/motorsports/drivers/driver-profile")
  expect(screen.getByText("7 followers · 2 following")).toBeInTheDocument()
  expect(mock.queries).toHaveBeenCalledWith("follows:isFollowingUser", "skip")
  expect(mock.follow).not.toHaveBeenCalled()
})

it("waits for Clerk, Convex, and the relationship result instead of assuming not followed", () => {
  mock.clerkLoaded = false
  mock.convexLoading = true
  mock.convexAuthenticated = false
  const view = render(<Control />)
  expect(screen.getByRole("button", { name: "Loading follow status..." })).toBeDisabled()
  expect(screen.queryByRole("link", { name: "Sign in to follow" })).not.toBeInTheDocument()
  expect(mock.queries).toHaveBeenCalledWith("follows:isFollowingUser", "skip")
  mock.clerkLoaded = true
  mock.queries.mockClear()
  view.rerender(<Control />)
  expect(mock.queries).toHaveBeenCalledWith("follows:isFollowingUser", "skip")
  mock.convexLoading = false
  mock.convexAuthenticated = true
  mock.following = undefined
  view.rerender(<Control />)
  expect(mock.queries).toHaveBeenCalledWith("follows:isFollowingUser", {
    followedUserId: "driver-user",
  })
  expect(screen.getByRole("button", { name: "Loading follow status..." })).toBeDisabled()
  mock.following = true
  view.rerender(<Control />)
  expect(screen.getByRole("button", { name: "Unfollow" })).toBeEnabled()
})

it("does not present zero counts while the count query is unresolved", () => {
  mock.counts = undefined
  const view = render(<Control />)
  expect(screen.getByText("Loading follow counts...")).toBeInTheDocument()
  expect(screen.queryByText("0 followers · 0 following")).not.toBeInTheDocument()
  mock.counts = { followers: 0, following: 0 }
  view.rerender(<Control />)
  expect(screen.getByText("0 followers · 0 following")).toBeInTheDocument()
})

it("hides self-follow actions but retains the driver's authoritative counts", () => {
  mock.user = { id: "driver-user" }
  render(<Control />)
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  expect(screen.queryByRole("link")).not.toBeInTheDocument()
  expect(mock.queries).toHaveBeenCalledWith("follows:isFollowingUser", "skip")
  expect(screen.getByText("7 followers · 2 following")).toBeInTheDocument()
})

it("blocks follow mutations when Convex authentication is rejected", () => {
  mock.convexAuthenticated = false
  render(<Control />)
  expect(screen.getByRole("alert")).toHaveTextContent("Follow controls are unavailable")
  expect(mock.queries).toHaveBeenCalledWith("follows:isFollowingUser", "skip")
  expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument()
})

it("allows one pending follow and waits for authoritative relationship and count changes", async () => {
  const request = deferred()
  mock.follow.mockReturnValue(request.promise)
  const view = render(<Control />)
  fireEvent.click(screen.getByRole("button", { name: "Follow" }))
  const pending = screen.getByRole("button", { name: "Updating..." })
  expect(pending).toBeDisabled()
  expect(pending).toHaveAttribute("aria-busy", "true")
  fireEvent.click(pending)
  expect(mock.follow).toHaveBeenCalledTimes(1)
  expect(mock.follow).toHaveBeenCalledWith({ followedUserId: "driver-user" })
  expect(mock.unfollow).not.toHaveBeenCalled()
  expect(screen.getByText("7 followers · 2 following")).toBeInTheDocument()
  await act(async () => request.resolve())
  expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument()
  expect(screen.getByText("7 followers · 2 following")).toBeInTheDocument()
  mock.following = true
  mock.counts = { followers: 8, following: 2 }
  view.rerender(<Control />)
  expect(screen.getByRole("button", { name: "Unfollow" })).toBeEnabled()
  expect(screen.getByText("8 followers · 2 following")).toBeInTheDocument()
})

it("unfollows the external user ID and does not decrement counts optimistically", async () => {
  mock.following = true
  mock.counts = { followers: 1, following: 2 }
  const request = deferred()
  mock.unfollow.mockReturnValue(request.promise)
  const view = render(<Control />)
  fireEvent.click(screen.getByRole("button", { name: "Unfollow" }))
  expect(mock.unfollow).toHaveBeenCalledWith({ followedUserId: "driver-user" })
  expect(screen.getByText("1 follower · 2 following")).toBeInTheDocument()
  await act(async () => request.resolve())
  expect(screen.getByRole("button", { name: "Unfollow" })).toBeInTheDocument()
  mock.following = false
  mock.counts = { followers: 0, following: 2 }
  view.rerender(<Control />)
  expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument()
  expect(screen.getByText("0 followers · 2 following")).toBeInTheDocument()
})

it("preserves state after a real follow rejection and permits retry", async () => {
  mock.follow.mockRejectedValueOnce(new Error("permission denied"))
  const view = render(<Control />)
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Follow" })))
  expect(screen.getByRole("alert")).toHaveTextContent("Could not follow this driver")
  expect(screen.getByRole("button", { name: "Follow" })).toBeEnabled()
  expect(screen.getByText("7 followers · 2 following")).toBeInTheDocument()
  expect(mock.handleError).toHaveBeenCalledWith(expect.any(Error), { showToast: false })
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Follow" })))
  expect(mock.follow).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  mock.following = true
  mock.counts = { followers: 8, following: 2 }
  view.rerender(<Control />)
  expect(screen.getByRole("button", { name: "Unfollow" })).toBeInTheDocument()
})

it("retains followed state and count after an unfollow failure", async () => {
  mock.following = true
  mock.unfollow.mockRejectedValueOnce(new Error("network failure"))
  render(<Control />)
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Unfollow" })))
  expect(screen.getByRole("alert")).toHaveTextContent("Could not unfollow this driver")
  expect(screen.getByRole("button", { name: "Unfollow" })).toBeEnabled()
  expect(screen.getByText("7 followers · 2 following")).toBeInTheDocument()
})

it.each([
  "countsError",
  "followingError",
] as const)("contains a %s query failure and retries without fabricating follow data", (field) => {
  vi.spyOn(console, "error").mockImplementation(() => undefined)
  mock[field] = true
  render(<Control />)
  expect(screen.getByRole("alert")).toHaveTextContent("Follow information could not be loaded")
  expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument()
  mock[field] = false
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(screen.getByRole("button", { name: "Follow" })).toBeEnabled()
  expect(screen.getByText("7 followers · 2 following")).toBeInTheDocument()
})

it("drops the old account's followed state while the new account authenticates", () => {
  mock.following = true
  const view = render(<Control />)
  expect(screen.getByRole("button", { name: "Unfollow" })).toBeInTheDocument()
  mock.user = { id: "viewer-b" }
  mock.session = "session-b"
  mock.convexLoading = true
  mock.convexAuthenticated = false
  mock.queries.mockClear()
  view.rerender(<Control />)
  expect(screen.queryByRole("button", { name: "Unfollow" })).not.toBeInTheDocument()
  expect(mock.queries).toHaveBeenCalledWith("follows:isFollowingUser", "skip")
  mock.convexLoading = false
  mock.convexAuthenticated = true
  mock.following = false
  view.rerender(<Control />)
  expect(screen.getByRole("button", { name: "Follow" })).toBeEnabled()
})

it.each([
  "account",
  "session",
  "driver",
  "sign-out",
] as const)("ignores a previous %s's pending mutation failure", async (transition) => {
  const request = deferred()
  mock.follow.mockReturnValue(request.promise)
  const view = render(<Control />)
  fireEvent.click(screen.getByRole("button", { name: "Follow" }))
  if (transition === "account") {
    mock.user = { id: "viewer-b" }
    mock.session = "session-b"
  }
  if (transition === "session") mock.session = "new-session"
  if (transition === "sign-out") {
    mock.user = null
    mock.session = null
    mock.convexAuthenticated = false
  }
  view.rerender(
    transition === "driver" ? (
      <Control profileId="other-profile" userId="other-driver" />
    ) : (
      <Control />
    )
  )
  await act(async () => request.reject(new Error("old request failure")))
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(mock.handleError).not.toHaveBeenCalled()
  expect(mock.follow).toHaveBeenCalledTimes(1)
  expect(mock.follow).toHaveBeenCalledWith({ followedUserId: "driver-user" })
  expect(screen.queryByRole("button", { name: "Updating..." })).not.toBeInTheDocument()
  if (transition === "sign-out")
    expect(screen.getByRole("link", { name: "Sign in to follow" })).toBeInTheDocument()
  else expect(screen.getByRole("button", { name: "Follow" })).toBeEnabled()
})
