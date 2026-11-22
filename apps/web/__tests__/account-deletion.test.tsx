import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { getFunctionName } from "convex/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import SettingsPage from "@/app/settings/page"

const mock = vi.hoisted(() => ({
  eligibility: vi.fn(),
  deleteUser: vi.fn(),
  signOut: vi.fn(),
  getToken: vi.fn(),
  reverify: vi.fn(),
  requestDeletion: vi.fn(),
  userId: "synthetic-self" as string | null,
  sessionId: "session-1",
  clerkLoaded: true,
  convexLoading: false,
  convexAuthenticated: true,
  push: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  handleError: vi.fn(),
  billing: vi.fn(),
  mutation: vi.fn(),
  setTheme: vi.fn(),
}))

vi.mock("@clerk/nextjs", () => ({
  useReverification: (fetcher: () => Promise<unknown>) => async () => {
    const result = await fetcher()
    if (result && typeof result === "object" && "clerk_error" in result) {
      await mock.reverify()
      return fetcher()
    }
    return result
  },
  useUser: () => ({
    isLoaded: mock.clerkLoaded,
    isSignedIn: !!mock.userId,
    user: mock.userId
      ? {
          id: mock.userId,
          firstName: "Synthetic",
          lastName: "User",
          fullName: "Synthetic User",
          primaryEmailAddress: { emailAddress: "synthetic@example.invalid" },
          delete: mock.deleteUser,
        }
      : null,
  }),
  useAuth: () => ({
    isLoaded: mock.clerkLoaded,
    isSignedIn: !!mock.userId,
    userId: mock.userId,
    sessionId: mock.userId ? mock.sessionId : null,
    signOut: mock.signOut,
    getToken: mock.getToken,
  }),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mock.push }) }))
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "system", setTheme: mock.setTheme }) }))
vi.mock("sonner", () => ({ toast: { error: mock.error, success: mock.success } }))
vi.mock("@/lib/error-handler", () => ({ handleErrorWithContext: mock.handleError }))
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: mock.convexLoading,
    isAuthenticated: mock.convexAuthenticated,
  }),
  useQuery: () => null,
  useMutation: () => mock.mutation,
  useAction: (ref: Parameters<typeof getFunctionName>[0]) => {
    const functions: Record<string, ReturnType<typeof vi.fn>> = {
      "users:checkUserDeletionEligibility": mock.eligibility,
      "users:requestAccountDeletion": mock.requestDeletion,
      "stripe:getCustomerPaymentMethods": mock.billing,
      "stripe:getCustomerInvoices": mock.billing,
    }
    const fn = functions[getFunctionName(ref)]
    if (!fn) throw new Error(`Unexpected action: ${getFunctionName(ref)}`)
    return fn
  },
}))

type Eligibility = { canDelete: boolean; reason?: string; blockingFactors: string[] }
const eligible: Eligibility = { canDelete: true, blockingFactors: [] }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.clearAllMocks()
  mock.eligibility.mockReset().mockResolvedValue(eligible)
  mock.userId = "synthetic-self"
  mock.sessionId = "session-1"
  mock.clerkLoaded = true
  mock.convexLoading = false
  mock.convexAuthenticated = true
  mock.deleteUser.mockReset()
  mock.signOut.mockReset().mockResolvedValue(undefined)
  mock.getToken.mockReset().mockResolvedValue("native-session-token")
  mock.reverify.mockReset().mockResolvedValue(undefined)
  mock.requestDeletion.mockReset().mockResolvedValue({ deleted: true })
})
afterEach(cleanup)

async function openDialog(confirm = true) {
  const user = userEvent.setup()
  const view = render(<SettingsPage />)
  await user.click(screen.getByRole("button", { name: "Delete Account" }))
  const dialog = screen.getByRole("dialog", { name: "Delete Account" })
  const confirmation = within(dialog).getByLabelText("Type DELETE to confirm:")
  if (confirm) await user.type(confirmation, "DELETE")
  return {
    view,
    user,
    dialog,
    confirmation,
    submit: within(dialog).getByRole("button", { name: "Delete Account" }),
  }
}

it("requires the exact confirmation before checking eligibility or deleting", async () => {
  const { user, confirmation, submit } = await openDialog(false)
  expect(submit).toBeDisabled()
  await user.type(confirmation, "delete")
  expect(submit).toBeDisabled()
  await user.click(submit)
  expect(mock.eligibility).not.toHaveBeenCalled()
  expect(mock.requestDeletion).not.toHaveBeenCalled()
  await user.clear(confirmation)
  await user.type(confirmation, "DELETE")
  expect(submit).toBeEnabled()
})

it("waits for authenticated eligibility before deleting and redirects only after the server confirms provider deletion", async () => {
  const check = deferred<Eligibility>()
  const provider = deferred<{ deleted: boolean }>()
  mock.eligibility.mockReturnValue(check.promise)
  mock.requestDeletion.mockReturnValue(provider.promise)
  const { user, dialog, confirmation, submit } = await openDialog()
  await user.click(submit)

  expect(mock.eligibility).toHaveBeenCalledExactlyOnceWith({})
  expect(mock.requestDeletion).not.toHaveBeenCalled()
  expect(mock.push).not.toHaveBeenCalled()
  expect(confirmation).toBeDisabled()
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled()
  await user.keyboard("{Escape}")
  expect(dialog).toBeInTheDocument()

  await act(async () => check.resolve(eligible))
  expect(mock.requestDeletion).toHaveBeenCalledExactlyOnceWith({
    reauthToken: "native-session-token",
  })
  expect(mock.push).not.toHaveBeenCalled()
  expect(mock.success).not.toHaveBeenCalled()

  await act(async () => provider.resolve({ deleted: true }))
  expect(mock.success).toHaveBeenCalledWith("Account deleted")
  expect(mock.push).toHaveBeenCalledExactlyOnceWith("/")
  expect(mock.deleteUser).not.toHaveBeenCalled()
  expect(within(dialog).getByRole("button", { name: "Checking and deleting..." })).toBeDisabled()
})

it.each([
  {
    result: {
      canDelete: false,
      reason: "Cannot delete account: active rental obligations remain.",
      blockingFactors: ["Active booking"],
    },
    message: "Cannot delete account: active rental obligations remain.",
  },
  {
    result: {
      canDelete: false,
      blockingFactors: ["Please wait for all Stripe payouts to complete."],
    },
    message: "Please wait for all Stripe payouts to complete.",
  },
  {
    result: { canDelete: false, blockingFactors: [] },
    message: "Your account cannot be deleted yet. Please contact support.",
  },
])("shows the blocking reason without deleting or navigating: $message", async ({
  result,
  message,
}) => {
  mock.eligibility.mockResolvedValue(result)
  const { user, dialog, submit } = await openDialog()
  await user.click(submit)
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(message)
  expect(mock.requestDeletion).not.toHaveBeenCalled()
  expect(mock.push).not.toHaveBeenCalled()
  expect(mock.success).not.toHaveBeenCalled()
  expect(submit).toBeEnabled()
})

it("fails closed when preflight fails and permits a fresh eligibility check on retry", async () => {
  const error = new Error("Eligibility service unavailable")
  mock.eligibility.mockRejectedValueOnce(error)
  const { user, dialog, submit } = await openDialog()
  await user.click(submit)
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Unable to verify account deletion eligibility. No new deletion request was made."
  )
  expect(mock.requestDeletion).not.toHaveBeenCalled()
  expect(mock.push).not.toHaveBeenCalled()
  expect(mock.handleError).toHaveBeenCalledWith(error, expect.any(Object))
  expect(submit).toBeEnabled()

  await user.click(submit)
  await waitFor(() => expect(mock.push).toHaveBeenCalledWith("/"))
  expect(mock.eligibility).toHaveBeenCalledTimes(2)
  expect(mock.requestDeletion).toHaveBeenCalledTimes(1)
  expect(within(dialog).queryByRole("alert")).toBeNull()
})

it("preserves the account view on server-controlled provider failure and rechecks eligibility before another deletion", async () => {
  const error = new Error("Clerk unavailable")
  mock.requestDeletion.mockRejectedValueOnce(error)
  const { user, dialog, submit } = await openDialog()
  await user.click(submit)
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Account deletion could not be confirmed. Please try again or contact support."
  )
  expect(mock.push).not.toHaveBeenCalled()
  expect(mock.success).not.toHaveBeenCalled()
  expect(mock.handleError).toHaveBeenCalledWith(error, expect.any(Object))
  expect(submit).toBeEnabled()

  mock.eligibility.mockResolvedValue({
    canDelete: false,
    reason: "A new booking now blocks deletion.",
    blockingFactors: ["Active booking"],
  })
  await user.click(submit)
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "A new booking now blocks deletion."
  )
  expect(mock.eligibility).toHaveBeenCalledTimes(2)
  expect(mock.requestDeletion).toHaveBeenCalledTimes(1)
  expect(mock.push).not.toHaveBeenCalled()
})

it("ignores repeated submissions while preflight, provider deletion, or navigation is pending", async () => {
  const check = deferred<Eligibility>()
  const provider = deferred<{ deleted: boolean }>()
  mock.eligibility.mockReturnValue(check.promise)
  mock.requestDeletion.mockReturnValue(provider.promise)
  const { submit } = await openDialog()
  act(() => {
    fireEvent.click(submit)
    fireEvent.click(submit)
  })
  expect(mock.eligibility).toHaveBeenCalledTimes(1)
  expect(mock.requestDeletion).not.toHaveBeenCalled()

  await act(async () => check.resolve(eligible))
  fireEvent.click(submit)
  expect(mock.eligibility).toHaveBeenCalledTimes(1)
  expect(mock.requestDeletion).toHaveBeenCalledTimes(1)

  await act(async () => provider.resolve({ deleted: true }))
  fireEvent.click(submit)
  expect(mock.eligibility).toHaveBeenCalledTimes(1)
  expect(mock.requestDeletion).toHaveBeenCalledTimes(1)
  expect(mock.push).toHaveBeenCalledTimes(1)
})

it("clears a blocking error and confirmation when the dialog is closed and reopened", async () => {
  mock.eligibility.mockResolvedValue({
    canDelete: false,
    reason: "Active booking prevents deletion.",
    blockingFactors: ["Active booking"],
  })
  const { user, dialog, submit } = await openDialog()
  await user.click(submit)
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Active booking")
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
  expect(screen.queryByRole("dialog")).toBeNull()
  await user.click(screen.getByRole("button", { name: "Delete Account" }))
  const reopened = screen.getByRole("dialog", { name: "Delete Account" })
  expect(within(reopened).queryByRole("alert")).toBeNull()
  expect(within(reopened).getByLabelText("Type DELETE to confirm:")).toHaveValue("")
  expect(within(reopened).getByRole("button", { name: "Delete Account" })).toBeDisabled()
  expect(mock.requestDeletion).not.toHaveBeenCalled()
})

it("waits for both auth systems and never offers deletion to a signed-out or rejected session", () => {
  mock.clerkLoaded = false
  const view = render(<SettingsPage />)
  expect(screen.getByText("Loading your settings…")).toBeVisible()
  mock.clerkLoaded = true
  mock.convexLoading = true
  view.rerender(<SettingsPage />)
  expect(screen.getByText("Loading your settings…")).toBeVisible()
  mock.convexLoading = false
  mock.convexAuthenticated = false
  view.rerender(<SettingsPage />)
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to connect to your account")
  expect(screen.queryByRole("button", { name: "Delete Account" })).toBeNull()
  mock.userId = null
  view.rerender(<SettingsPage />)
  expect(screen.getByRole("heading", { name: "Please sign in" })).toBeVisible()
  expect(mock.eligibility).not.toHaveBeenCalled()
  expect(mock.requestDeletion).not.toHaveBeenCalled()
})

it.each([
  eligible,
  { canDelete: false, blockingFactors: ["Old account obligation"] },
])("discards an old account's preflight result after switching identities", async (result) => {
  const check = deferred<Eligibility>()
  mock.eligibility.mockReturnValueOnce(check.promise)
  const { user, view, submit } = await openDialog()
  await user.click(submit)
  mock.userId = "another-self"
  mock.sessionId = "session-2"
  view.rerender(<SettingsPage />)
  expect(screen.queryByRole("dialog")).toBeNull()
  await act(async () => check.resolve(result))
  expect(mock.requestDeletion).not.toHaveBeenCalled()
  expect(mock.push).not.toHaveBeenCalled()
  expect(mock.success).not.toHaveBeenCalled()
  expect(mock.handleError).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "Delete Account" }))
  expect(screen.getByLabelText("Type DELETE to confirm:")).toHaveValue("")
  expect(screen.queryByRole("alert")).toBeNull()
})

it.each([
  "success",
  "failure",
])("ignores stale deletion %s after a session changes", async (outcome) => {
  const request = deferred<{ deleted: boolean }>()
  mock.requestDeletion.mockReturnValueOnce(request.promise)
  const { user, view, submit } = await openDialog()
  await user.click(submit)
  expect(mock.requestDeletion).toHaveBeenCalledExactlyOnceWith({
    reauthToken: "native-session-token",
  })
  mock.sessionId = "session-2"
  view.rerender(<SettingsPage />)
  expect(screen.queryByRole("dialog")).toBeNull()
  await act(async () => {
    if (outcome === "success") request.resolve({ deleted: true })
    else request.reject(new Error("Previous session request failed"))
    await request.promise.catch(() => undefined)
  })
  expect(mock.push).not.toHaveBeenCalled()
  expect(mock.success).not.toHaveBeenCalled()
  expect(mock.handleError).not.toHaveBeenCalled()
})

it("does not claim deletion when a server response lacks provider confirmation", async () => {
  mock.requestDeletion.mockResolvedValueOnce({ deleted: false })
  const { user, dialog, submit } = await openDialog()
  await user.click(submit)
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Account deletion could not be confirmed"
  )
  expect(mock.success).not.toHaveBeenCalled()
  expect(mock.push).not.toHaveBeenCalled()
  expect(submit).toBeEnabled()
})

it("retries the authenticated server action after an unconfirmed response using fresh preflight", async () => {
  mock.requestDeletion.mockRejectedValueOnce(new Error("Provider response lost"))
  const { user, dialog, submit } = await openDialog()
  await user.click(submit)
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("could not be confirmed")
  await user.click(submit)
  await waitFor(() => expect(mock.success).toHaveBeenCalledWith("Account deleted"))
  expect(mock.eligibility).toHaveBeenCalledTimes(2)
  expect(mock.requestDeletion).toHaveBeenNthCalledWith(1, { reauthToken: "native-session-token" })
  expect(mock.requestDeletion).toHaveBeenNthCalledWith(2, { reauthToken: "native-session-token" })
  expect(mock.push).toHaveBeenCalledExactlyOnceWith("/")
})

it("signs out the confirmed session and explains pending cleanup without offering deletion retry", async () => {
  mock.requestDeletion.mockResolvedValue({ deleted: true, cleanupPending: true })
  const { user, submit } = await openDialog()
  await user.click(submit)
  await waitFor(() =>
    expect(mock.signOut).toHaveBeenCalledExactlyOnceWith({ sessionId: "session-1" })
  )
  expect(mock.success).toHaveBeenCalledWith(
    "Sign-in access removed. Final account cleanup is under review."
  )
  expect(mock.push).toHaveBeenCalledExactlyOnceWith("/")
  expect(mock.handleError).not.toHaveBeenCalled()
  expect(submit).toBeDisabled()
})

it("keeps confirmed deletion successful when clearing the local session fails", async () => {
  mock.signOut.mockRejectedValue(new Error("Session already revoked"))
  const { user, submit } = await openDialog()
  await user.click(submit)
  await waitFor(() =>
    expect(mock.error).toHaveBeenCalledWith(
      "Sign-in access was removed. Please refresh to clear this session."
    )
  )
  expect(mock.success).toHaveBeenCalledWith("Account deleted")
  expect(mock.handleError).not.toHaveBeenCalled()
  expect(mock.push).toHaveBeenCalledExactlyOnceWith("/")
  expect(submit).toBeDisabled()
})

const verificationRequired = {
  clerk_error: {
    type: "forbidden",
    reason: "reverification-error",
    metadata: { reverification: { level: "second_factor", afterMinutes: 10 } },
  },
}

it("uses a fresh native token again after Clerk reverification", async () => {
  mock.getToken
    .mockResolvedValueOnce("before-verification")
    .mockResolvedValueOnce("after-verification")
  mock.requestDeletion.mockResolvedValueOnce(verificationRequired)
  const { user, submit } = await openDialog()
  await user.click(submit)
  await waitFor(() => expect(mock.success).toHaveBeenCalledWith("Account deleted"))
  expect(mock.reverify).toHaveBeenCalledOnce()
  expect(mock.getToken).toHaveBeenNthCalledWith(1, { skipCache: true })
  expect(mock.getToken).toHaveBeenNthCalledWith(2, { skipCache: true })
  expect(mock.requestDeletion).toHaveBeenNthCalledWith(1, { reauthToken: "before-verification" })
  expect(mock.requestDeletion).toHaveBeenNthCalledWith(2, { reauthToken: "after-verification" })
})

it("does not delete or claim success if verification is canceled", async () => {
  mock.requestDeletion.mockResolvedValueOnce(verificationRequired)
  mock.reverify.mockRejectedValueOnce(new Error("reverification_cancelled"))
  const { user, dialog, submit } = await openDialog()
  await user.click(submit)
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("could not be confirmed")
  expect(mock.requestDeletion).toHaveBeenCalledOnce()
  expect(mock.success).not.toHaveBeenCalled()
  expect(mock.signOut).not.toHaveBeenCalled()
  expect(submit).toBeEnabled()
})

it("does not dispatch deletion without a native verification token", async () => {
  mock.getToken.mockResolvedValueOnce(null)
  const { user, dialog, submit } = await openDialog()
  await user.click(submit)
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("could not be confirmed")
  expect(mock.requestDeletion).not.toHaveBeenCalled()
  expect(mock.signOut).not.toHaveBeenCalled()
})

it("does not use a fresh token from a changed account", async () => {
  const token = deferred<string>()
  mock.getToken.mockReturnValueOnce(token.promise)
  const { user, view, submit } = await openDialog()
  await user.click(submit)
  mock.userId = "another-self"
  mock.sessionId = "session-2"
  view.rerender(<SettingsPage />)
  await act(async () => token.resolve("other-account-token"))
  expect(mock.requestDeletion).not.toHaveBeenCalled()
  expect(mock.success).not.toHaveBeenCalled()
  expect(mock.handleError).not.toHaveBeenCalled()
})

it("hands focus to Clerk verification and restores confirmation after cancellation", async () => {
  const verification = deferred<void>()
  mock.requestDeletion.mockResolvedValueOnce(verificationRequired)
  mock.reverify.mockReturnValueOnce(verification.promise)
  const { user, submit } = await openDialog()
  await user.click(submit)
  await waitFor(() => expect(mock.reverify).toHaveBeenCalledOnce())
  expect(screen.queryByRole("dialog", { name: "Delete Account" })).toBeNull()
  await act(async () => {
    verification.reject(new Error("reverification_cancelled"))
    await verification.promise.catch(() => undefined)
  })
  const restored = screen.getByRole("dialog", { name: "Delete Account" })
  expect(within(restored).getByLabelText("Type DELETE to confirm:")).toHaveValue("DELETE")
  expect(within(restored).getByRole("button", { name: "Delete Account" })).toBeEnabled()
  expect(mock.requestDeletion).toHaveBeenCalledOnce()
})

it("does not open verification for a stale action response", async () => {
  const response = deferred<typeof verificationRequired>()
  mock.requestDeletion.mockReturnValueOnce(response.promise)
  const { user, view, submit } = await openDialog()
  await user.click(submit)
  mock.sessionId = "session-2"
  view.rerender(<SettingsPage />)
  await act(async () => response.resolve(verificationRequired))
  expect(mock.reverify).not.toHaveBeenCalled()
  expect(mock.success).not.toHaveBeenCalled()
  expect(mock.handleError).not.toHaveBeenCalled()
})

it("does not retry deletion after the session changes during verification", async () => {
  const verification = deferred<void>()
  mock.requestDeletion.mockResolvedValueOnce(verificationRequired)
  mock.reverify.mockReturnValueOnce(verification.promise)
  const { user, view, submit } = await openDialog()
  await user.click(submit)
  await waitFor(() => expect(mock.reverify).toHaveBeenCalledOnce())
  mock.sessionId = "session-2"
  view.rerender(<SettingsPage />)
  await act(async () => verification.resolve())
  expect(mock.getToken).toHaveBeenCalledOnce()
  expect(mock.requestDeletion).toHaveBeenCalledOnce()
  expect(mock.success).not.toHaveBeenCalled()
  expect(mock.signOut).not.toHaveBeenCalled()
  expect(mock.handleError).not.toHaveBeenCalled()
})
