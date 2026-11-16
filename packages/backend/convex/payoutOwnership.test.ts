// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import stripeSchema from "../node_modules/@convex-dev/stripe/dist/component/schema.js"
import { api, components, internal } from "./_generated/api"
import schema from "./schema"
import * as users from "./users"

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  create: vi.fn(),
  login: vi.fn(),
  link: vi.fn(),
  customer: vi.fn(),
  methods: vi.fn(),
  invoices: vi.fn(),
  balance: vi.fn(),
  transactions: vi.fn(),
  transfers: vi.fn(),
}))
vi.mock("./r2", () => ({ r2: {} }))
vi.mock("stripe", () => ({
  default: class {
    accounts = { retrieve: mocks.account, create: mocks.create, createLoginLink: mocks.login }
    accountLinks = { create: mocks.link }
    customers = { retrieve: mocks.customer }
    paymentMethods = { list: mocks.methods }
    invoices = { list: mocks.invoices }
    balance = { retrieve: mocks.balance }
    balanceTransactions = { list: mocks.transactions }
    transfers = { list: mocks.transfers }
  },
}))
const modules = (
  import.meta as unknown as { glob: (s: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
const stripeModules = (
  import.meta as unknown as { glob: (s: string) => Record<string, () => Promise<unknown>> }
).glob("../node_modules/@convex-dev/stripe/src/component/**/*.ts")
const tagged = {
  id: "acct_host",
  type: "express",
  details_submitted: false,
  payouts_enabled: false,
  charges_enabled: false,
  external_accounts: { data: [], has_more: false },
  metadata: { renegadeUserId: "host" },
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_ownership")
  vi.stubEnv("WEB_URL", "https://renegaderace.test")
  mocks.account.mockResolvedValue(tagged)
  mocks.create.mockResolvedValue(tagged)
  mocks.link.mockResolvedValue({ url: "https://connect.stripe.test/onboarding" })
  mocks.login.mockResolvedValue({ url: "https://connect.stripe.test/login" })
  mocks.balance.mockResolvedValue({ available: [{ amount: 0 }], pending: [{ amount: 0 }] })
  mocks.transactions.mockResolvedValue({ data: [] })
  mocks.transfers.mockResolvedValue({ data: [] })
})
afterEach(() => vi.unstubAllEnvs())

async function setup(account?: string, customer?: string) {
  const t = convexTest(schema, modules)
  const id = await t.run(({ db }) =>
    db.insert("users", {
      externalId: "host",
      name: "Host",
      email: "mutable@example.test",
      ...(account ? { stripeAccountId: account, stripeAccountStatus: "pending" as const } : {}),
      stripeCustomerId: customer,
    })
  )
  const host = t.withIdentity({ subject: "host", email: "verified@example.test" })
  const other = t.withIdentity({ subject: "other" })
  return { t, host, other, id }
}

describe("Stripe ownership", () => {
  it("keeps identifier writers and full account lookup internal and prevents rebinding", async () => {
    for (const fn of [
      users.setStripeAccountId,
      users.setStripeCustomerId,
      users.getByStripeAccountId,
    ]) {
      expect("isInternal" in fn).toBe(true)
      expect("isPublic" in fn).toBe(false)
    }
    const { t } = await setup()
    await t.run(({ db }) => db.insert("users", { externalId: "other", name: "Other" }))
    for (const userId of ["host", "host"]) {
      await t.mutation(internal.users.setStripeAccountId, { userId, stripeAccountId: "acct_host" })
      await t.mutation(internal.users.setStripeCustomerId, { userId, stripeCustomerId: "cus_host" })
    }
    await expect(
      t.mutation(internal.users.setStripeAccountId, {
        userId: "other",
        stripeAccountId: "acct_host",
      })
    ).rejects.toThrow("already linked")
    await expect(
      t.mutation(internal.users.setStripeCustomerId, {
        userId: "other",
        stripeCustomerId: "cus_host",
      })
    ).rejects.toThrow("already linked")
    await expect(
      t.mutation(internal.users.setStripeAccountId, {
        userId: "host",
        stripeAccountId: "acct_other",
      })
    ).rejects.toThrow("has changed")
    await expect(
      t.mutation(internal.users.setStripeCustomerId, {
        userId: "host",
        stripeCustomerId: "cus_other",
      })
    ).rejects.toThrow("already linked")
  })

  it.each([
    "createConnectAccount",
    "getConnectAccountStatus",
    "refreshConnectAccountStatus",
    "createConnectLoginLink",
  ] as const)("%s rejects anonymous and other-user targets before Stripe", async (method) => {
    const { t, other } = await setup("acct_host")
    await expect(t.action(api.stripe[method], { ownerId: "host" })).rejects.toThrow(
      "Not authorized"
    )
    await expect(other.action(api.stripe[method], { ownerId: "host" })).rejects.toThrow(
      "Not authorized"
    )
    expect(mocks.account).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it("binds the server-created account to the Clerk subject and resumes the same account", async () => {
    const { t, host, id } = await setup()
    const result = await host.action(api.stripe.createConnectAccount, { ownerId: "host" })
    expect(result).toMatchObject({ accountId: "acct_host", isComplete: false })
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "verified@example.test",
        metadata: { renegadeUserId: "host" },
      }),
      { idempotencyKey: "renegade_connect_host_new" }
    )
    expect((await t.run(({ db }) => db.get(id)))?.stripeAccountId).toBe("acct_host")
    await host.action(api.stripe.createConnectAccount, { ownerId: "host" })
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.link).toHaveBeenCalledTimes(2)
    await host.action(api.stripe.createConnectLoginLink, { ownerId: "host" })
    expect(mocks.login).toHaveBeenCalledWith("acct_host")
  })

  it("preserves unique untagged legacy status and uses authenticated Express sign-in", async () => {
    const { host } = await setup("acct_host")
    mocks.account.mockResolvedValue({
      ...tagged,
      metadata: {},
      details_submitted: true,
      payouts_enabled: true,
      charges_enabled: true,
    })
    expect(
      await host.action(api.stripe.getConnectAccountStatus, { ownerId: "host" })
    ).toMatchObject({ hasAccount: true, isComplete: true })
    expect(
      await host.action(api.stripe.refreshConnectAccountStatus, { ownerId: "host" })
    ).toMatchObject({ success: true, status: "enabled" })
    expect(await host.action(api.stripe.createConnectLoginLink, { ownerId: "host" })).toEqual({
      url: "https://connect.stripe.com/express_login",
    })
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it("restarts only unused legacy onboarding without issuing access to the old account", async () => {
    const { host, t, id } = await setup("acct_old")
    mocks.account.mockResolvedValue({ ...tagged, id: "acct_old", metadata: {} })
    mocks.transactions.mockResolvedValueOnce({ data: [{ id: "txn_history" }] })
    await expect(host.action(api.stripe.createConnectAccount, { ownerId: "host" })).rejects.toThrow(
      "Contact support"
    )
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.link).not.toHaveBeenCalled()
    expect((await t.run(({ db }) => db.get(id)))?.stripeAccountId).toBe("acct_old")
    await host.action(api.stripe.createConnectAccount, { ownerId: "host" })
    expect(mocks.link).toHaveBeenCalledWith(
      expect.objectContaining({ account: "acct_host" }),
      expect.anything()
    )
    expect((await t.run(({ db }) => db.get(id)))?.stripeAccountId).toBe("acct_host")
  })

  it("rejects an account owned by another subject and duplicate legacy pointers", async () => {
    const { host, t } = await setup("acct_host")
    mocks.account.mockResolvedValue({ ...tagged, metadata: { renegadeUserId: "other" } })
    await expect(
      host.action(api.stripe.createConnectLoginLink, { ownerId: "host" })
    ).rejects.toThrow("ownership")
    await expect(host.action(api.stripe.createConnectAccount, { ownerId: "host" })).rejects.toThrow(
      "ownership"
    )
    await t.run(({ db }) =>
      db.insert("users", { externalId: "other", name: "Other", stripeAccountId: "acct_host" })
    )
    mocks.account.mockResolvedValue({ ...tagged, metadata: {} })
    await expect(
      host.action(api.stripe.getConnectAccountStatus, { ownerId: "host" })
    ).rejects.toThrow()
    expect(mocks.link).not.toHaveBeenCalled()
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it("does not bind a customer suggested by payment metadata to another user", async () => {
    const { host, t, id } = await setup()
    t.registerComponent("stripe", stripeSchema, stripeModules)
    await t.run((ctx) =>
      ctx.runMutation(components.stripe.private.handlePaymentIntentSucceeded, {
        stripePaymentIntentId: "pi_other",
        stripeCustomerId: "cus_other",
        amount: 1000,
        currency: "usd",
        status: "succeeded",
        created: 1,
        metadata: { userId: "host" },
      })
    )
    mocks.customer.mockResolvedValue({ id: "cus_other", metadata: { userId: "other" } })
    await expect(
      host.action(api.stripe.createCustomerPortalSession, {
        returnUrl: "https://renegaderace.test/settings",
      })
    ).rejects.toThrow("ownership")
    expect((await t.run(({ db }) => db.get(id)))?.stripeCustomerId).toBeUndefined()
  })

  it("rejects forgery before disclosing billing or opening a portal, preserves a genuine legacy customer", async () => {
    const { host, t } = await setup(undefined, "cus_existing")
    mocks.customer.mockResolvedValue({ id: "cus_existing", metadata: { userId: "other" } })
    for (const method of [
      "getCustomerDetails",
      "getCustomerInvoices",
      "getCustomerPaymentMethods",
    ] as const) {
      await expect(t.action(api.stripe[method], { customerId: "cus_existing" })).rejects.toThrow(
        "AUTH_REQUIRED"
      )
      await expect(host.action(api.stripe[method], { customerId: "cus_other" })).rejects.toThrow(
        "Not authorized"
      )
      await expect(host.action(api.stripe[method], { customerId: "cus_existing" })).rejects.toThrow(
        "ownership"
      )
    }
    await expect(
      host.action(api.stripe.createCustomerPortalSession, {
        returnUrl: "https://renegaderace.test/settings",
      })
    ).rejects.toThrow("ownership")
    expect(mocks.methods).not.toHaveBeenCalled()
    expect(mocks.invoices).not.toHaveBeenCalled()
    mocks.customer.mockResolvedValue({
      id: "cus_existing",
      metadata: { userId: "host" },
      email: "host@example.test",
    })
    expect(
      await host.action(api.stripe.getCustomerDetails, { customerId: "cus_existing" })
    ).toMatchObject({ id: "cus_existing", email: "host@example.test" })
  })
})
