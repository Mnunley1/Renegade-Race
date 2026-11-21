// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { describe, expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"
import {
  formatVehicleTitle,
  formatVehicleYear,
  isVehicleYear,
  VEHICLE_YEAR_ERROR,
} from "./vehicleYear"

vi.mock("./r2", () => ({ r2: {} }))
const modules = (
  import.meta as unknown as { glob: (pattern: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
const vehicleData = {
  make: "Mazda",
  model: "MX-5",
  year: 2026,
  dailyRate: 10000,
  description: "Synthetic",
  amenities: [],
  addOns: [],
}

describe("vehicle year format", () => {
  it.each([
    999,
    10000,
    2026.5,
    -2026,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "2026",
    null,
    undefined,
  ])("rejects invalid numeric format %s", (year) => {
    expect(isVehicleYear(year)).toBe(false)
    expect(formatVehicleYear(year)).toBe("Year unconfirmed")
  })
  it.each([
    1000, 1899, 2026, 9999,
  ])("accepts four digits without imposing a business eligibility window: %s", (year) => {
    expect(isVehicleYear(year)).toBe(true)
    expect(formatVehicleYear(year)).toBe(String(year))
  })
  it("preserves supplied make/model text in a neutral title", () => {
    expect(formatVehicleTitle({ year: 206, make: "BMW", model: "m3" })).toBe(
      "Year unconfirmed BMW m3"
    )
  })
})

async function fixture() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async ({ db }) => {
    const userId = await db.insert("users", { externalId: "host", name: "Host" })
    const trackId = await db.insert("tracks", {
      name: "Synthetic track",
      location: "Test",
      isActive: true,
    })
    const vehicleId = await db.insert("vehicles", {
      ...vehicleData,
      year: 206,
      ownerId: "host",
      trackId,
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    })
    return { userId, trackId, vehicleId }
  })
  return { t, owner: t.withIdentity({ subject: "host" }), ...ids }
}

describe("vehicle write guards", () => {
  it.each([
    206, 2026.5, 10000, -1,
  ])("rejects new year %s without creating a listing", async (year) => {
    const { t, owner, trackId } = await fixture()
    await expect(
      owner.mutation(api.vehicles.createVehicleWithImages, {
        ...vehicleData,
        year,
        trackId,
        images: [],
      })
    ).rejects.toThrow(VEHICLE_YEAR_ERROR)
    expect(await t.run(({ db }) => db.query("vehicles").collect())).toHaveLength(1)
  })
  it("accepts a valid new year and preserves legacy years on unrelated updates", async () => {
    const { t, owner, trackId, vehicleId } = await fixture()
    const created = await owner.mutation(api.vehicles.createVehicleWithImages, {
      ...vehicleData,
      trackId,
      images: [],
    })
    expect((await t.run(({ db }) => db.get(created)))?.year).toBe(2026)
    await owner.mutation(api.vehicles.update, { id: vehicleId, description: "Unrelated edit" })
    await owner.mutation(api.vehicles.update, {
      id: vehicleId,
      year: 206,
      description: "Legacy client roundtrip",
    })
    expect((await t.run(({ db }) => db.get(vehicleId)))?.year).toBe(206)
    await expect(owner.mutation(api.vehicles.update, { id: vehicleId, year: 207 })).rejects.toThrow(
      VEHICLE_YEAR_ERROR
    )
    await expect(
      owner.mutation(api.vehicles.update, { id: vehicleId, year: 2026.5 })
    ).rejects.toThrow(VEHICLE_YEAR_ERROR)
    await owner.mutation(api.vehicles.update, { id: vehicleId, year: 2026 })
    expect((await t.run(({ db }) => db.get(vehicleId)))?.year).toBe(2026)
  })
  it("guards new/changed drafts but permits unchanged legacy draft data and other steps", async () => {
    const { t, owner, userId } = await fixture()
    await expect(
      owner.mutation(api.users.saveOnboardingDraft, { vehicleData: { ...vehicleData, year: 206 } })
    ).rejects.toThrow(VEHICLE_YEAR_ERROR)
    await t.run(({ db }) =>
      db.patch(userId, { hostOnboardingDraft: { vehicleData: { ...vehicleData, year: 206 } } })
    )
    await owner.mutation(api.users.saveOnboardingDraft, { currentStep: 3 })
    await owner.mutation(api.users.saveOnboardingDraft, {
      vehicleData: { ...vehicleData, year: 206, description: "Unrelated edit" },
    })
    expect((await t.run(({ db }) => db.get(userId)))?.hostOnboardingDraft?.vehicleData?.year).toBe(
      206
    )
    await expect(
      owner.mutation(api.users.saveOnboardingDraft, { vehicleData: { ...vehicleData, year: 207 } })
    ).rejects.toThrow(VEHICLE_YEAR_ERROR)
    await owner.mutation(api.users.saveOnboardingDraft, { vehicleData })
    expect((await t.run(({ db }) => db.get(userId)))?.hostOnboardingDraft?.vehicleData?.year).toBe(
      2026
    )
  })
})
