#!/usr/bin/env tsx
/**
 * Clerk User Creation Script
 * 
 * Creates Clerk user accounts from Adalo user data
 * 
 * Usage:
 *   CLERK_SECRET_KEY=your-key tsx scripts/create-clerk-users.ts --users-file adalo-users.json --output mapping.json
 */

import { ClerkClient } from "@clerk/clerk-sdk-node"
import * as fs from "fs"
import * as path from "path"

type AdaloUser = {
  id: string
  email: string
  name: string
  phone?: string
}

type UserMapping = Record<string, string> // Adalo User ID -> Clerk User ID

async function createClerkUsers(
  clerk: ClerkClient,
  users: AdaloUser[]
): Promise<UserMapping> {
  const mapping: UserMapping = {}
  const errors: Array<{ user: AdaloUser; error: string }> = []

  console.log(`\n👥 Creating ${users.length} Clerk accounts...\n`)

  for (let i = 0; i < users.length; i++) {
    const user = users[i]
    const progress = `[${i + 1}/${users.length}]`

    // Skip if email is missing
    if (!user.email) {
      console.log(`${progress} ⚠️  Skipping user ${user.id} - no email`)
      errors.push({ user, error: "No email address" })
      continue
    }

    try {
      // Split name into first and last
      const nameParts = user.name.trim().split(/\s+/)
      const firstName = nameParts[0] || ""
      const lastName = nameParts.slice(1).join(" ") || ""

      // Check if user already exists by email
      const existingUsers = await clerk.users.getUserList({
        emailAddress: [user.email],
      })

      if (existingUsers.data.length > 0) {
        const existingUser = existingUsers.data[0]
        mapping[user.id] = existingUser.id
        console.log(
          `${progress} ✅ User exists: ${user.email} (${existingUser.id})`
        )
        continue
      }

      // Create new user
      const clerkUser = await clerk.users.createUser({
        emailAddress: [user.email],
        firstName,
        lastName,
        phoneNumber: user.phone ? [user.phone] : undefined,
        skipPasswordChecks: true, // Users will reset password on first login
        skipPasswordRequirement: true,
        publicMetadata: {
          migratedFromAdalo: true,
          adaloUserId: user.id,
        },
      })

      mapping[user.id] = clerkUser.id
      console.log(
        `${progress} ✅ Created: ${user.email} → ${clerkUser.id}`
      )

      // Rate limiting - Clerk has rate limits
      await sleep(200) // 200ms delay between requests
    } catch (error: any) {
      const errorMessage =
        error?.errors?.[0]?.message || error?.message || String(error)
      console.error(
        `${progress} ❌ Failed: ${user.email} - ${errorMessage}`
      )
      errors.push({ user, error: errorMessage })
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`  ✅ Created/Found: ${Object.keys(mapping).length}`)
  console.log(`  ❌ Failed: ${errors.length}`)

  if (errors.length > 0) {
    console.log(`\n❌ Errors:`)
    errors.slice(0, 10).forEach(({ user, error }) => {
      console.log(`  - ${user.email}: ${error}`)
    })
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more errors`)
    }
  }

  return mapping
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const args = process.argv.slice(2)
  const usersFileIndex = args.indexOf("--users-file")
  const outputIndex = args.indexOf("--output")

  if (usersFileIndex === -1 || args[usersFileIndex + 1] === undefined) {
    console.error(
      "Usage: tsx scripts/create-clerk-users.ts --users-file <file> [--output <file>]"
    )
    process.exit(1)
  }

  const usersFilePath = args[usersFileIndex + 1]
  const outputPath =
    outputIndex !== -1 ? args[outputIndex + 1] : "user-mapping.json"

  const clerkSecretKey = process.env.CLERK_SECRET_KEY
  if (!clerkSecretKey) {
    console.error(
      "Error: CLERK_SECRET_KEY environment variable is required"
    )
    process.exit(1)
  }

  const clerk = new ClerkClient({ secretKey: clerkSecretKey })

  // Load users from file
  console.log("📂 Loading users from file...")
  const usersData = JSON.parse(
    fs.readFileSync(path.resolve(usersFilePath), "utf-8")
  )

  const users: AdaloUser[] = Array.isArray(usersData)
    ? usersData
    : usersData.users || []

  console.log(`  Loaded ${users.length} users`)

  // Create Clerk users
  const mapping = await createClerkUsers(clerk, users)

  // Save mapping to file
  console.log(`\n💾 Saving mapping to ${outputPath}...`)
  fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2))
  console.log(`  ✅ Mapping saved!`)

  console.log(`\n✨ Done! Next steps:`)
  console.log(`  1. Review the mapping file: ${outputPath}`)
  console.log(`  2. Use this mapping file with the migration script`)
  console.log(`  3. Send password reset emails to migrated users`)
}

if (require.main === module) {
  main().catch(console.error)
}

export { createClerkUsers }
