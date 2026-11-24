// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import Stripe from "stripe"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import stripeSchema from "../node_modules/@convex-dev/stripe/dist/component/schema.js"
import { components } from "./_generated/api"
import schema from "./schema"
import { STRIPE_REVOCATION_WEBHOOK_PATH } from "./stripeRevocationRouting"

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
const secret = "whsec_revocationFixture"
const client = new Stripe("sk_test_revocationFixture")
const path = STRIPE_REVOCATION_WEBHOOK_PATH
let binding: {
  platformAccountId: string
  applicationId: string
  webhookEndpointId: string
  secretSha256: string
}
let endpoint: Record<string, unknown>
let platformId: string
let providerError: number | undefined

beforeEach(async () => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_revocationFixture")
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_legacyFixture")
  vi.stubEnv("STRIPE_PLATFORM_WEBHOOK_SECRET", "whsec_platformFixture")
  vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_connectFixture")
  vi.stubEnv("STRIPE_CONNECT_REVOCATION_WEBHOOK_SECRET", secret)
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret))
  binding = {
    platformAccountId: "acct_platform",
    applicationId: "ca_reviewedApplication",
    webhookEndpointId: "we_revocation",
    secretSha256: Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join(
      ""
    ),
  }
  vi.stubEnv("STRIPE_CONNECT_REVOCATION_BINDING", JSON.stringify(binding))
  platformId = binding.platformAccountId
  endpoint = {
    id: binding.webhookEndpointId,
    object: "webhook_endpoint",
    application: binding.applicationId,
    url: `https://some.convex.site${path}`,
    status: "enabled",
    livemode: false,
    api_version: "2025-08-27.basil",
    enabled_events: ["account.application.deauthorized"],
  }
  providerError = undefined
  providerFetch.mockReset().mockImplementation((input, init) => {
    const headers = new Headers(init?.headers)
    if (
      headers.get("authorization") !== "Bearer sk_test_revocationFixture" ||
      headers.has("stripe-account")
    )
      throw new Error("Unexpected provider credential or connected-account context")
    const resource = new URL(String(input)).pathname
    if (providerError)
      return Promise.resolve(
        Response.json({ error: { message: "Unavailable" } }, { status: providerError })
      )
    if (resource === "/v1/account")
      return Promise.resolve(Response.json({ id: platformId, object: "account" }))
    if (resource === `/v1/webhook_endpoints/${binding.webhookEndpointId}`)
      return Promise.resolve(Response.json(endpoint))
    throw new Error(`Unexpected provider read: ${resource}`)
  })
})
afterEach(() => vi.unstubAllEnvs())

async function setup() {
  const t = convexTest(schema, modules)
  t.registerComponent("stripe", stripeSchema, stripeModules)
  await t.run(async ({ db }) => {
    for (const [externalId, stripeAccountId] of [
      ["host", "acct_revoked"],
      ["unrelated", "acct_unrelated"],
    ]) {
      await db.insert("users", {
        externalId,
        name: `Synthetic ${externalId}`,
        stripeAccountId,
        stripeAccountStatus: "enabled",
      })
    }
  })
  const state = () =>
    t.run(async (ctx) => ({
      users: await ctx.db.query("users").collect(),
      revocations: await ctx.db.query("stripeAccountRevocations").collect(),
      events: await ctx.db.query("stripeRevocationEvents").collect(),
      receipts: await ctx.db.query("webhookEvents").collect(),
      audit: await ctx.db.query("auditLogs").collect(),
      payments: await ctx.db.query("payments").collect(),
      cache: await ctx.runQuery(components.stripe.public.listPayments, {
        stripeCustomerId: "cus_revocationProof",
      }),
    }))
  return { t, state }
}
function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_revocation",
    object: "event",
    type: "account.application.deauthorized",
    account: "acct_revoked",
    created: 1_700_000_000,
    livemode: false,
    api_version: "2025-08-27.basil",
    data: { object: { id: binding.applicationId, object: "application" } },
    ...overrides,
  }
}
async function post(
  t: Awaited<ReturnType<typeof setup>>["t"],
  body = event(),
  options: { signedBody?: ReturnType<typeof event>; secret?: string; timestamp?: number } = {}
) {
  const signature = await client.webhooks.generateTestHeaderStringAsync({
    payload: JSON.stringify(options.signedBody ?? body),
    secret: options.secret ?? secret,
    timestamp: options.timestamp,
    cryptoProvider: Stripe.createSubtleCryptoProvider(),
  })
  return t.fetch(path, {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: JSON.stringify(body),
  })
}

it("records signed application-bound revocation without accessing the revoked account/event store", async () => {
  const { t, state } = await setup()
  expect((await post(t)).status).toBe(200)
  const result = await state()
  expect(result.users.map((u) => [u.externalId, u.stripeAccountStatus])).toEqual([
    ["host", "disabled"],
    ["unrelated", "enabled"],
  ])
  expect(result.revocations).toHaveLength(1)
  expect(result.events).toHaveLength(1)
  expect(result.events[0]).toMatchObject({
    stripeAccountId: "acct_revoked",
    applicationId: binding.applicationId,
    platformAccountId: binding.platformAccountId,
    livemode: false,
    eventCreated: 1_700_000_000,
  })
  expect(result.audit).toHaveLength(1)
  expect(result.receipts).toHaveLength(1)
  expect(result.payments).toEqual([])
  expect(result.cache).toEqual([])
  expect(providerFetch).toHaveBeenCalledTimes(2)
  for (const [, init] of providerFetch.mock.calls) {
    const headers = new Headers(init?.headers)
    expect(headers.get("authorization")).toBe("Bearer sk_test_revocationFixture")
    expect(headers.has("stripe-account")).toBe(false)
  }
})

it("acknowledges duplicates and delayed distinct events without clearing or multiplying the hold", async () => {
  const { t, state } = await setup()
  expect((await post(t)).status).toBe(200)
  const first = await state()
  expect((await post(t)).status).toBe(200)
  expect(await state()).toEqual(first)
  expect((await post(t, event({ id: "evt_delayed", created: 1_600_000_000 }))).status).toBe(200)
  const delayed = await state()
  expect(delayed.revocations).toEqual(first.revocations)
  expect(delayed.events).toHaveLength(2)
  expect(delayed.users).toEqual(first.users)
})

it("keeps signed unmapped account provenance without disabling a different linked account", async () => {
  const { t, state } = await setup()
  const before = await state()
  expect((await post(t, event({ account: "acct_unmapped" }))).status).toBe(200)
  const result = await state()
  expect(result.users).toEqual(before.users)
  expect(result.revocations[0].stripeAccountId).toBe("acct_unmapped")
  expect(result.events[0].linkedUserIds).toEqual([])
})

it.each([
  { label: "wrong secret", options: { secret: "whsec_different" } },
  { label: "expired signature", options: { timestamp: 1 } },
  { label: "tampered account", options: { signedBody: undefined } },
])("rejects $label before provider or database effects", async ({ label, options }) => {
  const { t, state } = await setup()
  const before = await state()
  const body = event()
  const actual = label === "tampered account" ? event({ account: "acct_unrelated" }) : body
  expect((await post(t, actual, { ...options, signedBody: body })).status).toBe(400)
  expect(providerFetch).not.toHaveBeenCalled()
  expect(await state()).toEqual(before)
})

it.each([
  { account: undefined },
  { account: "cus_wrong" },
  { livemode: true },
  { livemode: undefined },
  { object: "account" },
  { id: "pi_wrong" },
  { type: "account.updated" },
  { api_version: "2026-11-18.preview" },
  { api_version: null },
  { created: -1 },
  { created: 1.5 },
  { data: { object: { id: "ca_other", object: "application" } } },
  { data: { object: { id: "acct_revoked", object: "account" } } },
  { data: null },
])("rejects malformed or unbound lifecycle envelope %j", async (change) => {
  const { t, state } = await setup()
  const before = await state()
  expect((await post(t, event(change))).status).toBe(400)
  expect(providerFetch).not.toHaveBeenCalled()
  expect(await state()).toEqual(before)
})

it.each([
  { field: "application", value: "ca_other" },
  { field: "id", value: "we_other" },
  { field: "object", value: "account" },
  { field: "url", value: "https://other.convex.site/stripe/connect-revocation-webhook" },
  { field: "url", value: "https://some.convex.site/stripe/connect-webhook" },
  { field: "status", value: "disabled" },
  { field: "livemode", value: true },
  { field: "api_version", value: "2024-10-28.acacia" },
  { field: "enabled_events", value: ["account.updated"] },
  { field: "enabled_events", value: ["account.application.deauthorized", "account.updated"] },
])("fails closed on provider destination mismatch $field=$value", async ({ field, value }) => {
  const { t, state } = await setup()
  const before = await state()
  endpoint[field] = value
  expect((await post(t)).status).toBe(500)
  expect(await state()).toEqual(before)
})

it("rejects a credential for a different platform", async () => {
  const { t, state } = await setup()
  const before = await state()
  platformId = "acct_other"
  expect((await post(t)).status).toBe(500)
  expect(await state()).toEqual(before)
})

it.each([403, 404, 503])("never treats provider HTTP %s as revocation proof", async (status) => {
  const { t, state } = await setup()
  const before = await state()
  providerError = status
  expect((await post(t)).status).toBe(500)
  expect(await state()).toEqual(before)
})

it.each([
  { variable: "STRIPE_CONNECT_REVOCATION_BINDING", value: "" },
  { variable: "STRIPE_CONNECT_REVOCATION_BINDING", value: "null" },
  { variable: "STRIPE_CONNECT_REVOCATION_BINDING", value: "{}" },
  { variable: "STRIPE_CONNECT_REVOCATION_WEBHOOK_SECRET", value: "" },
  { variable: "STRIPE_SECRET_KEY", value: "rk_test_wrong" },
])("requires complete dedicated provisioning $variable=$value", async ({ variable, value }) => {
  const { t, state } = await setup()
  const before = await state()
  vi.stubEnv(variable, value)
  expect((await post(t)).status).toBe(500)
  expect(providerFetch).not.toHaveBeenCalled()
  expect(await state()).toEqual(before)
})

it.each([
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PLATFORM_WEBHOOK_SECRET",
  "STRIPE_CONNECT_WEBHOOK_SECRET",
])("rejects secret reuse with %s without disabling that existing route", async (variable) => {
  const { t, state } = await setup()
  const before = await state()
  vi.stubEnv(variable, secret)
  expect((await post(t)).status).toBe(500)
  expect(providerFetch).not.toHaveBeenCalled()
  expect(await state()).toEqual(before)
  // Existing handlers do not consult the optional revocation configuration.
  const legacy = await t.fetch("/stripe/webhook", { method: "POST", body: "{}" })
  expect(legacy.status).toBe(400)
})

it("requires the creation-time secret fingerprint", async () => {
  const { t, state } = await setup()
  const before = await state()
  vi.stubEnv(
    "STRIPE_CONNECT_REVOCATION_BINDING",
    JSON.stringify({ ...binding, secretSha256: "0".repeat(64) })
  )
  expect((await post(t)).status).toBe(500)
  expect(providerFetch).not.toHaveBeenCalled()
  expect(await state()).toEqual(before)
})

it("rejects a missing signature without consulting Stripe", async () => {
  const { t, state } = await setup()
  const before = await state()
  expect((await t.fetch(path, { method: "POST", body: JSON.stringify(event()) })).status).toBe(400)
  expect(providerFetch).not.toHaveBeenCalled()
  expect(await state()).toEqual(before)
})
