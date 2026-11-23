import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalMutation, type ActionCtx, type MutationCtx } from "./_generated/server"
import { assertAccountsAvailable } from "./accountDeletionGuards"

export async function reserveAccountOperation(
  ctx: MutationCtx,
  key: string,
  subjects: string[],
  preserveProviderFact = false
) {
  if (!preserveProviderFact) await assertAccountsAvailable(ctx, ...subjects)
  const existing = await ctx.db
    .query("accountOperations")
    .withIndex("by_key", (q) => q.eq("key", key))
    .collect()
  for (const subject of new Set(subjects)) {
    const row = existing.find((candidate) => candidate.subject === subject)
    if (row) await ctx.db.patch(row._id, { status: "active", updatedAt: Date.now() })
    else
      await ctx.db.insert("accountOperations", {
        key,
        subject,
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
  }
}

export const begin = internalMutation({
  args: { key: v.string(), subjects: v.array(v.string()) },
  handler: (ctx, { key, subjects }) => reserveAccountOperation(ctx, key, subjects),
})

export const complete = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const rows = await ctx.db
      .query("accountOperations")
      .withIndex("by_key", (q) => q.eq("key", key))
      .collect()
    for (const row of rows)
      await ctx.db.patch(row._id, { status: "completed", updatedAt: Date.now() })
  },
})

/** A failed/uncertain external operation stays durable for support investigation.
 * Never expire a lock based on elapsed time: the provider may have accepted the request. */
export async function withAccountOperation<T>(
  ctx: ActionCtx,
  key: string,
  subjects: string[],
  run: (beforeProviderMutation: () => void) => Promise<T>
): Promise<T> {
  // Each invocation owns its own durable reservation. A concurrent successful
  // retry must not release another invocation which is still making provider calls.
  const operationKey = `${key}:${crypto.randomUUID()}`
  await ctx.runMutation(internal.accountOperations.begin, { key: operationKey, subjects })
  let providerMutationStarted = false
  try {
    const result = await run(() => {
      providerMutationStarted = true
    })
    await ctx.runMutation(internal.accountOperations.complete, { key: operationKey })
    return result
  } catch (error) {
    // Read-only provider failures and definitive validation errors cannot have
    // created remote obligations. Only ambiguous mutations retain a support hold.
    if (!providerMutationStarted)
      await ctx.runMutation(internal.accountOperations.complete, { key: operationKey })
    throw error
  }
}
