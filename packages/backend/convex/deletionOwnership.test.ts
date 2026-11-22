// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { Webhook } from "svix"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import rateSchema from "../node_modules/@convex-dev/rate-limiter/dist/component/schema.js"
import { api, internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
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

function rentalFixture(
  t: Awaited<ReturnType<typeof setup>>["t"],
  role: "renter" | "owner",
  {
    status = "approved",
    endDate = "2099-01-02",
    paymentStatus,
  }: {
    status?: Doc<"reservations">["status"]
    endDate?: string
    paymentStatus?: Doc<"payments">["status"]
  } = {}
) {
  return t.run(async ({ db }) => {
    // Give the unrelated identity a real user row so eligibility reaches the
    // participant-index queries instead of returning early for a missing user.
    await db.insert("users", { externalId: "other", name: "Unrelated fixture user" })
    const participants = {
      renterId: role === "renter" ? "owner" : "renter",
      ownerId: role === "owner" ? "owner" : "host",
    }
    const trackId = await db.insert("tracks", {
      name: "REN-32 fixture",
      location: "Test",
      isActive: true,
    })
    const vehicleId = await db.insert("vehicles", {
      ownerId: participants.ownerId,
      trackId,
      make: "Test",
      model: "REN-32",
      year: 2020,
      dailyRate: 1000,
      description: "Synthetic deletion obligation fixture",
      amenities: [],
      addOns: [],
      isActive: true,
      createdAt: 0,
      updatedAt: 0,
    })
    const reservationId = await db.insert("reservations", {
      ...participants,
      vehicleId,
      startDate: endDate,
      endDate,
      totalDays: 1,
      dailyRate: 1000,
      totalAmount: 1000,
      status,
      createdAt: 0,
      updatedAt: 0,
    })
    const paymentId = paymentStatus
      ? await db.insert("payments", {
          ...participants,
          reservationId,
          amount: 1000,
          platformFee: 100,
          ownerAmount: 900,
          currency: "usd",
          status: paymentStatus,
          createdAt: 0,
          updatedAt: 0,
        })
      : undefined
    return { reservationId, paymentId }
  })
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

  it("requires a signed Clerk deletion event, handles replay, and anonymizes only its subject", async () => {
    const { t, postDeleted, getUser } = await setup(true)
    const otherId = await t.run((ctx) =>
      ctx.db.insert("users", { externalId: "other", name: "Other" })
    )
    const bad = await postDeleted({ signerSecret: `whsec_${btoa("wrong-signing-secret")}` })
    expect(bad.status).toBe(400)
    expect(await getUser()).not.toBeNull()
    const first = await postDeleted()
    expect(first.status).toBe(200)
    expect(await getUser()).toMatchObject({ externalId: "owner", name: "Deleted user" })
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
    await t.mutation(internal.users.confirmProviderDeletion, { subject: "owner" })
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

  it.each(
    (["renter", "owner"] as const).flatMap((role) =>
      ["2000-01-01", "2099-01-02"].map((endDate) => ({ role, endDate }))
    )
  )("blocks an approved booking before payment as $role ending $endDate, then allows cancellation without erasing history", async ({
    role,
    endDate,
  }) => {
    const { t, self, other, userId, getUser, postDeleted } = await setup()
    const { reservationId } = await rentalFixture(t, role, { endDate })
    expect((await self.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(false)
    expect((await other.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(true)
    await t.mutation(internal.users.confirmProviderDeletion, { subject: "owner" })
    await expect(
      t.mutation(internal.users.performUserDeletion, { userId, clerkUserId: "owner" })
    ).rejects.toThrow("Cannot delete")
    expect((await postDeleted()).status).toBe(200)
    expect(await getUser()).not.toBeNull()
    expect(await t.run(({ db }) => db.query("payments").collect())).toEqual([])

    await t.run(({ db }) => db.patch(reservationId, { status: "cancelled" }))
    expect((await self.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(true)
    // The signed deletion fact is acknowledged; a replay can retry deferred cleanup.
    expect((await postDeleted()).status).toBe(200)
    expect((await postDeleted()).status).toBe(200)
    expect(await getUser()).toMatchObject({ externalId: "owner", name: "Deleted user" })
    expect(await t.run(({ db }) => db.get(reservationId))).toMatchObject({ status: "cancelled" })
  })

  it.each(
    (["renter", "owner"] as const).flatMap((role) =>
      (["intent", "checkout"] as const).flatMap((kind) =>
        [true, false].map((terminalFirst) => ({ role, kind, terminalFirst }))
      )
    )
  )("resolves $role deletion only after booking cancellation and terminal $kind evidence (terminal first=$terminalFirst)", async ({
    role,
    kind,
    terminalFirst,
  }) => {
    vi.useFakeTimers()
    const { t, self } = await setup()
    try {
      const { reservationId, paymentId } = await rentalFixture(t, role, {
        paymentStatus: "pending",
      })
      if (!paymentId) throw new Error("Expected payment")
      const payment = await t.run(async ({ db }) => {
        await db.patch(reservationId, { paymentId, paymentStatus: "pending" })
        await db.patch(
          paymentId,
          kind === "intent"
            ? { stripePaymentIntentId: "pi_terminal" }
            : { stripeCheckoutSessionId: "cs_terminal" }
        )
        return await db.get(paymentId)
      })
      if (!payment) throw new Error("Expected payment")
      const duplicateId = await t.run(({ db }) => {
        const { _id, _creationTime, ...fields } = payment
        return db.insert("payments", fields)
      })
      const terminal = () =>
        kind === "intent"
          ? t.mutation(internal.stripe.ingestRentalPaymentEvent, {
              reservationId,
              renterId: payment.renterId,
              ownerId: payment.ownerId,
              currency: "usd",
              amount: 1000,
              stripePaymentIntentId: "pi_terminal",
              eventId: "evt_terminal",
              eventType: "payment_intent.canceled",
            })
          : t.mutation(internal.stripe.ingestRentalCheckoutExpired, {
              reservationId,
              renterId: payment.renterId,
              ownerId: payment.ownerId,
              currency: "usd",
              amount: 1000,
              stripeCheckoutSessionId: "cs_terminal",
              eventId: "evt_terminal",
              mode: "payment",
              status: "expired",
              paymentStatus: "unpaid",
            })
      expect((await self.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(false)
      if (terminalFirst) {
        await terminal()
        expect((await self.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(
          false
        )
      }
      await self.mutation(api.reservations.cancel, { reservationId })
      if (!terminalFirst) {
        expect((await self.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(
          false
        )
        await terminal()
      }
      expect((await self.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(true)
      expect(await t.run(({ db }) => db.get(paymentId))).toMatchObject({ status: "cancelled" })
      expect(await t.run(({ db }) => db.get(duplicateId))).toMatchObject({ status: "cancelled" })
      const jobs = await t.run(({ db }) => db.system.query("_scheduled_functions").collect())
      expect(jobs.some((job) => job.name.includes("processRefundOnCancellation"))).toBe(false)
    } finally {
      await t.finishAllScheduledFunctions(vi.runAllTimers)
      vi.useRealTimers()
    }
  })

  const unsettledCases = (["renter", "owner"] as const).flatMap((role) =>
    (["pending", "processing"] as const).flatMap((paymentStatus) =>
      (
        [
          ["approved", "2000-01-01"],
          ["completed", "2000-01-01"],
          ["cancelled", "2099-01-02"],
        ] as const
      ).map(([reservationStatus, endDate]) => ({
        role,
        paymentStatus,
        reservationStatus,
        endDate,
      }))
    )
  )

  it.each(
    unsettledCases
  )("blocks $role deletion for $paymentStatus payment on $reservationStatus booking ending $endDate", async ({
    role,
    paymentStatus,
    reservationStatus,
    endDate,
  }) => {
    const { t, self, other, userId, getUser, postDeleted } = await setup()
    const { reservationId, paymentId } = await rentalFixture(t, role, {
      status: reservationStatus,
      endDate,
      paymentStatus,
    })
    if (!paymentId) throw new Error("Expected payment fixture")
    const eligibility = await self.action(api.users.checkUserDeletionEligibility, {})
    expect(eligibility.canDelete).toBe(false)
    expect(eligibility.blockingFactors.join(" ").toLowerCase()).toContain("payment")
    expect((await other.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(true)
    await t.mutation(internal.users.confirmProviderDeletion, { subject: "owner" })
    await expect(
      t.mutation(internal.users.performUserDeletion, { userId, clerkUserId: "owner" })
    ).rejects.toThrow("Cannot delete")
    expect((await postDeleted()).status).toBe(200)
    expect(await getUser()).not.toBeNull()
    expect(await t.run(({ db }) => db.get(paymentId))).toMatchObject({ status: paymentStatus })

    await t.run(({ db }) => db.patch(paymentId, { status: "cancelled" }))
    if (reservationStatus === "approved") {
      expect((await self.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(false)
      await t.run(({ db }) => db.patch(reservationId, { status: "cancelled" }))
    }
    expect((await self.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(true)
    expect((await postDeleted()).status).toBe(200)
    expect(await getUser()).toMatchObject({ externalId: "owner", name: "Deleted user" })
    expect(await t.run(({ db }) => db.get(paymentId))).toMatchObject({ status: "cancelled" })
    expect(await t.run(({ db }) => db.get(reservationId))).not.toBeNull()
  })

  it.each([
    "renter",
    "owner",
  ] as const)("requires both booking and payment obligations to resolve for %s", async (role) => {
    const { t, self } = await setup()
    const { reservationId, paymentId } = await rentalFixture(t, role, {
      paymentStatus: "processing",
    })
    if (!paymentId) throw new Error("Expected payment fixture")
    await t.run(({ db }) => db.patch(reservationId, { status: "cancelled" }))
    expect((await self.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(false)
    await t.run(async ({ db }) => {
      await db.patch(reservationId, { status: "approved" })
      await db.patch(paymentId, { status: "succeeded" })
    })
    expect((await self.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(false)
    await t.run(({ db }) => db.patch(reservationId, { status: "confirmed" }))
    expect((await self.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(false)
    await t.run(({ db }) => db.patch(reservationId, { status: "completed" }))
    for (const status of [
      "succeeded",
      "failed",
      "cancelled",
      "refunded",
      "partially_refunded",
    ] as const) {
      await t.run(({ db }) => db.patch(paymentId, { status }))
      expect((await self.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(true)
    }
  })

  it.each([
    "approved booking",
    "processing payment",
  ] as const)("rechecks a new %s created during the Stripe balance read in the final deletion transaction", async (obligation) => {
    const { t, self, getUser, postDeleted } = await setup(true)
    expect((await self.action(api.users.checkUserDeletionEligibility, {})).canDelete).toBe(true)
    stripe.balance.mockImplementationOnce(async () => {
      if (obligation === "approved booking") {
        await rentalFixture(t, "owner")
      } else {
        await rentalFixture(t, "renter", {
          status: "cancelled",
          endDate: "2000-01-01",
          paymentStatus: "processing",
        })
      }
      return { pending: [], available: [] }
    })
    expect((await postDeleted()).status).toBe(200)
    expect(await getUser()).not.toBeNull()
    expect(await t.run(({ db }) => db.query("webhookEvents").collect())).toHaveLength(1)
  })

  it("denies deletion for an outstanding balance and if Stripe ownership cannot be verified", async () => {
    const { t, self, userId, getUser } = await setup(true)
    stripe.balance.mockResolvedValue({ pending: [{ currency: "usd", amount: 500 }], available: [] })
    const args = { clerkUserId: "owner" }
    expect((await self.action(api.users.checkUserDeletionEligibility, args)).canDelete).toBe(false)
    await t.mutation(internal.users.confirmProviderDeletion, { subject: "owner" })
    await expect(t.action(internal.users.performUserDeletionWithChecks, args)).rejects.toThrow(
      "payouts"
    )
    const reads = stripe.balance.mock.calls.length
    stripe.account.mockResolvedValue({
      id: "acct_owner",
      type: "express",
      metadata: { renegadeUserId: "other" },
    })
    await t.mutation(internal.users.confirmProviderDeletion, { subject: "owner" })
    await expect(t.action(internal.users.performUserDeletionWithChecks, args)).rejects.toThrow(
      "Unable to verify"
    )
    expect(stripe.balance.mock.calls.length).toBe(reads)
    await t.mutation(internal.users.confirmProviderDeletion, { subject: "owner" })
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
    expect(await getUser()).toMatchObject({ externalId: "owner", name: "Deleted user" })
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
    await t.mutation(internal.users.confirmProviderDeletion, { subject: "owner" })
    await expect(
      t.action(internal.users.performUserDeletionWithChecks, { clerkUserId: "owner" })
    ).rejects.toThrow("Unable to verify")
    expect(await getUser()).not.toBeNull()
  })
  it.each([
    { pending: [{ amount: -1, currency: "usd" }], available: [] },
    { pending: [], available: [], connect_reserved: [{ amount: 1, currency: "usd" }] },
    {
      pending: [],
      available: [],
      refund_and_dispute_prefunding: { pending: [{ amount: -1, currency: "usd" }], available: [] },
    },
  ])("blocks verified-owner deletion for nonzero liabilities or reserved funds %j", async (balance) => {
    const { self } = await setup(true)
    stripe.balance.mockResolvedValue(balance)
    expect(await self.action(api.users.checkUserDeletionEligibility, {})).toMatchObject({
      canDelete: false,
    })
  })
})
