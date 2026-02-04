/**
 * Initialization script for Convex backend.
 * Run this after deployment to set up cron jobs and other scheduled tasks.
 *
 * Usage:
 *   npx convex run init:setup
 *
 * Or add to package.json scripts:
 *   "convex:init": "convex run init:setup"
 */

import { internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"

/**
 * Main setup function that initializes all cron jobs and scheduled tasks.
 * This function is idempotent - safe to run multiple times.
 */
export const setup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const results: Record<string, unknown> = {}

    // Register message digest cron job
    const digestResult = await ctx.runMutation(
      internal.notificationCron.registerMessageDigestCron,
      {}
    )
    results.messageDigestCron = digestResult

    return results
  },
})
