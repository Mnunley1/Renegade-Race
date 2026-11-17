import type { UserJSON } from "@clerk/backend"
import { type Validator, v } from "convex/values"
import { api, internal } from "./_generated/api"
import {
  action,
  type ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server"
import { getWelcomeEmailTemplate, sendTransactionalEmail } from "./emails"
import { isEarlyAdopterPromoActive, resolvePlatformFeePercentage } from "./pricing"
import { clearDraftUploads, requireDraftUpload } from "./r2"
import { retrieveLinkedConnectAccount } from "./stripeOwnership"
import { publicUserProfile } from "./userProfile"

/** Matches Clerk/Convex placeholder names like "null null" from `${null} ${null}`. */
const NULLISH_NAME_RE = /^(null|undefined)(\s+(null|undefined))+$/i

type EarlyAdopterGrant = {
  isEarlyAdopter: true
  platformFeeCapPercentage: number
  earlyAdopterGrantedAt: number
}

/** Fields to stamp on a new user when the early-adopter promo window is active. */
async function earlyAdopterGrantIfPromoActive(
  ctx: MutationCtx
): Promise<EarlyAdopterGrant | Record<string, never>> {
  const settings = await ctx.db
    .query("platformSettings")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .first()
  if (!isEarlyAdopterPromoActive(settings)) {
    return {}
  }
  const now = Date.now()
  return {
    isEarlyAdopter: true,
    platformFeeCapPercentage: settings?.earlyAdopterFeeCapPercentage ?? 3,
    earlyAdopterGrantedAt: now,
  }
}

export const current = query({
  args: {},
  handler: async (ctx) => await getCurrentUser(ctx),
})

/** Provider-facing fee summary for host/coach portals. */
export const getMyPlatformFee = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first()
    const globalFeePercentage = settings?.platformFeePercentage ?? 5
    const effectiveFeePercentage = resolvePlatformFeePercentage(
      globalFeePercentage,
      user.platformFeeCapPercentage
    )

    return {
      isEarlyAdopter: user.isEarlyAdopter === true,
      platformFeeCapPercentage: user.platformFeeCapPercentage ?? null,
      globalFeePercentage,
      effectiveFeePercentage,
    }
  },
})

export const getByExternalId = query({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    const user = await userByExternalId(ctx, externalId)
    const profile = publicUserProfile(user)
    if (!profile) return null
    // The deployed settings page uses this field to load the caller's billing settings.
    const identity = await ctx.auth.getUserIdentity()
    return {
      ...profile,
      ...(identity?.subject === externalId ? { stripeCustomerId: user?.stripeCustomerId } : {}),
    }
  },
})

export const getByExternalIdInternal = internalQuery({
  args: { externalId: v.string() },
  handler: (ctx, { externalId }) => userByExternalId(ctx, externalId),
})

export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => publicUserProfile(await ctx.db.get(userId)),
})

function isPlaceholderUserName(name: string | null | undefined): boolean {
  const trimmed = name?.trim() ?? ""
  if (!trimmed) return true
  const lower = trimmed.toLowerCase()
  return (
    lower === "unknown user" ||
    lower === "null" ||
    lower === "undefined" ||
    NULLISH_NAME_RE.test(trimmed)
  )
}

/** Build a display name from Clerk parts — never stringifies null into "null null". */
function displayNameFromClerkParts(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string {
  return [firstName, lastName]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0 && !isPlaceholderUserName(part))
    .join(" ")
}

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> }, // no runtime validation, trust Clerk
  async handler(ctx, { data }) {
    const userData = data as UserJSON // Type assertion for Clerk data
    const user = await userByExternalId(ctx, data.id)
    const isNewUser = user === null
    const nameFromClerk = displayNameFromClerkParts(userData.first_name, userData.last_name)
    const userEmail = userData.email_addresses?.[0]?.email_address
    const fallbackName = userEmail || "Unknown User"

    if (isNewUser) {
      const userName = nameFromClerk || fallbackName
      const earlyAdopter = await earlyAdopterGrantIfPromoActive(ctx)
      await ctx.db.insert("users", {
        externalId: data.id,
        name: userName,
        email: userEmail,
        ...earlyAdopter,
      })

      // Send welcome email to new user
      if (userEmail) {
        try {
          const template = getWelcomeEmailTemplate(userName)
          await sendTransactionalEmail(ctx, userEmail, template)
        } catch (error) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { logError } = require("./logger")
          logError(error, "Failed to send welcome email")
          // Don't fail the mutation if email fails
        }
      }
    } else {
      // Only overwrite name when Clerk has real name parts, or the stored name is a placeholder.
      const updates: { name?: string; email?: string } = {
        email: userEmail || user.email,
      }
      if (nameFromClerk) {
        updates.name = nameFromClerk
      } else if (isPlaceholderUserName(user.name)) {
        updates.name = fallbackName
      }
      await ctx.db.patch(user._id, updates)
    }
  },
})

async function stripeDeletionBlocker(ctx: ActionCtx, stripeAccountId: string, clerkUserId: string) {
  const unverified =
    "Unable to verify your Stripe account balance. Please try again later or contact support."
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) throw new Error("Stripe is not configured")

    const { default: Stripe } = await import("stripe")
    const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" })
    const account = await retrieveLinkedConnectAccount(ctx, stripe, stripeAccountId, clerkUserId)
    const balance = await stripe.balance.retrieve({ stripeAccount: stripeAccountId })
    const balances = [...balance.pending, ...balance.available]
    if (account.metadata?.renegadeUserId !== clerkUserId) {
      return [...balances, ...(balance.connect_reserved ?? [])].some((entry) => entry.amount !== 0)
        ? unverified
        : null
    }
    if (balances.some((entry) => entry.amount > 0)) {
      return "Please wait for all Stripe payouts to complete before deleting your account."
    }
    return null
  } catch {
    return unverified
  }
}

async function rentalDeletionBlockers(ctx: QueryCtx, clerkUserId: string): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10)
  const bookings = ctx.db.query("reservations")
  const byRenter = bookings.withIndex("by_renter", (q) => q.eq("renterId", clerkUserId))
  const byHost = ctx.db
    .query("reservations")
    .withIndex("by_owner", (q) => q.eq("ownerId", clerkUserId))
  const [renterCount, hostCount] = await Promise.all(
    [byRenter, byHost].map(async (indexed) => {
      const active = await indexed
        .filter((q) =>
          q.and(
            q.gte(q.field("endDate"), today),
            q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "confirmed"))
          )
        )
        .collect()
      return active.length
    })
  )
  const blockers: string[] = []
  if (renterCount)
    blockers.push(`${renterCount} active booking(s) as a renter. Please cancel them first.`)
  if (hostCount) blockers.push(`${hostCount} active reservation(s) on your vehicles.`)
  return blockers
}

export const getRentalDeletionBlockers = internalQuery({
  args: { clerkUserId: v.string() },
  handler: (ctx, { clerkUserId }) => rentalDeletionBlockers(ctx, clerkUserId),
})

type DeletionEligibility = { canDelete: boolean; reason?: string; blockingFactors: string[] }

async function deletionEligibility(
  ctx: ActionCtx,
  clerkUserId: string,
  stripeAccountId?: string
): Promise<DeletionEligibility> {
  const blockingFactors = await ctx.runQuery(internal.users.getRentalDeletionBlockers, {
    clerkUserId,
  })
  if (stripeAccountId) {
    const blocker = await stripeDeletionBlocker(ctx, stripeAccountId, clerkUserId)
    if (blocker) blockingFactors.push(blocker)
  }
  return blockingFactors.length
    ? {
        canDelete: false,
        reason: `Cannot delete account: ${blockingFactors.join(" ")}`,
        blockingFactors,
      }
    : { canDelete: true, blockingFactors }
}

// Existing clients can pass their own Clerk ID. The authenticated subject is authoritative.
export const checkUserDeletionEligibility = action({
  args: { clerkUserId: v.optional(v.string()) },
  handler: async (ctx, args): Promise<DeletionEligibility> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    if (args.clerkUserId !== undefined && args.clerkUserId !== identity.subject) {
      throw new Error("Not authorized to check another user's deletion eligibility")
    }
    const user = await ctx.runQuery(internal.users.getByExternalIdInternal, {
      externalId: identity.subject,
    })
    if (!user) return { canDelete: true, blockingFactors: [] }
    return await deletionEligibility(ctx, identity.subject, user.stripeAccountId)
  },
})

// The signed Clerk user.deleted event is the authority to remove a local identity.
export const performUserDeletionWithChecks = internalAction({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }): Promise<void> => {
    const user = await ctx.runQuery(internal.users.getByExternalIdInternal, {
      externalId: clerkUserId,
    })
    if (!user) return
    const eligibility = await deletionEligibility(ctx, clerkUserId, user.stripeAccountId)
    if (!eligibility.canDelete) throw new Error(eligibility.reason)
    await ctx.runMutation(internal.users.performUserDeletion, {
      userId: user._id,
      clerkUserId,
      checkedStripeAccountId: user.stripeAccountId,
    })
  },
})

export const performUserDeletion = internalMutation({
  args: {
    userId: v.id("users"),
    clerkUserId: v.string(),
    checkedStripeAccountId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) return
    if (
      user.externalId !== args.clerkUserId ||
      user.stripeAccountId !== args.checkedStripeAccountId
    ) {
      throw new Error(
        "Account changed while verifying deletion eligibility. Retry the deletion check."
      )
    }
    // Recheck local obligations inside the deletion transaction after external Stripe I/O.
    const blockers = await rentalDeletionBlockers(ctx, args.clerkUserId)
    if (blockers.length) throw new Error(`Cannot delete account: ${blockers.join(" ")}`)
    await ctx.db.delete(user._id)
  },
})

export const updateProfileImage = mutation({
  args: {
    r2Key: v.optional(v.string()), // R2 object key (preferred)
    storageId: v.optional(v.id("_storage")), // Legacy Convex storage ID
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    // Get or create user
    let user = await userByExternalId(ctx, userId)
    if (!user) {
      // Create user if they don't exist
      const earlyAdopter = await earlyAdopterGrantIfPromoActive(ctx)
      const userData = {
        externalId: userId,
        name: identity.name || identity.email || "Unknown User",
        email: identity.email,
        ...earlyAdopter,
      }
      const newUserId = await ctx.db.insert("users", userData)
      user = await ctx.db.get(newUserId)
    }

    if (!user) {
      throw new Error("Failed to create or retrieve user")
    }

    if (args.r2Key) {
      await ctx.db.patch(user._id, {
        profileImageR2Key: args.r2Key,
      })
    } else if (args.storageId) {
      // Legacy: Get the URL from the storage ID
      const storageId = args.storageId
      const returnEvidence = await ctx.db.query("returnEvidence")
        .withIndex("by_storage", (q) => q.eq("storageId", storageId))
        .first()
      if (returnEvidence) throw new Error("File is unavailable for profile use")
      const profileImageUrl = await ctx.storage.getUrl(args.storageId)
      if (!profileImageUrl) {
        throw new Error("Failed to get image URL from storage")
      }
      await ctx.db.patch(user._id, {
        profileImage: profileImageUrl,
      })
    } else {
      throw new Error("Either r2Key or storageId must be provided")
    }

    return user._id
  },
})

export const updateProfile = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    interests: v.optional(v.array(v.string())),
    bio: v.optional(v.string()),
    location: v.optional(v.string()),
    experience: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    // Get or create user
    let user = await userByExternalId(ctx, userId)
    if (!user) {
      // Create user if they don't exist
      const earlyAdopter = await earlyAdopterGrantIfPromoActive(ctx)
      const userData = {
        externalId: userId,
        name: args.name || identity.name || identity.email || "Unknown User",
        email: args.email || identity.email,
        phone: args.phone,
        interests: args.interests,
        bio: args.bio,
        location: args.location,
        experience: args.experience,
        ...earlyAdopter,
      }
      const newUserId = await ctx.db.insert("users", userData)
      user = await ctx.db.get(newUserId)
    }

    if (!user) {
      throw new Error("Failed to create or retrieve user")
    }

    await ctx.db.patch(user._id, {
      name: args.name,
      email: args.email,
      phone: args.phone,
      interests: args.interests,
      bio: args.bio,
      location: args.location,
      experience: args.experience,
    })

    return user._id
  },
})

// Update notification preferences
export const updateNotificationPreferences = mutation({
  args: {
    preferences: v.object({
      reservationUpdates: v.boolean(),
      messages: v.boolean(),
      reviewsAndRatings: v.boolean(),
      paymentUpdates: v.boolean(),
      marketing: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const user = await userByExternalId(ctx, identity.subject)
    if (!user) {
      throw new Error("User not found")
    }

    await ctx.db.patch(user._id, {
      notificationPreferences: args.preferences,
    })

    return user._id
  },
})

// Get notification preferences for current user
export const getNotificationPreferences = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const user = await userByExternalId(ctx, identity.subject)
    if (!user) {
      return null
    }

    // Return default preferences if none set
    return (
      user.notificationPreferences || {
        reservationUpdates: true,
        messages: true,
        reviewsAndRatings: true,
        paymentUpdates: true,
        marketing: false,
      }
    )
  },
})

// Replacing an unclaimed legacy account is safe only before any checkout was opened.
async function hasPayoutHistory(ctx: QueryCtx, userId: string): Promise<boolean> {
  const records = await Promise.all([
    ctx.db
      .query("payments")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first(),
    ctx.db
      .query("coachingBookings")
      .withIndex("by_coach_user", (q) => q.eq("coachUserId", userId))
      .filter((q) =>
        q.or(
          q.neq(q.field("stripeCheckoutSessionId"), undefined),
          q.neq(q.field("stripePaymentIntentId"), undefined)
        )
      )
      .first(),
    ctx.db
      .query("damageInvoices")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .filter((q) =>
        q.or(
          q.neq(q.field("stripeCheckoutSessionId"), undefined),
          q.neq(q.field("stripePaymentIntentId"), undefined)
        )
      )
      .first(),
    ctx.db
      .query("seatBookings")
      .withIndex("by_host", (q) => q.eq("hostUserId", userId))
      .filter((q) =>
        q.or(
          q.neq(q.field("stripeDepositCheckoutSessionId"), undefined),
          q.neq(q.field("stripeBalanceCheckoutSessionId"), undefined),
          q.neq(q.field("stripeDepositPaymentIntentId"), undefined),
          q.neq(q.field("stripeBalancePaymentIntentId"), undefined)
        )
      )
      .first(),
  ])
  return records.some(Boolean)
}

export const hasPayoutHistoryForOnboarding = internalQuery({
  args: { userId: v.string() },
  handler: (ctx, { userId }) => hasPayoutHistory(ctx, userId),
})

// These IDs are established by server-side Stripe creation, never by a client.
export const setStripeAccountId = internalMutation({
  args: {
    userId: v.string(),
    stripeAccountId: v.string(),
    replaceUnusedAccount: v.optional(v.string()),
  },
  handler: async (ctx, { userId, stripeAccountId, replaceUnusedAccount }) => {
    const user = await userByExternalId(ctx, userId)
    if (!user) throw new Error("User not found")
    const existing = await ctx.db
      .query("users")
      .withIndex("by_stripe_account", (q) => q.eq("stripeAccountId", stripeAccountId))
      .unique()
    if (existing && existing._id !== user._id) throw new Error("Stripe account is already linked")
    if (user.stripeAccountId === stripeAccountId) return user._id
    if (user.stripeAccountId !== replaceUnusedAccount) throw new Error("Stripe account has changed")
    if (
      replaceUnusedAccount &&
      (user.stripeAccountStatus !== "pending" || (await hasPayoutHistory(ctx, userId)))
    ) {
      throw new Error("Existing payout account requires verification")
    }
    await ctx.db.patch(user._id, { stripeAccountId, stripeAccountStatus: "pending" })
    return user._id
  },
})

export const getByStripeAccountId = internalQuery({
  args: { stripeAccountId: v.string() },
  handler: async (ctx, { stripeAccountId }) =>
    ctx.db
      .query("users")
      .withIndex("by_stripe_account", (q) => q.eq("stripeAccountId", stripeAccountId))
      .unique(),
})

export const updateStripeAccountStatus = internalMutation({
  args: {
    stripeAccountId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("enabled"),
      v.literal("restricted"),
      v.literal("disabled")
    ),
  },
  handler: async (ctx, { stripeAccountId, status }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_account", (q) => q.eq("stripeAccountId", stripeAccountId))
      .unique()
    if (user) await ctx.db.patch(user._id, { stripeAccountStatus: status })
  },
})

export const setStripeCustomerId = internalMutation({
  args: { userId: v.string(), stripeCustomerId: v.string() },
  handler: async (ctx, { userId, stripeCustomerId }) => {
    const user = await userByExternalId(ctx, userId)
    if (!user) throw new Error("User not found")
    const existing = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", stripeCustomerId))
      .unique()
    if (
      (existing && existing._id !== user._id) ||
      (user.stripeCustomerId && user.stripeCustomerId !== stripeCustomerId)
    ) {
      throw new Error("Stripe customer is already linked")
    }
    if (!user.stripeCustomerId) await ctx.db.patch(user._id, { stripeCustomerId })
    return user._id
  },
})

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const userRecord = await getCurrentUser(ctx)
  if (!userRecord) throw new Error("Can't get current user")
  return userRecord
}

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (identity === null) {
    return null
  }
  return await userByExternalId(ctx, identity.subject)
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .unique()
}

// ============================================================================
// Host Onboarding Functions
// ============================================================================

export const getHostOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const user = await userByExternalId(ctx, identity.subject)
    if (!user) {
      return {
        status: "not_started" as const,
        steps: {
          personalInfo: false,
          vehicleAdded: false,
          payoutSetup: false,
          safetyStandards: false,
        },
      }
    }

    // Check if user has vehicles (for vehicleAdded step)
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .collect()

    // Check if user has Stripe account (for payoutSetup step)
    const hasStripeAccount = !!user.stripeAccountId

    // Auto-complete steps based on existing data
    // Note: payoutSetup is no longer required for onboarding completion
    const steps = {
      personalInfo: !!(user.phone && user.location),
      vehicleAdded: vehicles.length > 0,
      payoutSetup: hasStripeAccount, // Tracked but not required for completion
      safetyStandards: user.hostOnboardingSteps?.safetyStandards ?? false,
    }

    // Determine overall status
    // Only require vehicleAdded and safetyStandards for completion (payoutSetup is optional)
    const requiredStepsComplete =
      steps.vehicleAdded && (steps.safetyStandards || user.hostOnboardingStatus === "completed")
    const anyStepComplete = Object.values(steps).some((step) => step === true)

    let status: "not_started" | "in_progress" | "completed"
    if (user.hostOnboardingStatus === "completed" || requiredStepsComplete) {
      status = "completed"
    } else if (user.hostOnboardingStatus === "in_progress" || anyStepComplete) {
      status = "in_progress"
    } else {
      status = "not_started"
    }

    return {
      status,
      steps,
    }
  },
})

export const updateHostOnboardingStep = mutation({
  args: {
    step: v.union(
      v.literal("personalInfo"),
      v.literal("vehicleAdded"),
      v.literal("payoutSetup"),
      v.literal("safetyStandards")
    ),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const user = await userByExternalId(ctx, identity.subject)
    if (!user) {
      throw new Error("User not found")
    }

    const currentSteps = user.hostOnboardingSteps || {
      personalInfo: false,
      vehicleAdded: false,
      payoutSetup: false,
      safetyStandards: false,
    }

    const updatedSteps = {
      ...currentSteps,
      [args.step]: args.completed,
    }

    // Check if required steps are complete (payoutSetup is optional)
    const requiredStepsComplete = updatedSteps.vehicleAdded && updatedSteps.safetyStandards

    await ctx.db.patch(user._id, {
      hostOnboardingSteps: updatedSteps,
      hostOnboardingStatus: requiredStepsComplete
        ? "completed"
        : user.hostOnboardingStatus === "not_started"
          ? "in_progress"
          : user.hostOnboardingStatus || "in_progress",
    })

    return { success: true }
  },
})

export const saveOnboardingVehicleAddress = mutation({
  args: {
    address: v.object({
      street: v.string(),
      city: v.string(),
      state: v.string(),
      zipCode: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const user = await userByExternalId(ctx, identity.subject)
    if (!user) {
      throw new Error("User not found")
    }

    // Save address without coordinates first (geocoding happens async)
    await ctx.db.patch(user._id, {
      onboardingVehicleAddress: args.address,
      hostOnboardingStatus:
        user.hostOnboardingStatus === "not_started"
          ? "in_progress"
          : user.hostOnboardingStatus || "in_progress",
    })

    // Schedule geocoding action
    await ctx.scheduler.runAfter(0, api.users.geocodeOnboardingAddress, {
      userId: user._id,
      address: args.address,
    })

    return { success: true }
  },
})

// Internal mutation to update onboarding address coordinates after geocoding
export const updateOnboardingAddressCoordinates = internalMutation({
  args: {
    userId: v.id("users"),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user?.onboardingVehicleAddress) {
      return
    }

    await ctx.db.patch(args.userId, {
      onboardingVehicleAddress: {
        ...user.onboardingVehicleAddress,
        latitude: args.latitude,
        longitude: args.longitude,
      },
    })
  },
})

// Action to geocode onboarding address (can make network calls)
export const geocodeOnboardingAddress = action({
  args: {
    userId: v.id("users"),
    address: v.object({
      street: v.string(),
      city: v.string(),
      state: v.string(),
      zipCode: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const { geocodeAddress } = await import("./geocoding")

    const result = await geocodeAddress(args.address)

    if (result) {
      await ctx.runMutation(internal.users.updateOnboardingAddressCoordinates, {
        userId: args.userId,
        latitude: result.latitude,
        longitude: result.longitude,
      })
    }
  },
})

export const getOnboardingVehicleAddress = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const user = await userByExternalId(ctx, identity.subject)
    if (!user) {
      return null
    }

    return user.onboardingVehicleAddress || null
  },
})

export const completeHostOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const user = await userByExternalId(ctx, identity.subject)
    if (!user) {
      throw new Error("User not found")
    }

    // Publishing binds vehicle images before this mutation. Only unused, owned
    // onboarding uploads are eligible for cleanup.
    await clearDraftUploads(ctx, user)
    await ctx.db.patch(user._id, {
      hostOnboardingStatus: "completed",
      onboardingVehicleAddress: undefined,
      hostOnboardingDraft: undefined,
    })

    return { success: true }
  },
})

export const resetHostOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const user = await userByExternalId(ctx, identity.subject)
    if (!user) {
      throw new Error("User not found")
    }

    await ctx.db.patch(user._id, {
      hostOnboardingStatus: "not_started",
      hostOnboardingSteps: {
        personalInfo: false,
        vehicleAdded: false,
        payoutSetup: false,
        safetyStandards: false,
      },
    })

    return { success: true }
  },
})

export const checkFirstVehicle = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return false
    }

    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .collect()

    return vehicles.length === 0
  },
})

// Save onboarding draft data
export const saveOnboardingDraft = mutation({
  args: {
    address: v.optional(
      v.object({
        street: v.string(),
        city: v.string(),
        state: v.string(),
        zipCode: v.string(),
      })
    ),
    vehicleData: v.optional(
      v.object({
        trackId: v.optional(v.string()),
        make: v.string(),
        model: v.string(),
        year: v.number(),
        dailyRate: v.number(),
        description: v.string(),
        horsepower: v.optional(v.number()),
        transmission: v.optional(v.string()),
        drivetrain: v.optional(v.string()),
        engineType: v.optional(v.string()),
        mileage: v.optional(v.number()),
        amenities: v.array(v.string()),
        addOns: v.array(
          v.object({
            name: v.string(),
            price: v.number(),
            description: v.optional(v.string()),
            isRequired: v.optional(v.boolean()),
            priceType: v.optional(v.union(v.literal("daily"), v.literal("one-time"))),
          })
        ),
        advanceNotice: v.optional(v.string()),
        minTripDuration: v.optional(v.string()),
        maxTripDuration: v.optional(v.string()),
        requireWeekendMin: v.optional(v.boolean()),
      })
    ),
    images: v.optional(
      v.array(
        v.object({
          r2Key: v.string(),
          isPrimary: v.boolean(),
          order: v.number(),
        })
      )
    ),
    currentStep: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const user = await userByExternalId(ctx, identity.subject)
    if (!user) {
      throw new Error("User not found")
    }

    if (args.images) {
      const keys = new Set(args.images.map((image) => image.r2Key))
      if (keys.size !== args.images.length) throw new Error("Choose distinct onboarding photos")
      for (const key of keys) await requireDraftUpload(ctx, user.externalId, key)
      await clearDraftUploads(ctx, user, keys)
    }

    const currentDraft = user.hostOnboardingDraft || {}
    const updatedDraft = {
      ...currentDraft,
      address: args.address ?? currentDraft.address,
      vehicleData: args.vehicleData ?? currentDraft.vehicleData,
      images: args.images ?? currentDraft.images,
      currentStep: args.currentStep ?? currentDraft.currentStep,
      lastSavedAt: Date.now(),
    }

    await ctx.db.patch(user._id, {
      hostOnboardingDraft: updatedDraft,
      hostOnboardingStatus:
        user.hostOnboardingStatus === "not_started"
          ? "in_progress"
          : user.hostOnboardingStatus || "in_progress",
    })

    return { success: true }
  },
})

// Get onboarding draft data
export const getOnboardingDraft = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const user = await userByExternalId(ctx, identity.subject)
    if (!user) {
      return null
    }

    return user.hostOnboardingDraft || null
  },
})

// Clear onboarding draft
export const clearOnboardingDraft = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const user = await userByExternalId(ctx, identity.subject)
    if (!user) {
      throw new Error("User not found")
    }

    await clearDraftUploads(ctx, user)

    await ctx.db.patch(user._id, {
      hostOnboardingDraft: undefined,
    })

    return { success: true }
  },
})

// Start over onboarding - clears draft, images, and resets status
export const startOverOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const user = await userByExternalId(ctx, identity.subject)
    if (!user) {
      throw new Error("User not found")
    }

    await clearDraftUploads(ctx, user)

    // Reset onboarding status and clear all draft data
    await ctx.db.patch(user._id, {
      hostOnboardingStatus: "not_started",
      hostOnboardingDraft: undefined,
      onboardingVehicleAddress: undefined,
    })

    return { success: true }
  },
})
