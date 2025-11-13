import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Resend } from 'resend'

// Helper function to check if user is admin
async function checkAdmin(ctx: any) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Not authenticated')
  }

  // When session token is configured with { "metadata": "{{user.public_metadata}}" },
  // the metadata is available in identity.metadata
  const role =
    (identity as any).metadata?.role || // From session token (recommended)
    (identity as any).publicMetadata?.role || // Direct from Clerk
    (identity as any).orgRole

  if (role !== 'admin') {
    throw new Error('Admin access required')
  }

  return identity
}

// Initialize Resend client
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }
  return new Resend(apiKey)
}

// Send mass email to users
export const sendMassEmail = mutation({
  args: {
    recipientType: v.union(
      v.literal('all'),
      v.literal('owners'),
      v.literal('renters'),
      v.literal('custom')
    ),
    customRecipients: v.optional(v.array(v.string())), // Array of email addresses
    subject: v.string(),
    htmlContent: v.string(),
    textContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const resend = getResendClient()

    // Get recipients based on type
    let recipients: string[] = []

    if (args.recipientType === 'custom' && args.customRecipients) {
      recipients = args.customRecipients
    } else {
      // Fetch users from database
      const allUsers = await ctx.db.query('users').collect()

      if (args.recipientType === 'all') {
        recipients = allUsers
          .map((user) => user.email)
          .filter((email): email is string => !!email)
      } else if (args.recipientType === 'owners') {
        // Get users who own vehicles
        const vehicles = await ctx.db.query('vehicles').collect()
        const ownerIds = new Set(vehicles.map((v) => v.ownerId))
        recipients = allUsers
          .filter((user) => ownerIds.has(user.externalId))
          .map((user) => user.email)
          .filter((email): email is string => !!email)
      } else if (args.recipientType === 'renters') {
        // Get users who have made reservations
        const reservations = await ctx.db.query('reservations').collect()
        const renterIds = new Set(reservations.map((r) => r.renterId))
        recipients = allUsers
          .filter((user) => renterIds.has(user.externalId))
          .map((user) => user.email)
          .filter((email): email is string => !!email)
      }
    }

    if (recipients.length === 0) {
      throw new Error('No recipients found')
    }

    // Send emails using Resend
    // Resend supports batch sending, but we'll send individually for better error handling
    const results = []
    const errors = []

    for (const recipient of recipients) {
      try {
        const result = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Renegade Rentals <noreply@renegaderentals.com>',
          to: recipient,
          subject: args.subject,
          html: args.htmlContent,
          text: args.textContent || args.htmlContent.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        })

        results.push({ recipient, success: true, id: result.data?.id })
      } catch (error) {
        errors.push({
          recipient,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return {
      success: true,
      totalRecipients: recipients.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
    }
  },
})

// Get email sending history (stored in a simple log format)
// Note: For production, you might want to create a dedicated emails table
export const getEmailHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    // This is a placeholder - in production you'd want to store email history in a table
    // For now, we'll return an empty array
    return []
  },
})

