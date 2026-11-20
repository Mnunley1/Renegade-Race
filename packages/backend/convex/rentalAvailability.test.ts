// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

vi.mock("./rateLimiter", () => ({ rateLimiter: { limit: async () => ({ ok: true }) } }))
vi.mock("./r2", () => ({ r2: {} }))
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
  const vehicleId = await t.run(async ({ db }) => {
    const trackId = await db.insert("tracks", { name: "REN34", location: "Test", isActive: true })
    return db.insert("vehicles", {
      ownerId: "host",
      trackId,
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
  })
  const host = t.withIdentity({ subject: "host" })
  const renter = t.withIdentity({ subject: "renter" })
  const request = (subject = "renter", startDate = "2030-06-14", durationDays = 3) =>
    t
      .withIdentity({ subject })
      .mutation(api.reservations.create, { vehicleId, startDate, durationDays })
  const range = { vehicleId, startDate: "2030-06-14", endDate: "2030-06-16" }
  return { t, vehicleId, host, renter, request, range }
}

describe("exclusive approved rental dates", () => {
  it("permits pending competition; approval reserves dates and declines its competitors", async () => {
    const { t, host, request, range } = await setup()
    const first = await request()
    const second = await request("other")
    expect(await t.query(api.availability.checkAvailability, range)).toMatchObject({
      isAvailable: true,
    })
    expect(
      await t.query(api.vehicles.searchWithAvailability, {
        startDate: range.startDate,
        endDate: range.endDate,
      })
    ).toHaveLength(1)
    const attempts = await Promise.allSettled([
      host.mutation(api.reservations.approve, { reservationId: first }),
      host.mutation(api.reservations.approve, { reservationId: second }),
    ])
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    const bookings = await t.run(async ({ db }) => [await db.get(first), await db.get(second)])
    expect(bookings.map((booking) => booking?.status).sort()).toEqual(["approved", "declined"])
    expect(bookings.every((booking) => booking?.totalAmount === 3000)).toBe(true)
    expect(await t.query(api.availability.checkAvailability, range)).toMatchObject({
      isAvailable: false,
    })
    expect(
      await t.query(api.vehicles.searchWithAvailability, {
        startDate: range.startDate,
        endDate: range.endDate,
      })
    ).toEqual([])
    await expect(request("late")).rejects.toThrow("DATES_UNAVAILABLE")
  })

  it("rejects a middle-day host block consistently in query, search, create and approval", async () => {
    const { t, host, request, range, vehicleId } = await setup()
    const pending = await request()
    await host.mutation(api.availability.blockDate, { vehicleId, date: "2030-06-15" })
    expect(await t.query(api.availability.checkAvailability, range)).toMatchObject({
      isAvailable: false,
    })
    expect(
      await t.query(api.vehicles.searchWithAvailability, {
        startDate: range.startDate,
        endDate: range.endDate,
      })
    ).toEqual([])
    await expect(request("other")).rejects.toThrow("DATES_UNAVAILABLE")
    await expect(
      host.mutation(api.reservations.approve, { reservationId: pending })
    ).rejects.toThrow("DATES_UNAVAILABLE")
    expect((await t.run(({ db }) => db.get(pending)))?.status).toBe("pending")
  })

  it.each([
    "approved",
    "confirmed",
  ] as const)("does not let a host block a %s booking", async (status) => {
    const { t, host, request, range, vehicleId } = await setup()
    const id = await request()
    await t.run(({ db }) => db.patch(id, { status }))
    await expect(
      host.mutation(api.availability.blockDate, { vehicleId, date: "2030-06-15" })
    ).rejects.toThrow("DATES_UNAVAILABLE")
    await expect(host.mutation(api.availability.blockDateRange, range)).rejects.toThrow(
      "DATES_UNAVAILABLE"
    )
    await expect(
      host.mutation(api.availability.setDefaultAvailability, { ...range, isAvailable: false })
    ).rejects.toThrow("DATES_UNAVAILABLE")
    expect(await t.query(api.availability.getByVehicle, { vehicleId })).toEqual([])
  })

  it("rechecks approval against an existing confirmed booking without rewriting either quote", async () => {
    const { t, host, request } = await setup()
    const first = await request()
    const second = await request("other")
    await t.run(({ db }) => db.patch(first, { status: "confirmed" }))
    const before = await t.run(async ({ db }) => [await db.get(first), await db.get(second)])
    await expect(
      host.mutation(api.reservations.approve, { reservationId: second })
    ).rejects.toThrow("DATES_UNAVAILABLE")
    expect(await t.run(async ({ db }) => [await db.get(first), await db.get(second)])).toEqual(
      before
    )
  })

  it("releases dates when an unpaid approved booking is cancelled", async () => {
    const { t, host, renter, request, range } = await setup()
    const id = await request()
    await host.mutation(api.reservations.approve, { reservationId: id })
    await renter.mutation(api.reservations.cancel, { reservationId: id })
    expect(await t.query(api.availability.checkAvailability, range)).toMatchObject({
      isAvailable: true,
    })
    const replacement = await request("other")
    await host.mutation(api.reservations.approve, { reservationId: replacement })
    expect((await t.run(({ db }) => db.get(id)))?.status).toBe("cancelled")
    expect((await t.run(({ db }) => db.get(replacement)))?.status).toBe("approved")
  })

  it.each([
    ["2030-12-31", "2031-01-01"],
    ["2030-03-09", "2030-03-10"],
    ["2030-11-02", "2030-11-03"],
  ])("includes occupied boundary dates across %s → %s", async (startDate, blockedDay) => {
    const { host, vehicleId, request } = await setup()
    await host.mutation(api.availability.blockDate, { vehicleId, date: blockedDay })
    await expect(request("renter", startDate, 2)).rejects.toThrow("DATES_UNAVAILABLE")
  })

  it("allows an adjacent day after the inclusive end, but not the end itself", async () => {
    const { host, request } = await setup()
    const id = await request()
    await host.mutation(api.reservations.approve, { reservationId: id })
    await expect(request("other", "2030-06-16", 1)).rejects.toThrow("DATES_UNAVAILABLE")
    await expect(request("other", "2030-06-17", 1)).resolves.toBeTruthy()
  })

  it("rejects noncanonical and reversed date ranges before a host writes blocks", async () => {
    const { host, vehicleId } = await setup()
    await expect(
      host.mutation(api.availability.blockDate, { vehicleId, date: "2030-6-15" })
    ).rejects.toThrow("INVALID_DATE_RANGE")
    await expect(
      host.mutation(api.availability.blockDateRange, {
        vehicleId,
        startDate: "2030-06-16",
        endDate: "2030-06-14",
      })
    ).rejects.toThrow("INVALID_DATE_RANGE")
  })
})
