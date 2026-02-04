#!/usr/bin/env tsx

/**
 * Migration Runner Script
 *
 * This script helps migrate data from Adalo to Convex
 *
 * Usage:
 *   tsx scripts/migrate-from-adalo.ts --data-file adalo-export.json --user-mapping users.json
 *
 * Or with environment variables:
 *   CONVEX_URL=your-url tsx scripts/migrate-from-adalo.ts --data-file adalo-export.json
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../packages/backend/convex/_generated/api"

// Types matching the migration functions
type AdaloUser = {
  id: string
  email: string
  name: string
  phone?: string
  profileImageUrl?: string
  bio?: string
  location?: string
  createdAt?: string
}

type AdaloVehicle = {
  id: string
  ownerId: string
  make: string
  model: string
  year: number
  dailyRate: number
  description: string
  trackId?: string
  trackName?: string
  images?: Array<{
    url: string
    isPrimary: boolean
    order: number
  }>
  horsepower?: number
  transmission?: string
  drivetrain?: string
  engineType?: string
  mileage?: number
  amenities?: string[]
  address?: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
  }
  createdAt?: string
}

type AdaloReservation = {
  id: string
  vehicleId: string
  renterId: string
  ownerId: string
  startDate: string
  endDate: string
  totalAmount: number
  status: "pending" | "confirmed" | "cancelled" | "completed"
  createdAt?: string
}

type AdaloReview = {
  id: string
  reservationId: string
  reviewerId: string
  reviewedId: string
  rating: number
  review: string
  createdAt?: string
}

type AdaloData = {
  users: AdaloUser[]
  vehicles: AdaloVehicle[]
  reservations: AdaloReservation[]
  reviews: AdaloReview[]
  tracks?: Array<{
    name: string
    location: string
  }>
}

type UserMapping = Record<string, string> // Adalo User ID -> Clerk User ID
type VehicleMapping = Record<string, string> // Adalo Vehicle ID -> Convex Vehicle ID

interface MigrationStats {
  users: { success: number; failed: number; errors: string[] }
  vehicles: { success: number; failed: number; errors: string[] }
  reservations: { success: number; failed: number; errors: string[] }
  reviews: { success: number; failed: number; errors: string[] }
}

class MigrationRunner {
  private readonly client: ConvexHttpClient
  private readonly userMapping: UserMapping
  private readonly vehicleMapping: VehicleMapping = {}
  private readonly stats: MigrationStats = {
    users: { success: 0, failed: 0, errors: [] },
    vehicles: { success: 0, failed: 0, errors: [] },
    reservations: { success: 0, failed: 0, errors: [] },
    reviews: { success: 0, failed: 0, errors: [] },
  }

  constructor(convexUrl: string, userMapping: UserMapping) {
    this.client = new ConvexHttpClient(convexUrl)
    this.userMapping = userMapping
  }

  async migrateUsers(users: AdaloUser[]): Promise<void> {
    console.log(`\n📦 Migrating ${users.length} users...`)

    // Prepare users for batch migration
    const usersToMigrate = users
      .filter((user) => this.userMapping[user.id])
      .map((user) => ({
        adaloUser: user,
        clerkExternalId: this.userMapping[user.id],
      }))

    if (usersToMigrate.length === 0) {
      console.log("⚠️  No users to migrate (missing Clerk mappings)")
      return
    }

    // Migrate in batches of 50
    const batchSize = 50
    for (let i = 0; i < usersToMigrate.length; i += batchSize) {
      const batch = usersToMigrate.slice(i, i + batchSize)
      console.log(`  Processing batch ${Math.floor(i / batchSize) + 1}...`)

      try {
        const result = await this.client.mutation(api.migrateAdalo.migrateUsersBatch, {
          users: batch,
        })

        this.stats.users.success += result.successCount
        this.stats.users.failed += result.errorCount
        this.stats.users.errors.push(...result.errors.map((e) => e.error))

        console.log(`    ✅ ${result.successCount} succeeded, ❌ ${result.errorCount} failed`)
      } catch (error) {
        console.error("    ❌ Batch failed:", error)
        this.stats.users.failed += batch.length
        this.stats.users.errors.push(String(error))
      }

      // Small delay to avoid rate limiting
      await this.sleep(1000)
    }
  }

  async migrateVehicles(vehicles: AdaloVehicle[]): Promise<void> {
    console.log(`\n🚗 Migrating ${vehicles.length} vehicles...`)

    for (const vehicle of vehicles) {
      const ownerClerkId = this.userMapping[vehicle.ownerId]
      if (!ownerClerkId) {
        console.log(`  ⚠️  Skipping vehicle ${vehicle.id} - owner not mapped`)
        this.stats.vehicles.failed++
        this.stats.vehicles.errors.push(
          `Vehicle ${vehicle.id}: Owner ${vehicle.ownerId} not found in mapping`
        )
        continue
      }

      try {
        const vehicleId = await this.client.mutation(api.migrateAdalo.migrateVehicle, {
          adaloVehicle: vehicle,
          ownerClerkId,
          trackName: vehicle.trackName,
        })

        this.vehicleMapping[vehicle.id] = vehicleId
        this.stats.vehicles.success++
        console.log(`  ✅ Migrated vehicle: ${vehicle.make} ${vehicle.model}`)
      } catch (error) {
        console.error(`  ❌ Failed to migrate vehicle ${vehicle.id}:`, error)
        this.stats.vehicles.failed++
        this.stats.vehicles.errors.push(`Vehicle ${vehicle.id}: ${String(error)}`)
      }

      // Small delay to avoid rate limiting
      await this.sleep(500)
    }
  }

  async migrateReservations(reservations: AdaloReservation[]): Promise<void> {
    console.log(`\n📅 Migrating ${reservations.length} reservations...`)

    for (const reservation of reservations) {
      const vehicleConvexId = this.vehicleMapping[reservation.vehicleId]
      const renterClerkId = this.userMapping[reservation.renterId]
      const ownerClerkId = this.userMapping[reservation.ownerId]

      if (!(vehicleConvexId && renterClerkId && ownerClerkId)) {
        console.log(`  ⚠️  Skipping reservation ${reservation.id} - missing mappings`)
        this.stats.reservations.failed++
        this.stats.reservations.errors.push(
          `Reservation ${reservation.id}: Missing vehicle or user mappings`
        )
        continue
      }

      try {
        await this.client.mutation(api.migrateAdalo.migrateReservation, {
          adaloReservation: reservation,
          vehicleConvexId: vehicleConvexId as any,
          renterClerkId,
          ownerClerkId,
        })

        this.stats.reservations.success++
        console.log(`  ✅ Migrated reservation: ${reservation.id}`)
      } catch (error) {
        console.error(`  ❌ Failed to migrate reservation ${reservation.id}:`, error)
        this.stats.reservations.failed++
        this.stats.reservations.errors.push(`Reservation ${reservation.id}: ${String(error)}`)
      }

      await this.sleep(500)
    }
  }

  async migrateReviews(reviews: AdaloReview[]): Promise<void> {
    console.log(`\n⭐ Migrating ${reviews.length} reviews...`)

    // We need to get reservation mappings first
    // For now, we'll need to query Convex to get reservation IDs
    // This is a simplified version - you may need to enhance this

    for (const review of reviews) {
      try {
        // Note: This requires getting the reservation Convex ID
        // You may need to query Convex to find it by date/user/vehicle
        // For now, we'll skip or implement a lookup

        console.log(`  ⚠️  Review migration requires reservation lookup - skipping ${review.id}`)
        this.stats.reviews.failed++
        this.stats.reviews.errors.push(
          `Review ${review.id}: Requires reservation lookup (not implemented)`
        )
      } catch (error) {
        console.error(`  ❌ Failed to migrate review ${review.id}:`, error)
        this.stats.reviews.failed++
        this.stats.reviews.errors.push(`Review ${review.id}: ${String(error)}`)
      }
    }
  }

  printStats(): void {
    console.log(`\n${"=".repeat(60)}`)
    console.log("📊 Migration Statistics")
    console.log("=".repeat(60))
    console.log(`Users:      ✅ ${this.stats.users.success}  ❌ ${this.stats.users.failed}`)
    console.log(`Vehicles:   ✅ ${this.stats.vehicles.success}  ❌ ${this.stats.vehicles.failed}`)
    console.log(
      `Reservations: ✅ ${this.stats.reservations.success}  ❌ ${this.stats.reservations.failed}`
    )
    console.log(`Reviews:    ✅ ${this.stats.reviews.success}  ❌ ${this.stats.reviews.failed}`)

    if (
      this.stats.users.errors.length > 0 ||
      this.stats.vehicles.errors.length > 0 ||
      this.stats.reservations.errors.length > 0 ||
      this.stats.reviews.errors.length > 0
    ) {
      console.log("\n❌ Errors:")
      const allErrors = [
        ...this.stats.users.errors,
        ...this.stats.vehicles.errors,
        ...this.stats.reservations.errors,
        ...this.stats.reviews.errors,
      ]
      allErrors.slice(0, 10).forEach((error) => console.log(`  - ${error}`))
      if (allErrors.length > 10) {
        console.log(`  ... and ${allErrors.length - 10} more errors`)
      }
    }

    console.log(`\n${"=".repeat(60)}`)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  const dataFileIndex = args.indexOf("--data-file")
  const mappingFileIndex = args.indexOf("--user-mapping")
  const convexUrlIndex = args.indexOf("--convex-url")

  if (dataFileIndex === -1 || args[dataFileIndex + 1] === undefined) {
    console.error(
      "Usage: tsx scripts/migrate-from-adalo.ts --data-file <file> [--user-mapping <file>] [--convex-url <url>]"
    )
    process.exit(1)
  }

  const dataFilePath = args[dataFileIndex + 1]
  const mappingFilePath = mappingFileIndex !== -1 ? args[mappingFileIndex + 1] : undefined
  const convexUrl = convexUrlIndex !== -1 ? args[convexUrlIndex + 1] : process.env.CONVEX_URL

  if (!convexUrl) {
    console.error("Error: CONVEX_URL not provided (use --convex-url or set CONVEX_URL env var)")
    process.exit(1)
  }

  // Load data files
  console.log("📂 Loading data files...")
  const adaloData: AdaloData = JSON.parse(fs.readFileSync(path.resolve(dataFilePath), "utf-8"))

  let userMapping: UserMapping = {}
  if (mappingFilePath) {
    userMapping = JSON.parse(fs.readFileSync(path.resolve(mappingFilePath), "utf-8"))
  } else {
    console.log("⚠️  No user mapping file provided. Users will be skipped.")
  }

  console.log(`  Loaded ${adaloData.users.length} users`)
  console.log(`  Loaded ${adaloData.vehicles.length} vehicles`)
  console.log(`  Loaded ${adaloData.reservations.length} reservations`)
  console.log(`  Loaded ${adaloData.reviews.length} reviews`)
  console.log(`  Loaded ${Object.keys(userMapping).length} user mappings`)

  // Create migration runner
  const runner = new MigrationRunner(convexUrl, userMapping)

  // Run migration in order
  try {
    await runner.migrateUsers(adaloData.users)
    await runner.migrateVehicles(adaloData.vehicles)
    await runner.migrateReservations(adaloData.reservations)
    await runner.migrateReviews(adaloData.reviews)

    // Print final statistics
    runner.printStats()
  } catch (error) {
    console.error("❌ Migration failed:", error)
    runner.printStats()
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error)
}

export { MigrationRunner }
