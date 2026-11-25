// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"

const sdk = vi.hoisted(() => ({
  account: vi.fn(),
  customer: vi.fn(),
  retrieve: vi.fn(),
  create: vi.fn(),
  item: vi.fn(),
  lines: vi.fn(),
  finalize: vi.fn(),
  send: vi.fn(),
  payments: vi.fn(),
  refund: vi.fn(),
}))
vi.mock("./r2", () => ({ r2: {} }))
vi.mock("stripe", () => ({
  default: class {
    accounts = { retrieve: sdk.account }
    customers = { retrieve: sdk.customer }
    invoices = {
      create: sdk.create,
      listLineItems: sdk.lines,
      retrieve: sdk.retrieve,
      finalizeInvoice: sdk.finalize,
      sendInvoice: sdk.send,
    }
    invoiceItems = { create: sdk.item }
    invoicePayments = { list: sdk.payments }
    refunds = { create: sdk.refund }
  },
}))
const privateBillingDetails =
  /stale\.example|private (sender|recipient) phone|acct_seller|cus_payer/
const modules = (
  import.meta as unknown as { glob: (s: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_invoice")
  sdk.customer.mockResolvedValue({ id: "cus_payer", metadata: { userId: "payer" } })
  sdk.account.mockImplementation(async (id: string) => ({
    id,
    type: "express",
    metadata: { renegadeUserId: "sender" },
    details_submitted: true,
    charges_enabled: true,
  }))
})
afterEach(() => vi.unstubAllEnvs())

async function setup(stored = false) {
  const t = convexTest(schema, modules)
  const { invoiceId, senderId } = await t.run(async ({ db }) => {
    const senderId = await db.insert("users", {
      externalId: "sender",
      name: "Seller",
      stripeAccountId: "acct_seller",
      phone: "private sender phone",
    })
    await db.insert("users", {
      externalId: "payer",
      name: "Buyer",
      stripeCustomerId: "cus_payer",
      phone: "private recipient phone",
    })
    const invoiceId = await db.insert("invoices", {
      senderId: "sender",
      recipientId: "payer",
      title: "Coaching",
      subtotal: 10000,
      total: 10000,
      currency: "usd",
      lineItems: [{ description: "Lesson", quantity: 1, unitAmount: 10000, amount: 10000 }],
      paymentMethods: ["stripe_ach", "stripe_card"],
      status: stored ? "payment_pending" : "sent",
      createdAt: 1,
      updatedAt: 1,
      ...(stored
        ? {
            selectedPaymentMethod: "stripe_card" as const,
            stripeInvoiceId: "in_local",
            stripeCheckoutUrl: "https://stale.example/old",
            stripeInvoicePdf: "https://stale.example/old.pdf",
          }
        : {}),
    })
    return { invoiceId, senderId }
  })
  const remote = {
    id: "in_local",
    status: stored ? "open" : "draft",
    amount_due: stored ? 10000 : 0,
    currency: "usd",
    customer: "cus_payer",
    hosted_invoice_url: "https://invoice.stripe.test/fresh",
    metadata: { type: "custom_invoice", invoiceId, senderId: "sender", recipientId: "payer" },
  }
  const binding = {
    is_default: true,
    payment: {
      type: "payment_intent",
      payment_intent: {
        id: "pi_org",
        customer: "cus_payer",
        latest_charge: "ch_original",
        transfer_data: { destination: "acct_seller" },
      },
    },
  }
  sdk.payments.mockImplementation(() => [binding])
  const lines = new Map<
    string,
    { amount: number; currency: string; metadata: Record<string, string> }
  >()
  sdk.lines.mockImplementation(() => [...lines.values()])
  sdk.item.mockImplementation((line, { idempotencyKey }) => {
    lines.set(idempotencyKey, line)
    remote.amount_due = [...lines.values()].reduce((sum, l) => sum + l.amount, 0)
    return line
  })
  sdk.create.mockImplementation(async () => ({ ...remote }))
  sdk.finalize.mockImplementation(() => {
    remote.status = "open"
    return { ...remote }
  })
  sdk.send.mockImplementation(async () => ({ ...remote, payments: { data: [binding] } }))
  sdk.retrieve.mockImplementation(async () => ({
    ...remote,
    transfer_data: { destination: "acct_seller" },
  }))
  const payer = t.withIdentity({ subject: "payer" }),
    sender = t.withIdentity({ subject: "sender" }),
    other = t.withIdentity({ subject: "other" })
  const choose = (paymentMethod: "stripe_card" | "stripe_ach" = "stripe_card") =>
    payer.action(api.invoices.choosePaymentMethod, { invoiceId, paymentMethod })
  return { t, invoiceId, senderId, sender, payer, other, remote, binding, choose }
}

describe("Deals invoice payment ownership", () => {
  it.each([
    "stripe_ach",
    "stripe_card",
  ] as const)("preserves %s settlement for an inactive deposit vehicle without granting public detail access", async (method) => {
    const { t, payer, other, invoiceId, choose } = await setup()
    const vehicleId = await t.run(async ({ db }) => {
      const trackId = await db.insert("tracks", {
        name: "Synthetic",
        location: "Test",
        isActive: false,
      })
      const vehicleId = await db.insert("vehicles", {
        trackId,
        ownerId: "sender",
        make: "BMW",
        model: "Synthetic",
        year: 2015,
        dailyRate: 1000,
        damageDepositAmount: 1234,
        description: "Historical",
        amenities: [],
        addOns: [],
        isActive: false,
        createdAt: 1,
        updatedAt: 1,
      })
      await db.patch(invoiceId, { depositVehicleId: vehicleId })
      return vehicleId
    })
    expect(await payer.query(api.vehicles.getById, { id: vehicleId })).toBeNull()
    await expect(
      other.query(internal.invoices.getDepositVehicleForPayment, { invoiceId })
    ).rejects.toThrow("Only the recipient")
    expect(await payer.query(internal.invoices.getDepositVehicleForPayment, { invoiceId })).toEqual(
      { damageDepositAmount: 1234 }
    )
    expect((await choose(method))?.url).toBe("https://invoice.stripe.test/fresh")
    const invoice = await t.run(({ db }) => db.get(invoiceId))
    expect(invoice?.damageDepositAmount).toBe(method === "stripe_ach" ? 1234 : 0)
    expect(invoice?.amountDue).toBe(method === "stripe_ach" ? 11234 : 10330)
    expect(await t.run(({ db }) => db.query("reservations").collect())).toEqual([])
  })

  it("does not finalize a draft if revocation arrives during invoice item creation", async () => {
    const { choose, t, invoiceId } = await setup()
    const item = sdk.item.getMockImplementation()
    if (!item) throw new Error("Missing invoice item test double")
    sdk.item.mockImplementationOnce(async (...args) => {
      const result = await item(...args)
      await t.mutation(internal.stripeRevocations.recordVerifiedRevocation, {
        stripeAccountId: "acct_seller",
        applicationId: "ca_test",
        platformAccountId: "acct_platform",
        livemode: false,
        eventId: "evt_item_barrier",
        eventCreated: 1,
      })
      return result
    })
    await expect(choose()).rejects.toThrow("revoked")
    expect(sdk.finalize).not.toHaveBeenCalled()
    expect(sdk.send).not.toHaveBeenCalled()
    expect(await t.run(({ db }) => db.get(invoiceId))).toMatchObject({
      stripeInvoiceId: "in_local",
    })
  })

  it("preserves a sent invoice's provider facts but withholds the URL after an in-flight revocation", async () => {
    const { choose, t, invoiceId } = await setup()
    const send = sdk.send.getMockImplementation()
    if (!send) throw new Error("Missing invoice send test double")
    sdk.send.mockImplementationOnce(async (...args) => {
      const result = await send(...args)
      await t.mutation(internal.stripeRevocations.recordVerifiedRevocation, {
        stripeAccountId: "acct_seller",
        applicationId: "ca_test",
        platformAccountId: "acct_platform",
        livemode: false,
        eventId: "evt_send_barrier",
        eventCreated: 1,
      })
      return result
    })
    await expect(choose()).rejects.toThrow("revoked")
    expect(await t.run(({ db }) => db.get(invoiceId))).toMatchObject({
      stripeInvoiceId: "in_local",
      stripePaymentIntentId: "pi_org",
    })
    expect(sdk.refund).not.toHaveBeenCalled()
  })

  it.each([
    "stripe_card",
    "stripe_ach",
  ] as const)("issues a verified %s invoice, records Basil's default intent and resumes the provider URL", async (method) => {
    const { t, invoiceId, choose, remote } = await setup()
    expect(await choose(method)).toEqual({ url: remote.hosted_invoice_url })
    expect(sdk.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_payer",
        transfer_data: { destination: "acct_seller" },
      }),
      expect.anything()
    )
    expect(await t.run(({ db }) => db.get(invoiceId))).toMatchObject({
      status: "payment_pending",
      selectedPaymentMethod: method,
      stripePaymentIntentId: "pi_org",
    })
    expect(await choose(method)).toEqual({ url: remote.hosted_invoice_url })
    expect(sdk.create).toHaveBeenCalledTimes(1)
    expect(sdk.send).toHaveBeenCalledTimes(1)
  })

  it("allows only one payment method to register and issue a Stripe invoice", async () => {
    const { choose, t, invoiceId } = await setup()
    const result = await Promise.allSettled([choose("stripe_card"), choose("stripe_ach")])
    expect(result.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"])
    expect(sdk.create).toHaveBeenCalledTimes(1)
    expect(sdk.finalize).toHaveBeenCalledTimes(1)
    expect(sdk.send).toHaveBeenCalledTimes(1)
    expect(await t.run(({ db }) => db.get(invoiceId))).toMatchObject({
      selectedPaymentMethod: result[0].status === "fulfilled" ? "stripe_card" : "stripe_ach",
      stripeInvoiceId: "in_local",
      status: "payment_pending",
    })
  })

  it("resumes an interrupted draft with repeated descriptions, tax and discount", async () => {
    const { choose, t, invoiceId, remote } = await setup()
    await t.run(({ db }) =>
      db.patch(invoiceId, {
        lineItems: [
          { description: "Lesson", quantity: 1, unitAmount: 4000, amount: 4000 },
          { description: "Lesson", quantity: 1, unitAmount: 6000, amount: 6000 },
        ],
        subtotal: 10000,
        taxAmount: 500,
        discountAmount: 100,
        total: 10400,
      })
    )
    const original = sdk.item.getMockImplementation()
    if (!original) throw new Error("Missing invoice item test double")
    sdk.item
      .mockImplementationOnce(original)
      .mockRejectedValueOnce(new Error("network unavailable"))
    await expect(choose("stripe_ach")).rejects.toThrow("network unavailable")
    expect(await t.run(({ db }) => db.get(invoiceId))).toMatchObject({
      stripeInvoiceId: "in_local",
      selectedPaymentMethod: "stripe_ach",
    })
    expect(await choose("stripe_ach")).toEqual({ url: remote.hosted_invoice_url })
    expect(sdk.create).toHaveBeenCalledTimes(1)
    expect(sdk.finalize).toHaveBeenCalledTimes(1)
    expect(sdk.item.mock.calls.map(([l]) => l.metadata.invoiceLineKey)).toEqual([
      "line_0",
      "line_1",
      "line_1",
      "tax",
      "discount",
    ])
    expect(remote.amount_due).toBe(10400)
  })

  it("withholds the URL for a wrong provider amount or currency", async () => {
    const { choose, remote } = await setup(true)
    remote.amount_due += 1
    await expect(choose()).rejects.toThrow("agreed total")
    remote.amount_due -= 1
    remote.currency = "eur"
    await expect(choose()).rejects.toThrow("agreed total")
    expect(sdk.send).not.toHaveBeenCalled()
  })

  it("releases a claim after a rejected creation and preserves it after an ambiguous error", async () => {
    const { choose, t, invoiceId } = await setup()
    sdk.create.mockRejectedValueOnce(
      Object.assign(new Error("invalid parameters"), { type: "StripeInvalidRequestError" })
    )
    await expect(choose("stripe_ach")).rejects.toThrow("invalid parameters")
    expect((await t.run(({ db }) => db.get(invoiceId)))?.selectedPaymentMethod).toBeUndefined()
    sdk.create.mockRejectedValueOnce(new Error("network unavailable"))
    await expect(choose("stripe_ach")).rejects.toThrow("network unavailable")
    await expect(choose("stripe_card")).rejects.toThrow("already been selected")
    expect((await choose("stripe_ach")).url).toBeTruthy()
  })

  it("rejects wrong callers before provider calls and keeps private contacts, hosted URLs and PDFs out of read APIs", async () => {
    const { t, invoiceId, sender, payer, other } = await setup(true)
    for (const client of [t, other, sender])
      await expect(
        client.action(api.invoices.choosePaymentMethod, { invoiceId, paymentMethod: "stripe_card" })
      ).rejects.toThrow()
    for (const client of [t, other])
      await expect(client.action(api.invoices.openHostedInvoice, { invoiceId })).rejects.toThrow()
    expect(sdk.retrieve).not.toHaveBeenCalled()
    for (const client of [sender, payer]) {
      const invoice = await client.query(api.invoices.getById, { invoiceId })
      expect(invoice?.hasHostedInvoice).toBe(true)
      const text = JSON.stringify([invoice, await client.query(api.invoices.getMine, {})])
      expect(text).not.toMatch(privateBillingDetails)
    }
  })

  it.each([
    false,
    true,
  ])("holds untagged payees and foreign billing customers on new or existing invoice (stored %s)", async (stored) => {
    const { choose } = await setup(stored)
    sdk.account.mockResolvedValue({
      type: "express",
      details_submitted: true,
      charges_enabled: true,
      metadata: {},
    })
    await expect(choose()).rejects.toThrow("on hold")
    sdk.account.mockResolvedValue({
      type: "express",
      details_submitted: true,
      charges_enabled: true,
      metadata: { renegadeUserId: "sender" },
    })
    sdk.customer.mockResolvedValue({ id: "cus_payer", metadata: { userId: "other" } })
    await expect(choose()).rejects.toThrow("customer ownership")
    expect(sdk.create).not.toHaveBeenCalled()
    expect(sdk.send).not.toHaveBeenCalled()
  })

  it("gates the actual stored destination on every open path, including older invoices with no open default intent", async () => {
    const { invoiceId, payer, sender, choose, remote, binding } = await setup(true)
    sdk.payments.mockReturnValue([
      binding,
      {
        ...binding,
        is_default: false,
        payment: {
          type: "payment_intent",
          payment_intent: {
            ...binding.payment.payment_intent,
            transfer_data: { destination: "acct_other" },
          },
        },
      },
    ])
    await expect(choose()).rejects.toThrow("destinations do not match")
    sdk.payments.mockReturnValue([])
    sdk.retrieve.mockResolvedValue({ ...remote, transfer_data: { destination: "acct_other" } })
    for (const client of [payer, sender])
      await expect(client.action(api.invoices.openHostedInvoice, { invoiceId })).rejects.toThrow(
        "ownership"
      )
    sdk.retrieve.mockResolvedValue({ ...remote, transfer_data: { destination: "acct_seller" } })
    expect(await choose()).toEqual({ url: remote.hosted_invoice_url })
    expect(sdk.retrieve).toHaveBeenCalledWith("in_local", {}, { apiVersion: "2024-10-28.acacia" })
  })

  it("does not send an invoice if Stripe's finalized payment points to a different destination", async () => {
    const { choose, binding } = await setup()
    sdk.payments.mockReturnValue([
      {
        ...binding,
        payment: {
          type: "payment_intent",
          payment_intent: {
            ...binding.payment.payment_intent,
            transfer_data: { destination: "acct_other" },
          },
        },
      },
    ])
    await expect(choose()).rejects.toThrow("ownership")
    expect(sdk.send).not.toHaveBeenCalled()
  })

  it("returns a settled receipt after the sender's payout link changes", async () => {
    const { t, invoiceId, senderId, sender, remote, binding } = await setup(true)
    await t.run(async ({ db }) => {
      await db.patch(senderId, { stripeAccountId: "acct_changed" })
      await db.patch(invoiceId, {
        status: "paid",
        depositStatus: "held",
        damageDepositAmount: 1500,
        stripeChargeId: "ch_unrelated",
      })
    })
    sdk.retrieve.mockResolvedValue({ ...remote, status: "paid" })
    sdk.payments.mockResolvedValue({ data: [binding], has_more: false })
    expect(await sender.action(api.invoices.openHostedInvoice, { invoiceId })).toBe(
      remote.hosted_invoice_url
    )
    expect(sdk.account).not.toHaveBeenCalled()
  })
})
