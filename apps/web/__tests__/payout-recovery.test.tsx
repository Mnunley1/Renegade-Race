import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import HostDashboardPage from "@/app/host/dashboard/page"
import OnboardingLayout from "@/app/host/onboarding/layout"
import PayoutSetupPage from "@/app/host/onboarding/payout/page"
import type { PayoutRecoveryStatus } from "@/components/payout-recovery"
import { stripeSetupUrl } from "@/lib/payout-navigation"

const mock = vi.hoisted(() => ({
  userId: "synthetic-host" as string | null,
  sessionId: "session-a",
  loaded: true,
  convexLoading: false,
  convexAuthenticated: true,
  status: undefined as PayoutRecoveryStatus | null | undefined,
  params: "",
  pathname: "/host/onboarding/payout",
  query: vi.fn(),
  start: vi.fn(),
  refresh: vi.fn(),
  getToken: vi.fn(),
  reverify: vi.fn(),
  legacyStatus: vi.fn(),
  legacyRefresh: vi.fn(),
  legacyStart: vi.fn(),
  legacyDashboard: vi.fn(),
  navigate: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  mutation: vi.fn(),
}))
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: mock.userId ? { id: mock.userId, firstName: "Synthetic" } : null,
    isSignedIn: !!mock.userId,
    isLoaded: mock.loaded,
  }),
  useAuth: () => ({
    userId: mock.userId,
    sessionId: mock.userId ? mock.sessionId : null,
    isLoaded: mock.loaded,
    isSignedIn: !!mock.userId,
    getToken: mock.getToken,
  }),
  useReverification: (fetcher: () => Promise<unknown>) => async () => {
    const result = await fetcher()
    if (result && typeof result === "object" && "clerk_error" in result) {
      await mock.reverify()
      return fetcher()
    }
    return result
  },
}))
vi.mock("next/navigation", () => ({
  usePathname: () => mock.pathname,
  useSearchParams: () => new URLSearchParams(mock.params),
  useRouter: () => ({ push: mock.push, replace: mock.replace }),
}))
vi.mock("@/lib/payout-navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/payout-navigation")>()),
  openStripeSetup: mock.navigate,
}))
vi.mock("@/components/host-onboarding-checklist", () => ({ HostOnboardingChecklist: () => null }))
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: mock.convexLoading,
    isAuthenticated: mock.convexAuthenticated,
  }),
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(ref)
    mock.query(name, args)
    if (args === "skip") return
    if (name === "payoutRecovery:getMyStatus") return mock.status
    if (name === "users:getHostOnboardingStatus") return { status: "completed" }
    if (name === "users:getMyPlatformFee") return null
    if (name === "reviews:getUserStats") return { averageRating: 0, totalReviews: 0 }
    return []
  },
  useMutation: () => mock.mutation,
  useAction: (ref: Parameters<typeof getFunctionName>[0]) => {
    const actions: Record<string, ReturnType<typeof vi.fn>> = {
      "payoutRecovery:startOnboarding": mock.start,
      "payoutRecovery:refreshMyStatus": mock.refresh,
      "stripe:getConnectAccountStatus": mock.legacyStatus,
      "stripe:refreshConnectAccountStatus": mock.legacyRefresh,
      "stripe:createConnectAccount": mock.legacyStart,
      "stripe:createConnectLoginLink": mock.legacyDashboard,
    }
    const action = actions[getFunctionName(ref)]
    if (!action) throw new Error(`Unexpected action ${getFunctionName(ref)}`)
    return action
  },
}))

const REMAINING_HOLD_COPY = /Payments remain on hold until the review/
const PRIVATE_ERROR_COPY = /private synthetic/
const SETUP_LINK = /Finish payment setup/
const RESERVATIONS_LINK = /Reservations/
const WIZARD_RESET = /Start Over|Reset/

const held: PayoutRecoveryStatus = {
  state: "held",
  canStart: true,
  canContinue: false,
  message: "Your payment setup needs verification.",
}
const inProgress: PayoutRecoveryStatus = {
  state: "setup_in_progress",
  canStart: false,
  canContinue: true,
  message: "Continue your setup with Stripe.",
}
const ready: PayoutRecoveryStatus = {
  state: "ready_for_review",
  canStart: false,
  canContinue: false,
  message: "Setup is ready for review.",
}
const syntheticUrl = "https://connect.stripe.com/setup/synthetic-not-a-live-link"
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  mock.userId = "synthetic-host"
  mock.sessionId = "session-a"
  mock.loaded = true
  mock.convexLoading = false
  mock.convexAuthenticated = true
  mock.status = held
  mock.params = ""
  mock.pathname = "/host/onboarding/payout"
  mock.start.mockReset().mockResolvedValue({ url: syntheticUrl })
  mock.refresh.mockReset().mockResolvedValue(held)
  mock.getToken.mockReset().mockResolvedValue("synthetic-native-token")
  mock.reverify.mockReset().mockResolvedValue(undefined)
  mock.legacyStatus.mockReset().mockResolvedValue({ hasAccount: false, isComplete: false })
  mock.legacyRefresh.mockReset().mockResolvedValue({ success: true })
  mock.legacyStart
    .mockReset()
    .mockResolvedValue({ onboardingUrl: syntheticUrl, accountId: "synthetic", isComplete: false })
  mock.legacyDashboard.mockReset().mockResolvedValue({ url: syntheticUrl })
})
afterEach(cleanup)

it("waits for authenticated backend readiness before subscribing or offering setup", () => {
  mock.convexLoading = true
  mock.convexAuthenticated = false
  const view = render(<PayoutSetupPage />)
  expect(screen.getByText("Connecting to your payment setup...")).toBeInTheDocument()
  expect(mock.query).not.toHaveBeenCalled()
  mock.convexLoading = false
  view.rerender(<PayoutSetupPage />)
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to connect")
  expect(mock.query).not.toHaveBeenCalled()
  expect(mock.start).not.toHaveBeenCalled()
})

it("requires sign-in and never reads another owner's recovery by supplied identity", () => {
  mock.userId = null
  mock.convexAuthenticated = false
  render(<PayoutSetupPage />)
  expect(screen.getByText("Please sign in")).toBeInTheDocument()
  expect(mock.query).not.toHaveBeenCalled()
  expect(mock.start).not.toHaveBeenCalled()
})

it("shows a held state without starting or checking provider setup on page view", () => {
  render(<PayoutSetupPage />)
  expect(screen.getByText("Payments on hold")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Start fresh payment setup" })).toBeEnabled()
  expect(mock.query).toHaveBeenCalledWith("payoutRecovery:getMyStatus", {})
  expect(mock.start).not.toHaveBeenCalled()
  expect(mock.refresh).not.toHaveBeenCalled()
  expect(mock.legacyStatus).not.toHaveBeenCalled()
  expect(mock.legacyStart).not.toHaveBeenCalled()
})

it("waits for recovery status rather than assuming the legacy path is safe", () => {
  mock.status = undefined
  render(<PayoutSetupPage />)
  expect(screen.getByText("Loading payment setup...")).toBeInTheDocument()
  expect(mock.legacyStatus).not.toHaveBeenCalled()
  expect(mock.start).not.toHaveBeenCalled()
})

it("starts only on click and passes a fresh native token through Clerk reverification and retry", async () => {
  mock.getToken
    .mockResolvedValueOnce("synthetic-token-before")
    .mockResolvedValueOnce("synthetic-token-after")
  mock.start
    .mockResolvedValueOnce({
      clerk_error: {
        type: "forbidden",
        reason: "reverification-error",
        metadata: { reverification: { level: "second_factor", afterMinutes: 10 } },
      },
    })
    .mockResolvedValueOnce({ url: syntheticUrl })
  render(<PayoutSetupPage />)
  fireEvent.click(screen.getByRole("button", { name: "Start fresh payment setup" }))
  await waitFor(() => expect(mock.navigate).toHaveBeenCalledWith(syntheticUrl))
  expect(mock.reverify).toHaveBeenCalledOnce()
  expect(mock.getToken).toHaveBeenNthCalledWith(1, { skipCache: true })
  expect(mock.getToken).toHaveBeenNthCalledWith(2, { skipCache: true })
  expect(mock.start).toHaveBeenNthCalledWith(1, { reauthToken: "synthetic-token-before" })
  expect(mock.start).toHaveBeenNthCalledWith(2, { reauthToken: "synthetic-token-after" })
})

it("does not recreate an expired link until the owner explicitly continues", async () => {
  mock.status = inProgress
  mock.params = "stripe_refresh=1"
  render(<PayoutSetupPage />)
  expect(screen.getByRole("status")).toHaveTextContent("expired or was already used")
  expect(mock.start).not.toHaveBeenCalled()
  expect(mock.refresh).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Continue setup" }))
  await waitFor(() => expect(mock.start).toHaveBeenCalledOnce())
})

it("treats a Stripe return as a read-only status hint and retains the ready-for-review hold", async () => {
  mock.status = ready
  mock.params = "stripe_return=1&accountId=untrusted&verified=true"
  render(<PayoutSetupPage />)
  await waitFor(() => expect(mock.refresh).toHaveBeenCalledOnce())
  expect(mock.refresh).toHaveBeenCalledWith({})
  expect(screen.getByText("Payments on hold")).toBeInTheDocument()
  expect(screen.getByText(REMAINING_HOLD_COPY)).toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Start fresh payment setup" })
  ).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Continue setup" })).not.toBeInTheDocument()
  expect(mock.start).not.toHaveBeenCalled()
  expect(mock.navigate).not.toHaveBeenCalled()
})

it("prevents duplicate start requests while verification is pending", async () => {
  const pending = deferred<{ url: string }>()
  mock.start.mockReturnValue(pending.promise)
  render(<PayoutSetupPage />)
  const button = screen.getByRole("button", { name: "Start fresh payment setup" })
  fireEvent.click(button)
  fireEvent.click(button)
  await waitFor(() => expect(mock.start).toHaveBeenCalledOnce())
  expect(button).toBeDisabled()
  await act(async () => pending.resolve({ url: syntheticUrl }))
  expect(mock.start).toHaveBeenCalledOnce()
})

it("ignores a completed onboarding response after account/session switch", async () => {
  const pending = deferred<{ url: string }>()
  mock.start.mockReturnValue(pending.promise)
  const view = render(<PayoutSetupPage />)
  fireEvent.click(screen.getByRole("button", { name: "Start fresh payment setup" }))
  await waitFor(() => expect(mock.start).toHaveBeenCalledOnce())
  mock.userId = "other-owner"
  mock.sessionId = "session-b"
  view.rerender(<PayoutSetupPage />)
  await act(async () => pending.resolve({ url: syntheticUrl }))
  expect(mock.navigate).not.toHaveBeenCalled()
})

it("shows a safe setup error without rendering a raw provider error or clearing the hold", async () => {
  mock.start.mockRejectedValue(new Error("private synthetic account/provider error"))
  render(<PayoutSetupPage />)
  fireEvent.click(screen.getByRole("button", { name: "Start fresh payment setup" }))
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Payments remain on hold")
  )
  expect(screen.queryByText(PRIVATE_ERROR_COPY)).not.toBeInTheDocument()
  expect(mock.navigate).not.toHaveBeenCalled()
})

it("keeps unsupported or revoked recovery states held when the backend offers no start action", () => {
  mock.status = { ...held, canStart: false, message: "Your account needs an operator review." }
  render(<PayoutSetupPage />)
  expect(screen.getByText("Your account needs an operator review.")).toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Start fresh payment setup" })
  ).not.toBeInTheDocument()
  expect(mock.start).not.toHaveBeenCalled()
})

it("preserves the normal setup path for unaffected users, with creation only after an explicit click", async () => {
  mock.status = null
  render(<PayoutSetupPage />)
  await waitFor(() => expect(mock.legacyStatus).toHaveBeenCalledWith({ ownerId: "synthetic-host" }))
  expect(mock.legacyStart).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Set up payouts" }))
  await waitFor(() => expect(mock.legacyStart).toHaveBeenCalledOnce())
  expect(mock.start).not.toHaveBeenCalled()
})

it("shows returning hosts a setup requirement while retaining dashboard navigation and blocking legacy actions", () => {
  render(<HostDashboardPage />)
  expect(screen.getByRole("heading", { name: "Finish payment setup" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: SETUP_LINK })).toHaveAttribute(
    "href",
    "/host/onboarding/payout"
  )
  expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute("href", "/messages")
  expect(screen.getByRole("link", { name: RESERVATIONS_LINK })).toBeInTheDocument()
  expect(mock.legacyStatus).not.toHaveBeenCalled()
  expect(mock.legacyRefresh).not.toHaveBeenCalled()
  expect(mock.legacyStart).not.toHaveBeenCalled()
  expect(mock.start).not.toHaveBeenCalled()
})

it.each([
  "/host/onboarding/payout",
  "/host/onboarding/payout/complete",
])("does not mount vehicle draft/reset controls or unload protection for %s", (pathname) => {
  mock.pathname = pathname
  render(
    <OnboardingLayout>
      <PayoutSetupPage />
    </OnboardingLayout>
  )
  expect(screen.getByRole("heading", { name: "Payment setup" })).toBeInTheDocument()
  expect(screen.queryByText("Vehicle & Location")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: WIZARD_RESET })).not.toBeInTheDocument()
  expect(mock.query).not.toHaveBeenCalledWith("users:getOnboardingDraft", {})
  const unload = new Event("beforeunload", { cancelable: true })
  window.dispatchEvent(unload)
  expect(unload.defaultPrevented).toBe(false)
})

it("allows a successful Continue setup response to navigate through the actual payout layout", async () => {
  mock.status = inProgress
  const unload = new Event("beforeunload", { cancelable: true })
  mock.navigate.mockImplementationOnce(() => window.dispatchEvent(unload))
  render(
    <OnboardingLayout>
      <PayoutSetupPage />
    </OnboardingLayout>
  )
  fireEvent.click(screen.getByRole("button", { name: "Continue setup" }))
  await waitFor(() => expect(mock.navigate).toHaveBeenCalledWith(syntheticUrl))
  expect(unload.defaultPrevented).toBe(false)
  expect(mock.start).toHaveBeenCalledOnce()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

it("retains the wizard guard and removes it when navigating from the wizard into payment setup", () => {
  mock.pathname = "/host/onboarding/vehicle"
  const view = render(
    <OnboardingLayout>
      <p>Vehicle wizard</p>
    </OnboardingLayout>
  )
  expect(screen.getByText("Vehicle & Location")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: WIZARD_RESET })).toBeInTheDocument()
  const wizardUnload = new Event("beforeunload", { cancelable: true })
  window.dispatchEvent(wizardUnload)
  expect(wizardUnload.defaultPrevented).toBe(true)
  mock.pathname = "/host/onboarding/payout"
  view.rerender(
    <OnboardingLayout>
      <PayoutSetupPage />
    </OnboardingLayout>
  )
  const payoutUnload = new Event("beforeunload", { cancelable: true })
  window.dispatchEvent(payoutUnload)
  expect(payoutUnload.defaultPrevented).toBe(false)
  expect(screen.queryByRole("button", { name: WIZARD_RESET })).not.toBeInTheDocument()
})

it.each([
  "http://connect.stripe.com/setup/test",
  "https://connect.stripe.com.evil.example/setup/test",
  "https://evil.example/setup/test",
  "javascript:alert(1)",
  "https://name:password@connect.stripe.com/setup/test",
  "https://connect.stripe.com:444/setup/test",
])("rejects unsafe setup navigation %s", (target) => {
  expect(() => stripeSetupUrl(target)).toThrow()
})
it("allows only the expected HTTPS Stripe host for setup navigation", () => {
  expect(stripeSetupUrl(syntheticUrl)).toBe(syntheticUrl)
})
