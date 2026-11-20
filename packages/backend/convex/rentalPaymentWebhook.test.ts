// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import Stripe from "stripe"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import stripeSchema from "../node_modules/@convex-dev/stripe/dist/component/schema.js"
import { api, internal } from "./_generated/api"
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
  const expiredSession = (metadata: Record<string, string>) => ({
    object: "checkout.session",
    id: "cs_rental",
    mode: "payment",
    status: "expired",
    payment_status: "unpaid",
    amount_total: 10330,
    currency: "usd",
    payment_intent: null,
    metadata,
  })

  it.each([
    "intent",
    "checkout",
  ] as const)("reconciles every verified duplicate of a terminal %s and preserves settled or different objects", async (kind) => {
    const { t, ids, post, intent, metadata } = await setup(kind === "checkout")
    const copies = await t.run(async ({ db }) => {
      const payment = await db.get(ids.paymentId)
      if (!payment) throw new Error("Expected payment")
      const { _id, _creationTime, ...fields } = payment
      const pendingId = await db.insert("payments", { ...fields, status: "processing" })
      const failedId = await db.insert("payments", { ...fields, status: "failed" })
      const settledId = await db.insert("payments", {
        ...fields,
        status: "succeeded",
        stripeChargeId: "ch_settled",
      })
      const unrelatedId = await db.insert("payments", {
        ...fields,
        ...(kind === "intent"
          ? { stripePaymentIntentId: "pi_other" }
          : { stripeCheckoutSessionId: "cs_other" }),
      })
      return {
        pendingId,
        failedId,
        settled: await db.get(settledId),
        unrelated: await db.get(unrelatedId),
      }
    })
    const type = kind === "intent" ? "payment_intent.canceled" : "checkout.session.expired"
    expect(
      (await post(type, "evt_duplicates", kind === "intent" ? intent : expiredSession(metadata)))
        .status
    ).toBe(200)
    expect(
      (await post(type, "evt_duplicates", kind === "intent" ? intent : expiredSession(metadata)))
        .status
    ).toBe(200)
    for (const id of [ids.paymentId, copies.pendingId, copies.failedId]) {
      expect(await t.run(({ db }) => db.get(id))).toMatchObject({ status: "cancelled" })
    }
    if (!(copies.settled && copies.unrelated)) throw new Error("Expected copies")
    const { settled, unrelated } = copies
    expect(await t.run(({ db }) => db.get(settled._id))).toEqual(settled)
    expect(await t.run(({ db }) => db.get(unrelated._id))).toEqual(unrelated)
  })

  it.each(
    (["intent", "checkout"] as const).flatMap((kind) =>
      ["renterId", "ownerId", "amount", "currency"].map((field) => ({ kind, field }))
    )
  )("rejects all terminal $kind writes if a duplicate has mismatched $field", async ({
    kind,
    field,
  }) => {
    const { t, ids, post, intent, metadata, state } = await setup(kind === "checkout")
    await t.run(async ({ db }) => {
      const payment = await db.get(ids.paymentId)
      if (!payment) throw new Error("Expected payment")
      const { _id, _creationTime, ...fields } = payment
      await db.insert("payments", { ...fields, [field]: field === "amount" ? 1 : "wrong" })
    })
    const before = await state()
    const rows = await t.run(({ db }) => db.query("payments").collect())
    const type = kind === "intent" ? "payment_intent.canceled" : "checkout.session.expired"
    expect(
      (await post(type, "evt_bad_duplicate", kind === "intent" ? intent : expiredSession(metadata)))
        .status
    ).toBe(500)
    expect(await state()).toEqual(before)
    expect(await t.run(({ db }) => db.query("payments").collect())).toEqual(rows)
  })

  it.each([
    "intent",
    "checkout",
  ] as const)("records signed terminal %s delivery once and requires cancellation before a fresh request", async (kind) => {
    const { t, ids, post, intent, metadata, state } = await setup(kind === "checkout")
    const type = kind === "intent" ? "payment_intent.canceled" : "checkout.session.expired"
    const object = kind === "intent" ? { ...intent, status: "canceled" } : expiredSession(metadata)
    expect((await post(type, "evt_terminal", object, { secret: "whsec_wrong" })).status).toBe(400)
    expect((await post(type, "evt_connected", object, { account: "acct_other" })).status).toBe(200)
    expect((await state()).payment?.status).toBe("pending")
    expect((await post(type, "evt_terminal", object)).status).toBe(200)
    expect((await post(type, "evt_terminal", object)).status).toBe(200)
    const result = await state()
    expect(result.payment?.status).toBe("cancelled")
    expect(result.reservation).toMatchObject({ status: "approved", paymentStatus: "failed" })
    expect(result.receipts.filter((r) => r.eventId === "evt_terminal")).toHaveLength(1)
    expect(result.notifications).toEqual([])
    await expect(
      t.query(internal.stripe.assertRentalPaymentAvailable, {
        reservationId: ids.reservationId,
        renterId: ids.renterId,
      })
    ).rejects.toThrow("PAYMENT_ATTEMPT_TERMINAL")
    await t
      .withIdentity({ subject: ids.renterId })
      .mutation(api.reservations.cancel, { reservationId: ids.reservationId })
    expect((await state()).reservation?.status).toBe("cancelled")
    await t.finishAllScheduledFunctions(vi.runAllTimers)
  })

  it.each([
    "pending",
    "processing",
    "failed",
  ] as const)("expires an unpaid checkout from %s", async (status) => {
    const { t, ids, post, metadata, state } = await setup(true)
    await t.run(({ db }) => db.patch(ids.paymentId, { status }))
    expect(
      (await post("checkout.session.expired", "evt_expired", expiredSession(metadata))).status
    ).toBe(200)
    expect((await state()).payment?.status).toBe("cancelled")
  })

  it("uses terminal evidence for an unambiguous legacy attempt without a pointer", async () => {
    const { t, ids, post, metadata, state } = await setup(true)
    await t.run(({ db }) => db.patch(ids.reservationId, { paymentId: undefined }))
    expect(
      (await post("checkout.session.expired", "evt_legacy", expiredSession(metadata))).status
    ).toBe(200)
    expect((await state()).reservation).toMatchObject({
      status: "approved",
      paymentStatus: "failed",
    })
  })

  it("preserves a later signed capture after an out-of-order expiry", async () => {
    const { t, post, metadata, intent, state } = await setup(true)
    const session = expiredSession(metadata)
    expect((await post("checkout.session.expired", "evt_expired", session)).status).toBe(200)
    expect(
      (
        await post("checkout.session.completed", "evt_completed", {
          ...session,
          status: "complete",
          payment_status: "paid",
          payment_intent: intent.id,
        })
      ).status
    ).toBe(200)
    expect((await post("payment_intent.succeeded", "evt_captured", intent)).status).toBe(200)
    expect((await post("checkout.session.expired", "evt_late_expiry", session)).status).toBe(200)
    expect((await state()).payment).toMatchObject({
      status: "succeeded",
      stripeChargeId: "ch_rental",
    })
    expect((await state()).reservation).toMatchObject({
      status: "confirmed",
      paymentStatus: "paid",
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
  })

  it.each([
    "renterId",
    "ownerId",
    "currency",
    "amount",
  ])("rejects cancellation evidence with mismatched %s", async (field) => {
    const { post, intent, state } = await setup()
    const object =
      field === "renterId" || field === "ownerId"
        ? { ...intent, metadata: { ...intent.metadata, [field]: "wrong" } }
        : { ...intent, [field]: field === "amount" ? 1 : "eur" }
    expect((await post("payment_intent.canceled", "evt_bad_cancel", object)).status).toBe(500)
    expect((await state()).payment?.status).toBe("pending")
    expect((await state()).receipts).toEqual([])
  })

  it.each([
    "succeeded",
    "partially_refunded",
    "refunded",
  ] as const)("does not downgrade a %s checkout after late expiry or cancellation", async (status) => {
    const { t, ids, post, metadata, intent, state } = await setup(true)
    await t.run(async ({ db }) => {
      await db.patch(ids.paymentId, {
        status,
        stripePaymentIntentId: intent.id,
        stripeChargeId: "ch_rental",
      })
      await db.patch(ids.reservationId, {
        status: "confirmed",
        paymentStatus: status === "succeeded" ? "paid" : status,
      })
    })
    const before = await state()
    expect(
      (await post("checkout.session.expired", "evt_expired", expiredSession(metadata))).status
    ).toBe(200)
    expect((await post("payment_intent.canceled", "evt_cancel", intent)).status).toBe(200)
    const after = await state()
    expect(after.payment).toEqual(before.payment)
    expect(after.reservation).toEqual(before.reservation)
  })

  it.each([
    "id",
    "renterId",
    "ownerId",
    "reservationId",
    "currency",
    "amount_total",
    "mode",
    "status",
    "payment_status",
  ])("rejects expired checkout with mismatched %s without recording it", async (field) => {
    const { post, metadata, state } = await setup(true)
    const session = expiredSession(metadata)
    const object = ["renterId", "ownerId", "reservationId"].includes(field)
      ? { ...session, metadata: { ...metadata, [field]: "wrong" } }
      : { ...session, [field]: field === "amount_total" ? 1 : "wrong" }
    expect((await post("checkout.session.expired", "evt_bad", object)).status).toBe(500)
    const result = await state()
    expect(result.payment?.status).toBe("pending")
    expect(result.reservation?.paymentStatus).toBe("pending")
    expect(result.receipts).toEqual([])
  })

  it.each([
    true,
    false,
  ])("does not overwrite a newer attempt when old checkout expires (pointer=%s)", async (hasPointer) => {
    const { t, ids, post, metadata, state } = await setup(true)
    await t.run(async ({ db }) => {
      const old = await db.get(ids.paymentId)
      if (!old) throw new Error("Missing payment")
      const { _id, _creationTime, ...fields } = old
      const newId = await db.insert("payments", { ...fields, stripeCheckoutSessionId: "cs_new" })
      await db.patch(ids.reservationId, { paymentId: hasPointer ? newId : undefined })
    })
    const before = (await state()).reservation
    expect(
      (await post("checkout.session.expired", "evt_expired", expiredSession(metadata))).status
    ).toBe(200)
    expect((await state()).payment?.status).toBe("cancelled")
    expect((await state()).reservation).toEqual(before)
  })

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

  it("routes a verified current invoice payment even if a rental references its intent", async () => {
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
    const invoiceIntent = {
      ...intent,
      customer: "cus_invoice",
      transfer_data: { destination: "acct_invoice" },
      metadata: { type: "custom_invoice", invoiceId },
    }
    let providerIntent = { ...invoiceIntent }
    let providerStatus = "open"
    stripeFetch.mockImplementation((input) => {
      const url = new URL(String(input))
      let object: unknown
      if (url.pathname === "/v1/invoice_payments")
        object = {
          object: "list",
          has_more: false,
          data:
            url.searchParams.get("payment[payment_intent]") === "pi_unrelated"
              ? []
              : [
                  {
                    id: "inpay_invoice",
                    invoice: "in_custom",
                    is_default: true,
                    status: providerStatus === "paid" ? "paid" : "open",
                    currency: "usd",
                    amount_requested: 10330,
                    amount_paid: providerStatus === "paid" ? 10330 : null,
                    payment: { type: "payment_intent", payment_intent: intent.id },
                  },
                ],
        }
      else if (url.pathname === "/v1/invoices/in_custom")
        object = {
          id: "in_custom",
          status: providerStatus,
          customer: "cus_invoice",
          total: 10330,
          currency: "usd",
          amount_due: 10330,
          amount_paid: providerStatus === "paid" ? 10330 : 0,
          metadata: { type: "custom_invoice", invoiceId, senderId: "host", recipientId: "renter" },
        }
      else if (url.pathname === `/v1/payment_intents/${intent.id}`) object = providerIntent
      else if (url.pathname === "/v1/customers/cus_invoice")
        object = { id: "cus_invoice", metadata: { userId: "renter" } }
      else if (url.pathname === "/v1/accounts/acct_invoice")
        object = { id: "acct_invoice", type: "express", metadata: { renegadeUserId: "host" } }
      else if (url.pathname === "/v1/charges/ch_rental")
        object = {
          id: "ch_rental",
          paid: true,
          captured: true,
          amount: 10330,
          amount_captured: 10330,
          currency: "usd",
          customer: "cus_invoice",
          payment_intent: intent.id,
          transfer_data: { destination: "acct_invoice" },
        }
      else throw new Error("Unexpected invoice provider request")
      return Promise.resolve(
        new Response(JSON.stringify(object), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    })
    const invoice = () => t.run((ctx) => ctx.db.get(invoiceId))
    expect(
      (
        await post("payment_intent.succeeded", "wrong_intent", {
          ...invoiceIntent,
          id: "pi_unrelated",
        })
      ).status
    ).toBe(500)
    expect(
      (
        await post("payment_intent.succeeded", "connected", invoiceIntent, {
          account: "acct_other",
        })
      ).status
    ).toBe(200)
    for (const [id, evidence] of [
      ["wrong_amount", { ...invoiceIntent, amount_received: 1 }],
      ["wrong_currency", { ...invoiceIntent, currency: "eur" }],
    ] as const) {
      providerIntent = evidence
      providerStatus = "paid"
      expect((await post("payment_intent.succeeded", id, evidence)).status).toBe(500)
      expect((await invoice())?.status).toBe("sent")
    }
    providerIntent = { ...invoiceIntent, status: "processing" }
    providerStatus = "open"
    expect(
      (await post("payment_intent.processing", "evt_invoice_processing", invoiceIntent)).status
    ).toBe(200)
    expect((await invoice())?.status).toBe("processing")
    providerIntent = { ...invoiceIntent, status: "requires_payment_method" }
    expect(
      (await post("payment_intent.payment_failed", "evt_invoice_failed", invoiceIntent)).status
    ).toBe(200)
    expect((await invoice())?.status).toBe("payment_pending")
    providerIntent = invoiceIntent
    providerStatus = "paid"
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
