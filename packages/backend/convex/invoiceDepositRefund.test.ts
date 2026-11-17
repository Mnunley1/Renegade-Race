// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"

const sdk = vi.hoisted(() => ({
  invoice: vi.fn(),
  payments: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  charge: vi.fn(),
  retrieve: vi.fn(),
}))
vi.mock("stripe", () => ({
  default: class {
    invoices = { retrieve: sdk.invoice }
    invoicePayments = { list: sdk.payments }
    charges = { retrieve: sdk.charge }
    refunds = { list: sdk.list, create: sdk.create, retrieve: sdk.retrieve }
  },
}))
vi.mock("./r2", () => ({ r2: {} }))
const modules = (
  import.meta as unknown as { glob: (path: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture")
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function setup() {
  const t = convexTest(schema, modules)
  const invoiceId = await t.run(async ({ db }) => {
    await db.insert("users", {
      externalId: "seller",
      name: "Seller",
      stripeAccountId: "acct_changed",
    })
    return await db.insert("invoices", {
      recipientId: "buyer",
      senderId: "seller",
      title: "Rental",
      subtotal: 5000,
      total: 5000,
      currency: "usd",
      lineItems: [{ description: "Rental", quantity: 1, unitAmount: 5000, amount: 5000 }],
      paymentMethods: ["stripe_ach"],
      status: "paid",
      damageDepositAmount: 1500,
      depositStatus: "held",
      stripeInvoiceId: "in_origin",
      createdAt: 1,
      updatedAt: 1,
    })
  })
  sdk.invoice.mockResolvedValue({
    id: "in_origin",
    customer: "cus_original",
    status: "paid",
    metadata: { type: "custom_invoice", invoiceId, senderId: "seller", recipientId: "buyer" },
  })
  sdk.payments.mockResolvedValue({
    data: [
      {
        invoice: "in_origin",
        payment: {
          type: "payment_intent",
          payment_intent: { id: "pi_orig", customer: "cus_original", latest_charge: "ch_original" },
        },
      },
    ],
    has_more: false,
  })
  type Row = {
    id: string
    status: string
    charge: string
    amount: number
    metadata: Record<string, string>
  }
  const refunds: Row[] = []
  sdk.list.mockImplementation(() => refunds.map((r) => ({ ...r })))
  sdk.create.mockImplementation(
    (params: { charge: string; amount: number; metadata: Record<string, string> }) => {
      const result = { id: `re_${refunds.length + 1}`, status: "succeeded", ...params }
      refunds.unshift(result)
      return result
    }
  )
  const seller = t.withIdentity({ subject: "seller" }),
    buyer = t.withIdentity({ subject: "buyer" })
  const issue = (requestId: string, amount?: number) =>
    seller.action(api.invoices.refundDeposit, { invoiceId, requestId, amount })
  const sync = () =>
    t.action(internal.invoices.syncDepositRefund, { invoiceId, chargeId: "ch_original" })
  const current = () => t.run(({ db }) => db.get(invoiceId))
  return { t, buyer, invoiceId, refunds, issue, sync, current }
}

describe("invoice damage deposit refunds", () => {
  it("authenticates the sender and resolves the original charge even when their payout account changed", async () => {
    const { buyer, t, invoiceId, issue } = await setup()
    await expect(buyer.action(api.invoices.refundDeposit, { invoiceId })).rejects.toThrow(
      "Only the invoice sender"
    )
    await t.run(({ db }) => db.patch(invoiceId, { stripeChargeId: "ch_foreign" }))
    await expect(issue("wrong")).rejects.toThrow("original Stripe invoice charge")
    await t.run(({ db }) => db.patch(invoiceId, { stripeChargeId: undefined }))
    await issue("original", 750)
    expect(sdk.create).toHaveBeenCalledWith(
      expect.objectContaining({ charge: "ch_original", amount: 750, reverse_transfer: true }),
      expect.anything()
    )
  })
  it("fails closed for a different recorded intent, different payer, or ambiguous paid invoice", async () => {
    const { issue, t, invoiceId } = await setup()
    await t.run(({ db }) => db.patch(invoiceId, { stripePaymentIntentId: "pi_recorded" }))
    await expect(issue("wrong-intent")).rejects.toThrow("original Stripe invoice charge")
    const paid = (customer: string) => ({
      invoice: "in_origin",
      payment: {
        type: "payment_intent",
        payment_intent: { id: "pi_recorded", customer, latest_charge: "ch_original" },
      },
    })
    sdk.payments.mockResolvedValueOnce({ data: [paid("cus_unrelated")], has_more: false })
    await expect(issue("wrong-payer")).rejects.toThrow("original Stripe invoice payment")
    sdk.payments.mockResolvedValueOnce({
      data: [paid("cus_original"), paid("cus_original")],
      has_more: false,
    })
    await expect(issue("ambiguous")).rejects.toThrow("original Stripe invoice payment")
    sdk.payments.mockResolvedValueOnce({
      data: [{ invoice: "in_origin", payment: { type: "charge", charge: "ch_direct" } }],
      has_more: false,
    })
    sdk.charge.mockResolvedValueOnce({
      id: "ch_direct",
      customer: "cus_original",
      payment_intent: "pi_unrelated",
    })
    await expect(issue("direct-charge-wrong-intent")).rejects.toThrow(
      "original Stripe invoice charge"
    )
    expect(sdk.create).not.toHaveBeenCalled()
    sdk.payments.mockResolvedValueOnce({ data: [paid("cus_original")], has_more: false })
    await expect(issue("matching-intent", 400)).resolves.toMatchObject({ status: "succeeded" })
  })
  it("replays a completed partial request and permits a distinct second partial", async () => {
    const { issue, current } = await setup()
    const first = await issue("one", 300)
    await expect(issue("one", 300)).resolves.toEqual(first)
    await expect(issue("one", 500)).rejects.toThrow("request changed")
    await issue("two", 300)
    await expect(current()).resolves.toMatchObject({
      depositRefundAmount: 600,
      depositStatus: "partially_refunded",
    })
    expect(sdk.create).toHaveBeenCalledTimes(2)
  })
  it("keeps pending amounts out of settled totals and releases a failed refund on webhook reconciliation", async () => {
    const { issue, refunds, sync, current } = await setup()
    sdk.create.mockImplementationOnce((params) => {
      const row = { id: "re_pending", status: "pending", ...params }
      refunds.unshift(row)
      return row
    })
    await expect(issue("pending", 900)).resolves.toMatchObject({ status: "pending" })
    await expect(current()).resolves.toMatchObject({
      depositRefundAmount: 0,
      depositRefundPendingAmount: 900,
      depositStatus: "held",
    })
    await expect(issue("oversize", 601)).rejects.toThrow("Invalid deposit refund amount")
    const pending = refunds.find((r) => r.id === "re_pending")
    if (!pending) throw new Error("Missing fixture refund")
    pending.status = "failed"
    await sync()
    await expect(current()).resolves.toMatchObject({
      depositRefundAmount: 0,
      depositRefundPendingAmount: 0,
      depositLatestRefundStatus: "failed",
    })
    await expect(issue("pending", 900)).resolves.toMatchObject({ status: "failed" })
    await issue("replacement", 1500)
    await sync()
    expect(sdk.create).toHaveBeenCalledTimes(2)
    await expect(current()).resolves.toMatchObject({
      depositRefundAmount: 1500,
      depositRefundPendingAmount: 0,
      depositStatus: "refunded",
    })
  })
  it("releases a definitively rejected request and never retries its provider create", async () => {
    const { issue, current } = await setup()
    sdk.create.mockRejectedValueOnce(
      Object.assign(new Error("No refundable balance"), {
        type: "StripeInvalidRequestError",
        statusCode: 400,
      })
    )
    await expect(issue("declined", 400)).resolves.toMatchObject({ status: "failed" })
    await expect(issue("declined", 400)).resolves.toMatchObject({ status: "failed" })
    await expect(current()).resolves.toMatchObject({ depositRefundAmount: 0 })
    await expect(issue("new", 400)).resolves.toMatchObject({ status: "succeeded" })
    expect(sdk.create).toHaveBeenCalledTimes(2)
  })
  it("recovers an accepted provider request after its response is lost, including on scheduled recovery", async () => {
    const { t, issue, refunds, current } = await setup()
    sdk.create.mockImplementationOnce((params) => {
      refunds.push({ id: "re_ambiguous", status: "succeeded", ...params })
      throw new Error("connection reset after submit")
    })
    await expect(issue("interrupted", 400)).rejects.toThrow("connection reset")
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    await expect(issue("interrupted", 400)).resolves.toMatchObject({ id: "re_ambiguous" })
    expect(sdk.create).toHaveBeenCalledTimes(1)
    await expect(current()).resolves.toMatchObject({ depositRefundAmount: 400 })
  })
  it("reserves deposit capacity atomically and corrects totals from legacy tagged refunds", async () => {
    const { t, invoiceId, issue, refunds, current } = await setup()
    refunds.push({
      id: "re_legacy",
      status: "succeeded",
      charge: "ch_original",
      amount: 700,
      metadata: { type: "invoice_damage_deposit_refund", invoiceId },
    })
    await expect(issue("over-cap", 801)).rejects.toThrow("Invalid deposit refund amount")
    const requests = await Promise.allSettled(
      ["race1", "race2"].map((requestId) =>
        t.mutation(internal.invoices.reserveDepositRefund, { invoiceId, requestId, amount: 700 })
      )
    )
    expect(requests.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    expect(requests.filter((r) => r.status === "rejected")).toHaveLength(1)
    expect(sdk.create).not.toHaveBeenCalled()
    await expect(current()).resolves.toMatchObject({ depositRefundAmount: 700 })
  })
})
