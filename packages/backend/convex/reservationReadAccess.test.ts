// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

const limiter = vi.hoisted(() => vi.fn(async () => ({ ok: true, retryAfter: 0 })))
vi.mock("./rateLimiter", () => ({ rateLimiter: { limit: limiter } }))
const modules = (
  import.meta as unknown as { glob: (pattern: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
const statuses = ["pending", "approved", "confirmed", "cancelled", "completed", "declined"] as const

async function fixture() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async ({ db }) => {
    for (const subject of ["renter", "historical-owner", "current-owner", "unrelated"]) {
      await db.insert("users", { externalId: subject, name: subject })
    }
    const trackId = await db.insert("tracks", {
      name: "Synthetic track",
      location: "Test",
      isActive: false,
    })
    const vehicleId = await db.insert("vehicles", {
      ownerId: "current-owner",
      trackId,
      make: "BMW",
      model: "Synthetic",
      year: 2015,
      dailyRate: 1800,
      description: "Retained legacy description",
      amenities: [],
      addOns: [],
      isActive: false,
      isApproved: true,
      createdAt: 1,
      updatedAt: 1,
    })
    const imageId = await db.insert("vehicleImages", {
      vehicleId,
      imageUrl: "https://example.test/retained.jpg",
      isPrimary: true,
      order: 0,
    })
    const reservationIds = await Promise.all(
      statuses.map((status) =>
        db.insert("reservations", {
          vehicleId,
          renterId: "renter",
          ownerId: "historical-owner",
          startDate: "2035-01-01",
          endDate: "2035-01-01",
          totalDays: 1,
          dailyRate: 1800,
          totalAmount: 1800,
          status,
          quoteVersion: 1,
          addOns: [],
          createdAt: 1,
          updatedAt: 1,
        })
      )
    )
    return { vehicleId, imageId, reservationIds }
  })
  const snapshot = () =>
    t.run(async ({ db }) => ({
      users: await db.query("users").collect(),
      vehicles: await db.query("vehicles").collect(),
      images: await db.query("vehicleImages").collect(),
      reservations: await db.query("reservations").collect(),
      payments: await db.query("payments").collect(),
      notifications: await db.query("notifications").collect(),
      conversations: await db.query("conversations").collect(),
      operations: await db.query("accountOperations").collect(),
    }))
  return { t, ...ids, snapshot }
}
beforeEach(() => limiter.mockClear())

describe("reservation history participant access", () => {
  it.each(
    statuses
  )("retains %s archived history and images for its actual participants/admin", async (status) => {
    const f = await fixture()
    const id = f.reservationIds[statuses.indexOf(status)]
    if (!id) throw new Error("Missing synthetic reservation")
    const before = await f.snapshot()
    for (const identity of [
      { subject: "renter" },
      { subject: "historical-owner" },
      { subject: "admin", publicMetadata: { role: "admin" } },
    ]) {
      const result = await f.t.withIdentity(identity).query(api.reservations.getById, { id })
      expect(result?.status).toBe(status)
      expect(result?.vehicle).toMatchObject({
        _id: f.vehicleId,
        description: "Retained legacy description",
        isActive: false,
      })
      expect((result?.vehicle as { images?: { _id: string }[] } | null)?.images?.[0]?._id).toBe(
        f.imageId
      )
    }
    for (const viewer of [
      f.t,
      f.t.withIdentity({ subject: "unrelated" }),
      f.t.withIdentity({ subject: "current-owner" }),
    ]) {
      expect(await viewer.query(api.reservations.getById, { id })).toBeNull()
    }
    expect(await f.snapshot()).toEqual(before)
  })

  it("returns all statuses only for the specified renter/owner or trusted admin", async () => {
    const f = await fixture()
    for (const [subject, role] of [
      ["renter", "renter"],
      ["historical-owner", "owner"],
    ] as const) {
      const args = { userId: subject, role }
      for (const reader of [
        f.t.withIdentity({ subject }),
        f.t.withIdentity({ subject: "admin", metadata: { role: "admin" } }),
      ]) {
        const results = await reader.query(api.reservations.getByUser, args)
        expect(new Set(results.map((r) => r.status))).toEqual(new Set(statuses))
        expect(results.every((r) => r.vehicle?.isActive === false)).toBe(true)
      }
      await expect(f.t.query(api.reservations.getByUser, args)).rejects.toThrow("Not authenticated")
      await expect(
        f.t.withIdentity({ subject: "unrelated" }).query(api.reservations.getByUser, args)
      ).rejects.toThrow("Not authorized")
    }
  })

  it("protects every user-filtered history alias while preserving authorized reads", async () => {
    const f = await fixture()
    const calls = [
      [api.reservations.getPendingForOwner, { ownerId: "historical-owner" }, "historical-owner"],
      [api.reservations.getApprovedForRenter, { renterId: "renter" }, "renter"],
      [api.reservations.getConfirmedForOwner, { ownerId: "historical-owner" }, "historical-owner"],
      [api.reservations.getUpcoming, { userId: "renter", role: "renter" }, "renter"],
      [
        api.reservations.getUpcoming,
        { userId: "historical-owner", role: "owner" },
        "historical-owner",
      ],
      [
        api.reservations.getCompletedReservationForVehicle,
        { userId: "renter", vehicleId: f.vehicleId },
        "renter",
      ],
    ] as const
    const before = await f.snapshot()
    for (const [fn, args, subject] of calls) {
      await expect(f.t.query(fn, args as never)).rejects.toThrow("Not authenticated")
      await expect(
        f.t.withIdentity({ subject: "unrelated" }).query(fn, args as never)
      ).rejects.toThrow("Not authorized")
      expect(await f.t.withIdentity({ subject }).query(fn, args as never)).toBeTruthy()
      expect(
        await f.t.withIdentity({ subject: "admin", orgRole: "admin" }).query(fn, args as never)
      ).toBeTruthy()
    }
    expect(await f.snapshot()).toEqual(before)
  })

  it("keeps the minimized public activity calendar compatible without legacy vehicle fields", async () => {
    const f = await fixture()
    const rows = await f.t.query(api.reservations.listActiveForVehicle, { vehicleId: f.vehicleId })
    expect(rows).toHaveLength(3)
    for (const row of rows)
      expect(Object.keys(row).sort()).toEqual(["_id", "endDate", "startDate", "status"])
  })
})

describe("inactive listing rental guards", () => {
  it.each([
    { isActive: false },
    { isActive: true, deletedAt: 0 },
    { isActive: true, isSuspended: true },
  ])("rejects new requests and approvals for %j without touching history or payments", async (lifecycle) => {
    const f = await fixture()
    await f.t.run(({ db }) => db.patch(f.vehicleId, lifecycle))
    const before = await f.snapshot()
    await expect(
      f.t.withIdentity({ subject: "unrelated" }).mutation(api.reservations.create, {
        vehicleId: f.vehicleId,
        startDate: "2035-02-01",
        durationDays: 1,
      })
    ).rejects.toThrow("no longer accepting")
    const pendingId = f.reservationIds[0]
    if (!pendingId) throw new Error("Missing synthetic pending reservation")
    await expect(
      f.t.withIdentity({ subject: "historical-owner" }).mutation(api.reservations.approve, {
        reservationId: pendingId,
      })
    ).rejects.toThrow("no longer accepting")
    expect(await f.snapshot()).toEqual(before)
    expect(limiter).not.toHaveBeenCalled()
  })
})
