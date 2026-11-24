// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import type Stripe from "stripe"
import { expect, it, vi } from "vitest"
import { internal } from "./_generated/api"
import type { ActionCtx } from "./_generated/server"
import schema from "./schema"
import {
  retrieveLinkedConnectAccount,
  retrieveLinkedConnectAccountForEvidence,
  verifiedPaymentDestination,
} from "./stripeOwnership"
import { getByAccount, recordVerifiedRevocation } from "./stripeRevocations"

vi.mock("./r2", () => ({ r2: {} }))
const modules = (
  import.meta as unknown as { glob: (s: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
const event = {
  stripeAccountId: "acct_revoked",
  applicationId: "ca_synthetic",
  platformAccountId: "acct_platform",
  livemode: false,
  eventId: "evt_revoked",
  eventCreated: 100,
}
async function setup() {
  const t = convexTest(schema, modules)
  const userId = await t.run(({ db }) =>
    db.insert("users", {
      externalId: "host",
      name: "Host",
      stripeAccountId: event.stripeAccountId,
      stripeAccountStatus: "enabled",
      stripeCustomerId: "cus_retained",
    })
  )
  return { t, userId }
}

it("keeps the verified writer and provenance lookup internal", () => {
  for (const fn of [getByAccount, recordVerifiedRevocation]) {
    expect("isInternal" in fn).toBe(true)
    expect("isPublic" in fn).toBe(false)
  }
})

it("ends disabled regardless of whether a delayed enabled write precedes or follows revocation", async () => {
  for (const revokeFirst of [false, true]) {
    const { t, userId } = await setup()
    const revoke = () => t.mutation(internal.stripeRevocations.recordVerifiedRevocation, event)
    const enable = () =>
      t.mutation(internal.users.updateStripeAccountStatus, {
        stripeAccountId: event.stripeAccountId,
        status: "enabled",
      })
    if (revokeFirst) {
      await revoke()
      await enable()
    } else {
      await enable()
      await revoke()
    }
    expect((await t.run(({ db }) => db.get(userId)))?.stripeAccountStatus).toBe("disabled")
  }
})

it("atomically disables the exact account, preserving links, other holds and financial history", async () => {
  const { t, userId } = await setup()
  const before = await t.run(async ({ db }) => {
    await db.insert("users", {
      externalId: "held",
      name: "Held",
      stripeAccountId: "acct_other",
      stripeAccountStatus: "restricted",
    })
    const invoice = await db.insert("invoices", {
      senderId: "host",
      recipientId: "renter",
      title: "Historical invoice",
      lineItems: [],
      subtotal: 1500,
      total: 1500,
      currency: "usd",
      paymentMethods: ["stripe_card"],
      status: "paid",
      createdAt: 1,
      updatedAt: 2,
    })
    return { user: await db.get(userId), invoice: await db.get(invoice), invoiceId: invoice }
  })
  expect(await t.mutation(internal.stripeRevocations.recordVerifiedRevocation, event)).toEqual({
    duplicate: false,
  })
  const after = await t.run(async ({ db }) => ({
    user: await db.get(userId),
    invoice: await db.get(before.invoiceId),
    held: await db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", "held"))
      .unique(),
    audit: await db.query("auditLogs").collect(),
  }))
  expect(after.user).toEqual({ ...before.user, stripeAccountStatus: "disabled" })
  expect(after.invoice).toEqual(before.invoice)
  expect(after.held?.stripeAccountStatus).toBe("restricted")
  expect(after.audit).toHaveLength(1)
  expect(after.audit[0]).toMatchObject({
    action: "connect_access_revoked",
    entityId: event.stripeAccountId,
  })
})

it("deduplicates permanently after receipt cleanup and retains every distinct verified event", async () => {
  const { t } = await setup()
  await t.mutation(internal.stripeRevocations.recordVerifiedRevocation, event)
  await t.run(async ({ db }) => {
    for (const receipt of await db.query("webhookEvents").collect()) await db.delete(receipt._id)
  })
  expect(await t.mutation(internal.stripeRevocations.recordVerifiedRevocation, event)).toEqual({
    duplicate: true,
  })
  await t.mutation(internal.stripeRevocations.recordVerifiedRevocation, {
    ...event,
    eventId: "evt_second",
    eventCreated: 99,
  })
  const state = await t.run(async ({ db }) => ({
    barriers: await db.query("stripeAccountRevocations").collect(),
    events: await db.query("stripeRevocationEvents").collect(),
    audit: await db.query("auditLogs").collect(),
  }))
  expect(state.barriers).toHaveLength(1)
  expect(state.barriers[0]).toMatchObject(event)
  expect(state.events).toHaveLength(2)
  expect(state.audit).toHaveLength(2)
  await expect(
    t.mutation(internal.stripeRevocations.recordVerifiedRevocation, {
      ...event,
      stripeAccountId: "acct_unrelated",
    })
  ).rejects.toThrow("binding mismatch")
  expect(
    await t.query(internal.stripeRevocations.getByAccount, { stripeAccountId: "acct_unrelated" })
  ).toBeNull()
})

it("retains unmapped and replaced-account provenance without guessing an owner", async () => {
  const { t, userId } = await setup()
  await t.run(({ db }) => db.patch(userId, { stripeAccountId: "acct_replacement" }))
  await t.mutation(internal.stripeRevocations.recordVerifiedRevocation, event)
  expect((await t.run(({ db }) => db.get(userId)))?.stripeAccountStatus).toBe("enabled")
  const saved = await t.run(({ db }) => db.query("stripeRevocationEvents").unique())
  expect(saved?.linkedUserIds).toEqual([])
  expect(
    await t.query(internal.stripeRevocations.getByAccount, {
      stripeAccountId: event.stripeAccountId,
    })
  ).toMatchObject(event)
  await expect(
    t.mutation(internal.users.setStripeAccountId, {
      userId: "host",
      stripeAccountId: event.stripeAccountId,
      replaceUnusedAccount: "acct_replacement",
    })
  ).rejects.toThrow("revoked")
})

it("cannot be re-enabled or automatically relinked by delayed status or onboarding writes", async () => {
  const { t, userId } = await setup()
  await t.mutation(internal.stripeRevocations.recordVerifiedRevocation, event)
  for (const status of ["pending", "enabled", "restricted", "disabled"] as const) {
    await t.mutation(internal.users.updateStripeAccountStatus, {
      stripeAccountId: event.stripeAccountId,
      status,
    })
    expect((await t.run(({ db }) => db.get(userId)))?.stripeAccountStatus).toBe("disabled")
  }
  for (const stripeAccountId of [event.stripeAccountId, "acct_new"]) {
    await expect(
      t.mutation(internal.users.setStripeAccountId, {
        userId: "host",
        stripeAccountId,
        replaceUnusedAccount: event.stripeAccountId,
      })
    ).rejects.toThrow("revoked")
  }
})

it("disables every exact duplicate legacy link and leaves no ambiguous account enabled", async () => {
  const { t, userId } = await setup()
  const duplicate = await t.run(({ db }) =>
    db.insert("users", {
      externalId: "duplicate",
      name: "Duplicate",
      stripeAccountId: event.stripeAccountId,
      stripeAccountStatus: "enabled",
    })
  )
  await t.mutation(internal.stripeRevocations.recordVerifiedRevocation, event)
  for (const id of [userId, duplicate]) {
    expect((await t.run(({ db }) => db.get(id)))?.stripeAccountStatus).toBe("disabled")
  }
})

it("holds a restored provider account before any onboarding, login or payment lookup", async () => {
  const { t } = await setup()
  const retrieve = vi
    .fn()
    .mockResolvedValue({ type: "express", metadata: { renegadeUserId: "host" } })
  const stripe = { accounts: { retrieve } } as unknown as Stripe
  const ctx = { runQuery: t.query } as unknown as ActionCtx
  await t.mutation(internal.stripeRevocations.recordVerifiedRevocation, event)
  for (const lookup of [retrieveLinkedConnectAccount, verifiedPaymentDestination]) {
    await expect(lookup(ctx, stripe, event.stripeAccountId, "host")).rejects.toThrow("revoked")
  }
  expect(retrieve).not.toHaveBeenCalled()
})

it("allows held account evidence reads while preserving exact owner and provider checks", async () => {
  const { t } = await setup()
  await t.mutation(internal.stripeRevocations.recordVerifiedRevocation, event)
  const retrieve = vi
    .fn()
    .mockResolvedValue({ type: "express", metadata: { renegadeUserId: "host" } })
  const stripe = { accounts: { retrieve } } as unknown as Stripe
  const ctx = { runQuery: t.query } as unknown as ActionCtx
  await expect(
    retrieveLinkedConnectAccountForEvidence(ctx, stripe, event.stripeAccountId, "host")
  ).resolves.toMatchObject({ type: "express" })
  await expect(
    retrieveLinkedConnectAccountForEvidence(ctx, stripe, event.stripeAccountId, "other")
  ).rejects.toThrow("ownership")
  retrieve.mockResolvedValue({ type: "express", metadata: { renegadeUserId: "other" } })
  await expect(
    retrieveLinkedConnectAccountForEvidence(ctx, stripe, event.stripeAccountId, "host")
  ).rejects.toThrow("ownership")
  expect(
    await t.query(internal.stripeRevocations.getByAccount, {
      stripeAccountId: event.stripeAccountId,
    })
  ).not.toBeNull()
})

it("rejects a provider result when revocation commits during its in-flight lookup", async () => {
  const { t } = await setup()
  const retrieve = vi.fn().mockImplementation(async () => {
    await t.mutation(internal.stripeRevocations.recordVerifiedRevocation, event)
    return { type: "express", metadata: { renegadeUserId: "host" } }
  })
  const stripe = { accounts: { retrieve } } as unknown as Stripe
  await expect(
    verifiedPaymentDestination(
      { runQuery: t.query } as unknown as ActionCtx,
      stripe,
      event.stripeAccountId,
      "host"
    )
  ).rejects.toThrow("revoked")
  expect(retrieve).toHaveBeenCalledTimes(1)
})
