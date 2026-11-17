// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { describe, expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

vi.hoisted(() => {
  vi.stubEnv("R2_BUCKET", "synthetic-profile-bucket")
  vi.stubEnv("R2_ENDPOINT", "https://storage.invalid")
  vi.stubEnv("R2_ACCESS_KEY_ID", "test-key")
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret")
})
const modules = (
  import.meta as unknown as { glob: (g: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")

async function setup() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async ({ db, storage }) => {
    const storageId = await storage.store(new Blob(["legacy profile"], { type: "image/png" }))
    const profileImage = await storage.getUrl(storageId)
    if (!profileImage) throw new Error("Missing fixture URL")
    const ownerId = await db.insert("users", { externalId: "owner", name: "Owner", profileImage })
    const otherId = await db.insert("users", { externalId: "other", name: "Other" })
    return { ownerId, otherId, storageId, profileImage }
  })
  return {
    t,
    ...ids,
    owner: t.withIdentity({ subject: "owner" }),
    other: t.withIdentity({ subject: "other" }),
  }
}

describe("profile image publication ownership", () => {
  it("publishes an issued profile upload only for its owner and allows replacement", async () => {
    const { t, owner, other, ownerId, profileImage } = await setup()
    for (let attempt = 0; attempt < 2; attempt++) {
      const upload = await owner.mutation(api.r2.generateProfileImageUploadUrl, {})
      expect(new URL(upload.url).searchParams.has("X-Amz-Signature")).toBe(true)
      await expect(
        other.mutation(api.users.updateProfileImage, { r2Key: upload.key })
      ).rejects.toThrow("verify ownership")
      expect(await owner.mutation(api.users.updateProfileImage, { r2Key: upload.key })).toBe(
        ownerId
      )
      // The deployed profile client does not call syncMetadata before publishing.
      const profile = await t.query(api.users.getById, { userId: ownerId })
      expect(profile?.profileImageR2Key).toBe(upload.key)
      expect(profile?.profileImage).toBe(profileImage)
    }
  })

  it("rejects anonymous upload issuance and both profile publication paths", async () => {
    const { t, owner, storageId } = await setup()
    const { key } = await owner.mutation(api.r2.generateProfileImageUploadUrl, {})
    await expect(t.mutation(api.r2.generateProfileImageUploadUrl, {})).rejects.toThrow(
      "Not authenticated"
    )
    for (const args of [{ r2Key: key }, { storageId }]) {
      await expect(t.mutation(api.users.updateProfileImage, args)).rejects.toThrow(
        "Not authenticated"
      )
    }
  })

  it("retires new legacy storage writes for every caller while retaining existing public images and bytes", async () => {
    const { t, owner, other, ownerId, otherId, storageId, profileImage } = await setup()
    const { key } = await owner.mutation(api.r2.generateProfileImageUploadUrl, {})
    for (const actor of [owner, other]) {
      for (const args of [{ storageId }, { storageId, r2Key: key }]) {
        await expect(actor.mutation(api.users.updateProfileImage, args)).rejects.toThrow(
          "unavailable"
        )
      }
    }
    for (const actor of [t, owner, other]) {
      await expect(actor.mutation(api.vehicles.generateUploadUrl, {})).rejects.toThrow()
      expect((await actor.query(api.users.getById, { userId: ownerId }))?.profileImage).toBe(
        profileImage
      )
    }
    expect((await t.query(api.users.getById, { userId: otherId }))?.profileImage).toBeUndefined()
    expect(await t.run(async ({ storage }) => (await storage.get(storageId))?.text())).toBe(
      "legacy profile"
    )
  })

  it("rejects unissued keys, foreign uploads, and owned non-profile uploads without replacing the image", async () => {
    const { t, owner, other, ownerId } = await setup()
    const original = await owner.mutation(api.r2.generateProfileImageUploadUrl, {})
    await owner.mutation(api.users.updateProfileImage, { r2Key: original.key })
    const foreign = await other.mutation(api.r2.generateProfileImageUploadUrl, {})
    const draft = await owner.mutation(api.r2.generateOnboardingImageUploadUrl, {})
    const listing = await owner.mutation(api.r2.generateListingImageUploadUrl, {})
    const general = await owner.mutation(api.r2.generateUploadUrl, {})
    const evidenceKey = `images/damage/synthetic-reservation/${ownerId}-photo`
    await t.run(({ db }) =>
      db.insert("r2Uploads", {
        bucket: "synthetic-profile-bucket",
        key: evidenceKey,
        ownerId: "owner",
        purpose: "other",
      })
    )
    for (const r2Key of [
      foreign.key,
      draft.key,
      listing.key,
      general.key,
      evidenceKey,
      `${original.key}-unissued`,
      "https://private.invalid/photo",
    ]) {
      await expect(owner.mutation(api.users.updateProfileImage, { r2Key })).rejects.toThrow(
        "verify ownership"
      )
      expect((await owner.query(api.users.current, {}))?.profileImageR2Key).toBe(original.key)
    }
    await expect(owner.mutation(api.users.updateProfileImage, {})).rejects.toThrow("required")
  })

  it("does not accept a profile-looking key recorded only for another bucket or purpose", async () => {
    const { t, owner, ownerId } = await setup()
    for (const [bucket, purpose] of [
      ["different-bucket", "other"],
      ["synthetic-profile-bucket", "general"],
    ] as const) {
      const key = `images/profiles/${ownerId}/${bucket}-${purpose}`
      await t.run(({ db }) => db.insert("r2Uploads", { bucket, key, ownerId: "owner", purpose }))
      await expect(owner.mutation(api.users.updateProfileImage, { r2Key: key })).rejects.toThrow(
        "verify ownership"
      )
    }
  })
})
