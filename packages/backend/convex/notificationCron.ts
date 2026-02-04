import { Crons } from "@convex-dev/crons"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { components, internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"
import { getUnreadMessagesDigestEmailTemplate, resendComponent } from "./emails"
import { getWebUrl } from "./helpers"
import { logError } from "./logger"

// Initialize the Crons component
export const crons = new Crons(components.crons)

// Configuration constants
const HOURS_BETWEEN_DIGESTS = 2
const MINUTES_PER_HOUR = 60
const SECONDS_PER_MINUTE = 60
const MS_PER_SECOND = 1000
const MIN_DIGEST_INTERVAL =
  HOURS_BETWEEN_DIGESTS * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND

// Types for unread conversation tracking
type UnreadConversationInfo = {
  conversationId: string
  unreadCount: number
  lastMessageText?: string
  vehicleId?: string
  otherUserId: string
}

type DigestResults = {
  usersChecked: number
  emailsSent: number
  skippedNoEmail: number
  skippedRecentDigest: number
  skippedNoPreference: number
  errors: string[]
}

// Helper function to check test mode
function isTestMode(): boolean {
  return process.env.RESEND_TEST_MODE !== "false"
}

// Helper function to get from email address
function getFromEmail(): string {
  if (isTestMode()) {
    return "delivered@resend.dev"
  }
  return process.env.RESEND_FROM_EMAIL || "Renegade Rentals <support@renegaderace.com>"
}

// Helper function to convert email for test mode
function getTestEmail(originalEmail: string): string {
  if (isTestMode()) {
    return "delivered@resend.dev"
  }
  return originalEmail
}


// Build map of users to their unread conversations
function buildUserUnreadMap(
  conversations: Array<{
    _id: Id<"conversations">
    renterId: string
    ownerId: string
    vehicleId?: Id<"vehicles">
    unreadCountRenter?: number
    unreadCountOwner?: number
    lastMessageText?: string
  }>
): Map<string, UnreadConversationInfo[]> {
  const userUnreadMap = new Map<string, UnreadConversationInfo[]>()

  for (const conversation of conversations) {
    // Check renter's unread count
    if (conversation.unreadCountRenter && conversation.unreadCountRenter > 0) {
      const existing = userUnreadMap.get(conversation.renterId) || []
      existing.push({
        conversationId: conversation._id,
        unreadCount: conversation.unreadCountRenter,
        lastMessageText: conversation.lastMessageText,
        vehicleId: conversation.vehicleId,
        otherUserId: conversation.ownerId,
      })
      userUnreadMap.set(conversation.renterId, existing)
    }

    // Check owner's unread count
    if (conversation.unreadCountOwner && conversation.unreadCountOwner > 0) {
      const existing = userUnreadMap.get(conversation.ownerId) || []
      existing.push({
        conversationId: conversation._id,
        unreadCount: conversation.unreadCountOwner,
        lastMessageText: conversation.lastMessageText,
        vehicleId: conversation.vehicleId,
        otherUserId: conversation.renterId,
      })
      userUnreadMap.set(conversation.ownerId, existing)
    }
  }

  return userUnreadMap
}

// Build conversation details for email template
function buildConversationDetails(ctx: MutationCtx, unreadConversations: UnreadConversationInfo[]) {
  return Promise.all(
    unreadConversations.map(async (conv) => {
      const otherUser = await ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", conv.otherUserId))
        .first()

      const vehicle = conv.vehicleId
        ? await ctx.db.get(conv.vehicleId as Id<"vehicles">)
        : null

      return {
        senderName: otherUser?.name || "Unknown User",
        vehicleName: vehicle
          ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
          : "Unknown Vehicle",
        unreadCount: conv.unreadCount,
        lastMessagePreview: conv.lastMessageText || "New message",
      }
    })
  )
}

// Check if a user should receive a digest email
function shouldSendDigest(
  user: {
    email?: string
    notificationPreferences?: { messages?: boolean }
    lastMessageDigestAt?: number
  },
  now: number
): { send: boolean; reason?: "no_email" | "no_preference" | "recent_digest" } {
  if (!user.email) {
    return { send: false, reason: "no_email" }
  }

  const messagesEnabled = user.notificationPreferences?.messages ?? true
  if (!messagesEnabled) {
    return { send: false, reason: "no_preference" }
  }

  if (user.lastMessageDigestAt && now - user.lastMessageDigestAt < MIN_DIGEST_INTERVAL) {
    return { send: false, reason: "recent_digest" }
  }

  return { send: true }
}

// Send digest email to a user
async function sendDigestEmail(
  ctx: MutationCtx,
  user: { _id: Id<"users">; name: string; email: string },
  unreadConversations: UnreadConversationInfo[],
  now: number
): Promise<{ success: boolean; error?: string }> {
  const conversationDetails = await buildConversationDetails(ctx, unreadConversations)
  const totalUnreadCount = conversationDetails.reduce((sum, conv) => sum + conv.unreadCount, 0)

  const template = getUnreadMessagesDigestEmailTemplate({
    userName: user.name,
    totalUnreadCount,
    conversations: conversationDetails,
    messagesUrl: `${getWebUrl()}/messages`,
  })

  try {
    const recipientEmail = getTestEmail(user.email)
    await resendComponent.sendEmail(ctx, {
      from: getFromEmail(),
      to: [recipientEmail],
      subject: template.subject,
      html: template.html,
      text: template.text,
    })

    await ctx.db.patch(user._id, { lastMessageDigestAt: now })
    return { success: true }
  } catch (error) {
    const errorMsg = `Failed to send digest to ${user.email}: ${error instanceof Error ? error.message : "Unknown error"}`
    logError(error, "Message digest email send failed")
    return { success: false, error: errorMsg }
  }
}

/**
 * Process unread message notifications for all users.
 * Runs as a cron job to send consolidated digest emails.
 */
export const processUnreadMessageDigests = internalMutation({
  args: {},
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Cron handler needs multiple validation checks
  handler: async (ctx) => {
    const now = Date.now()
    const results: DigestResults = {
      usersChecked: 0,
      emailsSent: 0,
      skippedNoEmail: 0,
      skippedRecentDigest: 0,
      skippedNoPreference: 0,
      errors: [],
    }

    // Get all conversations and build user unread map
    const allConversations = await ctx.db.query("conversations").collect()
    const userUnreadMap = buildUserUnreadMap(allConversations)

    // Process each user with unread messages
    for (const [userId, unreadConversations] of userUnreadMap) {
      results.usersChecked++

      const user = await ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", userId))
        .first()

      if (!user) {
        continue
      }

      const check = shouldSendDigest(user, now)
      if (!check.send) {
        if (check.reason === "no_email") {
          results.skippedNoEmail++
        } else if (check.reason === "no_preference") {
          results.skippedNoPreference++
        } else if (check.reason === "recent_digest") {
          results.skippedRecentDigest++
        }
        continue
      }

      // user.email is guaranteed to exist if shouldSendDigest returns send: true
      const userEmail = user.email ?? ""
      const sendResult = await sendDigestEmail(
        ctx,
        { _id: user._id, name: user.name, email: userEmail },
        unreadConversations,
        now
      )

      if (sendResult.success) {
        results.emailsSent++
      } else if (sendResult.error) {
        results.errors.push(sendResult.error)
      }
    }

    return results
  },
})

/**
 * Register the message digest cron job (idempotent).
 * Runs every 30 minutes to check for users with unread messages.
 */
export const registerMessageDigestCron: ReturnType<typeof internalMutation> = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cronName = "message-digest"

    const existingCron = await crons.get(ctx, { name: cronName })
    if (existingCron !== null) {
      return { status: "already_registered", cronId: existingCron.id }
    }

    // Register cron: "*/30 * * * *" = every 30 minutes
    const cronId = await crons.register(
      ctx,
      { kind: "cron", cronspec: "*/30 * * * *" },
      internal.notificationCron.processUnreadMessageDigests,
      {},
      cronName
    )

    return { status: "registered", cronId }
  },
})

/**
 * Unregister the message digest cron job (for cleanup/testing).
 */
export const unregisterMessageDigestCron = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cronName = "message-digest"

    try {
      await crons.delete(ctx, { name: cronName })
      return { status: "unregistered" }
    } catch {
      return { status: "not_found" }
    }
  },
})
