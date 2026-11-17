// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { Webhook } from "svix"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import rateSchema from "../node_modules/@convex-dev/rate-limiter/dist/component/schema.js"
import { api, internal } from "./_generated/api"
import schema from "./schema"

vi.mock("./r2", () => ({ r2: {} }))
vi.mock("./emails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./emails")>()),
  sendTransactionalEmail: vi.fn(),
}))
vi.mock("./geocoding", () => ({
  geocodeAddress: vi.fn(async () => ({ latitude: 35, longitude: -80 })),
}))

const stripe = vi.hoisted(() => ({ account: vi.fn(), balance: vi.fn() }))
vi.mock("stripe", () => ({
  default: class {
    accounts = { retrieve: stripe.account }
    balance = { retrieve: stripe.balance }
  },
}))

const modules = (
  import.meta as unknown as { glob: (g: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
const rateModules = (
  import.meta as unknown as { glob: (g: string) => Record<string, () => Promise<unknown>> }
).glob("../node_modules/@convex-dev/rate-limiter/src/component/**/*.ts")
const webhookSecret = `whsec_${btoa("synthetic-deletion-webhook-secret")}`

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy")
  vi.stubEnv("CLERK_WEBHOOK_SECRET", webhookSecret)
  stripe.account.mockResolvedValue({
    id: "acct_owner",
    type: "express",
    metadata: { renegadeUserId: "owner" },
  })
  stripe.balance.mockResolvedValue({ pending: [], available: [] })
})
afterEach(() => vi.unstubAllEnvs())

async function setup(connected = false) {
  const t = convexTest(schema, modules)
  t.registerComponent("rateLimiter", rateSchema, rateModules)
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      externalId: "owner",
      name: "Owner",
      ...(connected && { stripeAccountId: "acct_owner" }),
    })
  )
  const self = t.withIdentity({ subject: "owner" })
  const other = t.withIdentity({ subject: "other", publicMetadata: { role: "admin" } })
  const getUser = () => t.run((ctx) => ctx.db.get(userId))
  async function postClerkEvent(
    event: { type: string; data: Record<string, unknown> },
    id = "msg_synthetic",
    signerSecret = webhookSecret
  ) {
    const timestamp = new Date()
    const payload = JSON.stringify(event)
    const signature = new Webhook(signerSecret).sign(id, timestamp, payload)
    return await t.fetch("/clerk-users-webhook", {
      method: "POST",
      headers: {
        "svix-id": id,
        "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
        "svix-signature": signature,
      },
      body: payload,
    })
  }
  function postDeleted({ signerSecret }: { signerSecret?: string } = {}) {
    return postClerkEvent(
      { type: "user.deleted", data: { id: "owner", deleted: true } },
      "msg_synthetic",
      signerSecret
    )
  }
  return { t, self, other, getUser, userId, postDeleted, postClerkEvent }
}

describe("signup and owner profile workflows", () => {
  it("processes a signed Clerk signup and profile update without accepting payout IDs from the payload", async () => {
    const { t, postClerkEvent } = await setup()
    const data = {
      id: "new-subject",
      first_name: "New",
      last_name: "Driver",
      email_addresses: [{ email_address: "driver@example.test" }],
      stripeAccountId: "acct_injected",
      stripeCustomerId: "cus_injected",
    }
    const created = { type: "user.created", data }
    expect((await postClerkEvent(created)).status).toBe(200)
    expect((await postClerkEvent(created)).status).toBe(200)
    expect(
      (
        await postClerkEvent(
          {
            type: "user.updated",
            data: { ...data, last_name: "Racer" },
          },
          "msg_updated"
        )
      ).status
    ).toBe(200)
    const self = t.withIdentity({ subject: data.id })
    const user = await self.query(api.users.current)
    expect(user).toMatchObject({
      externalId: data.id,
      name: "New Racer",
      email: "driver@example.test",
    })
    expect(user?.stripeAccountId).toBeUndefined()
    expect(user?.stripeCustomerId).toBeUndefined()
  })

  it("retains invoice recipient discovery while only confirming a supplied exact email", async () => {
    const { t, self } = await setup()
    await t.run(({ db }) =>
      db.insert("users", {
        externalId: "new-subject",
        name: "Driver@example.test",
        email: "driver@example.test",
        stripeAccountId: "acct_private",
      })
    )
    const query = api.users.searchForInvoiceRecipients
    expect(await t.query(query, {})).toEqual([])
    expect(await self.query(query, {})).toEqual([{ externalId: "new-subject", name: "User" }])
    expect(await self.query(query, { search: "driver@" })).toEqual([])
    expect(await self.query(query, { search: " DRIVER@example.test " })).toEqual([
      { externalId: "new-subject", name: "User", email: "driver@example.test" },
    ])
  })

  it("schedules owner-address geocoding internally and ignores a stale result", async () => {
    const { t, self, userId, getUser } = await setup()
    const users = await import("./users")
    expect(users.geocodeOnboardingAddress.isInternal).toBe(true)
    const address = { street: "10 Main St", city: "Town", state: "NC", zipCode: "27500" }
    await expect(t.mutation(api.users.saveOnboardingVehicleAddress, { address })).rejects.toThrow(
      "Not authenticated"
    )
    vi.useFakeTimers()
    try {
      await self.mutation(api.users.saveOnboardingVehicleAddress, { address })
      await t.finishAllScheduledFunctions(vi.runAllTimers)
      await t.mutation(internal.users.updateOnboardingAddressCoordinates, {
        userId,
        address: { ...address, street: "9 Main St" },
        latitude: 0,
        longitude: 0,
      })
      expect((await getUser())?.onboardingVehicleAddress).toEqual({
        ...address,
        latitude: 35,
        longitude: -80,
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("account deletion ownership", () => {
  it("registers every deletion writer as service-only", async () => {
    const users = await import("./users")
    expect(users.checkUserDeletionEligibility.isPublic).toBe(true)
    expect(users.performUserDeletionWithChecks.isInternal).toBe(true)
    expect(users.performUserDeletion.isInternal).toBe(true)
  })

  it("denies anonymous and other-account eligibility before looking up balances", async () => {
    const { t, other, getUser } = await setup(true)
    const args = { clerkUserId: "owner" }
    await expect(t.action(api.users.checkUserDeletionEligibility, args)).rejects.toThrow(
      "Not authenticated"
    )
    await expect(other.action(api.users.checkUserDeletionEligibility, args)).rejects.toThrow(
      "Not authorized"
    )
    expect(stripe.account).not.toHaveBeenCalled()
    expect(stripe.balance).not.toHaveBeenCalled()
    expect(await getUser()).not.toBeNull()
  })

  it("gives owners the same non-destructive eligibility result with or without their own legacy argument", async () => {
    const { self, getUser } = await setup()
    for (const args of [{}, { clerkUserId: "owner" }]) {
      expect(await self.action(api.users.checkUserDeletionEligibility, args)).toEqual({
        canDelete: true,
        blockingFactors: [],
      })
    }
    expect(await getUser()).not.toBeNull()
  })

  it("requires a signed Clerk deletion event, handles replay, and removes only its subject", async () => {
    const { t, postDeleted, getUser } = await setup(true)
    const otherId = await t.run((ctx) =>
      ctx.db.insert("users", { externalId: "other", name: "Other" })
    )
    const bad = await postDeleted({ signerSecret: `whsec_${btoa("wrong-signing-secret")}` })
    expect(bad.status).toBe(400)
    expect(await getUser()).not.toBeNull()
    const first = await postDeleted()
    expect(first.status).toBe(200)
    expect(await getUser()).toBeNull()
    expect((await postDeleted()).status).toBe(200)
    expect(await t.run((ctx) => ctx.db.get(otherId))).not.toBeNull()
    expect(stripe.balance).toHaveBeenCalledTimes(1)
  })

  it("blocks active rentals in either role and rechecks before removing the user", async () => {
    const { t, self, userId, getUser } = await setup()
    const reservationIds = await t.run(async (ctx) => {
      const trackId = await ctx.db.insert("tracks", {
        name: "Test",
        location: "Test",
        isActive: true,
      })
      const vehicleId = await ctx.db.insert("vehicles", {
        ownerId: "host",
        trackId,
        make: "Ford",
        model: "GT",
        year: 2020,
        dailyRate: 1000,
        description: "Test",
        amenities: [],
        addOns: [],
        isActive: true,
        createdAt: 0,
        updatedAt: 0,
      })
      const booking = {
        vehicleId,
        startDate: "2099-01-01",
        endDate: "2099-01-02",
        totalDays: 1,
        dailyRate: 1000,
        totalAmount: 1000,
        createdAt: 0,
        updatedAt: 0,
      }
      return await Promise.all([
        ctx.db.insert("reservations", {
          ...booking,
          renterId: "owner",
          ownerId: "host",
          status: "pending",
        }),
        ctx.db.insert("reservations", {
          ...booking,
          renterId: "renter",
          ownerId: "owner",
          status: "confirmed",
        }),
      ])
    })
    const eligibility = await self.action(api.users.checkUserDeletionEligibility, {})
    expect(eligibility.canDelete).toBe(false)
    expect(eligibility.blockingFactors).toHaveLength(2)
    await expect(
      t.mutation(internal.users.performUserDeletion, { userId, clerkUserId: "owner" })
    ).rejects.toThrow("Cannot delete")
    await expect(
      t.action(internal.users.performUserDeletionWithChecks, { clerkUserId: "owner" })
    ).rejects.toThrow("Cannot delete")
    expect(await getUser()).not.toBeNull()
    await t.run(async (ctx) => {
      for (const id of reservationIds) await ctx.db.patch(id, { status: "cancelled" })
    })
    expect((await self.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(true)
  })

  it("denies deletion for an outstanding balance and if Stripe ownership cannot be verified", async () => {
    const { t, self, userId, getUser } = await setup(true)
    stripe.balance.mockResolvedValue({ pending: [{ currency: "usd", amount: 500 }], available: [] })
    const args = { clerkUserId: "owner" }
    expect((await self.action(api.users.checkUserDeletionEligibility, args)).canDelete).toBe(false)
    await expect(t.action(internal.users.performUserDeletionWithChecks, args)).rejects.toThrow(
      "payouts"
    )
    const reads = stripe.balance.mock.calls.length
    stripe.account.mockResolvedValue({
      id: "acct_owner",
      type: "express",
      metadata: { renegadeUserId: "other" },
    })
    await expect(t.action(internal.users.performUserDeletionWithChecks, args)).rejects.toThrow(
      "Unable to verify"
    )
    expect(stripe.balance.mock.calls.length).toBe(reads)
    await expect(
      t.mutation(internal.users.performUserDeletion, {
        userId,
        ...args,
        checkedStripeAccountId: "acct_changed",
      })
    ).rejects.toThrow("Account changed")
    expect(await getUser()).not.toBeNull()
  })

  it("allows a unique legacy Express destination with a verified zero balance", async () => {
    const { self, postDeleted, getUser } = await setup(true)
    stripe.account.mockResolvedValue({ id: "acct_owner", type: "express", metadata: {} })
    expect((await self.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(true)
    expect((await postDeleted()).status).toBe(200)
    expect(await getUser()).toBeNull()
  })

  it("returns one generic blocker for legacy funds, a failed balance read or an ambiguous link", async () => {
    const { t, self, getUser } = await setup(true)
    stripe.account.mockResolvedValue({ id: "acct_owner", type: "express", metadata: {} })
    const expected = {
      canDelete: false,
      blockingFactors: [
        "Unable to verify your Stripe account balance. Please try again later or contact support.",
      ],
    }
    for (const amount of [2500, -10]) {
      stripe.balance.mockResolvedValue({
        pending: [],
        available: [{ currency: "usd", amount }],
      })
      expect(await self.action(api.users.checkUserDeletionEligibility, {})).toMatchObject(expected)
    }
    stripe.balance.mockRejectedValue(new Error("Stripe unavailable"))
    expect(await self.action(api.users.checkUserDeletionEligibility, {})).toMatchObject(expected)
    await t.run(({ db }) =>
      db.insert("users", { externalId: "other", name: "Other", stripeAccountId: "acct_owner" })
    )
    stripe.balance.mockClear()
    expect(await self.action(api.users.checkUserDeletionEligibility, {})).toMatchObject(expected)
    expect(stripe.balance).not.toHaveBeenCalled()
    await expect(
      t.action(internal.users.performUserDeletionWithChecks, { clerkUserId: "owner" })
    ).rejects.toThrow("Unable to verify")
    expect(await getUser()).not.toBeNull()
  })
})
