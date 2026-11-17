// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import Stripe from "stripe"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import stripeSchema from "../node_modules/@convex-dev/stripe/dist/component/schema.js"
import { internal } from "./_generated/api"
import schema from "./schema"

// Use Stripe's real signature verification and SDK, with a test-only HTTP
// transport for retrieving charges and the refund list during reconciliation.
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
const webhookSecret = "whsec_rental_webhook_test"
const stripe = new Stripe("sk_test_rental_webhook")

beforeEach(() => {
  stripeFetch.mockReset()
  vi.useFakeTimers()
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_rental_webhook")
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", webhookSecret)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

async function setup(hosted = false) {
  const t = convexTest(schema, modules)
  t.registerComponent("stripe", stripeSchema, stripeModules)
  const ids = await t.run(async (ctx) => {
    const renterId = "renter"
    const ownerId = "host"
    const trackId = await ctx.db.insert("tracks", {
      name: "Road America",
      location: "WI",
      isActive: true,
    })
    const vehicleId = await ctx.db.insert("vehicles", {
      trackId,
      ownerId,
      make: "BMW",
      model: "M3",
      year: 2013,
      dailyRate: 10000,
      description: "Track car",
      amenities: [],
      addOns: [],
      isActive: true,
      isApproved: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    const reservationId = await ctx.db.insert("reservations", {
      renterId,
      ownerId,
      vehicleId,
      status: "approved",
      paymentStatus: "pending",
      startDate: "2031-08-01",
      endDate: "2031-08-01",
      totalDays: 1,
      dailyRate: 10000,
      totalAmount: 10000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    const paymentId = await ctx.db.insert("payments", {
      reservationId,
      renterId,
      ownerId,
      amount: 10000,
      processingFee: 330,
      platformFee: 500,
      ownerAmount: 9500,
      currency: "usd",
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(hosted
        ? { stripeCheckoutSessionId: "cs_rental" }
        : { stripePaymentIntentId: "pi_rental" }),
    })
    await ctx.db.patch(reservationId, { paymentId })
    return { renterId, ownerId, reservationId, paymentId, vehicleId }
  })
  const metadata = {
    renterId: ids.renterId,
    ownerId: ids.ownerId,
    reservationId: ids.reservationId,
  }
  const intent = {
    object: "payment_intent",
    id: "pi_rental",
    amount: 10330,
    amount_received: 10330,
    status: "succeeded",
    latest_charge: "ch_rental",
    currency: "usd",
    metadata,
    created: Math.floor(Date.now() / 1000),
  }
  async function post(
    type: string,
    id: string,
    object: object,
    { secret = webhookSecret, account }: { secret?: string; account?: string } = {}
  ) {
    const payload = JSON.stringify({ object: "event", id, type, data: { object }, account })
    const signature = await stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret,
      cryptoProvider: Stripe.createSubtleCryptoProvider(),
    })
    return t.fetch("/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: payload,
    })
  }
  const state = () =>
    t.run(async (ctx) => ({
      payment: await ctx.db.get(ids.paymentId),
      reservation: await ctx.db.get(ids.reservationId),
      receipts: await ctx.db.query("webhookEvents").collect(),
      notifications: await ctx.db.query("notifications").collect(),
      audit: await ctx.db.query("auditLogs").collect(),
    }))
  return { t, ids, intent, post, state, metadata }
}

describe("signed rental Stripe webhooks", () => {
  it("rejects an invalid signature and confirms a matching capture exactly once", async () => {
    const { t, post, intent, state } = await setup()
    expect(
      (await post("payment_intent.succeeded", "evt_success", intent, { secret: "whsec_wrong" }))
        .status
    ).toBe(400)
    expect((await state()).payment?.status).toBe("pending")
    const delivered = await Promise.all([
      post("payment_intent.succeeded", "evt_success", intent),
      post("payment_intent.succeeded", "evt_success", intent),
    ])
    expect(delivered.map((response) => response.status)).toEqual([200, 200])
    expect((await post("payment_intent.succeeded", "evt_second_success", intent)).status).toBe(200)
    expect((await post("payment_intent.payment_failed", "evt_stale_failure", intent)).status).toBe(
      200
    )
    expect((await post("payment_intent.canceled", "evt_stale_cancel", intent)).status).toBe(200)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const result = await state()
    expect(result.payment).toMatchObject({ status: "succeeded", stripeChargeId: "ch_rental" })
    expect(result.reservation).toMatchObject({ status: "confirmed", paymentStatus: "paid" })
    expect(result.notifications.map((n) => n.type)).toEqual(["payment_success"])
    expect(result.receipts.filter((e) => e.eventId === "evt_success")).toHaveLength(1)
  })

  it("ignores connected-account seat metadata and routes platform seat success exactly once", async () => {
    const { t, post, intent, state } = await setup()
    const bookingId = await t.run(async ({ db }) => {
      const now = Date.now()
      const teamId = await db.insert("teams", {
        ownerId: "host",
        name: "Test team",
        description: "Test",
        location: "WI",
        specialties: [],
        availableSeats: 1,
        requirements: [],
        contactInfo: {},
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      const seriesId = await db.insert("raceSeries", {
        name: "Test series",
        isActive: true,
        createdByUserId: "host",
        createdAt: now,
        updatedAt: now,
      })
      const raceEventId = await db.insert("raceEvents", {
        name: "Test event",
        seriesId,
        startDate: "2031-08-01",
        endDate: "2031-08-01",
        isActive: true,
        createdByUserId: "host",
        createdAt: now,
        updatedAt: now,
      })
      const teamCarId = await db.insert("teamCars", {
        teamId,
        raceEventId,
        hostUserId: "host",
        make: "BMW",
        model: "M3",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      const seatOfferingId = await db.insert("seatOfferings", {
        teamId,
        raceEventId,
        teamCarId,
        hostUserId: "host",
        title: "Test seat",
        spotCount: 1,
        priceCents: 10000,
        depositCents: 10000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      return db.insert("seatBookings", {
        seatOfferingId,
        teamCarId,
        raceEventId,
        teamId,
        hostUserId: "host",
        driverId: "driver",
        status: "approved",
        priceCents: 10000,
        depositCents: 10000,
        balanceCents: 0,
        platformFeePercentage: 5,
        availableStartDate: "2031-08-01",
        availableEndDate: "2031-08-01",
        driverExperience: "intermediate",
        budgetBand: "test",
        seriesClass: "test",
        whyBuying: "test",
        depositPaymentStatus: "pending",
        createdAt: now,
        updatedAt: now,
      })
    })
    const seatIntent = {
      ...intent,
      id: "pi_seat",
      metadata: {
        bookingType: "seat",
        phase: "deposit",
        seatBookingId: bookingId,
      },
    }
    for (const type of ["succeeded", "payment_failed", "canceled"]) {
      expect(
        (
          await post(`payment_intent.${type}`, `evt_seat_connected_${type}`, seatIntent, {
            account: "acct_connected",
          })
        ).status
      ).toBe(200)
    }
    expect(await t.run(({ db }) => db.get(bookingId))).toMatchObject({
      status: "approved",
      depositPaymentStatus: "pending",
    })
    expect((await post("payment_intent.succeeded", "evt_seat_platform", seatIntent)).status).toBe(
      200
    )
    expect((await post("payment_intent.succeeded", "evt_seat_platform", seatIntent)).status).toBe(
      200
    )
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await t.run(({ db }) => db.get(bookingId))).toMatchObject({
      status: "confirmed",
      depositPaymentStatus: "paid",
      stripeDepositPaymentIntentId: "pi_seat",
    })
    const result = await state()
    expect(result.payment?.status).toBe("pending")
    expect(result.reservation?.status).toBe("approved")
    expect(result.receipts.filter((event) => event.eventId === "evt_seat_platform")).toHaveLength(1)
    expect(result.receipts.some((event) => event.eventId.startsWith("evt_seat_connected"))).toBe(
      false
    )
  })

  it("routes a custom invoice through the invoice handlers even if a rental references its intent", async () => {
    const { t, post, intent, state } = await setup()
    const invoiceId = await t.run((ctx) =>
      ctx.db.insert("invoices", {
        senderId: "host",
        recipientId: "renter",
        title: "Track support",
        lineItems: [{ description: "Support", quantity: 1, unitAmount: 10330, amount: 10330 }],
        subtotal: 10330,
        total: 10330,
        currency: "usd",
        paymentMethods: ["stripe_card"],
        stripeInvoiceId: "in_custom",
        stripePaymentIntentId: intent.id,
        status: "sent",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    )
    const invoiceIntent = { ...intent, metadata: { type: "custom_invoice", invoiceId } }
    const invoice = () => t.run((ctx) => ctx.db.get(invoiceId))

    for (const [event, candidate, options] of [
      ["wrong_intent", { ...invoiceIntent, id: "pi_unrelated" }, {}],
      ["connected", invoiceIntent, { account: "acct_other" }],
      ["wrong_amount", { ...invoiceIntent, amount_received: 1 }, {}],
      ["wrong_currency", { ...invoiceIntent, currency: "eur" }, {}],
    ] as const) {
      expect((await post("payment_intent.succeeded", event, candidate, options)).status).toBe(200)
      expect((await invoice())?.status).toBe("sent")
    }
    expect(
      (await post("payment_intent.processing", "evt_invoice_processing", invoiceIntent)).status
    ).toBe(200)
    expect((await invoice())?.status).toBe("processing")
    expect(
      (await post("payment_intent.payment_failed", "evt_invoice_failed", invoiceIntent)).status
    ).toBe(200)
    expect((await invoice())?.status).toBe("payment_pending")
    expect((await post("payment_intent.succeeded", "evt_invoice_paid", invoiceIntent)).status).toBe(
      200
    )
    expect(await invoice()).toMatchObject({ status: "paid", stripeChargeId: intent.latest_charge })
    const paidAt = (await invoice())?.paidAt
    await post("payment_intent.succeeded", "evt_invoice_paid_replay", invoiceIntent)
    await post("payment_intent.payment_failed", "evt_invoice_failed_replay", invoiceIntent)
    expect(await invoice()).toMatchObject({ status: "paid", paidAt })
    const result = await state()
    expect(result.payment?.status).toBe("pending")
    expect(result.reservation?.paymentStatus).toBe("pending")
    await t.finishAllScheduledFunctions(vi.runAllTimers)
  })

  it("ignores a connected account's attempts to update coaching bookings and damage invoices", async () => {
    const { t, ids, post, intent } = await setup()
    const { booking, damage } = await t.run(async ({ db }) => {
      const timestamps = { createdAt: 1, updatedAt: 1 }
      const coachProfileId = await db.insert("coachProfiles", {
        userId: "coach",
        bio: "coach",
        specialties: [],
        hourlyRate: 10000,
        location: "WI",
        isActive: true,
        verificationStatus: "verified",
        ...timestamps,
      })
      const booking = await db.insert("coachingBookings", {
        coachProfileId,
        coachUserId: "coach",
        renterId: "renter",
        startDate: "2031-08-01",
        endDate: "2031-08-01",
        sessionType: "hourly",
        hours: 1,
        totalDays: 1,
        rate: 10000,
        totalAmount: 10000,
        status: "approved",
        paymentStatus: "pending",
        ...timestamps,
      })
      const rental = {
        reservationId: ids.reservationId,
        vehicleId: ids.vehicleId,
        renterId: ids.renterId,
        ownerId: ids.ownerId,
        ...timestamps,
      }
      const completionId = await db.insert("rentalCompletions", { ...rental, status: "completed" })
      const damage = await db.insert("damageInvoices", {
        ...rental,
        completionId,
        amount: 10000,
        description: "mirror",
        photos: [],
        status: "payment_pending",
      })
      return { booking, damage }
    })
    const connected = { account: "acct_connected" }
    const coaching = {
      ...intent,
      metadata: { type: "coaching_booking", coachingBookingId: booking },
    }
    const invoice = { ...intent, metadata: { type: "damage_invoice", damageInvoiceId: damage } }
    for (const [type, event, object] of [
      ["payment_intent.succeeded", "evt_coaching_paid", coaching],
      ["payment_intent.payment_failed", "evt_coaching_fail", coaching],
      ["payment_intent.succeeded", "evt_damage_paid", invoice],
    ] as const)
      expect((await post(type, event, object, connected)).status).toBe(200)
    expect(await t.run(({ db }) => db.get(booking))).toMatchObject({
      status: "approved",
      paymentStatus: "pending",
    })
    expect(await t.run(({ db }) => db.get(damage))).toMatchObject({ status: "payment_pending" })
  })

  it("ignores matching metadata on a connected account's own payment", async () => {
    const { post, intent, state } = await setup()
    expect(
      (
        await post("payment_intent.succeeded", "evt_connected", intent, {
          account: "acct_untrusted",
        })
      ).status
    ).toBe(200)
    expect((await state()).payment?.status).toBe("pending")
    expect((await state()).reservation?.paymentStatus).toBe("pending")
  })

  it("reconciles signed refund updates and duplicate deliveries against Stripe's cumulative total", async () => {
    const { t, post, intent, metadata, state } = await setup()
    expect((await post("payment_intent.succeeded", "evt_success", intent)).status).toBe(200)
    const charge = {
      id: "ch_rental",
      payment_intent: intent.id,
      metadata,
      paid: true,
      amount_captured: 10330,
      amount_refunded: 1234,
      currency: "usd",
    }
    const refund = {
      id: "re_partial",
      payment_intent: intent.id,
      charge: charge.id,
      status: "succeeded",
      amount: 1234,
      metadata: {},
    }
    stripeFetch.mockImplementation((url) => {
      const path = new URL(String(url)).pathname
      if (path === "/v1/charges/ch_rental") return Promise.resolve(Response.json(charge))
      if (path === "/v1/refunds")
        return Promise.resolve(
          Response.json({ object: "list", has_more: false, data: [refund], url: path })
        )
      throw new Error(`Unexpected Stripe API request: ${path}`)
    })
    expect((await post("charge.refunded", "evt_refund", charge)).status).toBe(200)
    expect((await post("charge.refunded", "evt_refund", charge)).status).toBe(200)
    expect((await post("refund.updated", "evt_refund_updated", refund)).status).toBe(200)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const result = await state()
    expect(result.payment).toMatchObject({ status: "partially_refunded", refundAmount: 1234 })
    expect(result.reservation).toMatchObject({
      status: "confirmed",
      paymentStatus: "partially_refunded",
    })
  })

  it("rejects a signed success for another renter, currency or amount", async () => {
    const { post, intent, metadata, state } = await setup()
    for (const overrides of [
      { metadata: { ...metadata, renterId: "stranger" } },
      { currency: "eur" },
      { amount_received: 9000 },
    ]) {
      expect(
        (await post("payment_intent.succeeded", "evt_mismatch", { ...intent, ...overrides })).status
      ).toBe(500)
    }
    const result = await state()
    expect(result.payment?.status).toBe("pending")
    expect(result.reservation?.paymentStatus).toBe("pending")
    expect(result.receipts).toHaveLength(0)
  })

  it("binds a hosted checkout intent from its signed session after out-of-order delivery", async () => {
    const { t, post, intent, metadata, state } = await setup(true)
    expect((await post("payment_intent.succeeded", "evt_capture", intent)).status).toBe(500)
    expect((await state()).receipts).toHaveLength(0)
    const session = {
      object: "checkout.session",
      id: "cs_rental",
      mode: "payment",
      payment_intent: "pi_rental",
      currency: "usd",
      amount_total: 10330,
      metadata,
    }
    expect((await post("checkout.session.completed", "evt_session", session)).status).toBe(200)
    expect((await state()).payment?.status).toBe("pending")
    expect((await post("payment_intent.succeeded", "evt_capture", intent)).status).toBe(200)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const result = await state()
    expect(result.payment).toMatchObject({
      status: "succeeded",
      stripePaymentIntentId: "pi_rental",
    })
    expect(result.reservation?.paymentStatus).toBe("paid")
  })

  it.each([
    false,
    true,
  ])("preserves a partial refund when the refund arrives first = %s", async (refundFirst) => {
    const { t, post, intent, ids, state } = await setup()
    if (!refundFirst) {
      expect((await post("payment_intent.succeeded", "evt_initial", intent)).status).toBe(200)
    }
    await t.mutation(internal.stripe.updateRefundStatus, {
      paymentId: ids.paymentId,
      stripeChargeId: "ch_rental",
      stripePaymentIntentId: "pi_rental",
      capturedAmount: 10330,
      refundAmount: 1234,
      expectedVersion: 0,
      cancelOnFull: false,
    })
    expect((await post("payment_intent.succeeded", "evt_success", intent)).status).toBe(200)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const result = await state()
    expect(result.payment).toMatchObject({
      status: "partially_refunded",
      refundAmount: 1234,
      stripeChargeId: "ch_rental",
    })
    expect(result.reservation).toMatchObject({
      status: "confirmed",
      paymentStatus: "partially_refunded",
    })
    expect(result.notifications.map((n) => n.type)).toEqual(["payment_success"])
  })

  it("retains a full refund when success arrives after the refund", async () => {
    const { t, post, intent, ids, state } = await setup()
    await t.mutation(internal.stripe.updateRefundStatus, {
      paymentId: ids.paymentId,
      stripeChargeId: "ch_rental",
      stripePaymentIntentId: "pi_rental",
      capturedAmount: 10330,
      refundAmount: 10330,
      expectedVersion: 0,
      cancelOnFull: true,
    })
    expect((await post("payment_intent.succeeded", "evt_after_refund", intent)).status).toBe(200)
    const result = await state()
    expect(result.payment?.status).toBe("refunded")
    expect(result.reservation).toMatchObject({ status: "cancelled", paymentStatus: "refunded" })
    expect(result.notifications).toHaveLength(0)
  })

  it("records a late capture without reopening a cancelled reservation", async () => {
    const { t, post, intent, ids, state } = await setup()
    await t.run((ctx) => ctx.db.patch(ids.reservationId, { status: "cancelled" }))
    expect((await post("payment_intent.succeeded", "evt_late", intent)).status).toBe(200)
    const result = await state()
    expect(result.payment?.status).toBe("succeeded")
    expect(result.reservation?.status).toBe("cancelled")
    expect(result.audit.map((a) => a.action)).toEqual(["rental_capture_requires_reconciliation"])
    expect(result.notifications).toHaveLength(0)
  })
})
