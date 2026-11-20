import { act, cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { AccountAuthBoundary } from "@/components/account-auth-boundary"
import { Providers } from "@/components/providers"

const PRIVATE_DATA = /Private data/

const mock = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud"
  return {
    userId: "account-a" as string | null,
    sessionId: "session-a" as string | null,
    callbacks: [] as ((authenticated: boolean) => void)[],
    tokenFetchers: [] as ((args: { forceRefreshToken: boolean }) => Promise<string | null>)[],
    clients: 0,
    getToken: vi.fn(),
    clearAuth: vi.fn(),
  }
})
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: mock.userId ? { id: mock.userId } : null,
    isSignedIn: !!mock.userId,
    isLoaded: true,
  }),
  useAuth: () => {
    const userId = mock.userId
    return {
      userId,
      sessionId: mock.sessionId,
      isLoaded: true,
      isSignedIn: !!userId,
      orgId: null,
      orgRole: null,
      getToken: () => {
        mock.getToken(userId)
        return Promise.resolve(`synthetic-token-${userId}`)
      },
    }
  },
}))
vi.mock("convex/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("convex/react")>()),
  ConvexReactClient: class {
    constructor() {
      mock.clients++
    }
    setAuth(
      fetch: (args: { forceRefreshToken: boolean }) => Promise<string | null>,
      callback: (authenticated: boolean) => void
    ) {
      mock.tokenFetchers.push(fetch)
      mock.callbacks.push(callback)
    }
    clearAuth() {
      mock.clearAuth()
    }
  },
}))
vi.mock("@/hooks/useCookieConsent", () => ({
  useCookieConsent: () => ({ hasConsented: false, isLoading: false }),
}))
vi.mock("@/components/cookie-consent-banner", () => ({ CookieConsentBanner: () => null }))
vi.mock("@workspace/ui/components/sonner", () => ({ Toaster: () => null }))
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/lib/sentry-loader", () => ({ loadSentry: vi.fn() }))

function AccountPage() {
  return (
    <Providers>
      <AccountAuthBoundary loadingLabel="Connecting account...">
        {(user) => <p>Private data for {user.id}</p>}
      </AccountAuthBoundary>
    </Providers>
  )
}

beforeEach(() => {
  mock.userId = "account-a"
  mock.sessionId = "session-a"
  mock.callbacks = []
  mock.tokenFetchers = []
  mock.getToken.mockClear()
  mock.clearAuth.mockClear()
})
afterEach(cleanup)

it("requires a fresh backend handshake when switching directly between signed-in accounts", async () => {
  const view = render(<AccountPage />)
  expect(screen.getByText("Connecting account...")).toBeInTheDocument()
  await act(async () => mock.callbacks.at(-1)?.(true))
  expect(screen.getByText("Private data for account-a")).toBeInTheDocument()
  const staleCallback = mock.callbacks.at(-1)!
  mock.userId = "account-b"
  mock.sessionId = "session-b"
  view.rerender(<AccountPage />)
  expect(screen.getByText("Connecting account...")).toBeInTheDocument()
  expect(screen.queryByText(PRIVATE_DATA)).not.toBeInTheDocument()
  expect(mock.callbacks).toHaveLength(2)
  await act(async () => staleCallback(true))
  expect(screen.queryByText(PRIVATE_DATA)).not.toBeInTheDocument()
  await mock.tokenFetchers.at(-1)!({ forceRefreshToken: true })
  expect(mock.getToken).toHaveBeenLastCalledWith("account-b")
  await act(async () => mock.callbacks.at(-1)?.(true))
  expect(screen.getByText("Private data for account-b")).toBeInTheDocument()
  expect(mock.clients).toBe(1)
})

it("requires a new handshake for another session of the same user and hides data on sign-out", async () => {
  const view = render(<AccountPage />)
  await act(async () => mock.callbacks.at(-1)?.(true))
  mock.sessionId = "session-a-new"
  view.rerender(<AccountPage />)
  expect(screen.queryByText(PRIVATE_DATA)).not.toBeInTheDocument()
  expect(mock.callbacks).toHaveLength(2)
  await act(async () => mock.callbacks.at(-1)?.(true))
  expect(screen.getByText("Private data for account-a")).toBeInTheDocument()
  mock.userId = null
  mock.sessionId = null
  view.rerender(<AccountPage />)
  expect(screen.queryByText(PRIVATE_DATA)).not.toBeInTheDocument()
  expect(screen.getByText("Please sign in")).toBeInTheDocument()
})
