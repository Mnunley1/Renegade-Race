// @vitest-environment edge-runtime
import { R2 } from "@convex-dev/r2"
import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

const modules = (
  import.meta as unknown as { glob: (pattern: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 99])
const jpeg = new Uint8Array([255, 216, 255, 7])
const renterForm = {
  returnDate: "2027-01-01",
  vehicleCondition: "good" as const,
  fuelLevel: "full" as const,
  mileage: 100,
  notes: "Private renter note",
}
const ownerReview = {
  vehicleReceived: true,
  conditionMatches: true,
  fuelLevelMatches: true,
  mileageMatches: true,
  notes: "Private owner note",
}

async function setup() {
  const t = convexTest(schema, modules)
  const records = await t.run(async ({ db }) => {
    const renterId = await db.insert("users", { name: "Renter", externalId: "renter" })
    const ownerId = await db.insert("users", { name: "Owner", externalId: "owner" })
    await db.insert("users", { name: "Outsider", externalId: "outsider" })
    const trackId = await db.insert("tracks", { name: "Track", location: "NC", isActive: true })
    const vehicleId = await db.insert("vehicles", {
      trackId,
      ownerId: "owner",
      make: "Test",
      model: "A",
      year: 2020,
      dailyRate: 100,
      description: "Fixture",
      amenities: [],
      addOns: [],
      isActive: true,
      isApproved: true,
      createdAt: 1,
      updatedAt: 1,
    })
    const booking = {
      vehicleId,
      renterId: "renter",
      ownerId: "owner",
      status: "confirmed" as const,
      paymentStatus: "paid" as const,
      startDate: "2027-01-01",
      endDate: "2027-01-01",
      totalDays: 1,
      dailyRate: 100,
      totalAmount: 100,
      createdAt: 1,
      updatedAt: 1,
    }
    const reservationId = await db.insert("reservations", booking)
    const otherReservationId = await db.insert("reservations", { ...booking, renterId: "outsider" })
    const completionId = await db.insert("rentalCompletions", {
      reservationId,
      vehicleId,
      renterId: "renter",
      ownerId: "owner",
      status: "pending_renter",
      createdAt: 1,
      updatedAt: 1,
    })
    return { renterId, ownerId, reservationId, otherReservationId, completionId }
  })
  const renter = t.withIdentity({ subject: "renter" }),
    owner = t.withIdentity({ subject: "owner" }),
    outsider = t.withIdentity({ subject: "outsider" })
  const route = (reservationId: string, key?: string) =>
    `/return-photo?${new URLSearchParams({ reservationId, ...(key && { key }) })}`
  const post = (bytes: Uint8Array) => ({
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: bytes as BodyInit,
  })
  return { t, ...records, renter, owner, outsider, route, post }
}

beforeEach(() => {
  vi.stubEnv("R2_BUCKET", "return-evidence-test")
  vi.stubEnv("R2_ENDPOINT", "https://r2.example.test")
  vi.stubEnv("R2_ACCESS_KEY_ID", "test-key")
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret")
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("return evidence byte access", () => {
  it("binds uploads and reads to both authorized participants and the exact reservation", async () => {
    const {
      t,
      renter,
      owner,
      outsider,
      reservationId,
      otherReservationId,
      completionId,
      route,
      post,
    } = await setup()
    expect((await t.fetch(route(reservationId), post(png))).status).toBe(401)
    expect((await outsider.fetch(route(reservationId), post(png))).status).toBe(404)
    expect((await renter.fetch(route(otherReservationId), post(png))).status).toBe(404)
    expect(
      (await renter.fetch(route(reservationId), post(new TextEncoder().encode("<svg/>")))).status
    ).toBe(415)
    const upload = await renter.fetch(route(reservationId), post(png))
    expect(upload.status).toBe(201)
    const { key } = await upload.json()
    const { key: ownerKey } = await (await owner.fetch(route(reservationId), post(jpeg))).json()
    const { key: otherKey } = await (
      await owner.fetch(route(otherReservationId), post(jpeg))
    ).json()
    expect((await owner.fetch(route(reservationId, key))).status).toBe(404)
    expect((await renter.fetch(route(reservationId, key))).status).toBe(200)
    await expect(
      renter.mutation(api.rentalCompletions.submitRenterReturnForm, {
        ...renterForm,
        completionId,
        photos: [ownerKey],
      })
    ).rejects.toThrow("Upload this return photo")
    await renter.mutation(api.rentalCompletions.submitRenterReturnForm, {
      ...renterForm,
      completionId,
      photos: [key],
    })
    await expect(
      owner.mutation(api.rentalCompletions.submitOwnerReturnReview, {
        ...ownerReview,
        completionId,
        photos: [otherKey],
      })
    ).rejects.toThrow("Upload this return photo")
    await owner.mutation(api.rentalCompletions.submitOwnerReturnReview, {
      ...ownerReview,
      completionId,
      photos: [ownerKey],
    })
    for (const [id, bytes] of [
      [key, png],
      [ownerKey, jpeg],
    ] as const) {
      for (const actor of [owner, renter]) {
        const read = await actor.fetch(route(reservationId, id))
        expect(read.status).toBe(200)
        expect(new Uint8Array(await read.arrayBuffer())).toEqual(bytes)
        expect(read.headers.get("Cache-Control")).toContain("no-store")
        expect(read.headers.get("X-Content-Type-Options")).toEqual("nosniff")
      }
      expect((await outsider.fetch(route(reservationId, id))).status).toBe(404)
      expect((await t.fetch(route(reservationId, id))).status).toBe(401)
      expect((await owner.fetch(route(otherReservationId, id))).status).toBe(404)
    }
    const row = await t.run(({ db }) => db.get(key as Id<"returnEvidence">))
    if (!row) throw new Error("Missing uploaded fixture")
    expect(
      JSON.stringify(await owner.query(api.rentalCompletions.getById, { id: completionId }))
    ).not.toContain(row.storageId)
    await expect(
      outsider.mutation(api.users.updateProfileImage, { storageId: row.storageId })
    ).rejects.toThrow("unavailable")
    await t.run(({ db }) => db.patch(completionId, { ownerId: "outsider" }))
    expect((await owner.fetch(route(reservationId, key))).status).toBe(404)
  })

  it("proxies only attached, attributable legacy images and migrates once before retiring the original", async () => {
    const {
      t,
      renter,
      owner,
      outsider,
      reservationId,
      otherReservationId,
      completionId,
      renterId,
      route,
    } = await setup()
    const suffix = `${renterId}-11111111-1111-4111-8111-111111111111`
    const key = `images/returns/${reservationId}/${suffix}`
    const invalid = `images/returns/${otherReservationId}/${suffix}`
    await t.run(({ db }) =>
      db.patch(completionId, {
        renterReturnForm: {
          ...renterForm,
          photos: [key, invalid, "https://untrusted.test/x"],
          submittedAt: 1,
        },
      })
    )
    const signed = "https://r2.example.test/server-only"
    vi.spyOn(R2.prototype, "getUrl").mockResolvedValue(signed)
    const deleteObject = vi.spyOn(R2.prototype, "deleteObject").mockResolvedValue(undefined)
    const provider = vi.fn(
      async () => new Response(png, { headers: { "Content-Type": "image/png" } })
    )
    vi.stubGlobal("fetch", provider)
    const before = await renter.query(api.rentalCompletions.getById, { id: completionId })
    expect(before?.renterReturnForm?.photos).toEqual(["legacy:renter:0"])
    const duplicate = await t.run(({ db }) =>
      db.insert("users", { name: "Duplicate", externalId: "renter" })
    )
    const ambiguous = await t.query(internal.returnEvidence.inventoryLegacy, {})
    expect(ambiguous.entries.every((entry) => entry.status === "manual")).toBe(true)
    await t.run(({ db }) => db.delete(duplicate))
    const inventory = await t.query(internal.returnEvidence.inventoryLegacy, {})
    expect(inventory.entries).toMatchObject([
      { completionId, form: "renter", index: 0, status: "verified", key },
      { completionId, form: "renter", index: 1, status: "manual" },
      { completionId, form: "renter", index: 2, status: "manual" },
    ])
    expect(JSON.stringify(inventory)).not.toContain("untrusted")
    expect(JSON.stringify(inventory)).not.toContain("Private renter note")
    const url = route(reservationId, "legacy:renter:0")
    expect((await outsider.fetch(url)).status).toBe(404)
    expect((await t.fetch(url)).status).toBe(401)
    expect((await renter.fetch(route(reservationId, key))).status).toBe(404)
    expect((await owner.fetch(route(reservationId, "legacy:renter:1"))).status).toBe(404)
    expect(provider).not.toHaveBeenCalled()
    for (const participant of [owner, renter]) {
      const result = await participant.fetch(url)
      expect(result.status).toBe(200)
      expect(new Uint8Array(await result.arrayBuffer())).toEqual(png)
    }
    expect(
      await t.action(internal.returnEvidence.migrateLegacyPhoto, { completionId, key: invalid })
    ).toBe("unverified")
    const args = { completionId, key }
    deleteObject.mockRejectedValueOnce(new Error("R2 unavailable"))
    await expect(t.action(internal.returnEvidence.migrateLegacyPhoto, args)).rejects.toThrow(
      "R2 unavailable"
    )
    expect((await t.run(({ db }) => db.query("returnEvidence").collect())).length).toBe(0)
    expect(await t.action(internal.returnEvidence.migrateLegacyPhoto, args)).toBe("migrated")
    expect(await t.action(internal.returnEvidence.migrateLegacyPhoto, args)).toBe("unverified")
    expect(deleteObject).toHaveBeenCalledTimes(2)
    expect(deleteObject).toHaveBeenLastCalledWith(expect.anything(), key)
    const after = await owner.query(api.rentalCompletions.getById, { id: completionId })
    expect(after?.renterReturnForm?.photos).toHaveLength(1)
    const newKey = after?.renterReturnForm?.photos[0]
    if (!newKey) throw new Error("Missing migrated fixture")
    expect(newKey).not.toBe("legacy:renter:0")
    const privateRead = await owner.fetch(route(reservationId, newKey))
    expect(new Uint8Array(await privateRead.arrayBuffer())).toEqual(png)
    expect((await outsider.fetch(route(reservationId, newKey))).status).toBe(404)
  })
})
