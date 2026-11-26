// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"
const mock = vi.hoisted(() => ({
  retrieve: vi.fn(),
  create: vi.fn(),
  link: vi.fn(),
  balance: vi.fn(),
  recent: vi.fn(),
  customer: vi.fn(),
  checkout: vi.fn(),
  intent: vi.fn(),
  afterOperation: vi.fn(),
}))
vi.mock("./r2", () => ({ r2: {} }))
vi.mock("./rateLimiter", () => ({ rateLimiter: { limit: async () => ({ ok: true }) } }))
vi.mock("./clerkDeletion", () => ({
  deletionProvider: async () => ({ verifyRecentAuthentication: mock.recent }),
}))
vi.mock("./accountOperations", async (original) => {
  const actual = await original<typeof import("./accountOperations")>()
  return {
    ...actual,
    withAccountOperation: async (...args: Parameters<typeof actual.withAccountOperation>) => {
      const r = await actual.withAccountOperation(...args)
      await mock.afterOperation()
      return r
    },
  }
})
vi.mock("stripe", () => ({
  default: class {
    accounts = { retrieve: mock.retrieve, create: mock.create }
    accountLinks = { create: mock.link }
    balance = { retrieve: mock.balance }
    customers = { retrieve: mock.customer, create: mock.customer }
    checkout = { sessions: { create: mock.checkout } }
    paymentIntents = { create: mock.intent }
  },
}))
const modules = (
  import.meta as unknown as { glob: (pattern: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
let candidate: Record<string, unknown>
const ready = {
  details_submitted: true,
  charges_enabled: true,
  payouts_enabled: true,
  capabilities: { transfers: "active" },
  requirements: {},
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_synthetic")
  vi.stubEnv(
    "STRIPE_CONNECT_REVOCATION_BINDING",
    JSON.stringify({ platformAccountId: "acct_platform" })
  )
  vi.stubEnv("WEB_URL", "https://renegade.test")
  mock.recent.mockResolvedValue(true)
  mock.balance.mockResolvedValue({ livemode: false })
  candidate = {
    id: "acct_candidate",
    type: "express",
    ...ready,
    details_submitted: false,
    metadata: {},
  }
  mock.create.mockImplementation((args) => {
    candidate = { ...candidate, metadata: args.metadata }
    return candidate
  })
  mock.retrieve.mockImplementation((id) =>
    id
      ? id === "acct_candidate"
        ? candidate
        : { id, type: "express", metadata: { renegadeUserId: "host" }, ...ready }
      : { id: "acct_platform" }
  )
  mock.link.mockResolvedValue({ url: "https://connect.stripe.test/synthetic" })
  mock.customer.mockResolvedValue({ id: "cus_synthetic", metadata: { userId: "renter" } })
  mock.checkout.mockResolvedValue({
    id: "cs_synthetic",
    url: "https://checkout.stripe.test/synthetic",
  })
  mock.intent.mockResolvedValue({
    id: "pi_synthetic",
    client_secret: "synthetic_not_a_real_secret",
  })
})
afterEach(() => vi.unstubAllEnvs())
async function setup(importHold = true) {
  const t = convexTest(schema, modules)
  const ids = await t.run(async ({ db }) => {
    const userId = await db.insert("users", {
      externalId: "host",
      name: "Synthetic host",
      stripeAccountId: "acct_legacy",
      stripeAccountStatus: "enabled",
    })
    await db.insert("users", {
      externalId: "renter",
      name: "Synthetic renter",
      stripeCustomerId: "cus_synthetic",
    })
    const trackId = await db.insert("tracks", {
      name: "Synthetic",
      location: "Synthetic",
      isActive: true,
    })
    const vehicleId = await db.insert("vehicles", {
      trackId,
      ownerId: "host",
      make: "Synthetic",
      model: "Test",
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
    const reservationId = await db.insert("reservations", {
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
      approvedAt: Date.now(),
      createdAt: 1,
      updatedAt: 1,
    })
    return { userId, reservationId, vehicleId }
  })
  const manifest = {
    dryRun: false,
    evidenceRef: "restricted/synthetic",
    cases: [
      {
        caseKey: "REN3-D01",
        subject: "host",
        expectedUserId: ids.userId,
        expectedAccountId: "acct_legacy",
      },
    ],
  }
  if (importHold) await t.mutation(internal.payoutRecovery.importCases, manifest)
  const owner = t.withIdentity({ subject: "host", issuer: "https://clerk.test" })
  const read = () => t.run(({ db }) => db.query("payoutRecoveryCases").unique())
  return { t, owner, ids, manifest, read }
}
function start(s: Awaited<ReturnType<typeof setup>>) {
  return s.owner.action(api.payoutRecovery.startOnboarding, {
    reauthToken: "synthetic_native_token",
  })
}
async function prepared() {
  const s = await setup()
  await start(s)
  candidate = { ...candidate, ...ready }
  await s.owner.action(api.payoutRecovery.refreshMyStatus, {})
  const c = (await s.read())!
  const args = {
    caseId: c._id,
    expectedVersion: c.version,
    expectedAccountId: "acct_legacy",
    expectedCandidateAccountId: "acct_candidate",
    operatorId: "synthetic_operator",
    approvalRef: "approval/synthetic",
    evidenceRef: "evidence/synthetic",
    obligationsEvidenceRef: "obligations/synthetic",
  }
  return { ...s, args }
}
it("dry-run and exact retries preserve user and case history", async () => {
  const s = await setup(false)
  const user = await s.t.run(({ db }) => db.get(s.ids.userId))
  await s.t.mutation(internal.payoutRecovery.importCases, { ...s.manifest, dryRun: true })
  expect(await s.read()).toBeNull()
  await s.t.mutation(internal.payoutRecovery.importCases, s.manifest)
  const first = await s.read()
  await s.t.mutation(internal.payoutRecovery.importCases, s.manifest)
  expect(await s.read()).toEqual(first)
  expect(await s.t.run(({ db }) => db.get(s.ids.userId))).toEqual(user)
})
it("rejects duplicate or drifted manifests atomically", async () => {
  const s = await setup(false)
  await expect(
    s.t.mutation(internal.payoutRecovery.importCases, {
      ...s.manifest,
      cases: [...s.manifest.cases, ...s.manifest.cases],
    })
  ).rejects.toThrow("Duplicate")
  await expect(
    s.t.mutation(internal.payoutRecovery.importCases, {
      ...s.manifest,
      cases: [{ ...s.manifest.cases[0]!, expectedAccountId: "acct_other" }],
    })
  ).rejects.toThrow("drift")
  expect(await s.read()).toBeNull()
})
it("status is owner-only sanitized and reading creates no setup", async () => {
  const s = await setup()
  expect(await s.t.query(api.payoutRecovery.getMyStatus, {})).toBeNull()
  expect(
    await s.t.withIdentity({ subject: "other" }).query(api.payoutRecovery.getMyStatus, {})
  ).toBeNull()
  expect(await s.owner.query(api.payoutRecovery.getMyStatus, {})).toMatchObject({
    state: "held",
    canStart: true,
    canContinue: false,
  })
  expect(JSON.stringify(await s.owner.query(api.payoutRecovery.getMyStatus, {}))).not.toContain(
    "acct_"
  )
  expect(mock.create).not.toHaveBeenCalled()
})
it("requires recent claimant authentication before any provider request", async () => {
  const s = await setup()
  mock.recent.mockResolvedValue(false)
  expect(await start(s)).toMatchObject({ clerk_error: { reason: "reverification-error" } })
  expect(mock.retrieve).not.toHaveBeenCalled()
  expect(mock.create).not.toHaveBeenCalled()
  await expect(
    s.t.action(api.payoutRecovery.startOnboarding, { reauthToken: "synthetic" })
  ).rejects.toThrow("authenticated")
})
it("starts a held candidate without overwriting the original account", async () => {
  const s = await setup()
  expect(await start(s)).toEqual({ url: "https://connect.stripe.test/synthetic" })
  const c = (await s.read())!
  expect(c).toMatchObject({
    held: true,
    state: "setup_in_progress",
    legacyAccountId: "acct_legacy",
    currentAccountId: "acct_legacy",
  })
  expect(await s.t.run(({ db }) => db.get(s.ids.userId))).toMatchObject({
    stripeAccountId: "acct_legacy",
  })
  expect(mock.link.mock.calls[0]![0]).toMatchObject({
    account: "acct_candidate",
    return_url: "https://renegade.test/host/onboarding/payout?stripe_return=1",
  })
  expect(mock.customer).not.toHaveBeenCalled()
})
it("expired-link continuation reuses candidate but creates a fresh generation", async () => {
  const s = await setup()
  await start(s)
  await start(s)
  expect(mock.create).toHaveBeenCalledTimes(1)
  expect(mock.link).toHaveBeenCalledTimes(2)
  expect(mock.link.mock.calls[0]![1].idempotencyKey).not.toEqual(
    mock.link.mock.calls[1]![1].idempotencyKey
  )
})
it("unknown creation outcomes retain durable operations and stable reconciliation key", async () => {
  const s = await setup()
  mock.create.mockRejectedValueOnce(new Error("unknown network outcome"))
  await expect(start(s)).rejects.toThrow("could not be completed")
  const pending = await s.t.run(({ db }) => db.query("accountOperations").collect())
  expect(pending.every((x) => x.status === "active")).toBe(true)
  await start(s)
  expect(mock.create.mock.calls[0]![1]).toEqual(mock.create.mock.calls[1]![1])
  expect(await s.t.run(({ db }) => db.query("payoutRecoveryAttempts").collect())).toHaveLength(1)
  expect(
    (await s.t.run(({ db }) => db.query("accountOperations").collect())).filter(
      (x) => x.status === "active"
    )
  ).toHaveLength(1)
})
it("provider mode/platform mismatch stops before journal or creation", async () => {
  const s = await setup()
  mock.balance.mockResolvedValue({ livemode: true })
  await expect(start(s)).rejects.toThrow("binding")
  expect(mock.create).not.toHaveBeenCalled()
  expect(await s.t.run(({ db }) => db.query("payoutRecoveryAttempts").collect())).toEqual([])
})
it("readiness and return refresh keep the hold and original link", async () => {
  const s = await prepared()
  expect(await s.owner.query(api.payoutRecovery.getMyStatus, {})).toMatchObject({
    state: "ready_for_review",
    canStart: false,
    canContinue: false,
  })
  expect((await s.read())?.held).toBe(true)
  expect(await s.t.run(({ db }) => db.get(s.ids.userId))).toMatchObject({
    stripeAccountId: "acct_legacy",
  })
})
it("wrong candidate provenance cannot be marked ready", async () => {
  const s = await setup()
  await start(s)
  candidate = { ...candidate, ...ready, metadata: { renegadeUserId: "other" } }
  await expect(s.owner.action(api.payoutRecovery.refreshMyStatus, {})).rejects.toThrow("provenance")
  expect((await s.read())?.state).toBe("setup_in_progress")
})
it("separate operator promotion and release preserve import retries and historic binding", async () => {
  const s = await prepared()
  await s.t.mutation(internal.payoutRecovery.promoteVerifiedCandidate, s.args)
  const promoted = (await s.read())!
  expect(promoted).toMatchObject({
    held: true,
    currentAccountId: "acct_candidate",
    legacyAccountId: "acct_legacy",
  })
  await s.t.mutation(internal.payoutRecovery.importCases, s.manifest)
  expect(await s.read()).toEqual(promoted)
  await expect(s.t.mutation(internal.payoutRecovery.releaseVerifiedHold, s.args)).rejects.toThrow(
    "stale"
  )
  await s.t.mutation(internal.payoutRecovery.releaseVerifiedHold, {
    ...s.args,
    expectedVersion: promoted.version,
    expectedAccountId: "acct_candidate",
    approvalRef: "separate/release/approval",
  })
  const released = await s.read()
  await s.t.mutation(internal.payoutRecovery.importCases, s.manifest)
  expect(await s.read()).toEqual(released)
  expect(await s.owner.query(api.payoutRecovery.getMyStatus, {})).toBeNull()
})
it("stale expected mappings, active operations and missing references block promotion", async () => {
  const s = await prepared()
  await expect(
    s.t.mutation(internal.payoutRecovery.promoteVerifiedCandidate, {
      ...s.args,
      expectedVersion: 0,
    })
  ).rejects.toThrow("stale")
  await expect(
    s.t.mutation(internal.payoutRecovery.promoteVerifiedCandidate, { ...s.args, evidenceRef: "" })
  ).rejects.toThrow("reference")
  await s.t.run(({ db }) =>
    db.insert("accountOperations", {
      key: "uncertain",
      subject: "host",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    })
  )
  await expect(
    s.t.mutation(internal.payoutRecovery.promoteVerifiedCandidate, s.args)
  ).rejects.toThrow("unresolved")
})
for (const method of ["createCheckoutSession", "createPaymentIntent"] as const) {
  it(`${method} rejects a healthy correctly tagged legacy account under explicit hold`, async () => {
    const s = await setup()
    await expect(
      s.t
        .withIdentity({ subject: "renter" })
        .action(api.stripe[method], { reservationId: s.ids.reservationId, amount: 1000 })
    ).rejects.toThrow("PAYOUT_VERIFICATION_REQUIRED")
    expect(mock.checkout).not.toHaveBeenCalled()
    expect(mock.intent).not.toHaveBeenCalled()
    expect(mock.customer).not.toHaveBeenCalled()
    expect(await s.t.run(({ db }) => db.query("payments").collect())).toEqual([])
  })
  it(`${method} preserves an in-flight provider fact but withholds payment access if a hold appears`, async () => {
    const s = await setup(false)
    const payment = method === "createCheckoutSession" ? mock.checkout : mock.intent
    payment.mockImplementationOnce(async () => {
      await s.t.mutation(internal.payoutRecovery.importCases, s.manifest)
      return method === "createCheckoutSession"
        ? { id: "cs_synthetic", url: "https://checkout.stripe.test/synthetic" }
        : { id: "pi_synthetic", client_secret: "synthetic_not_real" }
    })
    await expect(
      s.t
        .withIdentity({ subject: "renter" })
        .action(api.stripe[method], { reservationId: s.ids.reservationId, amount: 1000 })
    ).rejects.toThrow("PAYOUT_VERIFICATION_REQUIRED")
    expect(await s.t.run(({ db }) => db.query("payments").collect())).toHaveLength(1)
    expect(await s.t.run(({ db }) => db.get(s.ids.reservationId))).toMatchObject({
      status: "approved",
    })
    expect(
      (await s.t.run(({ db }) => db.query("accountOperations").collect())).every(
        (x) => x.status === "active"
      )
    ).toBe(true)
  })
  it(`${method} checks a hold added after account operation completion`, async () => {
    const s = await setup(false)
    mock.afterOperation.mockImplementationOnce(() =>
      s.t.mutation(internal.payoutRecovery.importCases, s.manifest)
    )
    await expect(
      s.t
        .withIdentity({ subject: "renter" })
        .action(api.stripe[method], { reservationId: s.ids.reservationId, amount: 1000 })
    ).rejects.toThrow("PAYOUT_VERIFICATION_REQUIRED")
    expect(await s.t.run(({ db }) => db.query("payments").collect())).toHaveLength(1)
  })
}
it("keeps a separate lease for each concurrent setup invocation", async () => {
  const s = await setup()
  let finishFirst!: () => void
  let firstStarted!: () => void
  const entered = new Promise<void>((resolve) => {
    firstStarted = resolve
  })
  mock.create.mockImplementationOnce(async (args) => {
    candidate = { ...candidate, metadata: args.metadata }
    firstStarted()
    await new Promise<void>((resolve) => {
      finishFirst = resolve
    })
    return candidate
  })
  const first = start(s)
  await entered
  await start(s)
  expect(
    (await s.t.run(({ db }) => db.query("accountOperations").collect())).filter(
      (x) => x.status === "active"
    )
  ).toHaveLength(1)
  finishFirst()
  await first
  expect(
    (await s.t.run(({ db }) => db.query("accountOperations").collect())).every(
      (x) => x.status === "completed"
    )
  ).toBe(true)
  expect(await s.t.run(({ db }) => db.query("payoutRecoveryAttempts").collect())).toHaveLength(1)
  expect(mock.create.mock.calls[0]![1]).toEqual(mock.create.mock.calls[1]![1])
})
it("refreshes exact promoted candidate evidence before a delayed separate release", async () => {
  const s = await prepared()
  await s.t.mutation(internal.payoutRecovery.promoteVerifiedCandidate, s.args)
  const promoted = (await s.read())!
  await s.t.run(async ({ db }) => {
    const c = (await db.get(s.args.caseId))!
    await db.patch(c.attemptId!, { observedAt: Date.now() - 6 * 60 * 1000 })
  })
  await expect(
    s.t.mutation(internal.payoutRecovery.releaseVerifiedHold, {
      ...s.args,
      expectedAccountId: "acct_candidate",
      expectedVersion: promoted.version,
      approvalRef: "release/approval",
    })
  ).rejects.toThrow("stale")
  await s.t.action(internal.payoutRecovery.reviewCandidate, { caseId: s.args.caseId })
  const current = (await s.read())!
  await expect(
    s.t.mutation(internal.payoutRecovery.releaseVerifiedHold, {
      ...s.args,
      expectedAccountId: "acct_candidate",
      expectedVersion: current.version,
    })
  ).rejects.toThrow("separate")
  await s.t.mutation(internal.payoutRecovery.releaseVerifiedHold, {
    ...s.args,
    expectedAccountId: "acct_candidate",
    expectedVersion: current.version,
    approvalRef: "release/approval",
  })
  expect((await s.read())?.held).toBe(false)
})
it("processing payments and pending latest refund observations block operator disposition", async () => {
  const s = await prepared()
  const pid = await s.t.run(({ db }) =>
    db.insert("payments", {
      reservationId: s.ids.reservationId,
      renterId: "renter",
      ownerId: "host",
      amount: 1000,
      platformFee: 50,
      ownerAmount: 950,
      currency: "usd",
      status: "processing",
      createdAt: 1,
      updatedAt: 1,
    })
  )
  await expect(
    s.t.mutation(internal.payoutRecovery.promoteVerifiedCandidate, s.args)
  ).rejects.toThrow("obligations")
  await s.t.run(async ({ db }) => {
    await db.patch(pid, { status: "succeeded" })
    await db.insert("rentalSettlementObservations", {
      paymentId: pid,
      refundId: "re_synthetic",
      observedAt: Date.now(),
      observation: {
        refundId: "re_synthetic",
        status: "pending",
        amount: 100,
        currency: "usd",
        chargeId: "ch_synthetic",
      },
    })
  })
  await expect(
    s.t.mutation(internal.payoutRecovery.promoteVerifiedCandidate, s.args)
  ).rejects.toThrow("obligations")
})
it("legacy onboarding, login links and account setters cannot bypass a hold", async () => {
  const s = await setup()
  await expect(
    s.owner.action(api.stripe.createConnectAccount, { ownerId: "host" })
  ).rejects.toThrow("PAYOUT_VERIFICATION_REQUIRED")
  await expect(
    s.owner.action(api.stripe.createConnectLoginLink, { ownerId: "host" })
  ).rejects.toThrow("PAYOUT_VERIFICATION_REQUIRED")
  await expect(
    s.t.mutation(internal.users.setStripeAccountId, {
      userId: "host",
      stripeAccountId: "acct_other",
      replaceUnusedAccount: "acct_legacy",
    })
  ).rejects.toThrow("reviewed payout")
  expect(mock.create).not.toHaveBeenCalled()
  expect(mock.link).not.toHaveBeenCalled()
})
it("released mapping drift returns a held review status and still denies payment", async () => {
  const s = await prepared()
  await s.t.mutation(internal.payoutRecovery.promoteVerifiedCandidate, s.args)
  const c = (await s.read())!
  await s.t.mutation(internal.payoutRecovery.releaseVerifiedHold, {
    ...s.args,
    expectedVersion: c.version,
    expectedAccountId: "acct_candidate",
    approvalRef: "release/approval",
  })
  await s.t.run(({ db }) => db.patch(s.ids.userId, { stripeAccountId: "acct_drift" }))
  expect(await s.owner.query(api.payoutRecovery.getMyStatus, {})).toMatchObject({
    state: "held",
    canStart: false,
    canContinue: false,
  })
  await expect(
    s.t.query(internal.payoutRecovery.assertPaymentAllowed, { subject: "host" })
  ).rejects.toThrow("PAYOUT_VERIFICATION_REQUIRED")
})
it("revocation and deletion barriers remain independent of setup readiness", async () => {
  const s = await setup()
  await start(s)
  await s.t.mutation(internal.stripeRevocations.recordVerifiedRevocation, {
    stripeAccountId: "acct_candidate",
    applicationId: "ca_synthetic",
    platformAccountId: "acct_platform",
    livemode: false,
    eventId: "evt_synthetic",
    eventCreated: 1,
  })
  expect(await s.owner.query(api.payoutRecovery.getMyStatus, {})).toMatchObject({
    canStart: false,
    canContinue: false,
  })
  await expect(start(s)).rejects.toThrow("revoked")
  await s.t.run(({ db }) =>
    db.insert("accountDeletionIntents", {
      subject: "host",
      status: "locked",
      createdAt: 1,
      updatedAt: 1,
    })
  )
  await expect(start(s)).rejects.toThrow("deleted")
})
