/**
 * Adalo → Convex Migration Script
 *
 * Migrates Users (~680) and Cars (~15) from Adalo CSV exports into Convex,
 * with images uploaded to R2 via presigned URLs and Clerk users created.
 *
 * Usage:
 *   npx tsx packages/backend/scripts/migrate-adalo.ts --dry-run
 *   npx tsx packages/backend/scripts/migrate-adalo.ts
 *
 * Required env vars:
 *   CLERK_SECRET_KEY     - Clerk API secret key
 *   CONVEX_URL           - Convex deployment URL (e.g. https://xxx.convex.cloud)
 *   R2_ENDPOINT          - R2 S3-compatible endpoint
 *   R2_ACCESS_KEY_ID     - R2 access key
 *   R2_SECRET_ACCESS_KEY - R2 secret key
 *   R2_BUCKET_NAME       - R2 bucket name
 */

import * as crypto from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"
import { ConvexHttpClient } from "convex/browser"
import { parse } from "csv-parse/sync"
import { api } from "../convex/_generated/api"
import type { Id } from "../convex/_generated/dataModel"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes("--dry-run")
const ADALO_CDN = "https://adalo-uploads.imgix.net"

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY
const CONVEX_URL = process.env.CONVEX_URL
const R2_ENDPOINT = process.env.R2_ENDPOINT
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return value
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdaloUser {
  ID: string
  Email: string
  "Full Name": string
  Bio: string
  "Profile Picture": string
  "Provider's Stripe ID": string
  "Organisation Name": string
  "Organisation Phone Number": string
  "User Type": string
  "Experience (Track Days)": string
  Created: string
}

interface AdaloCarRaw {
  ID: string
  Make: string
  Description: string
  Track: string
  Model: string
  Owner: string
  "Drive Type": string
  HorsePower: string
  "Car Transmission Type": string
  "Rate Per Day": string
  Image: string
  "Base Rate Inclusions": string
  "About The Car": string
  "Year Of Build": string
  Year: string
  "Active/inActive?": string
  Created: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse Adalo's single-quoted JSON blobs into a usable object */
function parseAdaloJson(raw: string): { url?: string } | null {
  if (!raw || raw.trim() === "") return null
  try {
    // Convert single quotes to double quotes, handling escaped apostrophes
    const jsonStr = raw.replace(/'/g, '"')
    return JSON.parse(jsonStr)
  } catch {
    console.warn(`  ⚠ Failed to parse JSON blob: ${raw.slice(0, 80)}...`)
    return null
  }
}

/** Split "Full Name" into first/last */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || "").trim().split(/\s+/)
  if (parts.length === 0 || (parts.length === 1 && parts[0] === "")) {
    return { firstName: "", lastName: "" }
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  }
}

/** Map Adalo experience to Convex experience level */
function mapExperience(exp: string): "beginner" | "intermediate" | "advanced" | undefined {
  if (!exp) return
  if (exp.includes("DE1") || exp.toLowerCase().includes("novice")) return "beginner"
  if (exp.includes("DE2") || exp.toLowerCase().includes("intermediate")) return "intermediate"
  if (exp.includes("DE3") || exp.toLowerCase().includes("advanced")) return "advanced"
  return
}

/** Map Adalo user type */
function mapUserType(userType: string, hasCars: boolean): "driver" | "both" | undefined {
  if (hasCars) return "both"
  if (userType === "Car Owner") return "both"
  if (userType === "Car Renter") return "driver"
  return "driver"
}

/** Download image from Adalo CDN, return buffer and content type */
async function downloadImage(
  imageUrl: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const url = imageUrl.startsWith("http") ? imageUrl : `${ADALO_CDN}/${imageUrl}`
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`  ⚠ Failed to download image: ${res.status} ${url}`)
      return null
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get("content-type") || "image/jpeg"
    return { buffer, contentType }
  } catch (e) {
    console.warn(`  ⚠ Error downloading image: ${e}`)
    return null
  }
}

/** Upload buffer to R2 directly using S3-compatible PUT */
async function uploadToR2(key: string, buffer: Buffer, contentType: string): Promise<boolean> {
  // Use AWS S3-compatible API with basic auth via presigned URL approach
  // For simplicity, use the S3 PutObject with SigV4
  const endpoint = R2_ENDPOINT!
  const bucket = R2_BUCKET_NAME!
  const accessKey = R2_ACCESS_KEY_ID!
  const secretKey = R2_SECRET_ACCESS_KEY!

  const url = `${endpoint}/${bucket}/${key}`
  const date = new Date()
  const dateStr = date
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "")
    .slice(0, 8)
  const dateTimeStr = date.toISOString().replace(/[:-]|\.\d{3}/g, "")
  const region = "auto"
  const service = "s3"

  // AWS SigV4 signing
  const payloadHash = crypto.createHash("sha256").update(buffer).digest("hex")
  const parsedUrl = new URL(url)

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${parsedUrl.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${dateTimeStr}\n`

  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date"

  const canonicalRequest = [
    "PUT",
    `/${bucket}/${key}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n")

  const credentialScope = `${dateStr}/${region}/${service}/aws4_request`
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    dateTimeStr,
    credentialScope,
    crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n")

  const signingKey = (key: string | Buffer, data: string) =>
    crypto.createHmac("sha256", key).update(data).digest()

  const kDate = signingKey(`AWS4${secretKey}`, dateStr)
  const kRegion = signingKey(kDate, region)
  const kService = signingKey(kRegion, service)
  const kSigning = signingKey(kService, "aws4_request")

  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex")

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": dateTimeStr,
        Authorization: authorization,
        Host: parsedUrl.host,
      },
      body: new Uint8Array(buffer),
    })
    if (!res.ok) {
      const body = await res.text()
      console.warn(`  ⚠ R2 upload failed: ${res.status} ${body.slice(0, 200)}`)
      return false
    }
    return true
  } catch (e) {
    console.warn(`  ⚠ R2 upload error: ${e}`)
    return false
  }
}

/** Clerk API helper */
async function clerkApi(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(`Clerk API ${method} ${path} failed: ${res.status} ${JSON.stringify(data)}`)
  }
  return data
}

// Rate limiting helper
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Clerk API helper with retry on 429 */
async function clerkApiWithRetry(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  maxRetries = 5
): Promise<unknown> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await clerkApi(method, path, body)
    } catch (e: unknown) {
      const errMsg = String(e)
      if (errMsg.includes("429") && attempt < maxRetries) {
        const backoff = Math.min(2000 * 2 ** attempt, 30_000)
        console.log(
          `    ⏳ Rate limited, waiting ${backoff / 1000}s (attempt ${attempt + 1}/${maxRetries})...`
        )
        await sleep(backoff)
        continue
      }
      throw e
    }
  }
  throw new Error("Max retries exceeded")
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n🏁 Adalo → Convex Migration ${DRY_RUN ? "(DRY RUN)" : "(PRODUCTION)"}\n`)

  if (!DRY_RUN) {
    requireEnv("CLERK_SECRET_KEY", CLERK_SECRET_KEY)
    requireEnv("CONVEX_URL", CONVEX_URL)
    requireEnv("R2_ENDPOINT", R2_ENDPOINT)
    requireEnv("R2_ACCESS_KEY_ID", R2_ACCESS_KEY_ID)
    requireEnv("R2_SECRET_ACCESS_KEY", R2_SECRET_ACCESS_KEY)
    requireEnv("R2_BUCKET_NAME", R2_BUCKET_NAME)
  }

  const repoRoot = path.resolve(import.meta.dirname, "../../..")
  const usersCsv = fs.readFileSync(path.join(repoRoot, "Users.csv"), "utf-8")
  const carsCsv = fs.readFileSync(path.join(repoRoot, "Cars.csv"), "utf-8")

  // ── Parse Users ──
  const usersRaw: AdaloUser[] = parse(usersCsv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  })
  const users = usersRaw.filter((u) => u.Email && u.Email.trim() !== "")
  console.log(`📋 Users: ${usersRaw.length} total, ${users.length} with email\n`)

  // ── Parse Cars ──
  const carsRaw: AdaloCarRaw[] = parse(carsCsv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  })
  const cars = carsRaw.filter((c) => c.Make && c.Make.trim() !== "")
  console.log(`🚗 Cars: ${carsRaw.length} total, ${cars.length} with Make\n`)

  // Build set of owner emails from cars
  const ownerEmails = new Set(cars.map((c) => c.Owner?.toLowerCase().trim()).filter(Boolean))

  // ── Extract unique tracks ──
  const trackNames = [...new Set(cars.map((c) => c.Track?.trim()).filter(Boolean))]
  console.log(`🏟️  Tracks: ${trackNames.join(", ")}\n`)

  if (DRY_RUN) {
    console.log("── Dry Run Summary ──")
    console.log(`Users to create: ${users.length}`)
    console.log(`Cars to create: ${cars.length}`)
    console.log(`Tracks to create: ${trackNames.length}`)
    console.log(`Owner emails in Cars.csv: ${[...ownerEmails].join(", ")}`)

    // Show sample user mapping
    console.log("\n── Sample Users (first 5) ──")
    for (const u of users.slice(0, 5)) {
      const pic = parseAdaloJson(u["Profile Picture"])
      const { firstName, lastName } = splitName(u["Full Name"])
      const exp = mapExperience(u["Experience (Track Days)"])
      const isOwner = ownerEmails.has(u.Email.toLowerCase().trim())
      const userType = mapUserType(u["User Type"], isOwner)
      console.log(
        `  ${u.Email} | ${firstName} ${lastName} | type=${userType} | exp=${exp} | pic=${pic?.url ? "yes" : "no"} | stripe=${u["Provider's Stripe ID"] || "none"}`
      )
    }

    // Show all cars
    console.log("\n── All Cars ──")
    for (const c of cars) {
      const img = parseAdaloJson(c.Image)
      const year = Number(c["Year Of Build"]) || Number(c.Year) || 0
      console.log(
        `  ${c.Make} ${c.Model || ""} (${year}) | owner=${c.Owner} | track=${c.Track || "none"} | rate=$${c["Rate Per Day"]} | img=${img?.url ? "yes" : "no"} | active=${c["Active/inActive?"]}`
      )
    }

    console.log("\n✅ Dry run complete. No data was written.")
    return
  }

  // ── Production run ──
  const convex = new ConvexHttpClient(CONVEX_URL!)

  // Step 1: Create tracks
  console.log("── Step 1: Creating Tracks ──")
  const trackMap = new Map<string, Id<"tracks">>() // track name → convex ID

  // Always create a placeholder track for cars with no track assigned
  const allTrackNames = [...trackNames, "Unassigned"]
  for (const trackName of allTrackNames) {
    console.log(`  Creating track: ${trackName}`)
    const trackId = await convex.mutation(api.tracks.createMigrationTrack, {
      name: trackName,
      location: trackName,
      isActive: trackName !== "Unassigned",
    })
    trackMap.set(trackName, trackId)
    console.log(`  ✓ ${trackName} → ${trackId}`)
  }

  // Step 2: Migrate users
  console.log("\n── Step 2: Migrating Users ──")
  const userMap = new Map<string, string>() // email → convex user _id
  const clerkUserMap = new Map<string, string>() // email → clerk user id
  let userSuccessCount = 0
  let userErrorCount = 0

  for (let i = 0; i < users.length; i++) {
    const u = users[i]
    const email = u.Email.trim().toLowerCase()
    const { firstName, lastName } = splitName(u["Full Name"])

    console.log(`  [${i + 1}/${users.length}] ${email}`)

    try {
      // Check if user already exists in Convex (idempotent re-runs)
      const existingUser = await convex.query(api.users.getByEmail, { email })
      if (existingUser) {
        console.log(`    Already in Convex: ${existingUser._id}`)
        userMap.set(email, existingUser._id)
        userSuccessCount++
        continue
      }

      // Create Clerk user (with invitation, no password required)
      let clerkUserId: string

      try {
        // First check if user already exists in Clerk
        const searchResult = (await clerkApiWithRetry(
          "GET",
          `/users?email_address=${encodeURIComponent(email)}`
        )) as { id: string }[]

        if (searchResult.length > 0) {
          clerkUserId = searchResult[0].id
          console.log(`    Existing Clerk user: ${clerkUserId}`)
        } else {
          // Create invitation (silent)
          await clerkApiWithRetry("POST", "/invitations", {
            email_address: email,
            notify: false,
            ignore_existing: true,
          })

          // Create the user
          const clerkUser = (await clerkApiWithRetry("POST", "/users", {
            email_address: [email],
            first_name: firstName || undefined,
            last_name: lastName || undefined,
            skip_password_requirement: true,
          })) as { id: string }
          clerkUserId = clerkUser.id
          console.log(`    Clerk user: ${clerkUserId}`)
        }
        clerkUserMap.set(email, clerkUserId)
      } catch (e: unknown) {
        // If user already exists in Clerk, try to find them
        const errMsg = String(e)
        if (errMsg.includes("already exists") || errMsg.includes("taken")) {
          console.log("    Clerk user already exists, searching...")
          const found = (await clerkApiWithRetry(
            "GET",
            `/users?email_address=${encodeURIComponent(email)}`
          )) as { id: string }[]
          if (found.length > 0) {
            clerkUserId = found[0].id
            clerkUserMap.set(email, clerkUserId)
            console.log(`    Found existing Clerk user: ${clerkUserId}`)
          } else {
            throw new Error(`Clerk user exists but not found via search: ${email}`)
          }
        } else {
          throw e
        }
      }

      // Upload profile image if present
      let profileImageR2Key: string | undefined
      const picData = parseAdaloJson(u["Profile Picture"])
      if (picData?.url) {
        console.log("    Downloading profile image...")
        const img = await downloadImage(picData.url)
        if (img) {
          const ext = picData.url.split(".").pop() || "jpg"
          const key = `images/profiles/migration/${crypto.randomUUID()}.${ext}`
          console.log(`    Uploading to R2: ${key}`)
          const ok = await uploadToR2(key, img.buffer, img.contentType)
          if (ok) {
            profileImageR2Key = key
            console.log("    ✓ Image uploaded")
          }
        }
      }

      // Determine user type
      const isOwner = ownerEmails.has(email)
      const userType = mapUserType(u["User Type"], isOwner)
      const experience = mapExperience(u["Experience (Track Days)"])

      // Insert Convex user
      const convexUserId = await convex.mutation(api.users.createMigrationUser, {
        externalId: clerkUserId,
        name: u["Full Name"]?.trim() || "",
        email,
        phone: u["Organisation Phone Number"]?.trim() || undefined,
        bio: u.Bio?.trim() || undefined,
        profileImageR2Key,
        userType,
        experience,
        location: u["Organisation Name"]?.trim() || undefined,
        stripeAccountId: u["Provider's Stripe ID"]?.trim() || undefined,
        memberSince: u.Created || undefined,
        rating: 0,
        totalRentals: 0,
        isHost: isOwner,
        isBanned: false,
      })

      userMap.set(email, convexUserId)
      userSuccessCount++
      console.log(`    ✓ Convex user: ${convexUserId}`)
    } catch (e) {
      userErrorCount++
      console.error(`    ✗ Error: ${e}`)
    }

    // Rate limit: delay between Clerk API calls to avoid 429s
    await sleep(500)
  }

  console.log(`\n  Users migrated: ${userSuccessCount} success, ${userErrorCount} errors`)

  // Step 3: Migrate vehicles
  console.log("\n── Step 3: Migrating Vehicles ──")
  let vehicleSuccessCount = 0
  let vehicleErrorCount = 0

  for (let i = 0; i < cars.length; i++) {
    const c = cars[i]
    const ownerEmail = c.Owner?.trim().toLowerCase()
    const make = c.Make?.trim()
    const model = c.Model?.trim() || ""
    const year = Number(c["Year Of Build"]) || Number(c.Year) || 0

    console.log(`  [${i + 1}/${cars.length}] ${make} ${model} (${year}) - owner: ${ownerEmail}`)

    try {
      // Look up owner
      const ownerId = userMap.get(ownerEmail)
      if (!ownerId) {
        console.warn(`    ⚠ Owner not found: ${ownerEmail}, skipping`)
        vehicleErrorCount++
        continue
      }

      // Look up track (fall back to "Unassigned" placeholder)
      const trackName = c.Track?.trim()
      const trackId =
        (trackName ? trackMap.get(trackName) : undefined) ?? trackMap.get("Unassigned")
      if (!trackId) {
        console.warn("    ⚠ No track available, skipping")
        vehicleErrorCount++
        continue
      }
      if (!trackName) {
        console.log(`    Using "Unassigned" track`)
      }

      // Build description
      const parts: string[] = []
      if (c.Description?.trim()) parts.push(c.Description.trim())
      if (c["About The Car"]?.trim()) parts.push(c["About The Car"].trim())
      if (c["Base Rate Inclusions"]?.trim()) {
        parts.push(`\nBase Rate Inclusions:\n${c["Base Rate Inclusions"].trim()}`)
      }
      const description = parts.join("\n\n") || `${make} ${model}`

      // Create vehicle
      const now = Date.now()
      const vehicleId = await convex.mutation(api.vehicles.createMigrationVehicle, {
        ownerId,
        trackId,
        make,
        model,
        year,
        dailyRate: Number(c["Rate Per Day"]) || 0,
        description,
        horsepower: Number(c.HorsePower) || undefined,
        transmission: c["Car Transmission Type"]?.trim() || undefined,
        drivetrain: c["Drive Type"]?.trim() || undefined,
        isActive: c["Active/inActive?"]?.toUpperCase() === "TRUE",
        isApproved: false,
        amenities: [],
        addOns: [],
        viewCount: 0,
        shareCount: 0,
        createdAt: new Date(c.Created).getTime() || now,
        updatedAt: now,
      })

      console.log(`    ✓ Vehicle: ${vehicleId}`)

      // Upload vehicle image
      const imgData = parseAdaloJson(c.Image)
      if (imgData?.url) {
        console.log("    Downloading vehicle image...")
        const img = await downloadImage(imgData.url)
        if (img) {
          const ext = imgData.url.split(".").pop() || "jpg"
          const key = `images/vehicles/${vehicleId}/${crypto.randomUUID()}.${ext}`
          console.log(`    Uploading to R2: ${key}`)
          const ok = await uploadToR2(key, img.buffer, img.contentType)
          if (ok) {
            await convex.mutation(api.vehicles.createMigrationVehicleImage, {
              vehicleId,
              r2Key: key,
              isPrimary: true,
              order: 0,
            })
            console.log("    ✓ Image uploaded and linked")
          }
        }
      }

      vehicleSuccessCount++
    } catch (e) {
      vehicleErrorCount++
      console.error(`    ✗ Error: ${e}`)
    }
  }

  console.log(`\n  Vehicles migrated: ${vehicleSuccessCount} success, ${vehicleErrorCount} errors`)

  console.log("\n✅ Migration complete!")
  console.log(`  Tracks: ${trackMap.size}`)
  console.log(`  Users: ${userSuccessCount}`)
  console.log(`  Vehicles: ${vehicleSuccessCount}`)
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})
