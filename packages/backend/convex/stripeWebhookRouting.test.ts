// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import Stripe from "stripe"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import stripeSchema from "../node_modules/@convex-dev/stripe/dist/component/schema.js"
import { components } from "./_generated/api"
import schema from "./schema"
import {
  CONNECT_WEBHOOK_EVENTS,
  PLATFORM_WEBHOOK_EVENTS,
  STRIPE_WEBHOOK_ROUTES,
} from "./stripeWebhookRouting"

const { providerFetch } = vi.hoisted(() => ({ providerFetch: vi.fn<typeof fetch>() }))
vi.mock("stripe", async (original) => {
  const { default: ActualStripe } = await original<typeof import("stripe")>()
  return {
    default: class extends ActualStripe {
      constructor(key: string, options?: Stripe.StripeConfig) {
        super(key, {
          ...options,
          maxNetworkRetries: 0,
          httpClient: ActualStripe.createFetchHttpClient(providerFetch),
        })
      }
    },
  }
})
vi.mock("./r2", () => ({ r2: {} }))
const modules = (
  import.meta as unknown as { glob: (pattern: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
const stripeModules = (
  import.meta as unknown as { glob: (pattern: string) => Record<string, () => Promise<unknown>> }
).glob("../node_modules/@convex-dev/stripe/src/component/**/*.ts")
const platformSecret = "whsec_platform_fixture"
const legacySecret = "whsec_legacy_fixture"
const connectSecret = "whsec_connect_fixture"
const client = new Stripe("sk_test_routing_fixture")
const secrets = { platform: platformSecret, legacyConnect: legacySecret, connect: connectSecret }
const confirmedEvents = new Map<string, unknown>()
let account = {
  id: "acct_host",
  object: "account",
  type: "express",
  details_submitted: true,
  charges_enabled: true,
  payouts_enabled: true,
  metadata: { renegadeUserId: "host" },
  requirements: {
    currently_due: [] as string[],
    past_due: [] as string[],
    disabled_reason: null as string | null,
  },
}
let invoiceFailures = 0
const keyFor = (id: string, accountId?: string) => `${accountId ?? "platform"}/${id}`
beforeEach(() => {
  confirmedEvents.clear()
  invoiceFailures = 0
  account = {
    ...account,
    id: "acct_host",
    charges_enabled: true,
    payouts_enabled: true,
    metadata: { renegadeUserId: "host" },
  }
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_routing_fixture")
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", legacySecret)
  vi.stubEnv("STRIPE_PLATFORM_WEBHOOK_SECRET", platformSecret)
  vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", connectSecret)
  providerFetch.mockReset().mockImplementation((input, init) => {
    const path = new URL(String(input)).pathname
    const headers = new Headers(init?.headers)
    const goodKey = headers.get("authorization") === "Bearer sk_test_routing_fixture"
    if (path.startsWith("/v1/events/")) {
      const id = decodeURIComponent(path.slice("/v1/events/".length))
      const storedEvent = goodKey
        ? confirmedEvents.get(keyFor(id, headers.get("stripe-account") ?? undefined))
        : null
      return Promise.resolve(
        Response.json(
          storedEvent ?? { error: { type: "invalid_request_error", message: "No such event" } },
          { status: storedEvent ? 200 : 404 }
        )
      )
    }
    if (path === "/v1/accounts/acct_host") return Promise.resolve(Response.json(account))
    if (path === "/v1/invoices/in_probe") {
      if (invoiceFailures-- > 0)
        return Promise.resolve(
          Response.json({ error: { message: "Temporary provider outage" } }, { status: 503 })
        )
      return Promise.resolve(Response.json({ id: "in_probe", object: "invoice", parent: null }))
    }
    throw new Error(`Unexpected provider read: ${path}`)
  })
})
afterEach(() => vi.unstubAllEnvs())
async function setup() {
  const t = convexTest(schema, modules)
  t.registerComponent("stripe", stripeSchema, stripeModules)
  const userId = await t.run(({ db }) =>
    db.insert("users", {
      externalId: "host",
      name: "Synthetic host",
      stripeAccountId: "acct_host",
      stripeAccountStatus: "restricted",
    })
  )
  const state = () =>
    t.run(async (ctx) => ({
      user: await ctx.db.get(userId),
      receipts: await ctx.db.query("webhookEvents").collect(),
      payments: await ctx.db.query("payments").collect(),
      audit: await ctx.db.query("auditLogs").collect(),
      cache: await ctx.runQuery(components.stripe.public.listPayments, {
        stripeCustomerId: "cus_proof",
      }),
    }))
  return { t, state }
}
type EventFixture = {
  id: string
  object: string
  type: string
  livemode: boolean
  api_version: string
  account?: string
  data: { object: { id: string; object: string; [key: string]: unknown } }
}
function event(id = "evt_proof", overrides: Record<string, unknown> = {}): EventFixture {
  return {
    id,
    object: "event",
    livemode: false,
    api_version: "2025-08-27.basil",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_proof",
        object: "payment_intent",
        customer: "cus_proof",
        amount: 100,
        currency: "usd",
        status: "succeeded",
        created: 1,
        metadata: { type: "routing_proof" },
      },
    },
    ...overrides,
  }
}
async function post(
  t: Awaited<ReturnType<typeof setup>>["t"],
  route: keyof typeof STRIPE_WEBHOOK_ROUTES,
  body: ReturnType<typeof event>,
  options: {
    secret?: string
    canonical?: ReturnType<typeof event>
    retain?: boolean
    timestamp?: number
  } = {}
) {
  const canonical = options.canonical ?? body
  if (options.retain !== false)
    confirmedEvents.set(keyFor(body.id, canonical.account as string | undefined), canonical)
  const payload = JSON.stringify(body)
  const signature = await client.webhooks.generateTestHeaderStringAsync({
    payload,
    secret: options.secret ?? secrets[route],
    timestamp: options.timestamp,
    cryptoProvider: Stripe.createSubtleCryptoProvider(),
  })
  return t.fetch(STRIPE_WEBHOOK_ROUTES[route].path, {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: payload,
  })
}
it("routes provider-bound platform success into its own receipt/cache once, preserving duplicate handling", async () => {
  const { t, state } = await setup()
  expect((await post(t, "platform", event())).status).toBe(200)
  expect((await post(t, "platform", event())).status).toBe(200)
  const result = await state()
  expect(result.receipts).toHaveLength(1)
  expect(result.cache).toHaveLength(1)
  expect(result.payments).toEqual([])
})
it.each([
  "platform",
  "legacyConnect",
  "connect",
] as const)("rejects cross-endpoint secrets on %s before any provider or database effects", async (route) => {
  const { t, state } = await setup()
  const before = await state()
  const body = route === "platform" ? event() : event("evt_connect", { account: "acct_host" })
  const wrongSecret = route === "platform" ? legacySecret : platformSecret
  expect((await post(t, route, body, { secret: wrongSecret })).status).toBe(400)
  expect(providerFetch).not.toHaveBeenCalled()
  expect(await state()).toEqual(before)
})
it.each([
  { route: "platform", change: { account: "acct_host" } },
  { route: "platform", change: { livemode: true } },
  { route: "platform", change: { api_version: "2026-11-18.preview" } },
  { route: "platform", change: { api_version: null } },
  { route: "platform", change: { livemode: undefined } },
  { route: "connect", change: {} },
  { route: "connect", change: { account: "ba_bank" } },
] as const)("rejects wrong scope/mode/version $route $change before effects", async ({
  route,
  change,
}) => {
  const { t, state } = await setup()
  const before = await state()
  expect((await post(t, route, event("evt_invalid", change))).status).toBe(400)
  expect(providerFetch).not.toHaveBeenCalled()
  expect(await state()).toEqual(before)
})
it("does not accept a correctly signed event paired with another same-mode provider key", async () => {
  const { t, state } = await setup()
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_wrong_account")
  expect((await post(t, "platform", event())).status).toBe(500)
  expect((await state()).receipts).toEqual([])
  expect((await state()).cache).toEqual([])
})
it("retries a provider lookup failure without prematurely recording a receipt", async () => {
  const { t, state } = await setup()
  expect((await post(t, "platform", event(), { retain: false })).status).toBe(500)
  expect((await state()).receipts).toEqual([])
  expect((await post(t, "platform", event())).status).toBe(200)
  expect((await state()).receipts).toHaveLength(1)
})
it.each([
  "id",
  "type",
  "account",
  "object",
  "livemode",
])("rejects canonical provider event mismatch in %s", async (field) => {
  const { t, state } = await setup()
  const body = event()
  const canonical = event()
  if (field === "id") canonical.id = "evt_other"
  if (field === "type") canonical.type = "payment_intent.payment_failed"
  if (field === "account") Object.assign(canonical, { account: "acct_other" })
  if (field === "object") canonical.data.object.id = "pi_other"
  if (field === "livemode") canonical.livemode = true
  // Map the delivery namespace explicitly, even when the canonical envelope is wrong.
  confirmedEvents.set(keyFor(body.id), canonical)
  expect((await post(t, "platform", body, { retain: false })).status).toBe(400)
  expect((await state()).receipts).toEqual([])
  expect((await state()).cache).toEqual([])
})
it("uses provider-confirmed data while accepting independently supported original/destination API versions", async () => {
  const { t, state } = await setup()
  const canonical = event()
  const delivered = event("evt_proof", { api_version: "2022-11-15" })
  delivered.data.object.amount = 1
  expect((await post(t, "platform", delivered, { canonical })).status).toBe(200)
  expect((await state()).cache[0]?.amount).toBe(100)
})
it.each([
  "legacyConnect",
  "connect",
] as const)("acknowledges preserved foreign payment/deauthorized deliveries on %s without any platform state/cache writes", async (route) => {
  const { t, state } = await setup()
  const before = await state()
  for (const type of [
    "payment_intent.succeeded",
    "checkout.session.completed",
    "charge.refunded",
    "account.application.deauthorized",
    "transfer.failed",
  ]) {
    expect(
      (await post(t, route, event(`evt_ignore_${type}`, { type, account: "acct_host" }))).status
    ).toBe(200)
  }
  expect(providerFetch).not.toHaveBeenCalled()
  expect(await state()).toEqual(before)
})
it("keeps legacy Connect functioning when additive route secrets are absent, with no fallback on new routes", async () => {
  const { t, state } = await setup()
  vi.stubEnv("STRIPE_PLATFORM_WEBHOOK_SECRET", "")
  vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "")
  const body = event("evt_account", {
    account: "acct_host",
    type: "account.updated",
    api_version: "2022-11-15",
    data: { object: account },
  })
  const response = await post(t, "legacyConnect", body)
  expect(response.status, await response.text()).toBe(200)
  expect((await state()).user?.stripeAccountStatus).toBe("enabled")
  expect((await post(t, "platform", event())).status).toBe(500)
  expect((await post(t, "connect", body)).status).toBe(500)
})
it("requires event/account equality and uses current provider status rather than an old enabled snapshot", async () => {
  const { t, state } = await setup()
  const old = { ...account }
  account = { ...account, charges_enabled: false }
  const body = event("evt_account", {
    account: "acct_host",
    type: "account.updated",
    data: { object: old },
  })
  expect((await post(t, "connect", body)).status).toBe(200)
  expect((await state()).user?.stripeAccountStatus).toBe("pending")
  const before = await state()
  expect(
    (
      await post(
        t,
        "connect",
        event("evt_mismatch", {
          account: "acct_other",
          type: "account.updated",
          data: { object: old },
        })
      )
    ).status
  ).toBe(400)
  expect(await state()).toEqual(before)
  expect(
    providerFetch.mock.calls.some(
      ([, init]) => new Headers(init?.headers).get("stripe-account") === "acct_host"
    )
  ).toBe(true)
})
it("does not resume a legacy account whose provider ownership is unverified", async () => {
  const { t, state } = await setup()
  account = { ...account, metadata: { renegadeUserId: "other" } }
  const body = event("evt_account", {
    account: "acct_host",
    type: "account.updated",
    data: { object: account },
  })
  expect((await post(t, "connect", body)).status).toBe(500)
  expect((await state()).user?.stripeAccountStatus).toBe("restricted")
  expect((await state()).cache).toEqual([])
})
it("audits a verified payout failure against event.account, never its destination bank, once", async () => {
  const { t, state } = await setup()
  const body = event("evt_payout", {
    account: "acct_host",
    type: "payout.failed",
    data: {
      object: {
        id: "po_proof",
        object: "payout",
        destination: "ba_not_account",
        failure_message: "Synthetic failure",
      },
    },
  })
  expect((await post(t, "connect", body)).status).toBe(200)
  expect((await post(t, "connect", body)).status).toBe(200)
  const result = await state()
  expect(result.audit).toHaveLength(1)
  expect(result.audit[0]?.metadata).toMatchObject({
    stripeAccountId: "acct_host",
    payoutId: "po_proof",
  })
  expect(result.user?.stripeAccountStatus).toBe("restricted")
  expect(result.cache).toEqual([])
})
it("repairs a secondary mirror failure after custom success on the same event retry", async () => {
  const { t, state } = await setup()
  const body = event()
  Object.assign(body.data.object, { invoice: "in_probe" })
  // Fail one provider read after the authoritative custom handler has committed.
  invoiceFailures = 1
  expect((await post(t, "platform", body)).status).toBe(500)
  expect((await state()).receipts).toHaveLength(1)
  expect((await state()).cache).toEqual([])
  expect((await post(t, "platform", body)).status).toBe(200)
  expect((await state()).receipts).toHaveLength(1)
  expect((await state()).cache).toHaveLength(1)
})
it("keeps provider-supported subscription matrices explicit and omits invented or deferred callbacks", () => {
  expect(PLATFORM_WEBHOOK_EVENTS).toHaveLength(15)
  expect(CONNECT_WEBHOOK_EVENTS).toEqual(["account.updated", "payout.failed"])
  expect([...PLATFORM_WEBHOOK_EVENTS, ...CONNECT_WEBHOOK_EVENTS]).not.toContain("transfer.failed")
})

it("isolates invalid duplicate keys on additive routes without disabling legacy Connect", async () => {
  const { t, state } = await setup()
  vi.stubEnv("STRIPE_PLATFORM_WEBHOOK_SECRET", legacySecret)
  const body = event("evt_duplicate_config", {
    account: "acct_host",
    type: "account.updated",
    data: { object: account },
  })
  expect((await post(t, "platform", event(), { secret: legacySecret })).status).toBe(500)
  expect((await post(t, "legacyConnect", body)).status).toBe(200)
  expect((await state()).user?.stripeAccountStatus).toBe("enabled")
})
it.each([
  "2022-11-15",
  "2024-10-28.acacia",
  "2025-08-27.basil",
])("accepts stable payment identifiers in reviewed original version %s", async (version) => {
  const { t, state } = await setup()
  const canonical = event("evt_versions", { api_version: version })
  expect((await post(t, "platform", event("evt_versions"), { canonical })).status).toBe(200)
  expect((await state()).cache[0]?.amount).toBe(100)
})
it("rejects an expired real signature without provider reads or receipts", async () => {
  const { t, state } = await setup()
  expect(
    (await post(t, "platform", event(), { timestamp: Math.floor(Date.now() / 1000) - 601 })).status
  ).toBe(400)
  expect(providerFetch).not.toHaveBeenCalled()
  expect((await state()).receipts).toEqual([])
})
it("rejects a resource mode inconsistent with the signed envelope before effects", async () => {
  const { t, state } = await setup()
  const body = event()
  Object.assign(body.data.object, { livemode: true })
  expect((await post(t, "platform", body)).status).toBe(400)
  expect(providerFetch).not.toHaveBeenCalled()
  expect((await state()).cache).toEqual([])
})

it("rejects a signed non-event JSON value before provider or database effects", async () => {
  const { t, state } = await setup()
  const payload = "null"
  const signature = await client.webhooks.generateTestHeaderStringAsync({
    payload,
    secret: platformSecret,
    cryptoProvider: Stripe.createSubtleCryptoProvider(),
  })
  const response = await t.fetch("/stripe/platform-webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: payload,
  })
  expect(response.status).toBe(400)
  expect(providerFetch).not.toHaveBeenCalled()
  expect((await state()).receipts).toEqual([])
  expect((await state()).cache).toEqual([])
})
