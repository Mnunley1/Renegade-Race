import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import InvoiceDetailPage from "@/app/deals/invoices/[id]/page"
import InvoicesPage from "@/app/deals/invoices/page"

const CONVERSATIONS_COPY = /view conversations/
const CARD_PAYMENT = /Pay by card/

const mock = vi.hoisted(() => ({
  userId: "recipient" as string | null,
  authUserId: "recipient" as string | null,
  sessionId: "session-a" as string | null,
  clerkLoaded: true,
  convexLoading: false,
  convexAuthenticated: true,
  invoiceId: "invoice-a",
  invoice: undefined as Record<string, unknown> | null | undefined,
  invoices: undefined as Record<string, unknown>[] | undefined,
  queries: vi.fn(),
  markViewed: vi.fn(),
  create: vi.fn(),
  send: vi.fn(),
  choose: vi.fn(),
  open: vi.fn(),
  refund: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  handleError: vi.fn(),
}))
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: mock.userId ? { id: mock.userId } : null,
    isSignedIn: !!mock.userId,
    isLoaded: mock.clerkLoaded,
  }),
  useAuth: () => ({
    userId: mock.authUserId,
    sessionId: mock.sessionId,
    isSignedIn: !!mock.sessionId,
    isLoaded: mock.clerkLoaded,
  }),
}))
vi.mock("next/navigation", () => ({ useParams: () => ({ id: mock.invoiceId }) }))
vi.mock("sonner", () => ({ toast: { success: mock.success, error: mock.error } }))
vi.mock("@/lib/error-handler", () => ({ handleErrorWithContext: mock.handleError }))
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: mock.convexLoading,
    isAuthenticated: mock.convexAuthenticated,
  }),
  useQuery: (fn: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(fn)
    mock.queries(name, args)
    if (args === "skip") return
    if (name === "invoices:getById") return mock.invoice
    if (name === "invoices:getMine") return mock.invoices
    if (name === "users:searchForInvoiceRecipients")
      return [{ externalId: "recipient", name: "Recipient" }]
    return []
  },
  useMutation: (fn: Parameters<typeof getFunctionName>[0]) => {
    if (getFunctionName(fn) === "invoices:createDraft") return mock.create
    if (getFunctionName(fn) === "invoices:send") return mock.send
    return mock.markViewed
  },
  useAction: (fn: Parameters<typeof getFunctionName>[0]) => {
    if (getFunctionName(fn) === "invoices:choosePaymentMethod") return mock.choose
    if (getFunctionName(fn) === "invoices:openHostedInvoice") return mock.open
    return mock.refund
  },
}))
vi.mock("@workspace/ui/components/select", () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: ReactNode
    onValueChange: (value: string) => void
    value: string
  }) => (
    <select onChange={(event) => onValueChange(event.target.value)} value={value}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
}))

const invoice = {
  _id: "invoice-a",
  senderId: "sender",
  recipientId: "recipient",
  title: "Synthetic invoice",
  status: "sent",
  total: 123,
  subtotal: 123,
  amountDue: 158,
  processingFee: 35,
  selectedPaymentMethod: "stripe_card",
  lineItems: [{ description: "Service", quantity: 1, unitAmount: 123, amount: 123 }],
  paymentMethods: ["stripe_card", "stripe_ach"],
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function switchAccount() {
  mock.userId = "account-b"
  mock.authUserId = "account-b"
  mock.sessionId = "session-b"
}
function submitDraft() {
  fireEvent.click(screen.getByRole("button", { name: "Create invoice" }))
  const form = within(screen.getByRole("form", { name: "Create invoice" }))
  fireEvent.change(form.getByLabelText("Title"), { target: { value: "Private draft" } })
  const recipientSelect = form.getAllByRole("combobox")[0]
  if (!recipientSelect) throw new Error("Recipient selector missing")
  fireEvent.change(recipientSelect, { target: { value: "recipient" } })
  fireEvent.submit(screen.getByRole("form", { name: "Create invoice" }))
}
beforeEach(() => {
  vi.clearAllMocks()
  mock.userId = "recipient"
  mock.authUserId = "recipient"
  mock.sessionId = "session-a"
  mock.clerkLoaded = true
  mock.convexLoading = false
  mock.convexAuthenticated = true
  mock.invoiceId = "invoice-a"
  mock.invoice = invoice
  mock.invoices = []
  mock.markViewed.mockResolvedValue(null)
  mock.create.mockResolvedValue("new-invoice")
  mock.send.mockResolvedValue(null)
  mock.choose.mockResolvedValue({})
  mock.open.mockResolvedValue(null)
  mock.refund.mockResolvedValue({ status: "succeeded" })
  sessionStorage.clear()
})
afterEach(cleanup)

it.each([
  InvoicesPage,
  InvoiceDetailPage,
])("waits for Clerk and Convex before protected queries/actions", (Page) => {
  mock.clerkLoaded = false
  mock.convexLoading = true
  mock.convexAuthenticated = false
  const view = render(<Page />)
  expect(screen.getByRole("status")).toHaveTextContent("Connecting")
  expect(mock.queries).not.toHaveBeenCalled()
  expect(mock.markViewed).not.toHaveBeenCalled()
  expect(screen.queryByText("No invoices yet.")).not.toBeInTheDocument()
  mock.clerkLoaded = true
  view.rerender(<Page />)
  expect(mock.queries).not.toHaveBeenCalled()
  mock.convexLoading = false
  mock.convexAuthenticated = true
  view.rerender(<Page />)
  expect(mock.queries).toHaveBeenCalled()
})

it.each([
  InvoicesPage,
  InvoiceDetailPage,
])("distinguishes signed out and auth failure without querying protected data", (Page) => {
  mock.convexAuthenticated = false
  const view = render(<Page />)
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to connect")
  expect(mock.queries).not.toHaveBeenCalled()
  mock.userId = null
  mock.authUserId = null
  mock.sessionId = null
  view.rerender(<Page />)
  expect(screen.getByText("Please sign in")).toBeInTheDocument()
  expect(screen.queryByText(CONVERSATIONS_COPY)).not.toBeInTheDocument()
  expect(mock.queries).not.toHaveBeenCalled()
})

it("waits for the Clerk user and session identity to agree before querying", () => {
  mock.authUserId = "new-recipient"
  const view = render(<InvoiceDetailPage />)
  expect(screen.getByRole("status")).toHaveTextContent("Connecting")
  expect(mock.queries).not.toHaveBeenCalled()
  expect(mock.markViewed).not.toHaveBeenCalled()
  mock.userId = "new-recipient"
  view.rerender(<InvoiceDetailPage />)
  expect(mock.queries).toHaveBeenCalledWith("invoices:getById", { invoiceId: "invoice-a" })
})

it("does not reuse a draft after account or session changes", () => {
  const view = render(<InvoicesPage />)
  fireEvent.click(screen.getByRole("button", { name: "Create invoice" }))
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Private draft" } })
  switchAccount()
  mock.convexLoading = true
  view.rerender(<InvoicesPage />)
  expect(screen.queryByDisplayValue("Private draft")).not.toBeInTheDocument()
  mock.convexLoading = false
  view.rerender(<InvoicesPage />)
  fireEvent.click(screen.getByRole("button", { name: "Create invoice" }))
  expect(screen.getByLabelText("Title")).toHaveValue("")
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Session draft" } })
  mock.sessionId = "session-c"
  view.rerender(<InvoicesPage />)
  expect(screen.queryByDisplayValue("Session draft")).not.toBeInTheDocument()
})

it("drops invoice data immediately on sign-out even while Convex still reports authenticated", () => {
  const view = render(<InvoiceDetailPage />)
  expect(screen.getByText("Synthetic invoice")).toBeInTheDocument()
  mock.userId = null
  mock.authUserId = null
  mock.sessionId = null
  mock.queries.mockClear()
  view.rerender(<InvoiceDetailPage />)
  expect(screen.queryByText("Synthetic invoice")).not.toBeInTheDocument()
  expect(mock.queries).not.toHaveBeenCalled()
})

it("does not send an old account's newly-created draft after account switch", async () => {
  const pending = deferred<string>()
  mock.create.mockReturnValue(pending.promise)
  const view = render(<InvoicesPage />)
  submitDraft()
  expect(mock.create).toHaveBeenCalledOnce()
  switchAccount()
  view.rerender(<InvoicesPage />)
  await act(async () => pending.resolve("old-draft"))
  expect(mock.send).not.toHaveBeenCalled()
  expect(mock.success).not.toHaveBeenCalled()
})

it("ignores an old send error after the session changes", async () => {
  const pending = deferred<null>()
  mock.send.mockReturnValue(pending.promise)
  const view = render(<InvoicesPage />)
  submitDraft()
  await act(async () => await Promise.resolve())
  expect(mock.send).toHaveBeenCalledOnce()
  mock.sessionId = "new-session"
  view.rerender(<InvoicesPage />)
  await act(async () => pending.reject(new Error("old request failed")))
  expect(mock.handleError).not.toHaveBeenCalled()
})

it("ignores an old payment response after account switch", async () => {
  const pending = deferred<{ url?: string }>()
  mock.choose.mockReturnValue(pending.promise)
  const view = render(<InvoiceDetailPage />)
  fireEvent.click(screen.getByRole("button", { name: CARD_PAYMENT }))
  switchAccount()
  view.rerender(<InvoiceDetailPage />)
  await act(async () => pending.resolve({}))
  expect(mock.success).not.toHaveBeenCalled()
  expect(mock.error).not.toHaveBeenCalled()
})

it("ignores hosted-invoice errors after navigating to a different invoice", async () => {
  const pending = deferred<string>()
  mock.open.mockReturnValue(pending.promise)
  mock.invoice = { ...invoice, hasHostedInvoice: true }
  const view = render(<InvoiceDetailPage />)
  fireEvent.click(screen.getByRole("button", { name: "Open Stripe invoice" }))
  mock.invoiceId = "invoice-b"
  mock.invoice = undefined
  view.rerender(<InvoiceDetailPage />)
  await act(async () => pending.reject(new Error("old invoice failed")))
  expect(mock.handleError).not.toHaveBeenCalled()
})

it("retains a pending refund request without showing its completion in the next session", async () => {
  mock.userId = "sender"
  mock.authUserId = "sender"
  mock.invoice = { ...invoice, status: "paid", damageDepositAmount: 1000 }
  const pending = deferred<{ status: string }>()
  mock.refund.mockReturnValue(pending.promise)
  const view = render(<InvoiceDetailPage />)
  fireEvent.click(screen.getByRole("button", { name: "Refund deposit" }))
  const key = "deposit-refund:invoice-a:remaining"
  const requestId = sessionStorage.getItem(key)
  expect(requestId).toBeTruthy()
  mock.sessionId = "new-session"
  view.rerender(<InvoiceDetailPage />)
  await act(async () => pending.resolve({ status: "succeeded" }))
  expect(sessionStorage.getItem(key)).toBe(requestId)
  expect(mock.success).not.toHaveBeenCalled()
})

it.each([
  "sent",
  "viewed",
  "payment_pending",
  "processing",
  "failed",
  "overdue",
  "cancelled",
])("never labels %s invoices as paid", (status) => {
  mock.invoice = { ...invoice, status }
  render(<InvoiceDetailPage />)
  expect(screen.getByText("Amount due").parentElement).toHaveTextContent("$1.58")
  expect(screen.queryByText("Amount paid")).not.toBeInTheDocument()
  expect(screen.queryByText("Remaining balance")).not.toBeInTheDocument()
})

it("shows the settled amount and zero balance without altering the expected charge", () => {
  mock.invoice = { ...invoice, status: "paid" }
  render(<InvoiceDetailPage />)
  expect(screen.getByText("Amount paid").parentElement).toHaveTextContent("$1.58")
  expect(screen.getByText("Remaining balance").parentElement).toHaveTextContent("$0.00")
  expect(screen.getByText("Invoice total").parentElement).toHaveTextContent("$1.23")
  expect(screen.getByText("Card processing fee").parentElement).toHaveTextContent("$0.35")
  expect(screen.queryByText("Amount due")).not.toBeInTheDocument()
  expect(mock.invoice.amountDue).toBe(158)
})
