import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalAction, internalMutation, internalQuery } from "./_generated/server"
import { r2 } from "./r2"

// One-shot migration for vehicleImages rows that pre-date the R2 cutover.
// Fetches the legacy imageUrl, uploads the bytes to R2, and patches r2Key.
// The query filter makes it idempotent — re-running skips already-migrated rows.
//
// Run from the Convex dashboard or CLI:
//   npx convex run migrations:migrateVehicleImagesToR2
//   npx convex run migrations:migrateVehicleImagesToR2 '{ "dryRun": true }'

const BATCH_SIZE = 25

export const _listLegacyVehicleImages = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db
      .query("vehicleImages")
      .filter((q) =>
        q.and(q.eq(q.field("r2Key"), undefined), q.neq(q.field("imageUrl"), undefined))
      )
      .take(limit)
    return rows.map((row) => ({ _id: row._id, imageUrl: row.imageUrl as string }))
  },
})

export const _setVehicleImageR2Key = internalMutation({
  args: { id: v.id("vehicleImages"), r2Key: v.string() },
  handler: async (ctx, { id, r2Key }) => {
    await ctx.db.patch(id, { r2Key })
  },
})

export const migrateVehicleImagesToR2 = internalAction({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun = false }) => {
    let migrated = 0
    let skipped = 0
    let failed = 0

    while (true) {
      const batch = await ctx.runQuery(internal.migrations._listLegacyVehicleImages, {
        limit: BATCH_SIZE,
      })
      if (batch.length === 0) {
        break
      }

      let batchProgress = 0
      for (const row of batch) {
        try {
          const res = await fetch(row.imageUrl)
          if (!res.ok) {
            console.warn(`migrate: HTTP ${res.status} for ${row._id} (${row.imageUrl})`)
            failed += 1
            continue
          }
          const contentType = res.headers.get("content-type") ?? ""
          if (!contentType.startsWith("image/")) {
            console.warn(
              `migrate: non-image content-type "${contentType}" for ${row._id} (${row.imageUrl})`
            )
            failed += 1
            continue
          }

          if (dryRun) {
            skipped += 1
            continue
          }

          const bytes = new Uint8Array(await res.arrayBuffer())
          const newKey = await r2.store(ctx, bytes, { type: contentType })
          await ctx.runMutation(internal.migrations._setVehicleImageR2Key, {
            id: row._id,
            r2Key: newKey,
          })
          migrated += 1
          batchProgress += 1
        } catch (err) {
          console.error(`migrate: failed for ${row._id}`, err)
          failed += 1
        }
      }

      // dry-run never patches, so the same rows would come back forever.
      // Also stop if a full batch made zero progress to avoid retrying poison rows.
      if (dryRun || batchProgress === 0) {
        break
      }
    }

    const result = { migrated, skipped, failed, dryRun }
    console.log("migrateVehicleImagesToR2 done:", result)
    return result
  },
})
