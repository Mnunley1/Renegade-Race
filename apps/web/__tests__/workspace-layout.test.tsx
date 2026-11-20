import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import InvoiceDetailPage from "@/app/deals/invoices/[id]/page"
import InvoicesPage from "@/app/deals/invoices/page"
import PaddockPage from "@/app/paddock/page"

const mock = vi.hoisted(() => ({
  invoices: undefined as Record<string, unknown>[] | undefined,
  invoice: undefined as Record<string, unknown> | null | undefined,
  feed: undefined as Record<string, unknown>[] | undefined,
  signedIn: true,
  userId: "sender",
  queries: vi.fn(),
  createDraft: vi.fn(),
  send: vi.fn(),
  createPost: vi.fn(),
  markViewed: vi.fn(),
  choosePayment: vi.fn(),
  otherAction: vi.fn(),
  toastError: vi.fn(),
  handleError: vi.fn(),
}))
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    isSignedIn: mock.signedIn,
    isLoaded: true,
    user: mock.signedIn ? { id: mock.userId, firstName: "Renter" } : null,
  }),
  useAuth: () => ({
    userId: mock.signedIn ? mock.userId : null,
    sessionId: mock.signedIn ? `session-${mock.userId}` : null,
    isSignedIn: mock.signedIn,
    isLoaded: true,
  }),
}))
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "invoice" }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mock.toastError } }))
vi.mock("@/lib/error-handler", () => ({ handleErrorWithContext: mock.handleError }))
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: mock.signedIn }),
  useQuery: (fn: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(fn)
    mock.queries(name, args)
    if (args === "skip") return
    switch (name) {
      case "invoices:getMine":
        return mock.invoices
      case "invoices:getById":
        return mock.invoice
      case "users:searchForInvoiceRecipients":
        return [{ externalId: "recipient", name: "Driver", email: "driver@example.com" }]
      case "vehicles:getByOwner":
        return [
          { _id: "vehicle", year: 2026, make: "Track", model: "Car", damageDepositAmount: 50000 },
        ]
      case "posts:listFeed":
        return mock.feed
      case "posts:listOnlineNow":
        return []
      default:
        return
    }
  },
  useMutation: (fn: Parameters<typeof getFunctionName>[0]) => {
    switch (getFunctionName(fn)) {
      case "invoices:createDraft":
        return mock.createDraft
      case "invoices:send":
        return mock.send
      case "invoices:markViewed":
        return mock.markViewed
      case "posts:createPost":
        return mock.createPost
      default:
        return mock.otherAction
    }
  },
  useAction: (fn: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(fn) === "invoices:choosePaymentMethod" ? mock.choosePayment : mock.otherAction,
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
  _id: "invoice",
  title: "Track session",
  senderId: "sender",
  recipientId: "recipient",
  status: "sent",
  total: 4092,
  subtotal: 4092,
  amountDue: 4092,
  lineItems: [{ description: "Coaching", quantity: 2, unitAmount: 2046, amount: 4092 }],
  paymentMethods: ["stripe_card", "stripe_ach"],
  sender: { name: "Coach" },
  recipient: { name: "Driver" },
}
beforeEach(() => {
  vi.clearAllMocks()
  mock.invoices = undefined
  mock.invoice = undefined
  mock.feed = undefined
  mock.signedIn = true
  mock.userId = "sender"
  mock.createDraft.mockResolvedValue("invoice")
  mock.send.mockResolvedValue(undefined)
  mock.createPost.mockResolvedValue("post")
  mock.markViewed.mockResolvedValue(undefined)
  mock.choosePayment.mockResolvedValue({})
})
afterEach(cleanup)

function openInvoiceForm() {
  fireEvent.click(screen.getByRole("button", { name: "Create invoice" }))
  return within(screen.getByRole("form", { name: "Create invoice" }))
}

it("shows the invoice list first and distinguishes loading from empty without querying recipients", () => {
  const page = render(<InvoicesPage />)
  expect(screen.getByRole("heading", { level: 1, name: "Invoices" })).toBeInTheDocument()
  expect(screen.getByRole("status", { name: "Loading invoices" })).toBeInTheDocument()
  expect(screen.queryByText("No invoices yet.")).toBeNull()
  expect(screen.queryByRole("form")).toBeNull()
  expect(screen.queryByRole("link", { name: "Deals" })).toBeNull()
  expect(mock.queries).toHaveBeenCalledWith("users:searchForInvoiceRecipients", "skip")
  expect(mock.createDraft).not.toHaveBeenCalled()
  mock.invoices = []
  page.rerender(<InvoicesPage />)
  expect(screen.getByText("No invoices yet.")).toBeInTheDocument()
  expect(screen.queryByRole("status", { name: "Loading invoices" })).toBeNull()
})

it("preserves every invoice field while closing and reopening without sending", () => {
  render(<InvoicesPage />)
  const form = openInvoiceForm()
  fireEvent.change(form.getByLabelText("Title"), { target: { value: "Coaching package" } })
  fireEvent.change(form.getByLabelText("Recipient"), { target: { value: "Driver" } })
  fireEvent.change(form.getAllByRole("combobox")[0]!, { target: { value: "recipient" } })
  fireEvent.change(form.getAllByRole("combobox")[1]!, { target: { value: "vehicle" } })
  fireEvent.change(form.getByLabelText("Due date"), { target: { value: "2030-01-05" } })
  fireEvent.change(form.getAllByLabelText("Description")[0]!, {
    target: { value: "Bring a helmet" },
  })
  const item = within(form.getByRole("group", { name: "Line item 1" }))
  fireEvent.change(item.getByLabelText("Description"), { target: { value: "Session" } })
  fireEvent.change(item.getByLabelText("Quantity"), { target: { value: "2" } })
  fireEvent.change(item.getByLabelText("Unit price ($)"), { target: { value: "20.46" } })
  fireEvent.click(form.getByRole("checkbox", { name: "Card" }))
  fireEvent.click(screen.getByRole("button", { name: "Close form" }))
  expect(screen.queryByRole("form")).toBeNull()
  expect(mock.queries).toHaveBeenLastCalledWith("users:searchForInvoiceRecipients", "skip")
  const restored = openInvoiceForm()
  expect(restored.getByLabelText("Title")).toHaveValue("Coaching package")
  expect(restored.getByLabelText("Recipient")).toHaveValue("Driver")
  expect(restored.getByLabelText("Due date")).toHaveValue("2030-01-05")
  expect(restored.getAllByLabelText("Description")[0]).toHaveValue("Bring a helmet")
  expect(restored.getByLabelText("Quantity")).toHaveValue(2)
  expect(restored.getByLabelText("Unit price ($)")).toHaveValue(20.46)
  expect(restored.getAllByRole("combobox")[0]).toHaveValue("recipient")
  expect(restored.getAllByRole("combobox")[1]).toHaveValue("vehicle")
  expect(restored.getByRole("checkbox", { name: "Card" })).not.toBeChecked()
  expect(restored.getByRole("checkbox", { name: "ACH Direct Debit" })).toBeChecked()
  expect(mock.createDraft).not.toHaveBeenCalled()
  expect(mock.send).not.toHaveBeenCalled()
})

it("sends the unchanged invoice payload only after explicit submission", async () => {
  render(<InvoicesPage />)
  const form = openInvoiceForm()
  fireEvent.change(form.getByLabelText("Title"), { target: { value: "Coaching package" } })
  fireEvent.change(form.getAllByRole("combobox")[0]!, { target: { value: "recipient" } })
  fireEvent.change(form.getAllByRole("combobox")[1]!, { target: { value: "vehicle" } })
  fireEvent.change(form.getByLabelText("Due date"), { target: { value: "2030-01-05" } })
  fireEvent.change(form.getAllByLabelText("Description")[0]!, {
    target: { value: "Bring a helmet" },
  })
  fireEvent.change(
    within(form.getByRole("group", { name: "Line item 1" })).getByLabelText("Description"),
    { target: { value: " Session " } }
  )
  fireEvent.change(form.getByLabelText("Quantity"), { target: { value: "2" } })
  fireEvent.change(form.getByLabelText("Unit price ($)"), { target: { value: "20.46" } })
  fireEvent.click(form.getByRole("button", { name: "Send invoice" }))
  await waitFor(() => expect(mock.send).toHaveBeenCalledWith({ invoiceId: "invoice" }))
  expect(mock.createDraft).toHaveBeenCalledWith({
    recipientId: "recipient",
    title: "Coaching package",
    description: "Bring a helmet",
    dueDate: "2030-01-05",
    lineItems: [{ description: "Session", quantity: 2, unitAmount: 2046, amount: 4092 }],
    paymentMethods: ["stripe_card", "stripe_ach"],
    depositVehicleId: "vehicle",
  })
  expect(mock.createDraft).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole("form")).toBeNull()
})

it("labels line item fields and removal controls while keeping one item", () => {
  render(<InvoicesPage />)
  const form = openInvoiceForm()
  expect(form.getByRole("button", { name: "Remove line item 1" })).toBeDisabled()
  fireEvent.click(form.getByRole("button", { name: "Add item" }))
  expect(
    within(form.getByRole("group", { name: "Line item 2" })).getByLabelText("Unit price ($)")
  ).toHaveAttribute("step", "0.01")
  fireEvent.click(form.getByRole("button", { name: "Remove line item 1" }))
  expect(form.getAllByRole("group")).toHaveLength(1)
  expect(mock.createDraft).not.toHaveBeenCalled()
})

it("shows zero due and the full long invoice title rather than substituting the original total", () => {
  const title = "Long invoice title ".repeat(20)
  mock.invoices = [{ ...invoice, title, status: "paid", amountDue: 0 }]
  render(<InvoicesPage />)
  const row = screen.getByRole("link", { name: `${title.trim()} Sent paid $0.00` })
  expect(row).toHaveAttribute("href", "/deals/invoices/invoice")
  expect(within(row).getByText(title.trim())).toHaveClass("break-words")
  expect(within(row).queryByText("$40.92")).toBeNull()
})

it("keeps invoice detail loading, unavailable, and zero-due states distinct with an Invoices back link", () => {
  const page = render(<InvoiceDetailPage />)
  expect(screen.getByRole("status", { name: "Loading invoice" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Invoices" })).toHaveAttribute("href", "/deals/invoices")
  mock.invoice = null
  page.rerender(<InvoiceDetailPage />)
  expect(screen.getByRole("heading", { name: "Invoice not found" })).toBeInTheDocument()
  mock.invoice = { ...invoice, amountDue: 0, status: "paid" }
  page.rerender(<InvoiceDetailPage />)
  expect(screen.getByText("Amount paid").parentElement).toHaveTextContent("$0.00")
  expect(screen.getByText("Remaining balance").parentElement).toHaveTextContent("$0.00")
  expect(screen.queryByText("Amount due")).not.toBeInTheDocument()
  expect(mock.choosePayment).not.toHaveBeenCalled()
})

it("keeps invoice payment method actions explicit and unchanged", async () => {
  mock.userId = "recipient"
  mock.invoice = invoice
  render(<InvoiceDetailPage />)
  expect(mock.choosePayment).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Pay by card$40.92" }))
  await waitFor(() =>
    expect(mock.choosePayment).toHaveBeenCalledWith({
      invoiceId: "invoice",
      paymentMethod: "stripe_card",
    })
  )
})

it("announces the selected paddock scope and separates feed loading from empty", () => {
  const page = render(<PaddockPage />)
  expect(screen.getByRole("heading", { level: 1, name: "The Paddock" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "For you" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("status", { name: "Loading paddock posts" })).toBeInTheDocument()
  expect(screen.queryByText("The paddock is quiet right now.")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Following" }))
  expect(mock.queries).toHaveBeenCalledWith("posts:listFeed", { scope: "following", limit: 50 })
  expect(screen.getByRole("button", { name: "For you" })).toHaveAttribute("aria-pressed", "false")
  expect(screen.getByRole("button", { name: "Following" })).toHaveAttribute("aria-pressed", "true")
  mock.feed = []
  page.rerender(<PaddockPage />)
  expect(screen.getByText("The paddock is quiet right now.")).toBeInTheDocument()
})

it("preserves a failed paddock post and permits an explicit retry", async () => {
  mock.createPost.mockRejectedValueOnce(new Error("Internal server details"))
  render(<PaddockPage />)
  fireEvent.change(screen.getByRole("textbox", { name: "Write a paddock post" }), {
    target: { value: "Our next track day" },
  })
  expect(mock.createPost).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Post" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Your post could not be shared")
  expect(screen.getByRole("textbox")).toHaveValue("Our next track day")
  expect(screen.getByRole("button", { name: "Post" })).toBeEnabled()
  fireEvent.click(screen.getByRole("button", { name: "Post" }))
  await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""))
  expect(mock.createPost).toHaveBeenCalledTimes(2)
  expect(mock.createPost).toHaveBeenLastCalledWith({ content: "Our next track day" })
  expect(screen.queryByRole("alert")).toBeNull()
})

it("preserves ACH-only and no-deposit choices in the submitted payload", async () => {
  render(<InvoicesPage />)
  const form = openInvoiceForm()
  fireEvent.change(form.getByLabelText("Title"), { target: { value: "ACH invoice" } })
  fireEvent.change(form.getAllByRole("combobox")[0]!, { target: { value: "recipient" } })
  fireEvent.click(form.getByRole("checkbox", { name: "Card" }))
  fireEvent.click(form.getByRole("button", { name: "Send invoice" }))
  await waitFor(() => expect(mock.send).toHaveBeenCalledTimes(1))
  expect(mock.createDraft).toHaveBeenCalledWith(
    expect.objectContaining({ paymentMethods: ["stripe_ach"], depositVehicleId: undefined })
  )
})

it("preserves invoice inputs and keeps the form available when creation fails", async () => {
  mock.createDraft.mockRejectedValueOnce(new Error("Service unavailable"))
  render(<InvoicesPage />)
  const form = openInvoiceForm()
  fireEvent.change(form.getByLabelText("Title"), { target: { value: "Keep this invoice" } })
  fireEvent.change(form.getAllByRole("combobox")[0]!, { target: { value: "recipient" } })
  fireEvent.click(form.getByRole("button", { name: "Send invoice" }))
  await waitFor(() =>
    expect(mock.handleError).toHaveBeenCalledWith(expect.any(Error), { action: "send invoice" })
  )
  expect(screen.getByLabelText("Title")).toHaveValue("Keep this invoice")
  expect(screen.getByRole("button", { name: "Send invoice" })).toBeEnabled()
  expect(screen.getByRole("button", { name: "Close form" })).toBeEnabled()
  expect(mock.send).not.toHaveBeenCalled()
})
