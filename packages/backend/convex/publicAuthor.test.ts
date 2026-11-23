// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { describe, expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"
import { loadPublicActor } from "./userProfile"

vi.mock("./r2", () => ({ r2: {} }))
const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>
  }
).glob("./**/*.ts")

describe("Paddock public author destinations", () => {
  it("resolves a driver's document ID without exposing private account/contact fields", async () => {
    const t = convexTest(schema, modules)
    const driverId = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        externalId: "driver-clerk-id",
        name: "Driver",
        email: "private@example.test",
        phone: "private-phone",
        stripeCustomerId: "cus_private",
        stripeAccountId: "acct_private",
      })
      return await ctx.db.insert("driverProfiles", {
        userId: "driver-clerk-id",
        bio: "Driver biography",
        experience: "beginner",
        licenses: [],
        preferredCategories: [],
        availability: [],
        location: "Track",
        contactInfo: { email: "contact@example.test" },
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      })
    })
    expect(await t.run((ctx) => loadPublicActor(ctx, "driver-clerk-id"))).toEqual({
      userId: "driver-clerk-id",
      name: "Driver",
      profileHref: `/motorsports/drivers/${driverId}`,
    })
    for (const viewer of [
      t,
      t.withIdentity({ subject: "driver-clerk-id" }),
      t.withIdentity({ subject: "other" }),
    ]) {
      const profile = await viewer.query(api.users.getPublicProfile, {
        externalId: "driver-clerk-id",
      })
      expect(profile?.driverProfileId).toBe(driverId)
      for (const field of ["email", "phone", "stripeCustomerId", "stripeAccountId", "contactInfo"])
        expect(profile).not.toHaveProperty(field)
    }
    await t.run((ctx) => ctx.db.patch(driverId, { isActive: false }))
    expect(await t.run((ctx) => loadPublicActor(ctx, "driver-clerk-id"))).toMatchObject({
      profileHref: "/profile/driver-clerk-id",
    })
    expect(
      await t.query(api.users.getPublicProfile, { externalId: "driver-clerk-id" })
    ).not.toHaveProperty("driverProfileId")
  })

  it("offers a working member destination without a driver profile, and no link for absent/banned users", async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        externalId: "member/with-space",
        name: "private@example.test",
        email: "private@example.test",
        bio: "Member biography",
      })
    )
    expect(await t.run((ctx) => loadPublicActor(ctx, "member/with-space"))).toMatchObject({
      name: "User",
      profileHref: "/profile/member%2Fwith-space",
    })
    expect(await t.query(api.users.getPublicProfile, { externalId: "missing" })).toBeNull()
    expect(await t.run((ctx) => loadPublicActor(ctx, "missing"))).toBeNull()
    await t.run((ctx) => ctx.db.patch(userId, { isBanned: true }))
    expect(await t.run((ctx) => loadPublicActor(ctx, "member/with-space"))).toBeNull()
    await t.run((ctx) => ctx.db.delete(userId))
    expect(
      await t.query(api.users.getPublicProfile, { externalId: "member/with-space" })
    ).toBeNull()
  })
})
