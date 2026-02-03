/**
 * Migration utility to geocode existing vehicles that were created before geocoding was added
 *
 * This is a one-time migration function that can be run to geocode all existing vehicles
 * that have addresses but no coordinates.
 *
 * Usage:
 * 1. Run this mutation from Convex dashboard or via API
 * 2. It will process vehicles in batches to avoid rate limits
 * 3. Check the results to see how many were successfully geocoded
 */

import { v } from "convex/values"
import { internalMutation } from "./_generated/server"
import { geocodeAddressWithCoordinates } from "./geocoding"

/**
 * Geocode a single vehicle's address
 * This is an internal mutation that can be called by admin functions
 */
export const geocodeVehicle = internalMutation({
  args: {
    vehicleId: v.id("vehicles"),
  },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId)
    if (!vehicle) {
      return { success: false, error: "Vehicle not found" }
    }

    // Skip if vehicle doesn't have an address
    if (!vehicle.address) {
      return { success: false, error: "Vehicle has no address" }
    }

    // Skip if already geocoded
    if (vehicle.address.latitude && vehicle.address.longitude) {
      return { success: true, skipped: true, message: "Already geocoded" }
    }

    // Geocode the address
    try {
      const geocodedAddress = await geocodeAddressWithCoordinates(vehicle.address)

      // Update vehicle with geocoded address
      await ctx.db.patch(args.vehicleId, {
        address: geocodedAddress,
        updatedAt: Date.now(),
      })

      const hasCoordinates = !!(geocodedAddress.latitude && geocodedAddress.longitude)

      return {
        success: true,
        hasCoordinates,
        message: hasCoordinates
          ? "Successfully geocoded"
          : "Geocoding attempted but no coordinates returned",
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },
})

/**
 * Geocode all vehicles that have addresses but no coordinates
 * Processes vehicles in batches to avoid rate limits
 */
// Constants for batch processing
const DEFAULT_BATCH_SIZE = 10
const DEFAULT_LIMIT = 100
const DELAY_BETWEEN_REQUESTS_MS = 100
const DELAY_BETWEEN_BATCHES_MS = 500

export const geocodeAllVehicles = internalMutation({
  args: {
    batchSize: v.optional(v.number()), // Number of vehicles to process per batch
    limit: v.optional(v.number()), // Maximum number of vehicles to process (for testing)
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || DEFAULT_BATCH_SIZE
    const limit = args.limit || DEFAULT_LIMIT

    // Get all vehicles with addresses but no coordinates
    const vehicles = await ctx.db
      .query("vehicles")
      .filter((q) =>
        q.and(
          q.neq(q.field("address"), undefined),
          q.or(
            q.eq(q.field("address.latitude"), undefined),
            q.eq(q.field("address.longitude"), undefined)
          )
        )
      )
      .take(limit)

    const results = {
      total: vehicles.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    }

    // Helper function to process a single vehicle
    const processVehicle = async (vehicle: (typeof vehicles)[0]) => {
      results.processed++

      // Skip if already geocoded (double-check)
      if (vehicle.address?.latitude && vehicle.address?.longitude) {
        results.skipped++
        return
      }

      if (!vehicle.address) {
        results.skipped++
        return
      }

      try {
        const geocodedAddress = await geocodeAddressWithCoordinates(vehicle.address)

        if (geocodedAddress.latitude && geocodedAddress.longitude) {
          await ctx.db.patch(vehicle._id, {
            address: geocodedAddress,
            updatedAt: Date.now(),
          })
          results.successful++
        } else {
          results.failed++
          results.errors.push(`Vehicle ${vehicle._id}: Geocoding returned no coordinates`)
        }
      } catch (error) {
        results.failed++
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        results.errors.push(`Vehicle ${vehicle._id}: ${errorMessage}`)
      }
    }

    // Process vehicles in batches with delays to avoid rate limits
    for (let i = 0; i < vehicles.length; i += batchSize) {
      const batch = vehicles.slice(i, i + batchSize)

      for (const vehicle of batch) {
        await processVehicle(vehicle)

        // Add a small delay between requests to avoid rate limits
        if (i + batch.length < vehicles.length) {
          await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS))
        }
      }

      // Add a longer delay between batches
      if (i + batchSize < vehicles.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS))
      }
    }

    return results
  },
})
