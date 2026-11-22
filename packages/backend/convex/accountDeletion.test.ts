// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import rateSchema from "../node_modules/@convex-dev/rate-limiter/dist/component/schema.js"
import { api, internal } from "./_generated/api"
import schema from "./schema"

vi.mock("./r2", () => ({ r2: {} }))
vi.mock("./emails", async (original) => ({
  ...(await original<typeof import("./emails")>()),
  sendTransactionalEmail: vi.fn(),
}))
const verifyToken = vi.hoisted(() => vi.fn())
vi.mock("@clerk/clerk-sdk-node", () => ({ createClerkClient: () => ({ verifyToken }) }))
const modules = (
  import.meta as unknown as { glob: (g: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
const rateModules = (
  import.meta as unknown as { glob: (g: string) => Record<string, () => Promise<unknown>> }
).glob("../node_modules/@convex-dev/rate-limiter/src/component/**/*.ts")
const issuer = "https://synthetic.clerk.accounts.dev"
let exists: boolean
let deleteFailure: "none" | "reject" | "lost" = "none"
let domain = issuer
let instanceId = "ins_fixture"
let environment = "development"
let request: ReturnType<typeof vi.fn>
beforeEach(() => {
  exists = true
  deleteFailure = "none"
  domain = issuer
  instanceId = "ins_fixture"
  environment = "development"
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture")
  vi.stubEnv("CLERK_INSTANCE_ID", "ins_fixture")
  vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", issuer)
  verifyToken.mockReset().mockResolvedValue({
    iss: issuer,
    sub: "self",
    sid: "sess_self",
    iat: Math.floor(Date.now() / 1000),
    fva: [0, -1],
  })
  request = vi.fn(async (url: string, options?: RequestInit) => {
    await Promise.resolve()
    const path = new URL(url).pathname
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
    if (path === "/v1/domains") return json({ data: [{ frontend_api_url: domain }] })
    if (path === "/v1/instance") return json({ id: instanceId, environment_type: environment })
    if (path === "/v1/sessions/sess_self")
      return json({ id: "sess_self", user_id: "self", status: "active" })
    if (path !== "/v1/users/self") throw new Error("Unexpected provider target")
    if (options?.method === "DELETE") {
      if (deleteFailure === "reject") return json({}, 503)
      exists = false
      if (deleteFailure === "lost") throw new Error("Provider response lost")
      return json({ id: "self", deleted: true })
    }
    return exists ? json({ id: "self", two_factor_enabled: false }) : json({}, 404)
  })
  vi.stubGlobal("fetch", request)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
async function setup() {
  const t = convexTest(schema, modules)
  t.registerComponent("rateLimiter", rateSchema, rateModules)
  const userId = await t.run(({ db }) =>
    db.insert("users", {
      externalId: "self",
      name: "Synthetic",
      email: "private@example.invalid",
      phone: "555",
      stripeCustomerId: "cus_retained",
    })
  )
  const self = t.withIdentity({ subject: "self", issuer })
  return {
    t,
    self,
    userId,
    state: () => t.query(internal.users.getDeletionIntent, { subject: "self" }),
  }
}
it("requires authentication and has no caller-selected deletion target", async () => {
  const { t, self } = await setup()
  await expect(
    t.action(api.users.requestAccountDeletion, { reauthToken: "synthetic-token" })
  ).rejects.toThrow("Not authenticated")
  await expect(
    self.action(api.users.requestAccountDeletion, { subject: "other" } as never)
  ).rejects.toThrow()
  expect(request).not.toHaveBeenCalled()
})
it.each([
  "secret",
  "instance",
  "domain",
  "mode",
  "issuer",
])("fails closed on mismatched or missing %s before locking or deleting", async (kind) => {
  const { t, self, state } = await setup()
  if (kind === "secret") vi.stubEnv("CLERK_SECRET_KEY", "")
  if (kind === "instance") instanceId = "ins_wrong"
  if (kind === "domain") domain = "https://wrong.clerk.accounts.dev"
  if (kind === "mode") environment = "production"
  const caller =
    kind === "issuer"
      ? t.withIdentity({ subject: "self", issuer: "https://wrong.clerk.accounts.dev" })
      : self
  await expect(
    caller.action(api.users.requestAccountDeletion, { reauthToken: "synthetic-token" })
  ).rejects.toThrow()
  expect(await state()).toBeNull()
  expect(request.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(false)
})
it("confirms exact provider deletion, scrubs private profile, retains actor linkage, and prevents resurrection", async () => {
  const { t, self, userId, state } = await setup()
  expect(
    await self.action(api.users.requestAccountDeletion, { reauthToken: "synthetic-token" })
  ).toEqual({
    deleted: true,
    cleanupPending: false,
  })
  expect(await state()).toMatchObject({ status: "completed" })
  expect(await t.run(({ db }) => db.get(userId))).toMatchObject({
    externalId: "self",
    name: "Deleted user",
    stripeCustomerId: "cus_retained",
  })
  expect(await t.run(({ db }) => db.get(userId))).not.toHaveProperty("email")
  expect(await self.query(api.users.current, {})).toBeNull()
  await t.mutation(internal.users.upsertFromClerk, {
    data: {
      id: "self",
      first_name: "Resurrected",
      email_addresses: [{ email_address: "private@example.invalid" }],
    } as never,
  })
  await expect(self.mutation(api.users.updateProfile, { name: "Resurrected" })).rejects.toThrow(
    "being deleted"
  )
  expect(await t.run(({ db }) => db.get(userId))).toMatchObject({ name: "Deleted user" })
  expect(request.mock.calls.filter(([, options]) => options?.method === "DELETE")).toHaveLength(1)
})
it("keeps a durable lock on provider failure and lets the same subject retry", async () => {
  const { self, state } = await setup()
  deleteFailure = "reject"
  await expect(
    self.action(api.users.requestAccountDeletion, { reauthToken: "synthetic-token" })
  ).rejects.toThrow("not confirmed")
  expect(await state()).toMatchObject({ status: "locked", lastFailure: "provider_unconfirmed" })
  expect(await self.action(api.users.checkUserDeletionEligibility, {})).toMatchObject({
    canDelete: true,
  })
  deleteFailure = "none"
  expect(
    await self.action(api.users.requestAccountDeletion, { reauthToken: "synthetic-token" })
  ).toMatchObject({ deleted: true })
  expect(await state()).toMatchObject({ status: "completed" })
})
it("recovers an accepted DELETE with lost response without a live user JWT or a second DELETE", async () => {
  const { t, self, state } = await setup()
  deleteFailure = "lost"
  await expect(
    self.action(api.users.requestAccountDeletion, { reauthToken: "synthetic-token" })
  ).rejects.toThrow("response lost")
  expect(await state()).toMatchObject({ status: "locked" })
  await t.action(internal.users.reconcileAccountDeletion, { subject: "self" })
  expect(await state()).toMatchObject({ status: "completed" })
  expect(request.mock.calls.filter(([, options]) => options?.method === "DELETE")).toHaveLength(1)
  await t.action(internal.users.reconcileAccountDeletion, { subject: "unconsented-subject" })
  expect(request.mock.calls.some(([url]) => url.includes("unconsented-subject"))).toBe(false)
})
it("serializes deletion with in-flight operations for either participant, without releasing concurrent reservations", async () => {
  const { t, self, state } = await setup()
  await t.mutation(internal.accountOperations.begin, {
    key: "attempt-a",
    subjects: ["other", "self"],
  })
  await t.mutation(internal.accountOperations.begin, {
    key: "attempt-b",
    subjects: ["self", "other"],
  })
  await t.mutation(internal.accountOperations.complete, { key: "attempt-a" })
  await expect(
    self.action(api.users.requestAccountDeletion, { reauthToken: "synthetic-token" })
  ).rejects.toThrow("unconfirmed")
  expect(await state()).toBeNull()
  await t.mutation(internal.accountOperations.complete, { key: "attempt-b" })
  await t.mutation(internal.users.beginAccountDeletion, { subject: "self" })
  await expect(
    t.mutation(internal.accountOperations.begin, {
      key: "late-attempt",
      subjects: ["other", "self"],
    })
  ).rejects.toThrow("being deleted")
})
it("refuses local cleanup without provider confirmation", async () => {
  const { t, userId } = await setup()
  await t.mutation(internal.users.beginAccountDeletion, { subject: "self" })
  await expect(
    t.mutation(internal.users.performUserDeletion, { userId, clerkUserId: "self" })
  ).rejects.toThrow("not confirmed")
  expect(await t.run(({ db }) => db.get(userId))).toHaveProperty("email")
})
it("blocks invoice creation for either deleting party even with a still-valid cached JWT", async () => {
  const { t, self } = await setup()
  await t.run(({ db }) => db.insert("users", { externalId: "recipient", name: "Recipient" }))
  await t.mutation(internal.users.beginAccountDeletion, { subject: "recipient" })
  await expect(
    self.mutation(api.invoices.createDraft, {
      recipientId: "recipient",
      title: "New obligation",
      lineItems: [{ description: "Test", quantity: 1, unitAmount: 100, amount: 100 }],
      paymentMethods: ["stripe_card"],
    })
  ).rejects.toThrow("being deleted")
  expect(await t.run(({ db }) => db.query("invoices").collect())).toEqual([])
})

it.each([
  "signature",
  "subject",
  "issuer",
  "sid",
  "session",
  "session-user",
])("rejects an invalid native-token %s before locking", async (kind) => {
  const { self, state } = await setup()
  const claims = {
    iss: issuer,
    sub: "self",
    sid: "sess_self",
    iat: Math.floor(Date.now() / 1000),
    fva: [0, -1],
  }
  if (kind === "signature") verifyToken.mockRejectedValueOnce(new Error("Invalid signature"))
  if (kind === "sid") verifyToken.mockResolvedValueOnce({ ...claims, sid: "sess_wrong" })
  if (kind === "subject") verifyToken.mockResolvedValueOnce({ ...claims, sub: "other" })
  if (kind === "issuer")
    verifyToken.mockResolvedValueOnce({ ...claims, iss: "https://wrong.clerk.accounts.dev" })
  if (kind === "session" || kind === "session-user") {
    const prior = request.getMockImplementation()
    if (!prior) throw new Error("Missing provider fixture")
    request.mockImplementation((url, options) =>
      url.endsWith("/sessions/sess_self")
        ? Promise.resolve(
            Response.json({
              id: "sess_self",
              user_id: kind === "session-user" ? "other" : "self",
              status: kind === "session" ? "revoked" : "active",
            })
          )
        : prior(url, options)
    )
  }
  await expect(
    self.action(api.users.requestAccountDeletion, { reauthToken: "synthetic-token" })
  ).rejects.toThrow()
  expect(await state()).toBeNull()
  expect(request.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(false)
})
it.each([
  [10, -1],
  [0, 10],
  [-1, -1],
  [9, -1],
])("requires fresh strongest-factor proof, including token age, for %j", async (...ages) => {
  const { self, state } = await setup()
  verifyToken.mockResolvedValueOnce({
    iss: issuer,
    sub: "self",
    sid: "sess_self",
    iat: Math.floor(Date.now() / 1000) - (ages[0] === 9 ? 61 : 0),
    fva: ages,
  })
  expect(
    await self.action(api.users.requestAccountDeletion, { reauthToken: "synthetic-token" })
  ).toMatchObject({
    clerk_error: {
      reason: "reverification-error",
      metadata: { reverification: { level: "second_factor", afterMinutes: 10 } },
    },
  })
  expect(await state()).toBeNull()
  expect(request.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(false)
})
it("requires the enrolled second factor even if the first factor is fresh", async () => {
  const { self, state } = await setup()
  const prior = request.getMockImplementation()
  if (!prior) throw new Error("Missing provider fixture")
  request.mockImplementation((url, options) =>
    url.endsWith("/users/self") && options?.method !== "DELETE"
      ? Promise.resolve(Response.json({ id: "self", two_factor_enabled: true }))
      : prior(url, options)
  )
  expect(
    await self.action(api.users.requestAccountDeletion, { reauthToken: "synthetic-token" })
  ).toHaveProperty("clerk_error")
  expect(await state()).toBeNull()
})
it("does not treat the old Convex template token as native-session step-up proof", async () => {
  const { self, state } = await setup()
  verifyToken.mockResolvedValueOnce({
    iss: issuer,
    sub: "self",
    aud: "convex",
    iat: Math.floor(Date.now() / 1000),
  })
  await expect(
    self.action(api.users.requestAccountDeletion, { reauthToken: "old-convex-template" })
  ).rejects.toThrow("does not match")
  expect(await state()).toBeNull()
})

function seedRental(
  t: ReturnType<typeof convexTest>,
  status: "approved" | "confirmed" | "completed" = "completed"
) {
  return t.run(async ({ db }) => {
    await db.insert("users", { externalId: "host", name: "Host" })
    const trackId = await db.insert("tracks", { name: "Test", location: "Test", isActive: true })
    const vehicleId = await db.insert("vehicles", {
      trackId,
      ownerId: "host",
      make: "Test",
      model: "Car",
      year: 2026,
      dailyRate: 1000,
      description: "Test",
      amenities: [],
      addOns: [],
      isActive: true,
      createdAt: 0,
      updatedAt: 0,
    })
    const reservationId = await db.insert("reservations", {
      vehicleId,
      renterId: "self",
      ownerId: "host",
      startDate: "2000-01-01",
      endDate: "2000-01-01",
      totalDays: 1,
      dailyRate: 1000,
      totalAmount: 1000,
      status,
      createdAt: 0,
      updatedAt: 0,
    })
    const paymentId = await db.insert("payments", {
      reservationId,
      renterId: "self",
      ownerId: "host",
      amount: 1000,
      platformFee: 100,
      ownerAmount: 900,
      currency: "usd",
      status: "succeeded",
      createdAt: 0,
      updatedAt: 0,
    })
    return { vehicleId, reservationId, paymentId }
  })
}
it("allows settled history while preserving its financial actor and payment/reservation records", async () => {
  const { t, self, userId } = await setup()
  const { reservationId, paymentId } = await seedRental(t)
  expect(await self.action(api.users.checkUserDeletionEligibility, {})).toMatchObject({
    canDelete: true,
  })
  expect(
    await self.action(api.users.requestAccountDeletion, { reauthToken: "synthetic-token" })
  ).toMatchObject({ deleted: true, cleanupPending: false })
  expect(await t.run(({ db }) => db.get(paymentId))).toMatchObject({
    renterId: "self",
    status: "succeeded",
  })
  expect(await t.run(({ db }) => db.get(reservationId))).toMatchObject({
    renterId: "self",
    status: "completed",
  })
  expect(await t.run(({ db }) => db.get(userId))).toMatchObject({
    externalId: "self",
    stripeCustomerId: "cus_retained",
    name: "Deleted user",
  })
})
it("does not treat a past confirmed rental without a return as settled", async () => {
  const { t, self } = await setup()
  await seedRental(t, "confirmed")
  expect(await self.action(api.users.checkUserDeletionEligibility, {})).toMatchObject({
    canDelete: false,
  })
  await expect(
    self.action(api.users.requestAccountDeletion, { reauthToken: "synthetic-token" })
  ).rejects.toThrow("active booking")
})
it.each([
  "self",
  "host",
])("blocks new rental and damage obligations for deleting participant %s", async (subject) => {
  const { t, self } = await setup()
  const { vehicleId, reservationId } = await seedRental(t)
  await t.run(({ db }) =>
    db.insert("accountDeletionIntents", { subject, status: "locked", createdAt: 0, updatedAt: 0 })
  )
  await expect(
    self.mutation(api.reservations.create, { vehicleId, startDate: "2099-01-01", durationDays: 1 })
  ).rejects.toThrow("being deleted")
  await expect(
    t.withIdentity({ subject: "host" }).mutation(api.damageInvoices.create, {
      reservationId,
      amount: 100,
      description: "Test claim",
      photos: [],
    })
  ).rejects.toThrow("being deleted")
  await t.run(({ db }) =>
    db.patch(reservationId, { status: "pending", startDate: "2099-01-01", endDate: "2099-01-01" })
  )
  await expect(
    t.withIdentity({ subject: "host" }).mutation(api.reservations.approve, { reservationId })
  ).rejects.toThrow("being deleted")
  expect(await t.run(({ db }) => db.query("damageInvoices").collect())).toEqual([])
})
it("blocks deletion for a latest pending refund despite paid charge/completed rental, then honors terminal evidence", async () => {
  const { t, self } = await setup()
  const { paymentId } = await seedRental(t)
  const observation = {
    refundId: "re_pending",
    status: "pending",
    amount: 100,
    currency: "usd",
    chargeId: "ch_fixture",
  }
  await t.run(({ db }) =>
    db.insert("rentalSettlementObservations", {
      paymentId,
      refundId: observation.refundId,
      observation,
      observedAt: Date.now(),
    })
  )
  expect(await self.action(api.users.checkUserDeletionEligibility, {})).toMatchObject({
    canDelete: false,
  })
  await t.run(({ db }) =>
    db.insert("rentalSettlementObservations", {
      paymentId,
      refundId: observation.refundId,
      observation: { ...observation, status: "succeeded" },
      observedAt: Date.now() + 1,
    })
  )
  expect(await self.action(api.users.checkUserDeletionEligibility, {})).toMatchObject({
    canDelete: true,
  })
})
it("returns confirmed sign-in deletion with cleanup pending when a late real obligation arrives", async () => {
  const { t, self, state, userId } = await setup()
  const prior = request.getMockImplementation()
  if (!prior) throw new Error("Missing provider fixture")
  request.mockImplementation(async (url, options) => {
    const result = await prior(url, options)
    if (options?.method === "DELETE")
      await t.run(({ db }) =>
        db.insert("accountOperations", {
          key: "late-provider-fact",
          subject: "self",
          status: "active",
          createdAt: 0,
          updatedAt: 0,
        })
      )
    return result
  })
  expect(
    await self.action(api.users.requestAccountDeletion, { reauthToken: "synthetic-token" })
  ).toEqual({ deleted: true, cleanupPending: true })
  expect(await state()).toMatchObject({ status: "provider_deleted" })
  expect(await t.run(({ db }) => db.get(userId))).toHaveProperty("email")
  await t.mutation(internal.accountOperations.complete, { key: "late-provider-fact" })
  await t.action(internal.users.reconcileAccountDeletion, { subject: "self" })
  expect(await state()).toMatchObject({ status: "completed" })
})

it.each(
  [
    "invoice",
    "deposit",
    "deposit-reservation",
    "coaching",
    "coaching-cancelled-pending",
    "damage",
    "dispute",
    "return",
  ].flatMap((kind) => ["self", "host"].map((subject) => ({ kind, subject })))
)("holds $subject deletion for outstanding $kind in either role", async ({ kind, subject }) => {
  const { t } = await setup()
  const { reservationId, vehicleId } = await seedRental(t)
  await t.run(async ({ db }) => {
    if (["invoice", "deposit", "deposit-reservation"].includes(kind)) {
      const invoiceId = await db.insert("invoices", {
        senderId: "host",
        recipientId: "self",
        title: "Test invoice",
        lineItems: [{ description: "Test", quantity: 1, unitAmount: 100, amount: 100 }],
        subtotal: 100,
        total: 100,
        currency: "usd",
        paymentMethods: ["stripe_card"],
        status: kind === "invoice" ? "sent" : "paid",
        ...(kind === "deposit" ? { depositStatus: "held" as const } : {}),
        createdAt: 0,
        updatedAt: 0,
      })
      if (kind === "deposit-reservation")
        await db.insert("invoiceDepositRefundRequests", {
          invoiceId,
          requestId: "reserved",
          amount: 100,
          state: "reserved",
        })
    }
    if (kind.startsWith("coaching")) {
      const coachProfileId = await db.insert("coachProfiles", {
        userId: "host",
        bio: "Test",
        specialties: [],
        location: "Test",
        isActive: true,
        createdAt: 0,
        updatedAt: 0,
      })
      await db.insert("coachingBookings", {
        coachProfileId,
        coachUserId: "host",
        renterId: "self",
        startDate: "2000-01-01",
        endDate: "2000-01-01",
        sessionType: "half_day",
        totalDays: 1,
        rate: 100,
        totalAmount: 100,
        status: kind === "coaching" ? "approved" : "cancelled",
        ...(kind === "coaching-cancelled-pending" ? { paymentStatus: "pending" as const } : {}),
        createdAt: 0,
        updatedAt: 0,
      })
    }
    if (["damage", "dispute", "return"].includes(kind)) {
      const completionId = await db.insert("rentalCompletions", {
        reservationId,
        vehicleId,
        renterId: "self",
        ownerId: "host",
        status: kind === "return" ? "pending_owner" : "completed",
        createdAt: 0,
        updatedAt: 0,
      })
      if (kind === "damage")
        await db.insert("damageInvoices", {
          reservationId,
          completionId,
          vehicleId,
          renterId: "self",
          ownerId: "host",
          amount: 100,
          description: "Test",
          photos: [],
          status: "pending_review",
          createdAt: 0,
          updatedAt: 0,
        })
      if (kind === "dispute")
        await db.insert("disputes", {
          reservationId,
          completionId,
          vehicleId,
          renterId: "self",
          ownerId: "host",
          createdBy: "self",
          reason: "Test",
          description: "Test",
          status: "open",
          createdAt: 0,
          updatedAt: 0,
        })
    }
  })
  const caller = t.withIdentity({ subject, issuer })
  expect(await caller.action(api.users.checkUserDeletionEligibility, {})).toMatchObject({
    canDelete: false,
  })
  await expect(t.mutation(internal.users.beginAccountDeletion, { subject })).rejects.toThrow(
    "Cannot delete"
  )
  expect(await t.query(internal.users.getDeletionIntent, { subject })).toBeNull()
})

it("requires signed factor ages rather than treating an absent freshness claim as fresh", async () => {
  const { self, state } = await setup()
  verifyToken.mockResolvedValueOnce({
    iss: issuer,
    sub: "self",
    sid: "sess_self",
    iat: Math.floor(Date.now() / 1000),
  })
  expect(
    await self.action(api.users.requestAccountDeletion, { reauthToken: "synthetic-token" })
  ).toHaveProperty("clerk_error")
  expect(await state()).toBeNull()
})

it("rejects missing provider factor-enrollment evidence rather than assuming no second factor", async () => {
  const { self, state } = await setup()
  const prior = request.getMockImplementation()
  if (!prior) throw new Error("Missing provider fixture")
  request.mockImplementation((url, options) =>
    url.endsWith("/users/self") && options?.method !== "DELETE"
      ? Promise.resolve(Response.json({ id: "self" }))
      : prior(url, options)
  )
  await expect(
    self.action(api.users.requestAccountDeletion, { reauthToken: "synthetic-token" })
  ).rejects.toThrow("Unable to verify")
  expect(await state()).toBeNull()
})
