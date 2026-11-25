// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { describe, expect, it, vi } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"
import { publicDisplayName } from "./userProfile"

vi.mock("./r2", () => ({ r2: {} }))

const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>
  }
).glob("./**/*.ts")

describe("public user lookups", () => {
  it.each([
    undefined,
    null,
    "",
    "   ",
    "null",
    "undefined",
    "null null",
    " UNDEFINED null ",
  ])("uses a neutral fallback for missing legacy display name %s", (name) => {
    expect(publicDisplayName({ name, email: "private@example.test" })).toBe("User")
  })
  it("preserves real names and does not expose an email fallback", () => {
    expect(publicDisplayName({ name: "A. Driver", email: "private@example.test" })).toBe(
      "A. Driver"
    )
    expect(
      publicDisplayName({ name: " PRIVATE@EXAMPLE.TEST ", email: "private@example.test" })
    ).toBe("User")
  })
  it("keeps placeholder coach names neutral through public query projection", async () => {
    const t = convexTest(schema, modules)
    const id = await t.run(({ db }) =>
      db.insert("users", {
        externalId: "missing-name",
        name: "null null",
        email: "private@example.test",
      })
    )
    const profile = await t.query(api.users.getById, { userId: id })
    expect(profile).toMatchObject({ name: "User" })
    expect(profile).not.toHaveProperty("email")
  })
  it("shares the same public fields by either ID and through marketplace listings", async () => {
    const t = convexTest(schema, modules)
    const { userId, vehicleId, driverProfileId } = await t.run(async ({ db }) => {
      const userId = await db.insert("users", {
        externalId: "profile-owner",
        name: "Owner",
        email: "owner@example.test",
        phone: "555-0100",
        stripeAccountId: "acct_fixture",
        stripeAccountStatus: "enabled",
        stripeCustomerId: "cus_fixture",
        hostOnboardingDraft: { currentStep: 2 },
        platformFeeCapPercentage: 3,
        bio: "Track instructor",
      })
      const trackId = await db.insert("tracks", {
        name: "Test track",
        location: "VA",
        isActive: true,
      })
      const vehicleId = await db.insert("vehicles", {
        ownerId: "profile-owner",
        trackId,
        make: "BMW",
        model: "M3",
        year: 2015,
        dailyRate: 50000,
        description: "Test car",
        amenities: [],
        addOns: [],
        isActive: true,
        isApproved: true,
        createdAt: 1,
        updatedAt: 1,
      })
      const driverProfileId = await db.insert("driverProfiles", {
        userId: "driver",
        bio: "",
        experience: "beginner",
        licenses: [],
        preferredCategories: [],
        availability: [],
        location: "",
        contactInfo: {},
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      })
      await db.insert("endorsements", {
        driverProfileId,
        endorserId: "profile-owner",
        type: "teamwork",
        createdAt: 1,
      })
      return { userId, vehicleId, driverProfileId }
    })
    const publicFields = {
      _id: userId,
      externalId: "profile-owner",
      name: "Owner",
      bio: "Track instructor",
      isEmailVerified: true,
      isPhoneVerified: true,
    }
    for (const viewer of [t, t.withIdentity({ subject: "other-person" })]) {
      expect(await viewer.query(api.users.getById, { userId })).toEqual(publicFields)
      expect(
        await viewer.query(api.users.getByExternalId, { externalId: "profile-owner" })
      ).toEqual(publicFields)
      const vehicle = await viewer.query(api.vehicles.getById, { id: vehicleId })
      expect(vehicle?.owner).toEqual(publicFields)
      expect(vehicle?.hostStripeReady).toBe(true)
      const endorsements = await viewer.query(api.endorsements.getByDriver, { driverProfileId })
      expect(endorsements[0]?.endorser).toEqual(publicFields)
    }
    const admin = t.withIdentity({ subject: "moderator", publicMetadata: { role: "admin" } })
    const detail = await admin.query(api.vehicles.getById, { id: vehicleId })
    expect(detail?.owner).toEqual({
      ...publicFields,
      email: "owner@example.test",
      phone: "555-0100",
    })
    const owner = t.withIdentity({ subject: "profile-owner" })
    expect(await owner.query(api.users.getByExternalId, { externalId: "profile-owner" })).toEqual({
      ...publicFields,
      stripeCustomerId: "cus_fixture",
    })
    expect(await owner.query(api.users.current, {})).toMatchObject({ email: "owner@example.test" })
    expect(
      await t.query(internal.users.getByExternalIdInternal, { externalId: "profile-owner" })
    ).toMatchObject({
      stripeAccountId: "acct_fixture",
      email: "owner@example.test",
    })
    expect(await t.query(api.users.getByExternalId, { externalId: "missing" })).toBeNull()
  })

  it("redacts the legacy email display-name fallback in public profiles", async () => {
    const t = convexTest(schema, modules)
    const id = await t.run(({ db }) =>
      db.insert("users", {
        externalId: "legacy",
        name: "User@example.test",
        email: "user@example.test",
      })
    )
    const postId = await t.run(async ({ db }) => {
      await db.insert("follows", { followerId: "legacy", followedUserId: "reader", createdAt: 1 })
      return db.insert("posts", {
        authorId: "legacy",
        content: "Hello",
        reactionCount: 0,
        commentCount: 0,
        createdAt: 1,
        updatedAt: 1,
      })
    })
    expect(await t.query(api.users.getById, { userId: id })).toMatchObject({ name: "User" })
    expect(await t.query(api.follows.listFollowers, { userId: "reader" })).toEqual([
      { userId: "legacy", name: "User" },
    ])
    expect((await t.query(api.posts.getPost, { postId }))?.author).toMatchObject({ name: "User" })
  })
})
