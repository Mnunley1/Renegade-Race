// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import { r2 } from "./r2"
import schema from "./schema"

// The real R2 client signs PUT URLs with synthetic credentials. An in-memory
// bucket replaces only the external object deletion boundary.
vi.hoisted(() => {
  vi.stubEnv("R2_BUCKET", "synthetic-bucket")
  vi.stubEnv("R2_ENDPOINT", "https://storage.invalid")
  vi.stubEnv("R2_ACCESS_KEY_ID", "test-key")
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret")
})
const modules = (
  import.meta as unknown as { glob: (g: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
const cleanupMethods = ["clearOnboardingDraft", "startOverOnboarding"] as const
const address = { street: "1 Test St", city: "Test", state: "NC", zipCode: "00000" }
const vehicle = {
  make: "Ford",
  model: "Mustang",
  description: "Test listing",
  year: 2020,
  dailyRate: 100,
  amenities: [],
  images: [],
}
const bucket = new Set<string>()
function images(...keys: string[]) {
  return keys.map((r2Key, order) => ({ r2Key, isPrimary: order === 0, order }))
}
beforeEach(() => {
  bucket.clear()
  vi.spyOn(r2, "deleteObject").mockImplementation((_ctx, key) => {
    bucket.delete(key)
    return Promise.resolve()
  })
})
afterEach(() => vi.restoreAllMocks())

async function setup() {
  const t = convexTest(schema, modules)
  const ownerId = await t.run(async ({ db }) => {
    await db.insert("tracks", { name: "Synthetic", location: "Test", isActive: true })
    await db.insert("users", { externalId: "other", name: "Other" })
    return db.insert("users", {
      externalId: "owner",
      name: "Owner",
      hostOnboardingStatus: "in_progress",
      onboardingVehicleAddress: address,
    })
  })
  const owner = t.withIdentity({ subject: "owner" })
  const other = t.withIdentity({ subject: "other" })
  async function upload(
    caller: typeof owner,
    purpose: "onboarding" | "listing" | "generic" = "onboarding"
  ) {
    const issuers = {
      onboarding: api.r2.generateOnboardingImageUploadUrl,
      listing: api.r2.generateListingImageUploadUrl,
      generic: api.r2.generateUploadUrl,
    }
    const signed = await caller.mutation(issuers[purpose], {})
    bucket.add(signed.key)
    return signed.key
  }
  return { t, owner, other, ownerId, upload }
}

describe("onboarding upload ownership", () => {
  it("requires a signed-in owner for upload issuance, draft writes and both cleanup methods", async () => {
    const { t } = await setup()
    for (const issue of [
      api.r2.generateOnboardingImageUploadUrl,
      api.r2.generateListingImageUploadUrl,
      api.r2.generateUploadUrl,
    ]) {
      await expect(t.mutation(issue, {})).rejects.toThrow()
    }
    await expect(t.mutation(api.users.saveOnboardingDraft, { images: [] })).rejects.toThrow()
    for (const method of cleanupMethods) {
      await expect(t.mutation(api.users[method], {})).rejects.toThrow()
    }
    expect(r2.deleteObject).not.toHaveBeenCalled()
  })

  it("issues different signed keys to different owners and retains shared-purpose bytes for older clients", async () => {
    const { owner, other, upload } = await setup()
    const first = await owner.mutation(api.r2.generateOnboardingImageUploadUrl, {})
    const second = await other.mutation(api.r2.generateOnboardingImageUploadUrl, {})
    expect(first.key).not.toBe(second.key)
    expect(new URL(first.url).searchParams.has("X-Amz-Signature")).toBe(true)
    const general = await upload(owner, "generic")
    await owner.mutation(api.users.saveOnboardingDraft, { images: images(general) })
    await owner.mutation(api.users.clearOnboardingDraft, {})
    expect(bucket.has(general)).toBe(true)
    expect(r2.deleteObject).not.toHaveBeenCalled()
  })

  it("retains the draft if deletion cannot be queued and permits the same owner to retry", async () => {
    const { owner, upload } = await setup()
    const key = await upload(owner)
    await owner.mutation(api.users.saveOnboardingDraft, { images: images(key) })
    vi.mocked(r2.deleteObject).mockRejectedValueOnce(new Error("queue unavailable"))
    await expect(owner.mutation(api.users.startOverOnboarding, {})).rejects.toThrow(
      "queue unavailable"
    )
    expect((await owner.query(api.users.getOnboardingDraft, {}))?.images).toEqual(images(key))
    expect(bucket.has(key)).toBe(true)
    await owner.mutation(api.users.startOverOnboarding, {})
    expect(bucket.has(key)).toBe(false)
  })

  it.each(
    cleanupMethods
  )("%s removes only this owner's issued draft objects, even in a poisoned historical draft", async (method) => {
    const { t, owner, other, ownerId, upload } = await setup()
    const own = await upload(owner)
    const foreign = await upload(other)
    const listingOnly = await upload(owner, "listing")
    const unverified = "old-opaque-key"
    const lookalike = `${own}-unissued`
    bucket.add(unverified)
    bucket.add(lookalike)
    await other.mutation(api.users.saveOnboardingDraft, { images: images(foreign) })
    // Model a mixed row saved before the guard shipped.
    await t.run(({ db }) =>
      db.patch(ownerId, {
        hostOnboardingDraft: {
          images: images(own, own, foreign, listingOnly, unverified, lookalike),
        },
      })
    )
    await owner.mutation(api.users[method], {})
    await owner.mutation(api.users[method], {})
    expect(bucket).toEqual(new Set([foreign, listingOnly, unverified, lookalike]))
    expect(r2.deleteObject).toHaveBeenCalledTimes(1)
    const user = await t.run(({ db }) => db.get(ownerId))
    expect(user?.hostOnboardingDraft).toBeUndefined()
    expect(user?.hostOnboardingStatus).toBe(
      method === "startOverOnboarding" ? "not_started" : "in_progress"
    )
    expect(user?.onboardingVehicleAddress).toEqual(
      method === "startOverOnboarding" ? undefined : address
    )
    expect((await other.query(api.users.getOnboardingDraft, {}))?.images).toEqual(images(foreign))
  })

  it("rejects a forged save or metadata claim without replacing or cleaning the previous draft", async () => {
    const { owner, other, upload } = await setup()
    const own = await upload(owner)
    const foreign = await upload(other)
    const wrongPurpose = await upload(owner, "listing")
    await owner.mutation(api.users.saveOnboardingDraft, { images: images(own) })
    for (const forged of [foreign, `${own}-never-issued`, wrongPurpose]) {
      await expect(
        owner.mutation(api.users.saveOnboardingDraft, { images: images(own, forged) })
      ).rejects.toThrow()
      expect((await owner.query(api.users.getOnboardingDraft, {}))?.images).toEqual(images(own))
    }
    await expect(
      owner.mutation(api.users.saveOnboardingDraft, { images: images(own, own) })
    ).rejects.toThrow()
    await expect(owner.mutation(api.r2.syncMetadata, { key: foreign })).rejects.toThrow()
    await expect(
      owner.mutation(api.users.saveOnboardingDraft, { images: images(foreign) })
    ).rejects.toThrow()
    expect(r2.deleteObject).not.toHaveBeenCalled()
    expect(bucket.has(foreign)).toBe(true)
  })

  it("drops only removed, owned draft uploads on replacement and preserves unproven legacy files", async () => {
    const { t, owner, ownerId, upload } = await setup()
    const first = await upload(owner)
    const retained = await upload(owner)
    const legacy = "old-image-before-issuance-ledger"
    bucket.add(legacy)
    await t.run(({ db }) =>
      db.patch(ownerId, { hostOnboardingDraft: { images: images(first, retained, legacy) } })
    )
    await owner.mutation(api.users.saveOnboardingDraft, { currentStep: 3 })
    expect((await owner.query(api.users.getOnboardingDraft, {}))?.images).toEqual(
      images(first, retained, legacy)
    )
    await owner.mutation(api.users.saveOnboardingDraft, { images: images(retained) })
    expect(bucket).toEqual(new Set([retained, legacy]))
    expect(r2.deleteObject).toHaveBeenCalledTimes(1)
    await owner.mutation(api.users.clearOnboardingDraft, {})
    expect(bucket).toEqual(new Set([legacy]))
  })

  it.each([
    ...cleanupMethods,
    "completeHostOnboarding",
  ] as const)("%s preserves an adopted photo and rejects reusing it as a new draft", async (method) => {
    const { t, owner, upload } = await setup()
    const key = await upload(owner)
    const abandoned = await upload(owner)
    await owner.mutation(api.users.saveOnboardingDraft, { images: images(key, abandoned) })
    const vehicleId = await owner.mutation(api.vehicles.createVehicleWithImages, {
      ...vehicle,
      images: images(key),
    })
    await owner.mutation(api.users[method], {})
    expect(bucket.has(key)).toBe(true)
    await expect(
      owner.mutation(api.users.saveOnboardingDraft, { images: images(key) })
    ).rejects.toThrow()
    const [published] = await t.run(({ db }) =>
      db
        .query("vehicleImages")
        .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicleId))
        .collect()
    )
    if (!published) throw new Error("Published fixture is missing")
    expect(published.r2Key).toBe(key)
    expect(bucket.has(abandoned)).toBe(false)
    await owner.mutation(api.vehicles.removeImage, { imageId: published._id })
    expect(bucket.has(key)).toBe(false)
    expect(r2.deleteObject).toHaveBeenCalledTimes(2)
  })
})

describe("vehicle image ownership", () => {
  it("rejects unrelated object attachments on create and add, and only detaches a forged historical row", async () => {
    const { t, owner, other, upload } = await setup()
    const key = await upload(owner, "listing")
    const ownVehicle = await owner.mutation(api.vehicles.createVehicleWithImages, {
      ...vehicle,
      images: images(key),
    })
    const otherVehicle = await other.mutation(api.vehicles.createVehicleWithImages, vehicle)
    await expect(
      other.mutation(api.vehicles.createVehicleWithImages, { ...vehicle, images: images(key) })
    ).rejects.toThrow()
    await expect(
      other.mutation(api.vehicles.addImage, {
        vehicleId: otherVehicle,
        r2Key: key,
        isPrimary: true,
      })
    ).rejects.toThrow()
    const legacyRow = await t.run(({ db }) =>
      db.insert("vehicleImages", { vehicleId: otherVehicle, r2Key: key, isPrimary: true, order: 0 })
    )
    await other.mutation(api.vehicles.removeImage, { imageId: legacyRow })
    expect(bucket.has(key)).toBe(true)
    expect(await t.run(({ db }) => db.get(legacyRow))).toBeNull()
    const [realImage] = await t.run(({ db }) =>
      db
        .query("vehicleImages")
        .withIndex("by_vehicle", (q) => q.eq("vehicleId", ownVehicle))
        .collect()
    )
    if (!realImage) throw new Error("Published fixture is missing")
    await expect(
      other.mutation(api.vehicles.removeImage, { imageId: realImage._id })
    ).rejects.toThrow()
    expect(r2.deleteObject).not.toHaveBeenCalled()
    await owner.mutation(api.vehicles.removeImage, { imageId: realImage._id })
    expect(bucket.has(key)).toBe(false)
  })

  it("rejects an entire reorder batch containing another listing's image", async () => {
    const { t, owner, other, upload } = await setup()
    const ownVehicle = await owner.mutation(api.vehicles.createVehicleWithImages, vehicle)
    const otherVehicle = await other.mutation(api.vehicles.createVehicleWithImages, vehicle)
    const ownImage = await owner.mutation(api.vehicles.addImage, {
      vehicleId: ownVehicle,
      r2Key: await upload(owner, "listing"),
      isPrimary: true,
    })
    const otherImage = await other.mutation(api.vehicles.addImage, {
      vehicleId: otherVehicle,
      r2Key: await upload(other, "listing"),
      isPrimary: true,
    })
    const order = (id: typeof ownImage) => t.run(async ({ db }) => (await db.get(id))?.order)
    await expect(
      owner.mutation(api.vehicles.updateImageOrder, {
        vehicleId: ownVehicle,
        imageOrders: [
          { imageId: ownImage, order: 1 },
          { imageId: otherImage, order: 99 },
        ],
      })
    ).rejects.toThrow()
    expect(await order(ownImage)).toBe(0)
    expect(await order(otherImage)).toBe(0)
    await owner.mutation(api.vehicles.updateImageOrder, {
      vehicleId: ownVehicle,
      imageOrders: [{ imageId: ownImage, order: 1 }],
    })
    expect(await order(ownImage)).toBe(1)
  })
})
