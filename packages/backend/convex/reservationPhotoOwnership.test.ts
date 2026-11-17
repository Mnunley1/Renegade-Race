// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

const modules = (
  import.meta as unknown as { glob: (pattern: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")

const signers = [
  ["disputes", api.r2.generateDisputePhotoUploadUrl],
  ["reviews", api.r2.generateReviewPhotoUploadUrl],
  ["damage", api.r2.generateDamagePhotoUploadUrl],
] as const

beforeEach(() => {
  // The actual SDK signs locally with synthetic credentials. No upload is performed.
  vi.stubEnv("R2_BUCKET", "photo-test")
  vi.stubEnv("R2_ENDPOINT", "https://r2.example.test")
  vi.stubEnv("R2_ACCESS_KEY_ID", "test-key")
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret")
})
afterEach(() => vi.unstubAllEnvs())

async function setup() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async ({ db }) => {
    const owner = await db.insert("users", { externalId: "owner", name: "Owner" })
    const renter = await db.insert("users", { externalId: "renter", name: "Renter" })
    await db.insert("users", { externalId: "outsider", name: "Outsider" })
    const trackId = await db.insert("tracks", { name: "Test", location: "Test", isActive: true })
    const vehicle = {
      trackId,
      ownerId: "owner",
      make: "Test",
      model: "Test",
      year: 2020,
      dailyRate: 1000,
      description: "Test",
      amenities: [],
      addOns: [],
      isActive: true,
      isApproved: true,
      createdAt: 1,
      updatedAt: 1,
    }
    const vehicleId = await db.insert("vehicles", vehicle)
    const reservation = {
      renterId: "renter",
      ownerId: "owner",
      vehicleId,
      status: "confirmed" as const,
      paymentStatus: "paid" as const,
      startDate: "2030-01-01",
      endDate: "2030-01-02",
      totalDays: 1,
      dailyRate: 1000,
      totalAmount: 1000,
      createdAt: 1,
      updatedAt: 1,
    }
    const reservationId = await db.insert("reservations", reservation)
    const missingId = await db.insert("reservations", reservation)
    await db.delete(missingId)
    return { owner, renter, reservationId, missingId, vehicleId }
  })
  return { t, ids }
}

describe("reservation photo upload ownership", () => {
  it.each(
    signers
  )("restricts %s photo upload grants to the intended reservation participants", async (kind, signer) => {
    const { t, ids } = await setup()
    const args = { reservationId: ids.reservationId }
    const owner = t.withIdentity({ subject: "owner" })
    const renter = t.withIdentity({ subject: "renter" })
    const outsider = t.withIdentity({ subject: "outsider" })
    await expect(t.mutation(signer, args)).rejects.toThrow()
    await expect(outsider.mutation(signer, args)).rejects.toThrow()
    await expect(owner.mutation(signer, { reservationId: ids.missingId })).rejects.toThrow()
    const grant = await owner.mutation(signer, args)
    expect(grant.key.startsWith(`images/${kind}/${ids.reservationId}/${ids.owner}-`)).toBe(true)
    expect(new URL(grant.url).searchParams.has("X-Amz-Signature")).toBe(true)
    if (kind === "damage") {
      await expect(renter.mutation(signer, args)).rejects.toThrow()
    } else {
      const second = await renter.mutation(signer, args)
      expect(second.key.startsWith(`images/${kind}/${ids.reservationId}/${ids.renter}-`)).toBe(true)
    }
  })
})
