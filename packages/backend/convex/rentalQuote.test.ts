// @vitest-environment edge-runtime

import { ConvexError } from "convex/values"
import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import { RENTAL_QUOTE_RE_REQUEST } from "./rentalQuote"
import schema from "./schema"

vi.mock("./rateLimiter", () => ({ rateLimiter: { limit: async () => ({ ok: true }) } }))
vi.mock("./r2", () => ({ r2: {} }))
const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>
  }
).glob("./**/*.ts")
const required = { name: "Support", price: 123, priceType: "daily" as const }
const optional = { name: "Helmet", price: 234, priceType: "one-time" as const }
const request = { startDate: "2030-01-01", durationDays: 3, addOns: [required, optional] }

let activeTest: ReturnType<typeof convexTest> | undefined
beforeEach(() => vi.useFakeTimers())
afterEach(async () => {
  try {
    if (activeTest) {
      await activeTest.finishAllScheduledFunctions(vi.runAllTimers)
      const jobs = await activeTest.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      )
      const unfinished = jobs.filter(
        (job) => job.state.kind !== "success" && job.state.kind !== "canceled"
      )
      if (unfinished.length) {
        throw new Error(`Scheduled callbacks did not succeed: ${JSON.stringify(unfinished)}`)
      }
    }
  } finally {
    activeTest = undefined
    vi.useRealTimers()
  }
})

async function setup() {
  const t = convexTest(schema, modules)
  activeTest = t
  const vehicleId = await t.run(async ({ db }) => {
    const trackId = await db.insert("tracks", { name: "Test", location: "Test", isActive: true })
    return db.insert("vehicles", {
      trackId,
      ownerId: "host",
      make: "Test",
      model: "Car",
      year: 2026,
      dailyRate: 1023,
      description: "Synthetic",
      amenities: [],
      addOns: [{ ...required, description: "Canonical support", isRequired: true }, optional],
      isActive: true,
      isApproved: true,
      createdAt: 1,
      updatedAt: 1,
    })
  })
  return {
    t,
    vehicleId,
    renter: t.withIdentity({ subject: "renter" }),
    host: t.withIdentity({ subject: "host" }),
  }
}

describe("server-derived rental quotes", () => {
  it.each([1, 3])("persists canonical line items for %s inclusive days", async (durationDays) => {
    const { t, vehicleId, renter, host } = await setup()
    const id = await renter.mutation(api.reservations.create, {
      ...request,
      vehicleId,
      durationDays,
      addOns: [{ ...required, description: "Untrusted description" }, optional],
    })
    const expected = 1023 * durationDays + 123 * durationDays + 234
    expect(await t.run(({ db }) => db.get(id))).toMatchObject({
      quoteVersion: 1,
      dailyRate: 1023,
      totalDays: durationDays,
      totalAmount: expected,
      addOns: [{ ...required, description: "Canonical support" }, optional],
    })
    await host.mutation(api.reservations.approve, { reservationId: id })
    expect(await t.run(({ db }) => db.get(id))).toMatchObject({
      status: "approved",
      totalAmount: expected,
    })
  })

  it.each([
    { label: "omitted required", addOns: [optional], error: "INVALID_INPUT" },
    { label: "omitted all", addOns: undefined, error: "INVALID_INPUT" },
    { label: "duplicate", addOns: [required, required], error: "INVALID_INPUT" },
    {
      label: "unknown",
      addOns: [required, { ...optional, name: "Unknown" }],
      error: "INVALID_INPUT",
    },
    { label: "altered price", addOns: [{ ...required, price: 1 }], error: "PRICE_CHANGED" },
    {
      label: "altered cadence",
      addOns: [{ ...required, priceType: "one-time" as const }],
      error: "PRICE_CHANGED",
    },
    {
      label: "missing daily cadence",
      addOns: [{ name: "Support", price: 123 }],
      error: "PRICE_CHANGED",
    },
  ])("rejects $label without writing a request", async ({ addOns, error }) => {
    const { t, vehicleId, renter } = await setup()
    await expect(
      renter.mutation(api.reservations.create, { ...request, vehicleId, addOns })
    ).rejects.toThrow(error)
    expect(await t.run(({ db }) => db.query("reservations").collect())).toHaveLength(0)
    expect(await t.run(({ db }) => db.query("conversations").collect())).toHaveLength(0)
  })

  it("allows omitted optional items, free add-ons and legacy one-time cadence", async () => {
    const { t, vehicleId, renter } = await setup()
    await t.run(({ db }) =>
      db.patch(vehicleId, { addOns: [{ name: "Free", price: 0, isRequired: true }, optional] })
    )
    const id = await renter.mutation(api.reservations.create, {
      ...request,
      vehicleId,
      addOns: [{ name: "Free", price: 0 }],
    })
    expect(await t.run(({ db }) => db.get(id))).toMatchObject({
      totalAmount: 3069,
      addOns: [{ name: "Free", price: 0, priceType: "one-time" }],
    })
  })

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
    1.23,
    100_001,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid listing add-on cents %s", async (price) => {
    const { t, vehicleId, renter } = await setup()
    await t.run(({ db }) =>
      db.patch(vehicleId, { addOns: [{ ...required, price, isRequired: true }] })
    )
    await expect(
      renter.mutation(api.reservations.create, {
        ...request,
        vehicleId,
        addOns: [{ ...required, price }],
      })
    ).rejects.toThrow()
  })

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    99,
    1023.5,
    5_000_001,
  ])("rejects invalid daily rate cents %s", async (dailyRate) => {
    const { t, vehicleId, renter } = await setup()
    await t.run(({ db }) => db.patch(vehicleId, { dailyRate }))
    await expect(
      renter.mutation(api.reservations.create, { ...request, vehicleId })
    ).rejects.toThrow("INVALID_AMOUNT")
  })

  it("rejects duplicate listing names and over-limit quote totals", async () => {
    const { t, vehicleId, renter } = await setup()
    await t.run(({ db }) => db.patch(vehicleId, { addOns: [required, required] }))
    await expect(
      renter.mutation(api.reservations.create, { ...request, vehicleId })
    ).rejects.toThrow("ambiguous")
    await t.run(({ db }) =>
      db.patch(vehicleId, { dailyRate: 500_000, addOns: [required, optional] })
    )
    await expect(
      renter.mutation(api.reservations.create, { ...request, vehicleId })
    ).rejects.toThrow("INVALID_AMOUNT")
  })

  it("keeps the validated request quote when listing prices change before and after approval", async () => {
    const { t, vehicleId, renter, host } = await setup()
    const id = await renter.mutation(api.reservations.create, { ...request, vehicleId })
    await t.run(({ db }) => db.patch(vehicleId, { dailyRate: 2000, addOns: [] }))
    await host.mutation(api.reservations.approve, { reservationId: id })
    expect(await t.run(({ db }) => db.get(id))).toMatchObject({
      quoteVersion: 1,
      dailyRate: 1023,
      totalAmount: 3672,
    })
    for (const method of ["createCheckoutSession", "createPaymentIntent"] as const) {
      // Reaches the payout prerequisite without consulting changed listing prices.
      await expect(
        renter.action(api.stripe[method], { reservationId: id, amount: 3672 })
      ).rejects.toThrow("STRIPE_ACCOUNT_INCOMPLETE")
      await expect(
        renter.action(api.stripe[method], { reservationId: id, amount: 6000 })
      ).rejects.toThrow("expected 3672 cents")
      await expect(
        renter.action(api.stripe[method], { reservationId: id, amount: 3672.1 })
      ).rejects.toThrow("PRICE_CHANGED")
    }
    expect(await t.run(({ db }) => db.query("payments").collect())).toHaveLength(0)
  })

  it("rejects payment for a deleted listing even with a trusted quote", async () => {
    const { t, vehicleId, renter, host } = await setup()
    const id = await renter.mutation(api.reservations.create, { ...request, vehicleId })
    await host.mutation(api.reservations.approve, { reservationId: id })
    await t.run(({ db }) => db.delete(vehicleId))
    for (const method of ["createCheckoutSession", "createPaymentIntent"] as const) {
      await expect(
        renter.action(api.stripe[method], { reservationId: id, amount: 3672 })
      ).rejects.toThrow("NOT_FOUND")
    }
    expect(await t.run(({ db }) => db.query("payments").collect())).toHaveLength(0)
  })

  it("exposes actionable legacy recovery errors across the Convex boundary", async () => {
    const { t, vehicleId, renter, host } = await setup()
    const id = await renter.mutation(api.reservations.create, { ...request, vehicleId })
    await t.run(({ db }) => db.patch(id, { quoteVersion: undefined, totalAmount: 100 }))
    await expect(
      host.mutation(api.reservations.approve, { reservationId: id })
    ).rejects.toMatchObject({
      data: JSON.stringify({ code: "PRICE_CHANGED", message: RENTAL_QUOTE_RE_REQUEST }),
    })
    await t.run(({ db }) => db.patch(id, { status: "approved" }))
    for (const method of ["createCheckoutSession", "createPaymentIntent"] as const) {
      await expect(
        renter.action(api.stripe[method], { reservationId: id, amount: 100 })
      ).rejects.toBeInstanceOf(ConvexError)
    }
  })

  it("marks an exact legacy quote trusted at approval without changing its subtotal", async () => {
    const { t, vehicleId, renter, host } = await setup()
    const id = await renter.mutation(api.reservations.create, { ...request, vehicleId })
    await t.run(({ db }) => db.patch(id, { quoteVersion: undefined }))
    await host.mutation(api.reservations.approve, { reservationId: id })
    expect(await t.run(({ db }) => db.get(id))).toMatchObject({
      quoteVersion: 1,
      totalAmount: 3672,
      status: "approved",
    })
  })

  it.each([
    "required",
    "duplicate",
    "cadence",
    "rate",
    "subtotal",
  ] as const)("blocks unverifiable legacy %s at approval and both payment entry points", async (caseName) => {
    const { t, vehicleId, renter, host } = await setup()
    const id = await renter.mutation(api.reservations.create, { ...request, vehicleId })
    await t.run(({ db }) =>
      db.patch(id, {
        quoteVersion: undefined,
        ...(caseName === "required" ? { addOns: [optional], totalAmount: 3303 } : {}),
        ...(caseName === "duplicate" ? { addOns: [required, required], totalAmount: 3807 } : {}),
        ...(caseName === "cadence"
          ? {
              addOns: [{ ...required, priceType: "one-time" as const }, optional],
              totalAmount: 3426,
            }
          : {}),
        ...(caseName === "rate" ? { dailyRate: 1000, totalAmount: 3603 } : {}),
        ...(caseName === "subtotal" ? { totalAmount: 100 } : {}),
      })
    )
    await expect(host.mutation(api.reservations.approve, { reservationId: id })).rejects.toThrow(
      RENTAL_QUOTE_RE_REQUEST
    )
    const before = await t.run(({ db }) => db.get(id))
    if (!before) throw new Error("Missing test reservation")
    expect(before.status).toBe("pending")
    await t.run(({ db }) => db.patch(id, { status: "approved" }))
    for (const method of ["createCheckoutSession", "createPaymentIntent"] as const) {
      await expect(
        renter.action(api.stripe[method], { reservationId: id, amount: before.totalAmount })
      ).rejects.toThrow(RENTAL_QUOTE_RE_REQUEST)
    }
    expect(await t.run(({ db }) => db.query("payments").collect())).toHaveLength(0)
    expect(await t.run(({ db }) => db.get(id))).toMatchObject({ totalAmount: before.totalAmount })
  })

  it("retains legacy duration and valid one-time missing cadence without rewriting payment data", async () => {
    const { t, vehicleId, renter } = await setup()
    await t.run(({ db }) => db.patch(vehicleId, { addOns: [{ name: "Helmet", price: 234 }] }))
    const id = await renter.mutation(api.reservations.create, {
      ...request,
      vehicleId,
      addOns: [optional],
    })
    await t.run(({ db }) =>
      db.patch(id, {
        quoteVersion: undefined,
        totalDays: 4,
        totalAmount: 4326,
        status: "approved",
        addOns: [{ name: "Helmet", price: 234 }],
      })
    )
    for (const method of ["createCheckoutSession", "createPaymentIntent"] as const) {
      await expect(
        renter.action(api.stripe[method], { reservationId: id, amount: 4326 })
      ).rejects.toThrow("STRIPE_ACCOUNT_INCOMPLETE")
    }
    expect(await t.run(({ db }) => db.get(id))).toMatchObject({ totalDays: 4, totalAmount: 4326 })
  })
})
