import { v } from "convex/values"
import { internalMutation } from "./_generated/server"
import { rateLimiter } from "./rateLimiter"

/**
 * Helper mutation to check rate limits
 * Can be called from actions via ctx.runMutation
 */
export const checkRateLimit = internalMutation({
  args: {
    name: v.string(),
    key: v.string(),
    throws: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // @ts-expect-error - RateLimiter type mismatch
    const status = await rateLimiter.limit(ctx, args.name, {
      key: args.key,
      throws: args.throws ?? false,
    })
    return status
  },
})
