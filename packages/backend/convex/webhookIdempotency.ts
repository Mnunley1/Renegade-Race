// Webhook idempotency helpers
import { v } from "convex/values"
import { internalMutation, internalQuery, mutation } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"

type WebhookSource = "stripe" | "clerk" | "resend"

// 7 days in milliseconds
const WEBHOOK_EVENT_TTL = 7 * 24 * 60 * 60 * 1000

/**
 * Check if a webhook event has already been processed (internal helper)
 * @returns true if event was already processed (should skip), false if new event
 */
async function _isWebhookEventProcessed(
  ctx: QueryCtx,
  eventId: string,
  source: WebhookSource
): Promise<boolean> {
  const existingEvent = await ctx.db
    .query("webhookEvents")
    .withIndex("by_source_event_id", (q) => q.eq("source", source).eq("eventId", eventId))
    .first()

  return existingEvent !== null
}

/**
 * Record that a webhook event has been successfully processed (internal helper)
 */
async function _recordWebhookEvent(
  ctx: MutationCtx,
  eventId: string,
  source: WebhookSource,
  eventType: string
): Promise<void> {
  const now = Date.now()
  const expiresAt = now + WEBHOOK_EVENT_TTL

  await ctx.db.insert("webhookEvents", {
    eventId,
    source,
    eventType,
    processedAt: now,
    expiresAt,
  })
}

// Exported Convex functions for use in http.ts

/**
 * Check if a webhook event has already been processed
 */
export const checkWebhookEvent = internalQuery({
  args: {
    eventId: v.string(),
    source: v.union(v.literal("stripe"), v.literal("clerk"), v.literal("resend")),
  },
  handler: async (ctx, args) => await _isWebhookEventProcessed(ctx, args.eventId, args.source),
})

/**
 * Record a processed webhook event
 */
export const recordWebhookEvent = internalMutation({
  args: {
    eventId: v.string(),
    source: v.union(v.literal("stripe"), v.literal("clerk"), v.literal("resend")),
    eventType: v.string(),
  },
  handler: async (ctx, args) => {
    await _recordWebhookEvent(ctx, args.eventId, args.source, args.eventType)
  },
})

/**
 * Clean up old webhook events (older than 7 days)
 * This should be called by a cron job
 */
export const cleanupOldWebhookEvents = mutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const now = Date.now()
    const oldEvents = await ctx.db
      .query("webhookEvents")
      .withIndex("by_expires_at")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect()

    for (const event of oldEvents) {
      await ctx.db.delete(event._id)
    }

    return oldEvents.length
  },
})
