import { v } from "convex/values"
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"

export function accountRevocation(ctx: QueryCtx | MutationCtx, stripeAccountId: string) {
  return ctx.db
    .query("stripeAccountRevocations")
    .withIndex("by_account", (q) => q.eq("stripeAccountId", stripeAccountId))
    .unique()
}

export const getByAccount = internalQuery({
  args: { stripeAccountId: v.string() },
  handler: (ctx, { stripeAccountId }) => accountRevocation(ctx, stripeAccountId),
})

// Only the independently verified revocation ingress may call this writer.
// No public mutation, automatic reconnect, or status event clears this barrier.
export const recordVerifiedRevocation = internalMutation({
  args: {
    stripeAccountId: v.string(),
    applicationId: v.string(),
    platformAccountId: v.string(),
    livemode: v.boolean(),
    eventId: v.string(),
    eventCreated: v.number(),
  },
  handler: async (ctx, args) => {
    const previousEvent = await ctx.db
      .query("stripeRevocationEvents")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .unique()
    if (previousEvent) {
      // A reused event ID must not disable a different destination.
      for (const key of Object.keys(args) as (keyof typeof args)[]) {
        if (previousEvent[key] !== args[key]) throw new Error("Revocation event binding mismatch")
      }
      return { duplicate: true }
    }
    const now = Date.now()
    const tombstone = await accountRevocation(ctx, args.stripeAccountId)
    if (!tombstone) {
      await ctx.db.insert("stripeAccountRevocations", { ...args, recordedAt: now })
    }
    // All exact links are disabled even if legacy data contains duplicates.
    // Never infer an owner from email, Stripe metadata, or an old local link.
    const users = await ctx.db
      .query("users")
      .withIndex("by_stripe_account", (q) => q.eq("stripeAccountId", args.stripeAccountId))
      .collect()
    for (const user of users) {
      await ctx.db.patch(user._id, { stripeAccountStatus: "disabled" })
    }
    const linkedUserIds = users.map((user) => user.externalId)
    await ctx.db.insert("stripeRevocationEvents", { ...args, recordedAt: now, linkedUserIds })
    await ctx.db.insert("auditLogs", {
      entityType: "stripe_account",
      entityId: args.stripeAccountId,
      action: "connect_access_revoked",
      metadata: { ...args, linkedUserIds },
      timestamp: now,
    })
    const receipt = await ctx.db
      .query("webhookEvents")
      .withIndex("by_source_event_id", (q) => q.eq("source", "stripe").eq("eventId", args.eventId))
      .first()
    if (!receipt) {
      await ctx.db.insert("webhookEvents", {
        source: "stripe",
        eventId: args.eventId,
        eventType: "account.application.deauthorized",
        processedAt: now,
        expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      })
    }
    return { duplicate: false }
  },
})
