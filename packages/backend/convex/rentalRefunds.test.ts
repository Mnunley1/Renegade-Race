// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import type Stripe from "stripe"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"

const stripe = vi.hoisted(() => ({
  charges: { retrieve: vi.fn() },
  refunds: { list: vi.fn(), create: vi.fn() },
  paymentIntents: { retrieve: vi.fn() },
}))
vi.mock("stripe", () => ({
  default: class {
    charges = stripe.charges
    refunds = stripe.refunds
    paymentIntents = stripe.paymentIntents
  },
}))
const modules = (
  import.meta as unknown as {
    glob: (g: string) => Record<string, () => Promise<unknown>>
  }
).glob("./**/*.ts")

let refunds: Stripe.Refund[]
beforeEach(() => {
  vi.resetAllMocks()
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy"
  refunds = []
  stripe.refunds.list.mockImplementation((params) =>
    refunds.map((refund) => ({
      ...refund,
      charge: refund.charge ?? params.charge,
      currency: refund.currency ?? "usd",
    }))
  )
  stripe.refunds.create.mockImplementation((params: Stripe.RefundCreateParams) => {
    const refund = {
      id: `re_${refunds.length + 1}`,
      amount: params.amount,
      status: "succeeded",
      metadata: params.metadata,
    } as Stripe.Refund
    refunds.push(refund)
    return refund
  })
  stripe.paymentIntents.retrieve.mockResolvedValue({ latest_charge: "ch_rental" })
})

async function setup() {
  const t = convexTest(schema, modules)
  const seed = await t.run(async (ctx) => {
    const trackId = await ctx.db.insert("tracks", { name: "Test", location: "TX", isActive: true })
    const vehicleId = await ctx.db.insert("vehicles", {
      ownerId: "owner",
      trackId,
      make: "Mazda",
      model: "MX-5",
      year: 2020,
      dailyRate: 10000,
      description: "",
      amenities: [],
      addOns: [],
      isActive: true,
      cancellationPolicy: "moderate",
      createdAt: 0,
      updatedAt: 0,
    })
    const reservationId = await ctx.db.insert("reservations", {
      vehicleId,
      renterId: "renter",
      ownerId: "owner",
      startDate: "2030-05-10",
      endDate: "2030-05-11",
      status: "confirmed",
      paymentStatus: "paid",
      totalDays: 1,
      dailyRate: 10000,
      totalAmount: 10000,
      createdAt: 0,
      updatedAt: 0,
    })
    const paymentId = await ctx.db.insert("payments", {
      reservationId,
      ownerId: "owner",
      renterId: "renter",
      amount: 10000,
      platformFee: 500,
      ownerAmount: 9500,
      processingFee: 330,
      currency: "usd",
      stripePaymentIntentId: "pi_rental",
      status: "succeeded",
      createdAt: 0,
      updatedAt: 0,
    })
    await ctx.db.patch(reservationId, { paymentId })
    return { reservationId, paymentId }
  })
  const charge = {
    id: "ch_rental",
    paid: true,
    amount_captured: 10330,
    currency: "usd",
    payment_intent: "pi_rental",
    metadata: { reservationId: seed.reservationId, ownerId: "owner", renterId: "renter" },
    transfer_data: { destination: "acct_owner" },
  }
  stripe.charges.retrieve.mockResolvedValue(charge)
  const admin = t.withIdentity({ subject: "admin", publicMetadata: { role: "admin" } })
  const owner = t.withIdentity({ subject: "owner" })
  const read = async () =>
    t.run(async (ctx) => ({
      payment: await ctx.db.get(seed.paymentId),
      reservation: await ctx.db.get(seed.reservationId),
      audits: await ctx.db.query("auditLogs").collect(),
    }))
  const sync = () =>
    t.action(internal.stripe.syncChargeRefunds, {
      stripePaymentIntentId: "pi_rental",
      chargeId: "ch_rental",
    })
  return { t, admin, owner, ...seed, charge, read, sync }
}

describe("rental refunds", () => {
  it("admin partials remain refundable, identical requests replay, and full includes card processing", async () => {
    const { admin, paymentId, read, sync } = await setup()
    const request = { paymentId, amount: 4000, reason: "Rental adjustment", requestId: "first" }
    await admin.action(api.admin.initiateRefund, request)
    await sync()
    await admin.action(api.admin.initiateRefund, request)
    expect(stripe.refunds.create).toHaveBeenCalledTimes(1)
    let result = await read()
    expect(result.audits).toHaveLength(1)
    expect(result.reservation).toMatchObject({
      status: "confirmed",
      paymentStatus: "partially_refunded",
    })
    expect(result.payment).toMatchObject({
      refundAmount: 4000,
      capturedAmount: 10330,
      status: "partially_refunded",
    })

    await expect(
      admin.action(api.admin.initiateRefund, { ...request, amount: 3900 })
    ).rejects.toThrow("different details")
    await expect(
      admin.action(api.admin.initiateRefund, { ...request, amount: 6331, requestId: "over" })
    ).rejects.toThrow("remaining")
    await admin.action(api.admin.initiateRefund, { ...request, requestId: "second" })
    await admin.action(api.admin.initiateRefund, { ...request, requestId: "last", amount: 2330 })
    await sync()
    result = await read()
    expect(result.payment).toMatchObject({
      refundAmount: 10330,
      status: "refunded",
      refundPercentage: 100,
    })
    expect(result.reservation).toMatchObject({ status: "cancelled", paymentStatus: "refunded" })
    expect(result.audits).toHaveLength(3)
    expect(stripe.refunds.create).toHaveBeenCalledTimes(3)
    expect(stripe.refunds.create.mock.calls[0]?.[1].idempotencyKey).toContain("rental-refund-")
  })

  it("checks admin and owner authorization, verifies the Stripe rental before returning money", async () => {
    const { t, owner, paymentId, charge } = await setup()
    const request = { paymentId, amount: 500, reason: "requested_by_customer" }
    for (const caller of [
      t,
      t.withIdentity({ subject: "renter" }),
      t.withIdentity({ subject: "other" }),
    ]) {
      await expect(caller.action(api.admin.initiateRefund, request)).rejects.toThrow()
      await expect(caller.action(api.stripe.processRefund, request)).rejects.toThrow()
    }
    expect(stripe.charges.retrieve).not.toHaveBeenCalled()
    stripe.charges.retrieve.mockResolvedValue({
      ...charge,
      metadata: { ...charge.metadata, reservationId: "another" },
    })
    await expect(owner.action(api.stripe.processRefund, request)).rejects.toThrow("does not match")
    stripe.charges.retrieve.mockResolvedValue({
      ...charge,
      metadata: { ...charge.metadata, type: "damage_invoice" },
    })
    await expect(owner.action(api.stripe.processRefund, request)).rejects.toThrow("does not match")
    expect(stripe.refunds.create).not.toHaveBeenCalled()
  })

  it("allows staff to refund a separately captured payment without cancelling the linked paid reservation", async () => {
    const { t, admin, owner, paymentId, reservationId, charge, read } = await setup()
    const duplicate = await t.run((ctx) =>
      ctx.db.insert("payments", {
        reservationId,
        ownerId: "owner",
        renterId: "renter",
        amount: 10000,
        platformFee: 500,
        ownerAmount: 9500,
        processingFee: 330,
        currency: "usd",
        status: "succeeded",
        stripeChargeId: "ch_extra",
        stripePaymentIntentId: "pi_extra",
        createdAt: 0,
        updatedAt: 0,
      })
    )
    stripe.charges.retrieve.mockResolvedValue({
      ...charge,
      id: "ch_extra",
      payment_intent: "pi_extra",
    })
    const request = {
      paymentId: duplicate,
      amount: 10330,
      reason: "Duplicate capture",
      requestId: "extra",
    }
    await expect(owner.action(api.stripe.processRefund, request)).rejects.toThrow(
      "Only the payment owner"
    )
    await admin.action(api.admin.initiateRefund, request)
    expect(await t.run((ctx) => ctx.db.get(duplicate))).toMatchObject({ status: "refunded" })
    const { payment, reservation } = await read()
    expect(payment).toMatchObject({ status: "succeeded" })
    expect(reservation).toMatchObject({ paymentId, status: "confirmed", paymentStatus: "paid" })
  })

  it("uses a stable owner idempotency key on ambiguous network failure", async () => {
    const { owner, paymentId } = await setup()
    const request = { paymentId, amount: 500, reason: "requested_by_customer" }
    stripe.refunds.create.mockRejectedValueOnce(new Error("Timed out"))
    await expect(owner.action(api.stripe.processRefund, request)).rejects.toThrow("Timed out")
    await owner.action(api.stripe.processRefund, request)
    expect(stripe.refunds.create.mock.calls[0]?.[1]).toEqual(
      stripe.refunds.create.mock.calls[1]?.[1]
    )
  })

  it("handles legacy charges and subtracts existing credits when a cancellation policy applies", async () => {
    const { t, paymentId, reservationId, charge, read } = await setup()
    await t.run(async (ctx) => {
      await ctx.db.patch(paymentId, {
        processingFee: undefined,
        status: "partially_refunded",
        refundAmount: 2000,
      })
      await ctx.db.patch(reservationId, { status: "cancelled" })
    })
    stripe.charges.retrieve.mockResolvedValue({
      ...charge,
      amount_captured: 10000,
      transfer_data: null,
    })
    refunds.push({ id: "re_old", amount: 2000, status: "succeeded" } as Stripe.Refund)
    const args = {
      paymentId,
      reservationId,
      reason: "Schedule change",
      cancelledAt: new Date(2030, 4, 7).getTime(),
    }
    await t.action(internal.stripe.processRefundOnCancellation, args)
    await t.action(internal.stripe.processRefundOnCancellation, args)
    expect(stripe.refunds.create).toHaveBeenCalledTimes(1)
    expect(stripe.refunds.create.mock.calls[0]?.[0]).toMatchObject({ amount: 3000 })
    expect(stripe.refunds.create.mock.calls[0]?.[0]).not.toHaveProperty("reverse_transfer")
    expect((await read()).payment).toMatchObject({
      refundAmount: 5000,
      refundPolicy: "partial",
      refundPercentage: 50,
    })
  })

  it("reconciles pending, failed, and out-of-band Stripe refunds without double counting", async () => {
    const { admin, paymentId, read, sync } = await setup()
    stripe.refunds.create.mockImplementationOnce((params) => {
      const refund = {
        id: "re_pending",
        amount: params.amount,
        status: "pending",
        metadata: params.metadata,
      } as Stripe.Refund
      refunds.push(refund)
      return refund
    })
    await admin.action(api.admin.initiateRefund, {
      paymentId,
      amount: 1000,
      reason: "Adjustment",
      requestId: "pending",
    })
    expect((await read()).payment).toMatchObject({ status: "succeeded", refundAmount: 0 })
    await expect(
      admin.action(api.admin.initiateRefund, { paymentId, amount: 10000, reason: "Too much" })
    ).rejects.toThrow("remaining")
    const pending = refunds[0]
    if (!pending) throw new Error("Missing test refund")
    pending.status = "failed"
    refunds.push({ id: "re_dashboard", amount: 5500, status: "succeeded" } as Stripe.Refund)
    await sync()
    await sync()
    expect((await read()).payment).toMatchObject({
      status: "partially_refunded",
      refundAmount: 5500,
    })
  })

  it.each([
    { forced: true, refundAmount: 10330, expectedStatus: "refunded" },
    { forced: false, refundAmount: 10000, expectedStatus: "partially_refunded" },
  ])("preserves the host and renter cancellation bases (forced=$forced)", async ({
    forced,
    refundAmount,
    expectedStatus,
  }) => {
    const { t, paymentId, reservationId, read } = await setup()
    await t.run((ctx) => ctx.db.patch(reservationId, { status: "cancelled" }))
    await t.action(internal.stripe.processRefundOnCancellation, {
      paymentId,
      reservationId,
      reason: "Cancellation",
      forceFullRefund: forced,
      cancelledAt: new Date(2030, 3, 1).getTime(),
    })
    expect((await read()).payment).toMatchObject({ refundAmount, status: expectedStatus })
  })

  it("a stale webhook reconciliation re-reads Stripe after a concurrent reconciliation", async () => {
    const { sync, read } = await setup()
    let enter: () => void
    let release: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      enter = resolve
    })
    const proceed = new Promise<void>((resolve) => {
      release = resolve
    })
    stripe.refunds.list.mockImplementationOnce(async function* () {
      enter()
      await proceed
      yield {
        id: "old",
        status: "succeeded",
        amount: 1000,
        charge: "ch_rental",
        currency: "usd",
        payment_intent: "pi_rental",
      }
    })
    const stale = sync()
    await started
    refunds.push({ id: "current", status: "succeeded", amount: 3000 } as Stripe.Refund)
    await sync()
    release?.()
    await stale
    expect((await read()).payment?.refundAmount).toBe(3000)
  })

  it("ignores an unknown non-rental intent and lets Stripe retry a rental with a missing binding", async () => {
    const { t } = await setup()
    const args = { stripePaymentIntentId: "pi_unknown", chargeId: "ch_unknown" }
    await t.action(internal.stripe.syncChargeRefunds, args)
    await expect(
      t.action(internal.stripe.syncChargeRefunds, { ...args, requireMatchingPayment: true })
    ).rejects.toThrow("not available")
    expect(stripe.charges.retrieve).not.toHaveBeenCalled()
  })
})
