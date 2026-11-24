// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"

const { checkout, email } = vi.hoisted(() => ({ checkout: vi.fn(), email: vi.fn() }))
vi.mock("./r2", () => ({ r2: {} }))
vi.mock("./emails", async (original) => ({
  ...(await original<typeof import("./emails")>()),
  sendTransactionalEmail: email,
}))
vi.mock("stripe", () => ({
  default: class {
    accounts = {
      retrieve: async () => ({
        type: "express",
        metadata: { renegadeUserId: "owner" },
        charges_enabled: true,
      }),
    }
    checkout = { sessions: { create: checkout } }
  },
}))
const modules = (
  import.meta as unknown as { glob: (s: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_damage")
  vi.stubEnv("WEB_URL", "https://renegaderace.test")
})
afterEach(() => vi.unstubAllEnvs())
const event = {
  stripeAccountId: "acct_owner",
  applicationId: "ca_test",
  platformAccountId: "acct_platform",
  livemode: false,
  eventId: "evt_damage",
  eventCreated: 1,
}
async function setup() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async ({ db }) => {
    await db.insert("users", { externalId: "owner", name: "Owner", stripeAccountId: "acct_owner" })
    await db.insert("users", { externalId: "renter", name: "Renter", email: "renter@example.test" })
    const trackId = await db.insert("tracks", {
      name: "Synthetic",
      location: "Test",
      isActive: true,
    })
    const vehicleId = await db.insert("vehicles", {
      trackId,
      ownerId: "owner",
      make: "Test",
      model: "Test",
      year: 2020,
      dailyRate: 1000,
      description: "Synthetic",
      amenities: [],
      addOns: [],
      isActive: true,
      isApproved: true,
      createdAt: 1,
      updatedAt: 1,
    })
    const reservationId = await db.insert("reservations", {
      vehicleId,
      ownerId: "owner",
      renterId: "renter",
      status: "completed",
      startDate: "2030-01-01",
      endDate: "2030-01-01",
      totalDays: 1,
      dailyRate: 1000,
      totalAmount: 1000,
      createdAt: 1,
      updatedAt: 1,
    })
    const completionId = await db.insert("rentalCompletions", {
      reservationId,
      vehicleId,
      ownerId: "owner",
      renterId: "renter",
      status: "completed",
      createdAt: 1,
      updatedAt: 1,
    })
    const invoiceId = await db.insert("damageInvoices", {
      reservationId,
      completionId,
      vehicleId,
      ownerId: "owner",
      renterId: "renter",
      amount: 1000,
      description: "Synthetic damage",
      photos: [],
      status: "pending_review",
      createdAt: 1,
      updatedAt: 1,
    })
    return { invoiceId, reservationId }
  })
  return { t, ...ids }
}

it("preserves a raced provider checkout but sends and exposes no damage payment URL", async () => {
  const { t, invoiceId, reservationId } = await setup()
  checkout.mockImplementationOnce(async () => {
    await t.mutation(internal.stripeRevocations.recordVerifiedRevocation, event)
    return {
      id: "cs_damage",
      url: "https://checkout.stripe.test/held",
      payment_intent: "pi_damage",
    }
  })
  const admin = t.withIdentity({ subject: "admin", metadata: { role: "admin" } })
  await expect(
    admin.action(api.damageInvoices.adminApprove, { damageInvoiceId: invoiceId })
  ).rejects.toThrow("revoked")
  expect(await t.run(({ db }) => db.get(invoiceId))).toMatchObject({
    stripeCheckoutSessionId: "cs_damage",
    stripePaymentIntentId: "pi_damage",
    stripeCheckoutUrl: "https://checkout.stripe.test/held",
  })
  const renter = t.withIdentity({ subject: "renter" })
  expect(
    (await renter.query(api.damageInvoices.getById, { id: invoiceId }))?.stripeCheckoutUrl
  ).toBeUndefined()
  expect(
    (await renter.query(api.damageInvoices.getByUser, { userId: "renter" }))[0]?.stripeCheckoutUrl
  ).toBeUndefined()
  expect(
    (await renter.query(api.damageInvoices.getByReservation, { reservationId }))[0]
      ?.stripeCheckoutUrl
  ).toBeUndefined()
  expect(email).not.toHaveBeenCalled()
})

it("checks the revocation barrier atomically before enqueuing a payment email", async () => {
  const { t } = await setup()
  await t.mutation(internal.stripeRevocations.recordVerifiedRevocation, event)
  await expect(
    t.mutation(internal.damageInvoices.sendDamageEmail, {
      stripeAccountId: "acct_owner",
      to: "renter@example.test",
      subject: "Pay",
      html: "Held",
      text: "Held",
    })
  ).rejects.toThrow("revoked")
  expect(email).not.toHaveBeenCalled()
})
