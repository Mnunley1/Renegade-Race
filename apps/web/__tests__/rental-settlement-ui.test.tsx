import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { RentalSettlementNotice } from "@/components/rental-settlement-notice"
import {
  RentalSettlementQueue,
  RentalSettlementReview,
} from "../../admin/components/rental-settlement-review"

const state = vi.hoisted(() => ({
  userId: "renter" as string | null,
  ready: true,
  session: "session-1",
  convexReady: true,
  participant: null as Record<string, unknown> | null | undefined,
  reviews: [] as Record<string, unknown>[],
  loadingReviews: false,
  queries: vi.fn(),
  refresh: vi.fn(),
  resolve: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: state.ready,
    isSignedIn: !!state.userId,
    userId: state.userId,
    sessionId: state.userId ? state.session : null,
  }),
}))
vi.mock("@/hooks/useAccountAuth", () => ({
  useAccountAuth: () => ({
    user: state.userId ? { id: state.userId } : null,
    isReady: state.ready && state.convexReady && !!state.userId,
    accountKey: `${state.userId}:${state.session}`,
  }),
}))
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.error } }))
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: state.convexReady, isLoading: !state.convexReady }),
  useAction: (fn: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(fn).endsWith(":resolve") ? state.resolve : state.refresh,
  useQuery: (fn: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(fn)
    state.queries(name, args)
    if (name.endsWith(":participantStatus")) return state.participant
    if (state.loadingReviews) return
    if (name.endsWith(":getByPayment")) return { reviews: state.reviews }
    if (name.endsWith(":listHeld")) return state.reviews
    return null
  },
}))

const PAYOUT_CAVEAT = /not completed bank payouts/

const evidence = {
  observedAt: 1_800_000_000_000,
  stripeChargeId: "ch_example",
  stripePaymentIntentId: "pi_example",
  stripeTransferId: "tr_original",
  applicationFeeId: "fee_example",
  destinationAccountId: "acct_host",
  failureBalanceTransactionId: "txn_failure",
  transferReversalIds: ["trr_reversal"],
  feeRefundIds: ["fr_adjustment"],
  currency: "usd",
  expectedHostAllocation: 95,
  currentHostAllocation: 60,
  differenceCents: 35,
  bindingVerified: true,
  allocationVerifiable: true,
  references: [{ kind: "failure_credit", id: "txn_failure", amount: 50, currency: "usd" }],
}
const review = {
  _id: "review",
  paymentId: "payment",
  refundId: "re_failed",
  customerRefundStatus: "failed",
  status: "held",
  latestEvidenceId: "evidence-1",
  evidence,
}

beforeEach(() => {
  vi.clearAllMocks()
  state.userId = "renter"
  state.ready = true
  state.convexReady = true
  state.session = "session-1"
  state.participant = {
    status: "held",
    customerRefundStatus: "failed",
    message: "Operator settlement review is required.",
  }
  state.reviews = [{ ...review }]
  state.loadingReviews = false
  state.refresh.mockResolvedValue(undefined)
  state.resolve.mockResolvedValue(undefined)
})
afterEach(cleanup)

it.each([
  "renter",
  "host",
] as const)("keeps %s customer refund outcome separate from settlement review", (role) => {
  state.userId = role
  render(
    <RentalSettlementNotice
      participantId={role}
      participantRole={role}
      reservationId="reservation"
    />
  )
  expect(screen.getByText("Settlement review pending")).toBeVisible()
  expect(
    screen.getByText(role === "renter" ? "Your refund failed." : "The customer refund failed.")
  ).toBeVisible()
  expect(screen.queryByText("Host settlement restored.")).toBeNull()
  expect(screen.getByRole("link", { name: "Contact support" })).toHaveAttribute("href", "/contact")
  expect(screen.queryByText("acct_host")).toBeNull()
  expect(state.refresh).not.toHaveBeenCalled()
  expect(state.resolve).not.toHaveBeenCalled()
})

it("does not query participant state before auth readiness, for guests, or for an unrelated profile", () => {
  state.ready = false
  const view = render(
    <RentalSettlementNotice
      participantId="renter"
      participantRole="renter"
      reservationId="reservation"
    />
  )
  expect(state.queries).not.toHaveBeenCalled()
  state.ready = true
  state.userId = null
  view.rerender(
    <RentalSettlementNotice
      participantId="renter"
      participantRole="renter"
      reservationId="reservation"
    />
  )
  state.userId = "other"
  view.rerender(
    <RentalSettlementNotice
      participantId="renter"
      participantRole="renter"
      reservationId="reservation"
    />
  )
  expect(state.queries).not.toHaveBeenCalled()
})

it("removes protected notice immediately on account change and distinguishes loading, missing, and resolved state", () => {
  const view = render(
    <RentalSettlementNotice
      participantId="renter"
      participantRole="renter"
      reservationId="reservation"
    />
  )
  state.userId = "other"
  view.rerender(
    <RentalSettlementNotice
      participantId="renter"
      participantRole="renter"
      reservationId="reservation"
    />
  )
  expect(screen.queryByText("Settlement review pending")).toBeNull()
  state.userId = "renter"
  state.participant = undefined
  view.rerender(
    <RentalSettlementNotice
      participantId="renter"
      participantRole="renter"
      reservationId="reservation"
    />
  )
  expect(screen.getByText("Checking settlement review…")).toBeVisible()
  state.participant = null
  view.rerender(
    <RentalSettlementNotice
      participantId="renter"
      participantRole="renter"
      reservationId="reservation"
    />
  )
  expect(screen.queryByRole("status")).toBeNull()
  state.participant = {
    status: "resolved",
    customerRefundStatus: "failed",
    message: "Settlement verified; bank payout is not confirmed.",
  }
  view.rerender(
    <RentalSettlementNotice
      participantId="renter"
      participantRole="renter"
      reservationId="reservation"
    />
  )
  expect(screen.getByText("Settlement review completed")).toBeVisible()
  expect(screen.getByText("Your refund failed.")).toBeVisible()
  expect(screen.queryByRole("link", { name: "Contact support" })).toBeNull()
})

it("surfaces held failed refunds in their own operator queue even if successful refund totals are zero", () => {
  state.userId = "admin"
  render(<RentalSettlementQueue />)
  expect(screen.getByRole("link", { name: "Review payment payment" })).toHaveAttribute(
    "href",
    "/payments/payment"
  )
  expect(screen.getByText("Settlement review pending")).toBeVisible()
  expect(state.queries).toHaveBeenCalledWith("rentalSettlement:listHeld", { viewerId: "admin" })
  expect(state.refresh).not.toHaveBeenCalled()
})

it("keeps a canceled refund outcome explicit without claiming a successful refund", () => {
  state.participant = {
    status: "held",
    customerRefundStatus: "canceled",
    message: "Settlement review is required.",
  }
  render(
    <RentalSettlementNotice
      participantId="renter"
      participantRole="renter"
      reservationId="reservation"
    />
  )
  expect(screen.getByText("Your refund status: canceled")).toBeVisible()
  expect(screen.getByText("Settlement review pending")).toBeVisible()
})

it("does not present an empty review queue while its query is loading", () => {
  state.userId = "admin"
  state.loadingReviews = true
  render(<RentalSettlementQueue />)
  expect(screen.getByText("Loading settlement reviews…")).toBeVisible()
  expect(screen.queryByText("No settlement reviews are currently on hold.")).toBeNull()
})

it("shows bound provider references and the allocation difference without promising a payout", () => {
  state.userId = "admin"
  render(<RentalSettlementReview paymentId={"payment" as never} />)
  expect(screen.getByText("0.95 USD")).toBeVisible()
  expect(screen.getByText("0.60 USD")).toBeVisible()
  expect(screen.getByText("0.35 USD")).toBeVisible()
  expect(screen.getByText("acct_host")).toBeVisible()
  expect(screen.getByText(PAYOUT_CAVEAT)).toBeVisible()
  expect(screen.getByRole("button", { name: "Record verified resolution" })).toBeDisabled()
  expect(state.resolve).not.toHaveBeenCalled()
})

it("does not substitute zero for unavailable evidence or offer resolution without an evidence version", () => {
  state.userId = "admin"
  state.reviews = [
    {
      ...review,
      latestEvidenceId: undefined,
      evidence: {
        ...evidence,
        allocationVerifiable: false,
        expectedHostAllocation: null,
        currentHostAllocation: null,
        differenceCents: null,
      },
    },
  ]
  render(<RentalSettlementReview paymentId={"payment" as never} />)
  expect(screen.getAllByText("Unavailable")).toHaveLength(3)
  expect(screen.queryByText("0.00 USD")).toBeNull()
  expect(screen.getByRole("button", { name: "Record verified resolution" })).toBeDisabled()
})

function completeResolution() {
  fireEvent.change(screen.getByRole("textbox", { name: "Resolution reference" }), {
    target: { value: " case-123 " },
  })
  fireEvent.change(screen.getByRole("textbox", { name: "Operator notes" }), {
    target: { value: " Provider allocation independently checked. " },
  })
  fireEvent.click(screen.getByRole("checkbox"))
}

it("records only explicit evidence-bound resolution with references, never an amount or a transfer request", async () => {
  state.userId = "admin"
  render(<RentalSettlementReview paymentId={"payment" as never} />)
  completeResolution()
  fireEvent.change(
    screen.getByRole("textbox", { name: "Existing compensating transfer IDs (optional)" }),
    { target: { value: "tr_existing,tr_existing\ntr_second" } }
  )
  fireEvent.click(screen.getByRole("button", { name: "Record verified resolution" }))
  await waitFor(() =>
    expect(state.resolve).toHaveBeenCalledWith({
      reviewId: "review",
      expectedEvidenceId: "evidence-1",
      reference: "case-123",
      notes: "Provider allocation independently checked.",
      compensatingTransferIds: ["tr_existing", "tr_second"],
    })
  )
  expect(state.refresh).not.toHaveBeenCalled()
  expect(screen.queryByRole("spinbutton")).toBeNull()
})

it("retains operator inputs and held status when provider verification rejects resolution", async () => {
  state.userId = "admin"
  state.resolve.mockRejectedValueOnce(new Error("allocation remains short"))
  render(<RentalSettlementReview paymentId={"payment" as never} />)
  completeResolution()
  fireEvent.click(screen.getByRole("button", { name: "Record verified resolution" }))
  await waitFor(() =>
    expect(state.error).toHaveBeenCalledWith(expect.stringContaining("remains on hold"))
  )
  expect(screen.getByRole("textbox", { name: "Resolution reference" })).toHaveValue(" case-123 ")
  expect(screen.getByText("Settlement review pending")).toBeVisible()
  expect(state.success).not.toHaveBeenCalled()
})

it("validates existing transfer references and requires an explicit acknowledgement", () => {
  state.userId = "admin"
  render(<RentalSettlementReview paymentId={"payment" as never} />)
  fireEvent.change(screen.getByRole("textbox", { name: "Resolution reference" }), {
    target: { value: "case-123" },
  })
  fireEvent.change(screen.getByRole("textbox", { name: "Operator notes" }), {
    target: { value: "Checked" },
  })
  expect(screen.getByRole("button", { name: "Record verified resolution" })).toBeDisabled()
  fireEvent.click(screen.getByRole("checkbox"))
  fireEvent.change(
    screen.getByRole("textbox", { name: "Existing compensating transfer IDs (optional)" }),
    { target: { value: "Send 35 cents" } }
  )
  fireEvent.click(screen.getByRole("button", { name: "Record verified resolution" }))
  expect(state.resolve).not.toHaveBeenCalled()
  expect(state.error).toHaveBeenCalled()
})

it("waits for admin account readiness, resets drafts on session change and ignores stale action completions", async () => {
  state.userId = "admin"
  state.ready = false
  const view = render(<RentalSettlementReview paymentId={"payment" as never} />)
  expect(state.queries).not.toHaveBeenCalled()
  state.ready = true
  view.rerender(<RentalSettlementReview paymentId={"payment" as never} />)
  let finish!: () => void
  state.resolve.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
  )
  completeResolution()
  fireEvent.click(screen.getByRole("button", { name: "Record verified resolution" }))
  state.session = "session-2"
  view.rerender(<RentalSettlementReview paymentId={"payment" as never} />)
  expect(screen.getByRole("textbox", { name: "Resolution reference" })).toHaveValue("")
  await act(async () => finish())
  expect(state.success).not.toHaveBeenCalled()
})

it("shows recorded operator evidence separately from customer refund outcome after resolution", () => {
  state.userId = "admin"
  state.reviews = [
    {
      ...review,
      status: "resolved",
      resolution: {
        operatorId: "admin",
        reference: "case-123",
        notes: "Verified against ledger",
        resolvedAt: 1_800_000_000_000,
      },
    },
  ]
  render(<RentalSettlementReview paymentId={"payment" as never} />)
  expect(screen.getByText("Settlement review resolved")).toBeVisible()
  expect(screen.getByText("Customer refund: failed")).toBeVisible()
  expect(
    within(
      screen.getByRole("region", { name: "Settlement review for refund re_failed" })
    ).getByText("Reference: case-123")
  ).toBeVisible()
  expect(screen.queryByRole("button", { name: "Record verified resolution" })).toBeNull()
})
