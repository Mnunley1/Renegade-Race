import { v } from "convex/values"
import { internalMutation, mutation } from "./_generated/server"
// TODO: Uncomment after installing @convex-dev/rate-limiter
// import { rateLimiter } from "./rateLimiter"

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
    // TODO: Uncomment after installing @convex-dev/rate-limiter
    // const status = await rateLimiter.limit(ctx, args.name as any, {
    //   key: args.key,
    //   throws: args.throws ?? false,
    // })
    // return status
    return { ok: true, retryAfter: null }
  },
})
