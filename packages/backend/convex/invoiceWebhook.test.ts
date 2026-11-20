// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import Stripe from "stripe"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import stripeSchema from "../node_modules/@convex-dev/stripe/dist/component/schema.js"
import { internal } from "./_generated/api"
import schema from "./schema"

const { stripeFetch } = vi.hoisted(() => ({ stripeFetch: vi.fn<typeof fetch>() }))
vi.mock("stripe", async (importOriginal) => {
  const { default: RealStripe } = await importOriginal<typeof import("stripe")>()
  return {
    default: class TestStripe extends RealStripe {
      constructor(key: string, options?: Stripe.StripeConfig) {
        super(key, { ...options, httpClient: RealStripe.createFetchHttpClient(stripeFetch) })
      }
    },
  }
})
const modules = (
  import.meta as unknown as { glob: (s: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
const stripeModules = (
  import.meta as unknown as { glob: (s: string) => Record<string, () => Promise<unknown>> }
).glob("../node_modules/@convex-dev/stripe/src/component/**/*.ts")
const secret = "whsec_invoice_events_test"
const stripe = new Stripe("sk_test_invoice_events")

beforeEach(() => {
  stripeFetch.mockReset()
  vi.useFakeTimers()
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_invoice_events")
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

async function setup() {
  const t = convexTest(schema, modules)
  t.registerComponent("stripe", stripeSchema, stripeModules)
  const invoiceId = await t.run(async ({ db }) => {
    await db.insert("users", {
      externalId: "sender",
      name: "Seller",
      stripeAccountId: "acct_sender",
    })
    await db.insert("users", { externalId: "payer", name: "Buyer", stripeCustomerId: "cus_payer" })
    return db.insert("invoices", {
      senderId: "sender",
      recipientId: "payer",
      title: "Synthetic support",
      lineItems: [{ description: "Support", quantity: 1, unitAmount: 10000, amount: 10000 }],
      subtotal: 10000,
      total: 10000,
      currency: "usd",
      amountDue: 10000,
      platformFee: 500,
      processingFee: 0,
      senderAmount: 9500,
      paymentMethods: ["stripe_ach", "stripe_card"],
      selectedPaymentMethod: "stripe_ach",
      stripeInvoiceId: "in_invoice",
      stripePaymentIntentId: "pi_current",
      status: "payment_pending",
      createdAt: 1,
      updatedAt: 1,
    })
  })
  const remote = {
    object: "invoice",
    id: "in_invoice",
    customer: "cus_payer",
    currency: "usd",
    amount_due: 10000,
    amount_paid: 0,
    status: "open",
    total: 10000,
    metadata: { type: "custom_invoice", invoiceId, senderId: "sender", recipientId: "payer" },
    transfer_data: { destination: "acct_sender" },
    application_fee_amount: 500,
  }
  const intent = {
    object: "payment_intent",
    id: "pi_current",
    customer: "cus_payer",
    currency: "usd",
    amount: 10000,
    amount_received: 0,
    status: "requires_payment_method",
    latest_charge: null as string | null,
    transfer_data: { destination: "acct_sender" },
    application_fee_amount: 500,
    metadata: { type: "custom_invoice", invoiceId },
    last_payment_error: { message: "Synthetic failure" },
  }
  const payment = {
    id: "inpay_default",
    object: "invoice_payment",
    invoice: "in_invoice",
    is_default: true,
    amount_requested: 10000,
    amount_paid: null as number | null,
    currency: "usd",
    status: "open",
    payment: { type: "payment_intent", payment_intent: "pi_current" },
  }
  const customer = { id: "cus_payer", object: "customer", metadata: { userId: "payer" } }
  const account = { id: "acct_sender", type: "express", metadata: { renegadeUserId: "sender" } }
  let mapped = true
  stripeFetch.mockImplementation((input) => {
    const url = new URL(String(input))
    const path = url.pathname
    let result: unknown
    if (path === "/v1/invoice_payments") {
      const requested = url.searchParams.get("payment[payment_intent]")
      result = {
        object: "list",
        data: mapped
          ? [
              {
                ...payment,
                payment: {
                  ...payment.payment,
                  payment_intent: requested ?? payment.payment.payment_intent,
                },
              },
            ]
          : [],
        has_more: false,
      }
    } else if (path === "/v1/invoices/in_invoice") result = remote
    else if (path.startsWith("/v1/payment_intents/"))
      result = { ...intent, id: path.split("/").at(-1) }
    else if (path === "/v1/customers/cus_payer") result = customer
    else if (path === "/v1/accounts/acct_sender") result = account
    else if (path === "/v1/charges/ch_paid")
      result = {
        id: "ch_paid",
        payment_intent: intent.id,
        customer: "cus_payer",
        amount: 10000,
        amount_captured: 10000,
        currency: "usd",
        paid: true,
        captured: true,
        transfer_data: { destination: "acct_sender" },
      }
    else throw new Error(`Unexpected Stripe path ${path}`)
    return Promise.resolve(
      new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
  })
  async function post(
    type: string,
    id: string,
    object: object = intent,
    options: { account?: string; signingSecret?: string } = {}
  ) {
    const payload = JSON.stringify({
      id,
      object: "event",
      type,
      data: { object },
      account: options.account,
    })
    const signature = await stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: options.signingSecret ?? secret,
      cryptoProvider: Stripe.createSubtleCryptoProvider(),
    })
    return t.fetch("/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: payload,
    })
  }
  const state = () =>
    t.run(async ({ db }) => ({
      invoice: await db.get(invoiceId),
      receipts: await db.query("webhookEvents").collect(),
      notifications: await db.query("notifications").collect(),
      audit: await db.query("auditLogs").collect(),
    }))
  return {
    t,
    invoiceId,
    remote,
    intent,
    payment,
    customer,
    account,
    post,
    state,
    setMapped: (value: boolean) => {
      mapped = value
    },
  }
}

describe("authoritative signed invoice reconciliation", () => {
  it("does not turn a current failure back into processing on a delayed processing event", async () => {
    const f = await setup()
    expect((await f.post("payment_intent.payment_failed", "evt_failed")).status).toBe(200)
    expect(
      (
        await f.post("payment_intent.processing", "evt_delayed_processing", {
          ...f.intent,
          status: "processing",
        })
      ).status
    ).toBe(200)
    expect((await f.state()).invoice?.status).toBe("payment_pending")
  })

  it("binds an early processing event from the provider invoice relationship", async () => {
    const f = await setup()
    await f.t.run(({ db }) => db.patch(f.invoiceId, { stripePaymentIntentId: undefined }))
    f.intent.status = "processing"
    expect(
      (await f.post("payment_intent.processing", "evt_early", { ...f.intent, metadata: {} })).status
    ).toBe(200)
    expect((await f.state()).invoice).toMatchObject({
      status: "processing",
      stripePaymentIntentId: "pi_current",
    })
  })

  it("retries matching events until local invoice registration exists", async () => {
    const f = await setup()
    await f.t.run(({ db }) =>
      db.patch(f.invoiceId, { stripeInvoiceId: undefined, stripePaymentIntentId: undefined })
    )
    f.intent.status = "processing"
    expect(
      (await f.post("payment_intent.processing", "evt_unregistered")).status
    ).toBeGreaterThanOrEqual(500)
    expect((await f.state()).receipts).toHaveLength(0)
    await f.t.run(({ db }) => db.patch(f.invoiceId, { stripeInvoiceId: "in_invoice" }))
    expect((await f.post("payment_intent.processing", "evt_unregistered")).status).toBe(200)
    expect((await f.state()).invoice?.status).toBe("processing")
  })

  it("reconciles a later current intent instead of applying an older attempt's failure", async () => {
    const f = await setup()
    await f.t.run(({ db }) => db.patch(f.invoiceId, { stripePaymentIntentId: "pi_old" }))
    f.intent.status = "processing"
    expect(
      (
        await f.post("payment_intent.payment_failed", "evt_old", {
          ...f.intent,
          id: "pi_old",
          status: "requires_payment_method",
        })
      ).status
    ).toBe(200)
    expect((await f.state()).invoice).toMatchObject({
      status: "processing",
      stripePaymentIntentId: "pi_current",
    })
  })

  it("rejects invalid signatures and ignores connected-account events before provider reads", async () => {
    const f = await setup()
    expect(
      (
        await f.post("invoice.paid", "evt_bad_signature", f.remote, {
          signingSecret: "whsec_wrong",
        })
      ).status
    ).toBe(400)
    expect(
      (await f.post("invoice.paid", "evt_connected", f.remote, { account: "acct_other" })).status
    ).toBe(200)
    expect(stripeFetch).not.toHaveBeenCalled()
    expect((await f.state()).receipts).toHaveLength(0)
  })

  it("applies paid capture once from Basil's invoice payments without legacy invoice fields", async () => {
    const f = await setup()
    f.remote.status = "paid"
    f.remote.amount_paid = 10000
    f.intent.status = "succeeded"
    f.intent.amount_received = 10000
    f.intent.latest_charge = "ch_paid"
    f.payment.status = "paid"
    f.payment.amount_paid = 10000
    await Promise.all([
      f.post("invoice.paid", "evt_paid", f.remote),
      f.post("invoice.paid", "evt_paid", f.remote),
    ])
    await f.post("payment_intent.processing", "evt_stale_processing")
    await f.post("invoice.payment_failed", "evt_stale_failure", f.remote)
    await f.t.finishAllScheduledFunctions(vi.runAllTimers)
    const state = await f.state()
    expect(state.invoice).toMatchObject({
      status: "paid",
      stripePaymentIntentId: "pi_current",
      stripeChargeId: "ch_paid",
    })
    expect(state.receipts.filter((r) => r.eventId === "evt_paid")).toHaveLength(1)
    expect(state.audit.filter((a) => a.action === "invoice_paid")).toHaveLength(1)
    expect(state.notifications).toHaveLength(2)
  })

  it.each([
    "paid",
    "refunded",
    "cancelled",
  ] as const)("never downgrades a local %s invoice", async (status) => {
    const f = await setup()
    await f.t.run(({ db }) =>
      db.patch(f.invoiceId, {
        status,
        stripePaymentIntentId: "pi_settled",
        stripeChargeId: "ch_original",
      })
    )
    f.intent.status = "processing"
    expect((await f.post("payment_intent.processing", `evt_keep_${status}`)).status).toBe(200)
    expect((await f.state()).invoice).toMatchObject({
      status,
      stripePaymentIntentId: "pi_settled",
      stripeChargeId: "ch_original",
    })
  })

  it("does not acknowledge an unmapped matching attempt and succeeds when association appears", async () => {
    const f = await setup()
    f.setMapped(false)
    f.intent.status = "processing"
    expect((await f.post("payment_intent.processing", "evt_missing_association")).status).toBe(500)
    expect((await f.state()).receipts).toHaveLength(0)
    f.setMapped(true)
    expect((await f.post("payment_intent.processing", "evt_missing_association")).status).toBe(200)
    expect((await f.state()).invoice?.status).toBe("processing")
  })

  it("re-reads Stripe after another reconciliation commits during an external read", async () => {
    const f = await setup()
    f.intent.status = "processing"
    const transport = stripeFetch.getMockImplementation()
    if (!transport) throw new Error("Missing Stripe test transport")
    let release!: () => void
    let started!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const readStarted = new Promise<void>((resolve) => {
      started = resolve
    })
    let first = true
    stripeFetch.mockImplementation(async (input, init) => {
      const response = await transport(input, init)
      if (String(input).includes("/payment_intents/pi_current") && first) {
        first = false
        started()
        await gate
      }
      return response
    })
    const stale = f.post("payment_intent.processing", "evt_concurrent_old")
    await readStarted
    f.intent.status = "requires_payment_method"
    expect((await f.post("payment_intent.payment_failed", "evt_concurrent_new")).status).toBe(200)
    release()
    expect((await stale).status).toBe(200)
    expect((await f.state()).invoice?.status).toBe("payment_pending")
    expect((await f.state()).receipts).toHaveLength(2)
  })

  it.each([
    "void",
    "uncollectible",
  ] as const)("reconciles an unpaid %s invoice with no materialized intent", async (status) => {
    const f = await setup()
    f.setMapped(false)
    f.remote.status = status
    await f.t.run(({ db }) => db.patch(f.invoiceId, { stripePaymentIntentId: undefined }))
    const type = status === "void" ? "invoice.voided" : "invoice.marked_uncollectible"
    expect((await f.post(type, `evt_${status}`, f.remote)).status).toBe(200)
    expect((await f.state()).invoice?.status).toBe(status === "void" ? "cancelled" : "overdue")
    expect((await f.state()).receipts).toHaveLength(1)
  })

  it("enriches an already paid invoice's missing verified charge without notifying twice", async () => {
    const f = await setup()
    await f.t.run(({ db }) => db.patch(f.invoiceId, { status: "paid", paidAt: 123 }))
    f.remote.status = "paid"
    f.remote.amount_paid = 10000
    f.intent.status = "succeeded"
    f.intent.amount_received = 10000
    f.intent.latest_charge = "ch_paid"
    f.payment.status = "paid"
    f.payment.amount_paid = 10000
    expect((await f.post("invoice.paid", "evt_enrich", f.remote)).status).toBe(200)
    await f.t.finishAllScheduledFunctions(vi.runAllTimers)
    expect((await f.state()).invoice).toMatchObject({
      status: "paid",
      paidAt: 123,
      stripeChargeId: "ch_paid",
    })
    expect((await f.state()).notifications).toHaveLength(0)
    expect((await f.state()).audit).toHaveLength(0)
  })

  it("does not replace an already paid invoice's original payment binding", async () => {
    const f = await setup()
    await f.t.run(({ db }) =>
      db.patch(f.invoiceId, { status: "paid", stripePaymentIntentId: "pi_original" })
    )
    f.remote.status = "paid"
    f.remote.amount_paid = 10000
    f.intent.status = "succeeded"
    f.intent.amount_received = 10000
    f.intent.latest_charge = "ch_paid"
    f.payment.status = "paid"
    f.payment.amount_paid = 10000
    expect((await f.post("invoice.paid", "evt_wrong_enrichment", f.remote)).status).toBe(500)
    expect((await f.state()).invoice?.stripePaymentIntentId).toBe("pi_original")
    expect((await f.state()).receipts).toHaveLength(0)
  })

  it("captures the version before reading invoice state, not after an older provider snapshot", async () => {
    const f = await setup()
    const transport = stripeFetch.getMockImplementation()
    if (!transport) throw new Error("Missing Stripe test transport")
    let release!: () => void
    let started!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const readStarted = new Promise<void>((resolve) => {
      started = resolve
    })
    let first = true
    stripeFetch.mockImplementation(async (input, init) => {
      const response = await transport(input, init)
      if (String(input).includes("/invoices/in_invoice") && first) {
        first = false
        started()
        await gate
      }
      return response
    })
    const stale = f.post("invoice.payment_failed", "evt_invoice_old", f.remote)
    await readStarted
    f.remote.status = "uncollectible"
    expect((await f.post("invoice.marked_uncollectible", "evt_invoice_new", f.remote)).status).toBe(
      200
    )
    release()
    expect((await stale).status).toBe(200)
    expect((await f.state()).invoice?.status).toBe("overdue")
    expect((await f.state()).receipts).toHaveLength(2)
  })

  it("notifies a failed attempt once across invoice and PI deliveries while retaining user notes", async () => {
    const f = await setup()
    await f.t.run(({ db }) => db.patch(f.invoiceId, { notes: "Original invoice instructions" }))
    await f.post("payment_intent.payment_failed", "evt_failure_intent")
    await f.post("invoice.payment_failed", "evt_failure_invoice", f.remote)
    await f.post("payment_intent.processing", "evt_late_processing")
    await f.t.finishAllScheduledFunctions(vi.runAllTimers)
    expect((await f.state()).invoice).toMatchObject({
      status: "payment_pending",
      notes: "Original invoice instructions",
      paymentFailureReason: "Synthetic failure",
    })
    expect((await f.state()).notifications).toHaveLength(1)
  })

  it("refuses stale internal evidence after the payment choice writer advances the version", async () => {
    const f = await setup()
    await f.t.mutation(internal.invoices.updateWithStripeInvoice, {
      invoiceId: f.invoiceId,
      stripeInvoiceId: "in_invoice",
    })
    expect(
      await f.t.mutation(internal.invoices.applyPaymentReconciliation, {
        invoiceId: f.invoiceId,
        stripeInvoiceId: "in_invoice",
        senderId: "sender",
        recipientId: "payer",
        amount: 10000,
        expectedVersion: 0,
        stripePaymentIntentId: "pi_current",
        status: "processing",
        eventId: "evt_old_read",
        eventType: "payment_intent.processing",
      })
    ).toBe(false)
    expect((await f.state()).receipts).toHaveLength(0)
  })

  it.each([
    "customer",
    "participants",
    "currency",
    "amount",
    "destination",
    "fee",
    "invoice_total",
    "allocation",
  ] as const)("does not acknowledge mismatched %s evidence", async (field) => {
    const f = await setup()
    f.intent.status = "processing"
    if (field === "customer") f.customer.metadata.userId = "other"
    if (field === "participants") f.remote.metadata.recipientId = "other"
    if (field === "currency") f.intent.currency = "eur"
    if (field === "amount") f.intent.amount = 1
    if (field === "destination") f.account.metadata.renegadeUserId = "other"
    if (field === "fee") f.intent.application_fee_amount = 0
    if (field === "invoice_total") f.remote.total = 1
    if (field === "allocation") f.payment.amount_requested = 1
    expect(
      (await f.post("payment_intent.processing", `evt_${field}`)).status
    ).toBeGreaterThanOrEqual(500)
    expect((await f.state()).receipts).toHaveLength(0)
    expect((await f.state()).invoice?.status).toBe("payment_pending")
  })
})
