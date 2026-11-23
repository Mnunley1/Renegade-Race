import type { QueryCtx } from "./_generated/server"

/** Read in the transaction which creates/escalates the obligation, for both parties. */
export async function assertAccountsAvailable(ctx: QueryCtx, ...subjects: string[]) {
  for (const subject of new Set(subjects)) {
    const intent = await ctx.db
      .query("accountDeletionIntents")
      .withIndex("by_subject", (q) => q.eq("subject", subject))
      .unique()
    if (intent) throw new Error("This account is being deleted and cannot start new activity.")
  }
}

export function deletionIntent(ctx: QueryCtx, subject: string) {
  return ctx.db
    .query("accountDeletionIntents")
    .withIndex("by_subject", (q) => q.eq("subject", subject))
    .unique()
}
