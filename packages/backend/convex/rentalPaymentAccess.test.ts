// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { describe, expect, it, vi } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"
import * as stripe from "./stripe"

vi.mock("./r2", () => ({ r2: {} }))

vi.mock("./rateLimiter", () => ({
  rateLimiter: { limit: async () => ({ ok: true }) },
}))

const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>
  }
).glob("./**/*.ts")

async function booking() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async ({ db }) => {
    const trackId = await db.insert("tracks", { name: "VIR", location: "VA", isActive: true })
    const vehicleId = await db.insert("vehicles", {
      trackId,
      ownerId: "host",
      make: "BMW",
      model: "M3",
      year: 2015,
      dailyRate: 50000,
      description: "Track car",
      amenities: [],
      addOns: [{ name: "Support", price: 3000, priceType: "daily" }],
      isActive: true,
      isApproved: true,
      createdAt: 1,
      updatedAt: 1,
    })
    const reservationId = await db.insert("reservations", {
      vehicleId,
      renterId: "driver",
      ownerId: "host",
      startDate: "2030-01-01",
      endDate: "2030-01-02",
      totalDays: 2,
      dailyRate: 50000,
      totalAmount: 100000,
      status: "approved",
      createdAt: 1,
      updatedAt: 1,
    })
    return { vehicleId, reservationId }
  })
  const record = {
    reservationId: ids.reservationId,
    renterId: "driver",
    ownerId: "host",
    amount: 100000,
    platformFee: 5000,
    ownerAmount: 95000,
    stripePaymentIntentId: "pi_rental",
    metadata: {
      vehicleId: ids.vehicleId,
      startDate: "2030-01-01",
      endDate: "2030-01-02",
      totalDays: 2,
    },
  }
  return { t, record }
}

describe("rental payment access", () => {
  it("registers no public payment-record or Stripe event writer", () => {
    // convex-test can invoke internal functions directly. Convex's registration flags
    // determine which exported functions a real client is permitted to invoke.
    const publicWrites = Object.entries(stripe)
      .filter(([, fn]) => "isPublic" in fn && ("isMutation" in fn || "isAction" in fn))
      .map(([name]) => name)
    expect(publicWrites.sort()).toEqual(
      [
        "calculatePlatformFee",
        "createCheckoutSession",
        "createConnectAccount",
        "createConnectLoginLink",
        "createCustomerPortalSession",
        "createPaymentIntent",
        "getConnectAccountStatus",
        "getCustomerDetails",
        "getCustomerInvoices",
        "getCustomerPaymentMethods",
        "initializePlatformSettings",
        "processRefund",
        "refreshConnectAccountStatus",
        "updatePlatformSettings",
      ].sort()
    )
  })

  it.each([
    "createCheckoutSession",
    "createPaymentIntent",
  ] as const)("%s rejects anonymous and unrelated callers before reaching Stripe", async (method) => {
    const { t, record } = await booking()
    const args = { reservationId: record.reservationId, amount: record.amount }
    await expect(t.action(api.stripe[method], args)).rejects.toThrow("AUTH_REQUIRED")
    await expect(
      t.withIdentity({ subject: "other" }).action(api.stripe[method], args)
    ).rejects.toThrow("Not authorized")
    expect(await t.run(({ db }) => db.query("payments").collect())).toHaveLength(0)
  })

  it.each([
    "createCheckoutSession",
    "createPaymentIntent",
  ] as const)("%s prices a daily add-on from the vehicle listing", async (method) => {
    const { t, record } = await booking()
    await t.run(({ db }) =>
      db.patch(record.reservationId, {
        addOns: [{ name: "Support", price: 3000, priceType: "one-time" }],
      })
    )
    await expect(
      t.withIdentity({ subject: "driver" }).action(api.stripe[method], {
        reservationId: record.reservationId,
        amount: 103000,
      })
    ).rejects.toThrow("PRICE_CHANGED")
  })

  it.each([
    "createCheckoutSession",
    "createPaymentIntent",
  ] as const)("%s keeps the stored duration for both inclusive and historical bookings", async (method) => {
    const { t, record } = await booking()
    const renter = t.withIdentity({ subject: "driver" })
    // The same date pair can represent a historical one-night rental or a
    // current two-occupied-day rental. Payment must honor its stored count.
    for (const totalDays of [1, 2]) {
      await t.run(({ db }) =>
        db.patch(record.reservationId, { totalDays, totalAmount: 50000 * totalDays })
      )
      await expect(
        renter.action(api.stripe[method], {
          reservationId: record.reservationId,
          amount: 100,
        })
      ).rejects.toThrow(`expected ${50000 * totalDays} cents`)
    }
  })

  it("prevents a second checkout while the successful capture and partial refund settle", async () => {
    const { t, record } = await booking()
    await t.run(({ db }) => db.patch(record.reservationId, { paymentStatus: "partially_refunded" }))
    const renter = t.withIdentity({ subject: "driver" })
    for (const method of ["createCheckoutSession", "createPaymentIntent"] as const) {
      await expect(
        renter.action(api.stripe[method], {
          reservationId: record.reservationId,
          amount: record.amount,
        })
      ).rejects.toThrow("INVALID_STATUS")
    }
    await expect(t.mutation(internal.stripe.createPaymentRecord, record)).rejects.toThrow(
      "INVALID_STATUS"
    )
  })

  it("restricts payment history to its renter or an administrator and detail to the admin app", async () => {
    const { t, record } = await booking()
    const paymentId = await t.mutation(internal.stripe.createPaymentRecord, record)
    const other = t.withIdentity({ subject: "other" })
    const admin = t.withIdentity({ subject: "staff", publicMetadata: { role: "admin" } })
    await expect(t.query(api.stripe.getPaymentById, { paymentId })).rejects.toThrow("AUTH_REQUIRED")
    await expect(other.query(api.stripe.getPaymentById, { paymentId })).rejects.toThrow(
      "ADMIN_REQUIRED"
    )
    await expect(other.query(api.stripe.getUserPayments, { userId: "driver" })).rejects.toThrow(
      "ADMIN_REQUIRED"
    )
    expect(await admin.query(api.stripe.getPaymentById, { paymentId })).toMatchObject({
      _id: paymentId,
    })
    expect(
      await t
        .withIdentity({ subject: "driver" })
        .query(api.stripe.getUserPayments, { userId: "driver" })
    ).toHaveLength(1)
  })

  it("reuses the linked Stripe payment on checkout retries without resetting a paid booking", async () => {
    const { t, record } = await booking()
    const ids = await Promise.all(
      [0, 1].map(() => t.mutation(internal.stripe.createPaymentRecord, record))
    )
    expect(ids[0]).toEqual(ids[1])
    await t.run(({ db }) =>
      db.patch(record.reservationId, { status: "confirmed", paymentStatus: "paid" })
    )
    expect(await t.mutation(internal.stripe.createPaymentRecord, record)).toEqual(ids[0])
    await expect(
      t.mutation(internal.stripe.createPaymentRecord, {
        ...record,
        stripePaymentIntentId: "another",
      })
    ).rejects.toThrow("INVALID_STATUS")
    const reservation = await t.run(({ db }) => db.get(record.reservationId))
    expect(reservation).toMatchObject({ paymentStatus: "paid", paymentId: ids[0] })
    expect(await t.run(({ db }) => db.query("payments").collect())).toHaveLength(1)
  })

  it("selects the reservation's payment when historical checkout retries created duplicates", async () => {
    const { t, record } = await booking()
    const first = await t.mutation(internal.stripe.createPaymentRecord, record)
    const linked = await t.run(async ({ db }) => {
      const row = await db.get(first)
      if (!row) throw new Error("Missing payment fixture")
      const { _id, _creationTime, ...copy } = row
      const duplicate = await db.insert("payments", copy)
      await db.patch(record.reservationId, { paymentId: duplicate })
      return duplicate
    })
    expect(await t.mutation(internal.stripe.createPaymentRecord, record)).toEqual(linked)
  })
})
