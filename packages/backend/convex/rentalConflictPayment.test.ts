// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

vi.mock("./r2", () => ({ r2: {} }))
vi.mock("./rateLimiter", () => ({ rateLimiter: { limit: async () => ({ ok: true }) } }))
const modules = (
  import.meta as unknown as { glob: (pattern: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
let active: ReturnType<typeof convexTest> | undefined
beforeEach(() => vi.useFakeTimers())
afterEach(async () => {
  try {
    await active?.finishAllScheduledFunctions(vi.runAllTimers)
  } finally {
    active = undefined
    vi.useRealTimers()
  }
})

async function setup() {
  const t = convexTest(schema, modules)
  active = t
  const ids = await t.run(async ({ db }) => {
    const trackId = await db.insert("tracks", { name: "Test", location: "Test", isActive: true })
    const vehicleId = await db.insert("vehicles", {
      trackId,
      ownerId: "host",
      make: "Test",
      model: "Car",
      year: 2026,
      dailyRate: 1000,
      description: "Synthetic",
      amenities: [],
      addOns: [],
      isActive: true,
      isApproved: true,
      createdAt: 1,
      updatedAt: 1,
    })
    const reservationId = await db.insert("reservations", {
      vehicleId,
      ownerId: "host",
      renterId: "renter",
      startDate: "2031-01-01",
      endDate: "2031-01-03",
      totalDays: 3,
      dailyRate: 1000,
      totalAmount: 3000,
      quoteVersion: 1,
      status: "approved",
      createdAt: 1,
      updatedAt: 1,
    })
    return { vehicleId, reservationId }
  })
  const record = {
    reservationId: ids.reservationId,
    renterId: "renter",
    ownerId: "host",
    amount: 3000,
    platformFee: 150,
    ownerAmount: 2850,
    processingFee: 120,
    stripePaymentIntentId: "pi_conflict",
    metadata: {
      vehicleId: ids.vehicleId,
      startDate: "2031-01-01",
      endDate: "2031-01-03",
      totalDays: 3,
    },
  }
  const capture = {
    reservationId: ids.reservationId,
    renterId: "renter",
    ownerId: "host",
    amount: 3120,
    currency: "usd",
    stripePaymentIntentId: "pi_conflict",
    stripeChargeId: "ch_conflict",
    eventId: "evt_conflict",
    eventType: "payment_intent.succeeded" as const,
  }
  const addConflict = async (
    status: "pending" | "approved" | "confirmed" | "cancelled" = "approved"
  ) =>
    t.run(({ db }) =>
      db.insert("reservations", {
        vehicleId: ids.vehicleId,
        ownerId: "host",
        renterId: "other",
        startDate: "2031-01-02",
        endDate: "2031-01-02",
        totalDays: 1,
        dailyRate: 1000,
        totalAmount: 1000,
        quoteVersion: 1,
        status,
        createdAt: 1,
        updatedAt: 1,
      })
    )
  const blockMiddle = () =>
    t.run(({ db }) =>
      db.insert("availability", {
        vehicleId: ids.vehicleId,
        date: "2031-01-02",
        isAvailable: false,
        createdAt: 1,
      })
    )
  return { t, ids, record, capture, addConflict, blockMiddle }
}

describe("rental payment date protection", () => {
  it.each([
    "createPaymentIntent",
    "createCheckoutSession",
  ] as const)("%s rejects a conflicting approved booking before reaching Stripe", async (method) => {
    const { t, ids, addConflict } = await setup()
    await addConflict()
    await expect(
      t.withIdentity({ subject: "renter" }).action(api.stripe[method], {
        reservationId: ids.reservationId,
        amount: 3000,
      })
    ).rejects.toThrow("DATES_UNAVAILABLE")
    expect(await t.run(({ db }) => db.query("payments").collect())).toEqual([])
  })

  it.each([
    "createPaymentIntent",
    "createCheckoutSession",
  ] as const)("%s rejects a host block in the middle of the range before reaching Stripe", async (method) => {
    const { t, ids, blockMiddle } = await setup()
    await blockMiddle()
    await expect(
      t.withIdentity({ subject: "renter" }).action(api.stripe[method], {
        reservationId: ids.reservationId,
        amount: 3000,
      })
    ).rejects.toThrow("DATES_UNAVAILABLE")
  })

  it("ignores the booking's own hold and nonholding requests, then rechecks cancellation", async () => {
    const { t, ids, addConflict } = await setup()
    await addConflict("pending")
    await addConflict("cancelled")
    const args = { reservationId: ids.reservationId, renterId: "renter" }
    await expect(t.query(internal.stripe.assertRentalPaymentAvailable, args)).resolves.toBeNull()
    await t.run(({ db }) => db.patch(ids.reservationId, { status: "cancelled" }))
    await expect(t.query(internal.stripe.assertRentalPaymentAvailable, args)).rejects.toThrow(
      "INVALID_STATUS"
    )
  })

  it("rechecks conflicts when attaching a payment after an external Stripe request", async () => {
    const { t, record, addConflict } = await setup()
    await addConflict("confirmed")
    await expect(t.mutation(internal.stripe.createPaymentRecord, record)).rejects.toThrow(
      "DATES_UNAVAILABLE"
    )
    expect(await t.run(({ db }) => db.query("payments").collect())).toEqual([])
  })

  it("does not return a linked payment through a conflicting retry", async () => {
    const { t, record, addConflict } = await setup()
    const paymentId = await t.mutation(internal.stripe.createPaymentRecord, record)
    const before = await t.run(({ db }) => db.get(paymentId))
    await addConflict()
    await expect(t.mutation(internal.stripe.createPaymentRecord, record)).rejects.toThrow(
      "DATES_UNAVAILABLE"
    )
    expect(await t.run(({ db }) => db.get(paymentId))).toEqual(before)
  })

  it.each([
    "approved",
    "confirmed",
    "blocked",
  ] as const)("preserves capture and requests review instead of confirming against %s dates", async (kind) => {
    const { t, ids, record, capture, addConflict, blockMiddle } = await setup()
    const paymentId = await t.mutation(internal.stripe.createPaymentRecord, record)
    const conflictId = kind === "blocked" ? await blockMiddle() : await addConflict(kind)
    const conflictBefore = await t.run(({ db }) => db.get(conflictId))
    await t.mutation(internal.stripe.ingestRentalPaymentEvent, capture)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await t.run(({ db }) => db.get(paymentId))).toMatchObject({
      status: "succeeded",
      stripeChargeId: "ch_conflict",
    })
    expect(await t.run(({ db }) => db.get(ids.reservationId))).toMatchObject({
      status: "approved",
      paymentStatus: "paid",
      paymentId,
      totalAmount: 3000,
    })
    expect(await t.run(({ db }) => db.get(conflictId))).toEqual(conflictBefore)
    const audit = await t.run(({ db }) => db.query("auditLogs").collect())
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({
      action: "rental_capture_requires_reconciliation",
      metadata: { reason: "rental_dates_unavailable" },
    })
    const notices = await t.run(({ db }) => db.query("notifications").collect())
    expect(notices.map((item) => item.userId).sort()).toEqual(["host", "renter"])
    expect(
      notices.every(
        (item) => item.type === "system" && item.title === "Rental payment needs review"
      )
    ).toBe(true)
    await expect(
      t.query(internal.stripe.assertRentalPaymentAvailable, {
        reservationId: ids.reservationId,
        renterId: "renter",
      })
    ).rejects.toThrow("INVALID_STATUS")
  })

  it("does not reconfirm or resend notices on duplicate capture, even after the conflict is removed", async () => {
    const { t, ids, record, capture, addConflict } = await setup()
    await t.mutation(internal.stripe.createPaymentRecord, record)
    const otherId = await addConflict()
    await t.mutation(internal.stripe.ingestRentalPaymentEvent, capture)
    await t.mutation(internal.stripe.ingestRentalPaymentEvent, capture)
    await t.run(({ db }) => db.patch(otherId, { status: "cancelled" }))
    await t.mutation(internal.stripe.ingestRentalPaymentEvent, {
      ...capture,
      eventId: "evt_redelivered",
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await t.run(({ db }) => db.get(ids.reservationId))).toMatchObject({
      status: "approved",
      paymentStatus: "paid",
    })
    expect(await t.run(({ db }) => db.query("auditLogs").collect())).toHaveLength(1)
    expect(await t.run(({ db }) => db.query("notifications").collect())).toHaveLength(2)
  })

  it.each([
    ["renter", "paid"],
    ["host", "paid"],
    ["renter", "partially_refunded"],
    ["host", "partially_refunded"],
  ] as const)("rejects cancellation by %s for a %s review hold without writes or refund scheduling", async (subject, paymentStatus) => {
    const { t, ids, record, capture, addConflict } = await setup()
    const paymentId = await t.mutation(internal.stripe.createPaymentRecord, record)
    const otherId = await addConflict()
    await t.mutation(internal.stripe.ingestRentalPaymentEvent, capture)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    await t.run(async ({ db }) => {
      // Clearing the original conflict must not bypass the explicit review hold.
      await db.patch(otherId, { status: "cancelled" })
      if (paymentStatus === "partially_refunded") {
        await db.patch(ids.reservationId, { paymentStatus })
        await db.patch(paymentId, { status: "partially_refunded" })
      }
    })
    const snapshot = () =>
      t.run(async ({ db }) => ({
        reservations: await db.query("reservations").collect(),
        payments: await db.query("payments").collect(),
        audit: await db.query("auditLogs").collect(),
        notifications: await db.query("notifications").collect(),
        jobs: await db.system.query("_scheduled_functions").collect(),
      }))
    const before = await snapshot()
    await expect(
      t.withIdentity({ subject }).mutation(api.reservations.cancel, {
        reservationId: ids.reservationId,
        cancellationReason: "Cancel while payment needs review",
      })
    ).rejects.toThrow("This payment needs review")
    expect(await snapshot()).toEqual(before)
  })

  it("preserves a captured review hold when the unpaid approval cleanup runs", async () => {
    const { t, ids, record, capture, blockMiddle } = await setup()
    await t.mutation(internal.stripe.createPaymentRecord, record)
    await blockMiddle()
    await t.mutation(internal.stripe.ingestRentalPaymentEvent, capture)
    await t.run(({ db }) =>
      db.patch(ids.reservationId, {
        approvedAt: Date.now() - 49 * 60 * 60 * 1000,
      })
    )
    expect(await t.mutation(api.reservations.cleanupExpiredApprovedReservations, {})).toMatchObject(
      { cleanedUp: 0 }
    )
    expect(await t.run(({ db }) => db.get(ids.reservationId))).toMatchObject({
      status: "approved",
      paymentStatus: "paid",
    })
  })

  it("does not alter an already-confirmed historical booking on duplicate success", async () => {
    const { t, ids, record, capture, addConflict } = await setup()
    const paymentId = await t.mutation(internal.stripe.createPaymentRecord, record)
    await t.mutation(internal.stripe.ingestRentalPaymentEvent, capture)
    await addConflict("confirmed")
    await t.mutation(internal.stripe.ingestRentalPaymentEvent, {
      ...capture,
      eventId: "evt_old_confirmed",
    })
    expect(await t.run(({ db }) => db.get(ids.reservationId))).toMatchObject({
      status: "confirmed",
      paymentStatus: "paid",
      paymentId,
    })
    expect(await t.run(({ db }) => db.query("auditLogs").collect())).toHaveLength(0)
  })

  it("keeps a cancellation authoritative when an old payment captures after dates are rebooked", async () => {
    const { t, ids, record, capture, addConflict } = await setup()
    const paymentId: Id<"payments"> = await t.mutation(internal.stripe.createPaymentRecord, record)
    await t.run(({ db }) => db.patch(ids.reservationId, { status: "cancelled" }))
    const otherId = await addConflict()
    await t.mutation(internal.stripe.ingestRentalPaymentEvent, capture)
    expect(await t.run(({ db }) => db.get(paymentId))).toMatchObject({ status: "succeeded" })
    expect(await t.run(({ db }) => db.get(ids.reservationId))).toMatchObject({
      status: "cancelled",
    })
    expect(await t.run(({ db }) => db.get(otherId))).toMatchObject({ status: "approved" })
    expect(await t.run(({ db }) => db.query("auditLogs").collect())).toHaveLength(1)
  })
})
