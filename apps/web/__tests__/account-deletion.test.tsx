import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { getFunctionName } from "convex/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import SettingsPage from "@/app/settings/page"

const mock = vi.hoisted(() => ({
  eligibility: vi.fn(),
  deleteUser: vi.fn(),
  push: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  handleError: vi.fn(),
  billing: vi.fn(),
  mutation: vi.fn(),
  setTheme: vi.fn(),
}))

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    isLoaded: true,
    user: {
      id: "synthetic-self",
      firstName: "Synthetic",
      lastName: "User",
      fullName: "Synthetic User",
      primaryEmailAddress: { emailAddress: "synthetic@example.invalid" },
      delete: mock.deleteUser,
    },
  }),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mock.push }) }))
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "system", setTheme: mock.setTheme }) }))
vi.mock("sonner", () => ({ toast: { error: mock.error, success: mock.success } }))
vi.mock("@/lib/error-handler", () => ({ handleErrorWithContext: mock.handleError }))
vi.mock("convex/react", () => ({
  useQuery: () => null,
  useMutation: () => mock.mutation,
  useAction: (ref: Parameters<typeof getFunctionName>[0]) => {
    const functions: Record<string, ReturnType<typeof vi.fn>> = {
      "users:checkUserDeletionEligibility": mock.eligibility,
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
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  mock.eligibility.mockReset().mockResolvedValue(eligible)
  mock.deleteUser.mockReset().mockResolvedValue(undefined)
})
afterEach(cleanup)

async function openDialog(confirm = true) {
  const user = userEvent.setup()
  render(<SettingsPage />)
  await user.click(screen.getByRole("button", { name: "Delete Account" }))
  const dialog = screen.getByRole("dialog", { name: "Delete Account" })
  const confirmation = within(dialog).getByLabelText("Type DELETE to confirm:")
  if (confirm) await user.type(confirmation, "DELETE")
  return {
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
  expect(mock.deleteUser).not.toHaveBeenCalled()
  await user.clear(confirmation)
  await user.type(confirmation, "DELETE")
  expect(submit).toBeEnabled()
})

it("waits for authenticated eligibility before deleting and redirects only after Clerk succeeds", async () => {
  const check = deferred<Eligibility>()
  const provider = deferred<void>()
  mock.eligibility.mockReturnValue(check.promise)
  mock.deleteUser.mockReturnValue(provider.promise)
  const { user, dialog, confirmation, submit } = await openDialog()
  await user.click(submit)

  expect(mock.eligibility).toHaveBeenCalledExactlyOnceWith({})
  expect(mock.deleteUser).not.toHaveBeenCalled()
  expect(mock.push).not.toHaveBeenCalled()
  expect(confirmation).toBeDisabled()
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled()
  await user.keyboard("{Escape}")
  expect(dialog).toBeInTheDocument()

  await act(async () => check.resolve(eligible))
  expect(mock.deleteUser).toHaveBeenCalledTimes(1)
  expect(mock.push).not.toHaveBeenCalled()
  expect(mock.success).not.toHaveBeenCalled()

  await act(async () => provider.resolve())
  expect(mock.success).toHaveBeenCalledWith("Account deletion requested")
  expect(mock.push).toHaveBeenCalledExactlyOnceWith("/")
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
  expect(mock.deleteUser).not.toHaveBeenCalled()
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
    "Unable to verify account deletion eligibility. Your account has not been deleted."
  )
  expect(mock.deleteUser).not.toHaveBeenCalled()
  expect(mock.push).not.toHaveBeenCalled()
  expect(mock.handleError).toHaveBeenCalledWith(error, expect.any(Object))
  expect(submit).toBeEnabled()

  await user.click(submit)
  await waitFor(() => expect(mock.push).toHaveBeenCalledWith("/"))
  expect(mock.eligibility).toHaveBeenCalledTimes(2)
  expect(mock.deleteUser).toHaveBeenCalledTimes(1)
  expect(within(dialog).queryByRole("alert")).toBeNull()
})

it("preserves the account view on Clerk failure and rechecks eligibility before another deletion", async () => {
  const error = new Error("Clerk unavailable")
  mock.deleteUser.mockRejectedValueOnce(error)
  const { user, dialog, submit } = await openDialog()
  await user.click(submit)
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Account deletion could not be completed. Please try again or contact support."
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
  expect(mock.deleteUser).toHaveBeenCalledTimes(1)
  expect(mock.push).not.toHaveBeenCalled()
})

it("ignores repeated submissions while preflight, provider deletion, or navigation is pending", async () => {
  const check = deferred<Eligibility>()
  const provider = deferred<void>()
  mock.eligibility.mockReturnValue(check.promise)
  mock.deleteUser.mockReturnValue(provider.promise)
  const { submit } = await openDialog()
  act(() => {
    fireEvent.click(submit)
    fireEvent.click(submit)
  })
  expect(mock.eligibility).toHaveBeenCalledTimes(1)
  expect(mock.deleteUser).not.toHaveBeenCalled()

  await act(async () => check.resolve(eligible))
  fireEvent.click(submit)
  expect(mock.eligibility).toHaveBeenCalledTimes(1)
  expect(mock.deleteUser).toHaveBeenCalledTimes(1)

  await act(async () => provider.resolve())
  fireEvent.click(submit)
  expect(mock.eligibility).toHaveBeenCalledTimes(1)
  expect(mock.deleteUser).toHaveBeenCalledTimes(1)
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
  expect(mock.deleteUser).not.toHaveBeenCalled()
})
