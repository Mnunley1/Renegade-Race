/**
 * Send Clerk Invitations Script
 *
 * Triggers Clerk to send invitation emails to all pending invitations.
 * Run this when ready to launch and invite migrated users.
 *
 * Usage:
 *   npx tsx packages/backend/scripts/send-invitations.ts --dry-run
 *   npx tsx packages/backend/scripts/send-invitations.ts
 *
 * Required env vars:
 *   CLERK_SECRET_KEY - Clerk API secret key
 */

const DRY_RUN = process.argv.includes("--dry-run")
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY

if (!CLERK_SECRET_KEY) {
  console.error("Missing required env var: CLERK_SECRET_KEY")
  process.exit(1)
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface ClerkInvitation {
  id: string
  email_address: string
  status: string
  created_at: number
}

async function main() {
  console.log(
    `\n📧 Clerk Invitation Sender ${DRY_RUN ? "(DRY RUN)" : "(PRODUCTION)"}\n`
  )

  // List all pending invitations
  console.log("Fetching pending invitations...")
  let allInvitations: ClerkInvitation[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const batch = (await clerkApi(
      "GET",
      `/invitations?status=pending&limit=${limit}&offset=${offset}`
    )) as { data: ClerkInvitation[]; total_count: number }

    const invitations = Array.isArray(batch) ? batch : batch.data || []
    if (invitations.length === 0) break

    allInvitations = allInvitations.concat(invitations)
    offset += limit

    if (invitations.length < limit) break
  }

  console.log(`Found ${allInvitations.length} pending invitations\n`)

  if (allInvitations.length === 0) {
    console.log("No pending invitations to send.")
    return
  }

  if (DRY_RUN) {
    console.log("── Pending Invitations ──")
    for (const inv of allInvitations) {
      console.log(`  ${inv.email_address} (${inv.id})`)
    }
    console.log(`\n✅ Dry run complete. ${allInvitations.length} invitations would be sent.`)
    return
  }

  // Revoke and re-create each invitation with notify: true
  let sentCount = 0
  let errorCount = 0

  for (let i = 0; i < allInvitations.length; i++) {
    const inv = allInvitations[i]
    console.log(`[${i + 1}/${allInvitations.length}] Sending to ${inv.email_address}...`)

    try {
      // Revoke the silent invitation
      await clerkApi("POST", `/invitations/${inv.id}/revoke`, {})

      // Re-create with notification enabled
      await clerkApi("POST", "/invitations", {
        email_address: inv.email_address,
        notify: true,
        ignore_existing: true,
      })

      sentCount++
      console.log(`  ✓ Sent`)
    } catch (e) {
      errorCount++
      console.error(`  ✗ Error: ${e}`)
    }

    // Rate limit
    await sleep(200)
  }

  console.log(`\n✅ Complete: ${sentCount} sent, ${errorCount} errors`)
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})
