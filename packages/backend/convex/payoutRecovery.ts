import { v } from "convex/values"
import Stripe from "stripe"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { assertAccountsAvailable } from "./accountDeletionGuards"
import { reserveAccountOperation } from "./accountOperations"
import { deletionProvider } from "./clerkDeletion"
import { ErrorCode, throwError } from "./errors"
import { getWebUrl } from "./helpers"
import { accountRevocation } from "./stripeRevocations"

type Case = Doc<"payoutRecoveryCases">
type Attempt = Doc<"payoutRecoveryAttempts">
export type RecoveryStatus = {
  state: "held" | "setup_in_progress" | "ready_for_review"
  canStart: boolean
  canContinue: boolean
  message: string
}
const ACCOUNT = /^acct_[A-Za-z0-9]+$/
const CASE_KEY = /^[A-Za-z0-9-]{1,80}$/
const KEY_MODE = /^sk_(test|live)_/
function reference(value: string) {
  if (!value.trim() || value.length > 1000)
    throw new Error("Restricted evidence reference required")
}
export function recoveryCase(ctx: QueryCtx, subject: string) {
  return ctx.db
    .query("payoutRecoveryCases")
    .withIndex("by_subject", (q) => q.eq("subject", subject))
    .unique()
}
export async function assertRecoveryPaymentAllowed(ctx: QueryCtx, subject: string) {
  const c = await recoveryCase(ctx, subject)
  if (!c) return
  const user = await ctx.db
    .query("users")
    .withIndex("by_external_id", (q) => q.eq("externalId", subject))
    .unique()
  const revoked =
    (await accountRevocation(ctx, c.legacyAccountId)) ||
    (await accountRevocation(ctx, c.currentAccountId))
  if (c.held || c.state !== "released" || user?.stripeAccountId !== c.currentAccountId || revoked)
    throwError(
      ErrorCode.PAYOUT_VERIFICATION_REQUIRED,
      "Owner payment setup is pending. Payments remain on hold."
    )
}
export const assertPaymentAllowed = internalQuery({
  args: { subject: v.string() },
  handler: (ctx, { subject }) => assertRecoveryPaymentAllowed(ctx, subject),
})
async function exactCase(ctx: QueryCtx, id: Id<"payoutRecoveryCases">) {
  const c = await ctx.db.get(id)
  if (!c) throw new Error("Recovery case not found")
  const user = await ctx.db
    .query("users")
    .withIndex("by_external_id", (q) => q.eq("externalId", c.subject))
    .unique()
  if (!user || user.stripeAccountId !== c.currentAccountId)
    throw new Error("Payout binding changed; operator review required")
  return { c, user }
}
async function assertNotRevoked(ctx: QueryCtx, c: Case, candidate?: string) {
  for (const id of new Set([
    c.legacyAccountId,
    c.currentAccountId,
    ...(candidate ? [candidate] : []),
  ]))
    if (await accountRevocation(ctx, id))
      throw new Error("Stripe access was revoked; operator review required")
}
async function status(ctx: QueryCtx, subject: string): Promise<RecoveryStatus | null> {
  const c = await recoveryCase(ctx, subject)
  if (!c) return null
  let valid = true
  try {
    await exactCase(ctx, c._id)
    await assertAccountsAvailable(ctx, subject)
    await assertNotRevoked(ctx, c)
  } catch {
    valid = false
  }
  const a = c.attemptId ? await ctx.db.get(c.attemptId) : null
  if (a?.state === "review_required") valid = false
  if (a?.candidateAccountId && (await accountRevocation(ctx, a.candidateAccountId))) valid = false
  if (!c.held && c.state === "released" && valid) return null
  const state = c.state === "released" ? "held" : c.state
  return {
    state,
    canStart: valid && !a,
    canContinue: valid && !!a && a.state !== "ready",
    message: valid
      ? state === "ready_for_review"
        ? "Payment setup is ready for review. Payments remain on hold until it is approved."
        : state === "setup_in_progress"
          ? "Continue your payment setup. Payments remain on hold."
          : "Finish payment setup before accepting rental payments. Existing reservations and history remain available."
      : "Payments remain on hold. This setup needs an account review.",
  }
}
export const getMyStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    return identity ? status(ctx, identity.subject) : null
  },
})
export const getForOwner = internalQuery({
  args: { subject: v.string() },
  handler: async (ctx, { subject }) => {
    const c = await recoveryCase(ctx, subject)
    if (!c) throw new Error("No payment recovery is required")
    await exactCase(ctx, c._id)
    return { recovery: c, attempt: c.attemptId ? await ctx.db.get(c.attemptId) : null }
  },
})
export const publicStatusForOwner = internalQuery({
  args: { subject: v.string() },
  handler: (ctx, { subject }) => status(ctx, subject),
})
async function audit(
  ctx: MutationCtx,
  c: Case | { _id: Id<"payoutRecoveryCases">; subject: string },
  event: string,
  entry: { evidenceRef: string; [key: string]: unknown }
) {
  await ctx.db.insert("auditLogs", {
    entityType: "stripe_account",
    entityId: c._id,
    action: event,
    userId: typeof entry.operatorId === "string" ? entry.operatorId : c.subject,
    metadata: entry,
    timestamp: Date.now(),
  })
}
// Operator-only atomic import. Dry-run performs every mapping/uniqueness guard.
export const importCases = internalMutation({
  args: {
    dryRun: v.boolean(),
    evidenceRef: v.string(),
    cases: v.array(
      v.object({
        caseKey: v.string(),
        subject: v.string(),
        expectedUserId: v.id("users"),
        expectedAccountId: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    reference(args.evidenceRef)
    if (
      !args.cases.length ||
      args.cases.length > 100 ||
      new Set(args.cases.map((x) => x.subject)).size !== args.cases.length ||
      new Set(args.cases.map((x) => x.caseKey)).size !== args.cases.length ||
      new Set(args.cases.map((x) => x.expectedAccountId)).size !== args.cases.length
    )
      throw new Error("Duplicate or invalid case import")
    const checked: { input: (typeof args.cases)[number]; existing: Case | null }[] = []
    for (const input of args.cases) {
      if (!(CASE_KEY.test(input.caseKey) && ACCOUNT.test(input.expectedAccountId)))
        throw new Error("Invalid case mapping")
      const user = await ctx.db.get(input.expectedUserId)
      const existing = await recoveryCase(ctx, input.subject)
      const byKey = await ctx.db
        .query("payoutRecoveryCases")
        .withIndex("by_case", (q) => q.eq("caseKey", input.caseKey))
        .unique()
      const users = await ctx.db
        .query("users")
        .withIndex("by_stripe_account", (q) =>
          q.eq("stripeAccountId", existing?.currentAccountId ?? input.expectedAccountId)
        )
        .collect()
      const byLegacy = await ctx.db
        .query("payoutRecoveryCases")
        .withIndex("by_legacy_account", (q) => q.eq("legacyAccountId", input.expectedAccountId))
        .unique()
      if (
        !user ||
        user.externalId !== input.subject ||
        users.length !== 1 ||
        users[0]?._id !== user._id ||
        user.stripeAccountId !== (existing?.currentAccountId ?? input.expectedAccountId) ||
        (byKey && byKey._id !== existing?._id) ||
        (byLegacy && byLegacy._id !== existing?._id) ||
        (existing &&
          (existing.caseKey !== input.caseKey ||
            existing.legacyAccountId !== input.expectedAccountId))
      )
        throw new Error("Case mapping drift; import stopped")
      checked.push({ input, existing })
    }
    if (!args.dryRun)
      for (const { input, existing } of checked) {
        if (existing) continue // Never reset a progressed/released case on retry.
        const now = Date.now()
        const id = await ctx.db.insert("payoutRecoveryCases", {
          caseKey: input.caseKey,
          subject: input.subject,
          legacyAccountId: input.expectedAccountId,
          currentAccountId: input.expectedAccountId,
          held: true,
          state: "held",
          version: 1,
          evidenceRef: args.evidenceRef,
          createdAt: now,
          updatedAt: now,
        })
        await audit(ctx, { _id: id, subject: input.subject }, "payout_recovery_hold_imported", {
          evidenceRef: args.evidenceRef,
        })
      }
    return {
      dryRun: args.dryRun,
      checked: checked.length,
      newCases: checked.filter((x) => !x.existing).length,
    }
  },
})
function provider() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!(key && KEY_MODE.test(key))) throw new Error("Payment setup is not configured")
  let binding: { platformAccountId?: string }
  try {
    binding = JSON.parse(process.env.STRIPE_CONNECT_REVOCATION_BINDING ?? "")
  } catch {
    throw new Error("Payment provider binding is not configured")
  }
  if (!(binding.platformAccountId && ACCOUNT.test(binding.platformAccountId)))
    throw new Error("Payment provider binding is not configured")
  return {
    stripe: new Stripe(key, { apiVersion: "2025-08-27.basil" }),
    platformAccountId: binding.platformAccountId,
    livemode: key.startsWith("sk_live_"),
  }
}
async function providerRequest<T>(request: Promise<T>): Promise<T> {
  try {
    return await request
  } catch {
    // Stripe errors may contain private IDs or masked credentials. The durable
    // attempt and operation retain reconciliation context instead of raw errors.
    throw new Error(
      "Payment setup could not be completed. Try again or request a review. Payments remain on hold."
    )
  }
}

async function verifiedProvider() {
  const p = provider()
  const account = await providerRequest(p.stripe.accounts.retrieve())
  const balance = await providerRequest(p.stripe.balance.retrieve())
  if (account.id !== p.platformAccountId || balance.livemode !== p.livemode)
    throw new Error("Payment provider binding does not match")
  return p
}
export const claimAttempt = internalMutation({
  args: {
    subject: v.string(),
    platformAccountId: v.string(),
    livemode: v.boolean(),
    requestKey: v.string(),
  },
  handler: async (ctx, args) => {
    const c = await recoveryCase(ctx, args.subject)
    if (!c?.held || c.state === "released") throw new Error("No held payment recovery case")
    await exactCase(ctx, c._id)
    await assertAccountsAvailable(ctx, args.subject)
    await assertNotRevoked(ctx, c)
    let attempt = c.attemptId ? await ctx.db.get(c.attemptId) : null
    if (
      attempt &&
      (attempt.subject !== args.subject ||
        (attempt.expectedAccountId !== c.currentAccountId &&
          !(c.promotedAt && attempt.candidateAccountId === c.currentAccountId)) ||
        attempt.platformAccountId !== args.platformAccountId ||
        attempt.livemode !== args.livemode ||
        attempt.state === "review_required")
    )
      throw new Error("Recovery attempt requires operator review")
    if (attempt?.state === "ready") throw new Error("Payment setup is already ready for review")
    const ownPrefix = attempt ? `payout-recovery:${attempt.attemptKey}:` : null
    const active = await ctx.db
      .query("accountOperations")
      .withIndex("by_subject", (q) => q.eq("subject", args.subject))
      .collect()
    if (active.some((x) => x.status === "active" && !(ownPrefix && x.key.startsWith(ownPrefix))))
      throw new Error("Another account operation requires review")
    if (!attempt) {
      const now = Date.now()
      const attemptKey = crypto.randomUUID()
      const id = await ctx.db.insert("payoutRecoveryAttempts", {
        caseId: c._id,
        subject: args.subject,
        expectedAccountId: c.currentAccountId,
        attemptKey,
        platformAccountId: args.platformAccountId,
        livemode: args.livemode,
        state: "creating",
        linkGeneration: 0,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.patch(c._id, {
        attemptId: id,
        state: "setup_in_progress",
        version: c.version + 1,
        updatedAt: now,
      })
      await audit(ctx, c, "payout_recovery_attempt_started", {
        evidenceRef: c.evidenceRef,
        attemptId: id,
      })
      attempt = (await ctx.db.get(id))!
    }
    await assertNotRevoked(ctx, c, attempt.candidateAccountId)
    const operationKey = `payout-recovery:${attempt.attemptKey}:${args.requestKey}`
    await reserveAccountOperation(ctx, operationKey, [args.subject])
    await ctx.db.patch(attempt._id, {
      linkGeneration: attempt.linkGeneration + 1,
      updatedAt: Date.now(),
    })
    return { ...attempt, linkGeneration: attempt.linkGeneration + 1, operationKey }
  },
})
export const recordCandidate = internalMutation({
  args: { attemptId: v.id("payoutRecoveryAttempts"), candidateAccountId: v.string() },
  handler: async (ctx, args) => {
    if (!ACCOUNT.test(args.candidateAccountId)) throw new Error("Invalid provider account")
    const a = await ctx.db.get(args.attemptId)
    if (!a) throw new Error("Attempt not found")
    if (a.candidateAccountId && a.candidateAccountId !== args.candidateAccountId)
      throw new Error("Provider candidate changed")
    const c = await ctx.db.get(a.caseId)
    if (!c) throw new Error("Case not found")
    const candidate = await ctx.db
      .query("payoutRecoveryAttempts")
      .withIndex("by_candidate", (q) => q.eq("candidateAccountId", args.candidateAccountId))
      .unique()
    const linked = await ctx.db
      .query("users")
      .withIndex("by_stripe_account", (q) => q.eq("stripeAccountId", args.candidateAccountId))
      .first()
    if (
      (candidate && candidate._id !== a._id) ||
      linked ||
      args.candidateAccountId === c.legacyAccountId
    )
      throw new Error("Candidate is already bound")
    // Persist accepted provider creation even if a concurrent local state changed.
    let valid = c.held && c.attemptId === a._id && c.currentAccountId === a.expectedAccountId
    try {
      await exactCase(ctx, c._id)
      await assertAccountsAvailable(ctx, c.subject)
      await assertNotRevoked(ctx, c, args.candidateAccountId)
    } catch {
      valid = false
    }
    await ctx.db.patch(a._id, {
      candidateAccountId: args.candidateAccountId,
      state: valid ? "onboarding" : "review_required",
      updatedAt: Date.now(),
    })
    await audit(ctx, c, "payout_recovery_candidate_recorded", {
      evidenceRef: c.evidenceRef,
      attemptId: a._id,
      candidateAccountId: args.candidateAccountId,
      requiresReview: !valid,
    })
    return { valid }
  },
})
export const observeCandidate = internalMutation({
  args: { attemptId: v.id("payoutRecoveryAttempts"), ready: v.boolean() },
  handler: async (ctx, args) => {
    const a = await ctx.db.get(args.attemptId)
    if (!a?.candidateAccountId) throw new Error("Candidate not found")
    const { c } = await exactCase(ctx, a.caseId)
    await assertAccountsAvailable(ctx, c.subject)
    await assertNotRevoked(ctx, c, a.candidateAccountId)
    if (
      !c.held ||
      c.attemptId !== a._id ||
      (a.expectedAccountId !== c.currentAccountId &&
        !(c.promotedAt && a.candidateAccountId === c.currentAccountId)) ||
      a.state === "review_required"
    )
      throw new Error("Candidate needs operator review")
    const now = Date.now()
    await ctx.db.patch(a._id, {
      state: args.ready ? "ready" : "onboarding",
      observedAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(c._id, {
      state: args.ready ? "ready_for_review" : "setup_in_progress",
      version: c.version + 1,
      updatedAt: now,
    })
    return status(ctx, c.subject)
  },
})
function verifyCandidate(
  account: Stripe.Account,
  a: Attempt,
  platformAccountId: string,
  livemode: boolean
) {
  if (
    a.platformAccountId !== platformAccountId ||
    a.livemode !== livemode ||
    account.id !== a.candidateAccountId ||
    account.type !== "express" ||
    account.metadata?.renegadeUserId !== a.subject ||
    account.metadata?.payoutRecoveryAttempt !== a.attemptKey
  )
    throw new Error("Candidate account provenance does not match")
}
function ready(account: Stripe.Account) {
  return (
    account.details_submitted &&
    account.charges_enabled &&
    account.payouts_enabled &&
    account.capabilities?.transfers === "active" &&
    !account.requirements?.disabled_reason &&
    !account.requirements?.currently_due?.length &&
    !account.requirements?.past_due?.length
  )
}
export const startOnboarding = action({
  args: { reauthToken: v.string() },
  handler: async (
    ctx,
    { reauthToken }
  ): Promise<
    | { url: string }
    | {
        clerk_error: {
          type: "forbidden"
          reason: "reverification-error"
          metadata: { reverification: { level: "second_factor"; afterMinutes: number } }
        }
      }
  > => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const authProvider = await deletionProvider(identity)
    if (!(await authProvider.verifyRecentAuthentication(reauthToken)))
      return {
        clerk_error: {
          type: "forbidden",
          reason: "reverification-error",
          metadata: { reverification: { level: "second_factor", afterMinutes: 10 } },
        },
      }
    const p = await verifiedProvider()
    const a: Attempt & { operationKey: string } = await ctx.runMutation(
      internal.payoutRecovery.claimAttempt,
      {
        subject: identity.subject,
        platformAccountId: p.platformAccountId,
        livemode: p.livemode,
        requestKey: crypto.randomUUID(),
      }
    )
    // Reusing the same server-journalled key reconciles unknown creation outcomes.
    let id = a.candidateAccountId
    if (!id) {
      const created = await providerRequest(
        p.stripe.accounts.create(
          {
            type: "express",
            country: "US",
            email: identity.email,
            metadata: { renegadeUserId: identity.subject, payoutRecoveryAttempt: a.attemptKey },
            capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          },
          { idempotencyKey: `payout_recovery_${a.attemptKey}` }
        )
      )
      const recorded = await ctx.runMutation(internal.payoutRecovery.recordCandidate, {
        attemptId: a._id,
        candidateAccountId: created.id,
      })
      if (!recorded.valid)
        throw new Error("Created setup requires operator review; payments remain held")
      id = created.id
    }
    const current: { recovery: Case; attempt: Attempt | null } = await ctx.runQuery(
      internal.payoutRecovery.getForOwner,
      { subject: identity.subject }
    )
    if (!current.attempt || current.attempt._id !== a._id)
      throw new Error("Recovery attempt changed")
    const account = await providerRequest(p.stripe.accounts.retrieve(id))
    verifyCandidate(account, { ...a, candidateAccountId: id }, p.platformAccountId, p.livemode)
    await ctx.runMutation(internal.payoutRecovery.observeCandidate, {
      attemptId: a._id,
      ready: ready(account),
    })
    if (ready(account)) {
      await ctx.runMutation(internal.accountOperations.complete, { key: a.operationKey })
      throw new Error("Setup is ready for review. Payments remain on hold.")
    }
    const base = new URL(getWebUrl())
    if (
      base.protocol !== "https:" &&
      !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))
    )
      throw new Error("Invalid setup return origin")
    const origin = base.origin
    const link = await providerRequest(
      p.stripe.accountLinks.create(
        {
          account: id,
          type: "account_onboarding",
          refresh_url: `${origin}/host/onboarding/payout?stripe_refresh=1`,
          return_url: `${origin}/host/onboarding/payout?stripe_return=1`,
        },
        { idempotencyKey: `payout_recovery_link_${a.attemptKey}_${a.linkGeneration}` }
      )
    )
    // Re-read candidate/hold/deletion/revocation state before disclosing an account link.
    await ctx.runMutation(internal.payoutRecovery.observeCandidate, {
      attemptId: a._id,
      ready: false,
    })
    await ctx.runMutation(internal.accountOperations.complete, { key: a.operationKey })
    return { url: link.url }
  },
})
export const refreshMyStatus = action({
  args: {},
  handler: async (ctx): Promise<RecoveryStatus | null> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const state: { recovery: Case; attempt: Attempt | null } = await ctx.runQuery(
      internal.payoutRecovery.getForOwner,
      { subject: identity.subject }
    )
    if (state.recovery.promotedAt || !state.attempt?.candidateAccountId)
      return ctx.runQuery(internal.payoutRecovery.publicStatusForOwner, {
        subject: identity.subject,
      })
    const p = await verifiedProvider()
    const account = await providerRequest(
      p.stripe.accounts.retrieve(state.attempt.candidateAccountId)
    )
    verifyCandidate(account, state.attempt, p.platformAccountId, p.livemode)
    return ctx.runMutation(internal.payoutRecovery.observeCandidate, {
      attemptId: state.attempt._id,
      ready: ready(account),
    })
  },
})

const dispositionArgs = {
  caseId: v.id("payoutRecoveryCases"),
  expectedVersion: v.number(),
  expectedAccountId: v.string(),
  expectedCandidateAccountId: v.string(),
  operatorId: v.string(),
  approvalRef: v.string(),
  evidenceRef: v.string(),
  obligationsEvidenceRef: v.string(),
}
async function dispositionChecks(
  ctx: MutationCtx,
  args: {
    caseId: Id<"payoutRecoveryCases">
    expectedVersion: number
    expectedAccountId: string
    expectedCandidateAccountId: string
    operatorId: string
    approvalRef: string
    evidenceRef: string
    obligationsEvidenceRef: string
  }
) {
  for (const ref of [
    args.operatorId,
    args.approvalRef,
    args.evidenceRef,
    args.obligationsEvidenceRef,
  ])
    reference(ref)
  const { c, user } = await exactCase(ctx, args.caseId)
  const a = c.attemptId ? await ctx.db.get(c.attemptId) : null
  if (
    !c.held ||
    c.version !== args.expectedVersion ||
    c.currentAccountId !== args.expectedAccountId ||
    !a ||
    a.candidateAccountId !== args.expectedCandidateAccountId ||
    a.state !== "ready" ||
    !a.observedAt ||
    Date.now() - a.observedAt > 5 * 60 * 1000
  )
    throw new Error("Recovery disposition is stale or not ready")
  await assertAccountsAvailable(ctx, c.subject)
  await assertNotRevoked(ctx, c, a.candidateAccountId)
  const users = await ctx.db
    .query("users")
    .withIndex("by_stripe_account", (q) => q.eq("stripeAccountId", args.expectedCandidateAccountId))
    .collect()
  const attempts = await ctx.db
    .query("payoutRecoveryAttempts")
    .withIndex("by_candidate", (q) => q.eq("candidateAccountId", args.expectedCandidateAccountId))
    .collect()
  if (users.some((u) => u._id !== user._id) || attempts.length !== 1 || attempts[0]?._id !== a._id)
    throw new Error("Candidate is already bound")
  const ops = await ctx.db
    .query("accountOperations")
    .withIndex("by_subject", (q) => q.eq("subject", c.subject))
    .collect()
  if (ops.some((x) => x.status === "active")) throw new Error("Account operation is unresolved")
  const review = await ctx.db
    .query("rentalSettlementReviews")
    .withIndex("by_owner_status", (q) => q.eq("ownerId", c.subject).eq("status", "held"))
    .first()
  const dispute = await ctx.db
    .query("disputes")
    .withIndex("by_owner", (q) => q.eq("ownerId", c.subject))
    .filter((q) => q.eq(q.field("status"), "open"))
    .first()
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_owner", (q) => q.eq("ownerId", c.subject))
    .collect()
  let pendingRefund = false
  for (const payment of payments) {
    const observations = await ctx.db
      .query("rentalSettlementObservations")
      .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
      .order("desc")
      .collect()
    const seen = new Set<string>()
    if (
      observations.some(({ observation }) => {
        if (seen.has(observation.refundId)) return false
        seen.add(observation.refundId)
        return !["succeeded", "failed", "canceled"].includes(observation.status)
      })
    )
      pendingRefund = true
  }
  const pending = payments.some(
    (p) => ["pending", "processing"].includes(p.status) || p.settlementReviewStatus === "held"
  )
  if (review || dispute || pending || pendingRefund)
    throw new Error("Outstanding financial obligations need review")
  return { c, user, a }
}
// Private operator entrypoints. Approval/evidence references are required audit
// inputs, not an authorization token accepted from an owner-facing function.
export const promoteVerifiedCandidate = internalMutation({
  args: dispositionArgs,
  handler: async (ctx, args) => {
    const { c, user, a } = await dispositionChecks(ctx, args)
    if (c.promotedAt || a.expectedAccountId !== c.currentAccountId)
      throw new Error("Candidate promotion already changed the binding")
    const now = Date.now()
    await ctx.db.patch(user._id, {
      stripeAccountId: args.expectedCandidateAccountId,
      stripeAccountStatus: "pending",
    })
    await ctx.db.patch(c._id, {
      currentAccountId: args.expectedCandidateAccountId,
      promotedAt: now,
      promotionApprovalRef: args.approvalRef,
      version: c.version + 1,
      updatedAt: now,
    })
    await audit(ctx, c, "payout_recovery_candidate_promoted_under_hold", {
      evidenceRef: args.evidenceRef,
      operatorId: args.operatorId,
      approvalRef: args.approvalRef,
      obligationsEvidenceRef: args.obligationsEvidenceRef,
      oldAccountId: c.currentAccountId,
      candidateAccountId: args.expectedCandidateAccountId,
      legacyOwnershipRemainsUnverified: true,
    })
    return { held: true, version: c.version + 1 }
  },
})
export const releaseVerifiedHold = internalMutation({
  args: dispositionArgs,
  handler: async (ctx, args) => {
    const { c } = await dispositionChecks(ctx, args)
    if (c.promotionApprovalRef === args.approvalRef)
      throw new Error("A separate hold-release approval is required")
    if (!c.promotedAt || c.currentAccountId !== args.expectedCandidateAccountId)
      throw new Error("Candidate must be promoted under hold first")
    const now = Date.now()
    await ctx.db.patch(c._id, {
      held: false,
      state: "released",
      releasedAt: now,
      version: c.version + 1,
      updatedAt: now,
    })
    await audit(ctx, c, "payout_recovery_hold_released", {
      evidenceRef: args.evidenceRef,
      operatorId: args.operatorId,
      approvalRef: args.approvalRef,
      obligationsEvidenceRef: args.obligationsEvidenceRef,
      candidateAccountId: args.expectedCandidateAccountId,
    })
    return { released: true, version: c.version + 1 }
  },
})
export const getOperatorCase = internalQuery({
  args: { caseId: v.id("payoutRecoveryCases") },
  handler: async (ctx, { caseId }) => {
    const { c } = await exactCase(ctx, caseId)
    return { recovery: c, attempt: c.attemptId ? await ctx.db.get(c.attemptId) : null }
  },
})
export const reviewCandidate = internalAction({
  args: { caseId: v.id("payoutRecoveryCases") },
  handler: async (ctx, { caseId }): Promise<{ ready: boolean }> => {
    const state: { recovery: Case; attempt: Attempt | null } = await ctx.runQuery(
      internal.payoutRecovery.getOperatorCase,
      { caseId }
    )
    if (!state.attempt?.candidateAccountId) throw new Error("No candidate")
    const p = await verifiedProvider()
    const account = await providerRequest(
      p.stripe.accounts.retrieve(state.attempt.candidateAccountId)
    )
    verifyCandidate(account, state.attempt, p.platformAccountId, p.livemode)
    await ctx.runMutation(internal.payoutRecovery.observeCandidate, {
      attemptId: state.attempt._id,
      ready: ready(account),
    })
    return { ready: ready(account) }
  },
})
