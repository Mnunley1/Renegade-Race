// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  customer: vi.fn(),
  checkout: vi.fn(),
  intent: vi.fn(),
  link: vi.fn(),
  login: vi.fn(),
  afterOperation: vi.fn(),
}))
vi.mock("./r2", () => ({ r2: {} }))
vi.mock("./accountOperations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./accountOperations")>()
  return {
    ...actual,
    withAccountOperation: async (...args: Parameters<typeof actual.withAccountOperation>) => {
      const result = await actual.withAccountOperation(...args)
      await mocks.afterOperation()
      return result
    },
  }
})

vi.mock("./rateLimiter", () => ({ rateLimiter: { limit: async () => ({ ok: true }) } }))
vi.mock("stripe", () => ({
  default: class {
    accounts = { retrieve: mocks.account, createLoginLink: mocks.login }
    customers = { retrieve: mocks.customer }
    checkout = { sessions: { create: mocks.checkout } }
    paymentIntents = { create: mocks.intent }
    accountLinks = { create: mocks.link }
  },
}))
const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>
  }
).glob("./**/*.ts")
const account = {
  id: "acct_host",
  type: "express",
  metadata: { renegadeUserId: "host" },
  details_submitted: true,
  charges_enabled: true,
  payouts_enabled: true,
  capabilities: { transfers: "active" },
  requirements: {},
}
const customer = { id: "cus_renter", metadata: { userId: "renter" } }
const checkout = { id: "cs_revocation", url: "https://checkout.stripe.test/disposable" }
const intent = { id: "pi_revocation", client_secret: "synthetic_not_a_real_secret" }
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_revocation_fixture")
  vi.stubEnv("WEB_URL", "https://renegaderace.test")
  mocks.account.mockResolvedValue(account)
  mocks.customer.mockResolvedValue(customer)
  mocks.checkout.mockResolvedValue(checkout)
  mocks.intent.mockResolvedValue(intent)
})
afterEach(() => vi.unstubAllEnvs())
async function setup() {
  const t = convexTest(schema, modules)
  const reservationId = await t.run(async ({ db }) => {
    await db.insert("users", {
      externalId: "host",
      name: "Host",
      stripeAccountId: account.id,
      stripeAccountStatus: "enabled",
    })
    await db.insert("users", {
      externalId: "renter",
      name: "Renter",
      stripeCustomerId: customer.id,
    })
    const trackId = await db.insert("tracks", {
      name: "Synthetic",
      location: "Synthetic",
      isActive: true,
    })
    const vehicleId = await db.insert("vehicles", {
      trackId,
      ownerId: "host",
      make: "Test",
      model: "Car",
      year: 2026,
      dailyRate: 1000,
      description: "Synthetic",
      amenities: [],
      addOns: [],
      isActive: true,
      isApproved: true,
      createdAt: 1,
      updatedAt: 1,
    })
    return db.insert("reservations", {
      vehicleId,
      ownerId: "host",
      renterId: "renter",
      startDate: "2031-01-01",
      endDate: "2031-01-01",
      totalDays: 1,
      dailyRate: 1000,
      totalAmount: 1000,
      quoteVersion: 1,
      status: "approved",
      createdAt: 1,
      updatedAt: 1,
    })
  })
  const revoke = () =>
    t.mutation(internal.stripeRevocations.recordVerifiedRevocation, {
      stripeAccountId: account.id,
      applicationId: "ca_bound",
      platformAccountId: "acct_platform",
      livemode: false,
      eventId: "evt_revoked",
      eventCreated: 123,
    })
  return { t, reservationId, revoke }
}

it.each([
  "createCheckoutSession",
  "createPaymentIntent",
] as const)("%s stops at a revocation during customer lookup before creating a payable object", async (method) => {
  const { t, reservationId, revoke } = await setup()
  mocks.customer.mockImplementationOnce(async () => {
    await revoke()
    return customer
  })
  await expect(
    t.withIdentity({ subject: "renter" }).action(api.stripe[method], {
      reservationId,
      amount: 1000,
    })
  ).rejects.toThrow("revoked")
  expect(mocks.checkout).not.toHaveBeenCalled()
  expect(mocks.intent).not.toHaveBeenCalled()
  expect(await t.run(({ db }) => db.query("payments").collect())).toEqual([])
})
it.each([
  "createCheckoutSession",
  "createPaymentIntent",
] as const)("%s retains a provider object created in flight but does not publish its URL/secret", async (method) => {
  const { t, reservationId, revoke } = await setup()
  const provider = method === "createCheckoutSession" ? mocks.checkout : mocks.intent
  provider.mockImplementationOnce(async () => {
    await revoke()
    return method === "createCheckoutSession" ? checkout : intent
  })
  await expect(
    t.withIdentity({ subject: "renter" }).action(api.stripe[method], {
      reservationId,
      amount: 1000,
    })
  ).rejects.toThrow("revoked")
  const rows = await t.run(({ db }) => db.query("payments").collect())
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({
    stripeAccountId: account.id,
    status: "pending",
    ...(method === "createCheckoutSession"
      ? { stripeCheckoutSessionId: checkout.id }
      : { stripePaymentIntentId: intent.id }),
  })
  expect(await t.run(({ db }) => db.get(reservationId))).toMatchObject({ status: "approved" })
})
it.each([
  "createConnectAccount",
  "createConnectLoginLink",
] as const)("%s does not publish a link if access is revoked during link creation", async (method) => {
  const { t, revoke } = await setup()
  if (method === "createConnectAccount")
    mocks.account.mockResolvedValue({ ...account, details_submitted: false })
  const provider = method === "createConnectAccount" ? mocks.link : mocks.login
  provider.mockImplementationOnce(async () => {
    await revoke()
    return { url: "https://connect.stripe.test/synthetic" }
  })
  await expect(
    t.withIdentity({ subject: "host" }).action(api.stripe[method], { ownerId: "host" })
  ).rejects.toThrow("revoked")
  expect(
    await t.run(({ db }) =>
      db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", "host"))
        .unique()
    )
  ).toMatchObject({ stripeAccountId: account.id, stripeAccountStatus: "disabled" })
})
it("acknowledges verified delayed account updates without restoring access or rereading a revoked account", async () => {
  const { t, revoke } = await setup()
  await revoke()
  await t.action(internal.stripe.reconcileConnectedAccount, { stripeAccountId: account.id })
  expect(mocks.account).not.toHaveBeenCalled()
})
it("keeps verified payout evidence auditable without granting payment access to a revoked account", async () => {
  const { t, revoke } = await setup()
  await revoke()
  await t.action(internal.stripe.reconcilePayoutFailure, {
    stripeAccountId: account.id,
    payoutId: "po_evidence",
    eventId: "evt_payout",
  })
  const audit = await t.run(({ db }) => db.query("auditLogs").collect())
  expect(audit.filter((row) => row.action === "stripe_payout_failed")).toHaveLength(1)
  await expect(
    t
      .withIdentity({ subject: "host" })
      .action(api.stripe.createConnectLoginLink, { ownerId: "host" })
  ).rejects.toThrow("revoked")
  expect(mocks.login).not.toHaveBeenCalled()
})

it.each([
  "createCheckoutSession",
  "createPaymentIntent",
] as const)("%s stops if the listing becomes inactive during customer lookup", async (method) => {
  const { t, reservationId } = await setup()
  const reservation = await t.run(({ db }) => db.get(reservationId))
  if (!reservation) throw new Error("Missing synthetic reservation")
  mocks.customer.mockImplementationOnce(async () => {
    await t.run(({ db }) => db.patch(reservation.vehicleId, { isActive: false }))
    return customer
  })
  await expect(
    t
      .withIdentity({ subject: "renter" })
      .action(api.stripe[method], { reservationId, amount: 1000 })
  ).rejects.toThrow("no longer accepting rental requests or payments")
  expect(mocks.checkout).not.toHaveBeenCalled()
  expect(mocks.intent).not.toHaveBeenCalled()
  expect(await t.run(({ db }) => db.query("payments").collect())).toEqual([])
})

it.each([
  "createCheckoutSession",
  "createPaymentIntent",
] as const)("%s retains in-flight provider history but withholds access after deactivation", async (method) => {
  const { t, reservationId } = await setup()
  const reservation = await t.run(({ db }) => db.get(reservationId))
  if (!reservation) throw new Error("Missing synthetic reservation")
  const provider = method === "createCheckoutSession" ? mocks.checkout : mocks.intent
  provider.mockImplementationOnce(async () => {
    await t.run(({ db }) => db.patch(reservation.vehicleId, { isActive: false }))
    return method === "createCheckoutSession" ? checkout : intent
  })
  await expect(
    t
      .withIdentity({ subject: "renter" })
      .action(api.stripe[method], { reservationId, amount: 1000 })
  ).rejects.toThrow("no longer accepting rental requests or payments")
  expect(await t.run(({ db }) => db.query("payments").collect())).toMatchObject([
    {
      status: "pending",
      ...(method === "createCheckoutSession"
        ? { stripeCheckoutSessionId: checkout.id }
        : { stripePaymentIntentId: intent.id }),
    },
  ])
  expect(await t.run(({ db }) => db.get(reservationId))).toMatchObject({ status: "approved" })
})

it.each([
  "createCheckoutSession",
  "createPaymentIntent",
] as const)("%s rechecks lifecycle after the operation wrapper completes", async (method) => {
  const { t, reservationId } = await setup()
  const reservation = await t.run(({ db }) => db.get(reservationId))
  if (!reservation) throw new Error("Missing synthetic reservation")
  mocks.afterOperation.mockImplementationOnce(() =>
    t.run(({ db }) => db.patch(reservation.vehicleId, { isActive: false }))
  )
  await expect(
    t
      .withIdentity({ subject: "renter" })
      .action(api.stripe[method], { reservationId, amount: 1000 })
  ).rejects.toThrow("no longer accepting rental requests or payments")
  expect(await t.run(({ db }) => db.query("payments").collect())).toHaveLength(1)
  expect(await t.run(({ db }) => db.get(reservationId))).toMatchObject({ status: "approved" })
})
