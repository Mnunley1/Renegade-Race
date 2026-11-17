import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import { checkAdmin } from "./admin"
import { ErrorCode, throwError } from "./errors"
import { rateLimiter } from "./rateLimiter"
import { sanitizeMessage, sanitizeShortText } from "./sanitize"
import { getCurrentUser, getCurrentUserOrThrow } from "./users"
import { publicDisplayName } from "./userProfile"

const contactInfoValidator = v.object({
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
})

const socialLinksValidator = v.object({
  instagram: v.optional(v.string()),
  twitter: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  website: v.optional(v.string()),
})

const MAX_RATE_CENTS = 5_000_000 // $50,000
const MIN_RATE_CENTS = 100 // $1

function validateRates(rates: {
  hourlyRate?: number
  halfDayRate?: number
  fullDayRate?: number
}) {
  const set = [rates.hourlyRate, rates.halfDayRate, rates.fullDayRate].filter(
    (r) => r !== undefined
  ) as number[]
  if (set.length === 0) {
    throwError(ErrorCode.INVALID_AMOUNT, "At least one rate (hourly, half-day, or full-day) is required")
  }
  for (const rate of set) {
    if (rate < MIN_RATE_CENTS || rate > MAX_RATE_CENTS) {
      throwError(ErrorCode.INVALID_AMOUNT, "Rates must be between $1 and $50,000")
    }
  }
}

export const create = mutation({
  args: {
    headline: v.optional(v.string()),
    bio: v.string(),
    avatarUrl: v.optional(v.string()),
    avatarR2Key: v.optional(v.string()),
    yearsExperience: v.optional(v.number()),
    specialties: v.array(v.string()),
    certifications: v.optional(v.array(v.string())),
    tracksCoachedAt: v.optional(v.array(v.string())),
    racingType: v.optional(
      v.union(v.literal("real-world"), v.literal("sim-racing"), v.literal("both"))
    ),
    hourlyRate: v.optional(v.number()),
    halfDayRate: v.optional(v.number()),
    fullDayRate: v.optional(v.number()),
    location: v.string(),
    contactInfo: v.optional(contactInfoValidator),
    socialLinks: v.optional(socialLinksValidator),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    await rateLimiter.limit(ctx, "updateProfile", { key: user.externalId, throws: true })

    const existing = await ctx.db
      .query("coachProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user.externalId))
      .first()
    if (existing) {
      throwError(
        ErrorCode.ALREADY_EXISTS,
        "You already have a coach profile. Update your existing profile instead."
      )
    }

    if (!args.bio.trim()) {
      throwError(ErrorCode.INVALID_INPUT, "Bio is required")
    }
    if (args.specialties.length === 0) {
      throwError(ErrorCode.INVALID_INPUT, "At least one specialty is required")
    }
    validateRates(args)

    const now = Date.now()
    return await ctx.db.insert("coachProfiles", {
      userId: user.externalId,
      headline: args.headline ? sanitizeShortText(args.headline) : undefined,
      bio: sanitizeMessage(args.bio),
      avatarUrl: args.avatarUrl,
      avatarR2Key: args.avatarR2Key,
      yearsExperience: args.yearsExperience,
      specialties: args.specialties,
      certifications: args.certifications,
      tracksCoachedAt: args.tracksCoachedAt,
      racingType: args.racingType,
      hourlyRate: args.hourlyRate,
      halfDayRate: args.halfDayRate,
      fullDayRate: args.fullDayRate,
      location: args.location,
      contactInfo: args.contactInfo,
      socialLinks: args.socialLinks,
      isActive: true,
      viewCount: 0,
      verificationStatus: "pending",
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    profileId: v.id("coachProfiles"),
    headline: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    avatarR2Key: v.optional(v.string()),
    yearsExperience: v.optional(v.number()),
    specialties: v.optional(v.array(v.string())),
    certifications: v.optional(v.array(v.string())),
    tracksCoachedAt: v.optional(v.array(v.string())),
    racingType: v.optional(
      v.union(v.literal("real-world"), v.literal("sim-racing"), v.literal("both"))
    ),
    hourlyRate: v.optional(v.number()),
    halfDayRate: v.optional(v.number()),
    fullDayRate: v.optional(v.number()),
    location: v.optional(v.string()),
    contactInfo: v.optional(contactInfoValidator),
    socialLinks: v.optional(socialLinksValidator),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const { profileId, ...rest } = args

    const profile = await ctx.db.get(profileId)
    if (!profile) {
      throwError(ErrorCode.NOT_FOUND, "Coach profile not found")
    }
    if (profile.userId !== user.externalId) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized to update this profile")
    }

    await rateLimiter.limit(ctx, "updateProfile", { key: user.externalId, throws: true })

    // If any rate is being touched, re-validate the merged set
    if (
      rest.hourlyRate !== undefined ||
      rest.halfDayRate !== undefined ||
      rest.fullDayRate !== undefined
    ) {
      validateRates({
        hourlyRate: rest.hourlyRate ?? profile.hourlyRate,
        halfDayRate: rest.halfDayRate ?? profile.halfDayRate,
        fullDayRate: rest.fullDayRate ?? profile.fullDayRate,
      })
    }

    const updates: Record<string, unknown> = { ...rest, updatedAt: Date.now() }
    if (rest.headline !== undefined) {
      updates.headline = rest.headline ? sanitizeShortText(rest.headline) : undefined
    }
    if (rest.bio !== undefined) {
      if (!rest.bio.trim()) {
        throwError(ErrorCode.INVALID_INPUT, "Bio cannot be empty")
      }
      updates.bio = sanitizeMessage(rest.bio)
    }
    if (rest.specialties !== undefined && rest.specialties.length === 0) {
      throwError(ErrorCode.INVALID_INPUT, "At least one specialty is required")
    }

    await ctx.db.patch(profileId, updates)
    return profileId
  },
})

async function enrichWithUser(ctx: any, profile: Doc<"coachProfiles">) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_external_id", (q: any) => q.eq("externalId", profile.userId))
    .first()
  return {
    ...profile,
    user: user
      ? {
          name: publicDisplayName(user),
          avatarUrl: user.profileImage as string | undefined,
          memberSince: user.memberSince as string | undefined,
        }
      : {
          name: "Unknown Coach",
          avatarUrl: undefined as string | undefined,
          memberSince: undefined as string | undefined,
        },
  }
}

export const list = query({
  args: {
    location: v.optional(v.string()),
    specialty: v.optional(v.string()),
    racingType: v.optional(
      v.union(v.literal("real-world"), v.literal("sim-racing"), v.literal("both"))
    ),
    maxHourlyRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let profilesQuery = ctx.db
      .query("coachProfiles")
      .withIndex("by_active", (q) => q.eq("isActive", true))

    if (args.location) {
      profilesQuery = profilesQuery.filter((q) => q.eq(q.field("location"), args.location))
    }
    if (args.racingType) {
      profilesQuery = profilesQuery.filter((q) =>
        q.or(q.eq(q.field("racingType"), args.racingType), q.eq(q.field("racingType"), "both"))
      )
    }

    const profiles = await profilesQuery.collect()

    let filtered = profiles
    if (args.specialty) {
      const specialty = args.specialty
      filtered = filtered.filter((p) => p.specialties.includes(specialty))
    }
    if (args.maxHourlyRate !== undefined) {
      const max = args.maxHourlyRate
      filtered = filtered.filter((p) => p.hourlyRate !== undefined && p.hourlyRate <= max)
    }

    return await Promise.all(filtered.map((p) => enrichWithUser(ctx, p)))
  },
})

export const getById = query({
  args: { profileId: v.id("coachProfiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId)
    if (!profile) {
      return null
    }

    let isOwner = false
    const current = await getCurrentUser(ctx)
    if (current && profile.userId === current.externalId) {
      isOwner = true
    }

    const enriched = await enrichWithUser(ctx, profile)
    return { ...enriched, isOwner }
  },
})

export const getByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null
    return await ctx.db
      .query("coachProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user.externalId))
      .first()
  },
})

export const toggleVisibility = mutation({
  args: { profileId: v.id("coachProfiles") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const profile = await ctx.db.get(args.profileId)
    if (!profile) {
      throwError(ErrorCode.NOT_FOUND, "Coach profile not found")
    }
    if (profile.userId !== user.externalId) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized to update this profile")
    }
    await ctx.db.patch(args.profileId, {
      isActive: !profile.isActive,
      updatedAt: Date.now(),
    })
    return !profile.isActive
  },
})

export const deleteProfile = mutation({
  args: { profileId: v.id("coachProfiles") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const profile = await ctx.db.get(args.profileId)
    if (!profile) {
      throwError(ErrorCode.NOT_FOUND, "Coach profile not found")
    }
    if (profile.userId !== user.externalId) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized to delete this profile")
    }
    await ctx.db.delete(args.profileId)
    return true
  },
})

export const incrementViewCount = mutation({
  args: { profileId: v.id("coachProfiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId)
    if (!profile) return
    await ctx.db.patch(args.profileId, {
      viewCount: (profile.viewCount ?? 0) + 1,
    })
  },
})

// -------- Admin vetting --------

async function enrichForAdmin(ctx: any, profile: Doc<"coachProfiles">) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_external_id", (q: any) => q.eq("externalId", profile.userId))
    .first()
  return {
    ...profile,
    user: user
      ? {
          name: user.name as string,
          email: user.email as string | undefined,
          avatarUrl: user.profileImage as string | undefined,
        }
      : { name: "Unknown", email: undefined, avatarUrl: undefined },
  }
}

export const getCoachesForAdmin = query({
  args: {
    verificationStatus: v.optional(
      v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected"))
    ),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)
    const limit = args.limit ?? 100

    let profiles: Doc<"coachProfiles">[]
    if (args.verificationStatus) {
      const verificationStatus = args.verificationStatus
      profiles = await ctx.db
        .query("coachProfiles")
        .withIndex("by_verification_status", (q) =>
          q.eq("verificationStatus", verificationStatus)
        )
        .order("desc")
        .take(limit)
    } else {
      profiles = await ctx.db.query("coachProfiles").order("desc").take(limit)
    }

    const enriched = await Promise.all(profiles.map((p) => enrichForAdmin(ctx, p)))

    if (args.search) {
      const term = args.search.toLowerCase()
      return enriched.filter(
        (p) =>
          p.user.name?.toLowerCase().includes(term) ||
          p.user.email?.toLowerCase().includes(term) ||
          p.location.toLowerCase().includes(term) ||
          p.headline?.toLowerCase().includes(term)
      )
    }
    return enriched
  },
})

export const getPendingCoaches = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)
    const profiles = await ctx.db
      .query("coachProfiles")
      .withIndex("by_verification_status", (q) => q.eq("verificationStatus", "pending"))
      .order("desc")
      .take(args.limit ?? 50)
    return await Promise.all(profiles.map((p) => enrichForAdmin(ctx, p)))
  },
})

export const getByIdForAdmin = query({
  args: { profileId: v.id("coachProfiles") },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)
    const profile = await ctx.db.get(args.profileId)
    if (!profile) return null
    return await enrichForAdmin(ctx, profile)
  },
})

export const verifyCoach = mutation({
  args: { profileId: v.id("coachProfiles"), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await checkAdmin(ctx)
    const profile = await ctx.db.get(args.profileId)
    if (!profile) {
      throwError(ErrorCode.NOT_FOUND, "Coach profile not found")
    }
    await ctx.db.patch(args.profileId, {
      verificationStatus: "verified",
      verifiedAt: Date.now(),
      verifiedBy: identity.subject,
      moderationNotes: args.notes ? sanitizeMessage(args.notes) : profile.moderationNotes,
      updatedAt: Date.now(),
    })
    await ctx.runMutation(internal.auditLog.create, {
      entityType: "coach_profile",
      entityId: args.profileId,
      action: "verify_coach",
      userId: identity.subject,
      previousState: { verificationStatus: profile.verificationStatus ?? "pending" },
      newState: { verificationStatus: "verified" },
      metadata: { coachUserId: profile.userId, notes: args.notes },
    })
    return args.profileId
  },
})

export const rejectCoach = mutation({
  args: { profileId: v.id("coachProfiles"), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await checkAdmin(ctx)
    const profile = await ctx.db.get(args.profileId)
    if (!profile) {
      throwError(ErrorCode.NOT_FOUND, "Coach profile not found")
    }
    await ctx.db.patch(args.profileId, {
      verificationStatus: "rejected",
      moderationNotes: args.notes ? sanitizeMessage(args.notes) : profile.moderationNotes,
      updatedAt: Date.now(),
    })
    await ctx.runMutation(internal.auditLog.create, {
      entityType: "coach_profile",
      entityId: args.profileId,
      action: "reject_coach",
      userId: identity.subject,
      previousState: { verificationStatus: profile.verificationStatus ?? "pending" },
      newState: { verificationStatus: "rejected" },
      metadata: { coachUserId: profile.userId, notes: args.notes },
    })
    return args.profileId
  },
})

// Hard takedown: hide the profile from the directory (sets isActive false).
export const takedownCoach = mutation({
  args: { profileId: v.id("coachProfiles"), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await checkAdmin(ctx)
    const profile = await ctx.db.get(args.profileId)
    if (!profile) {
      throwError(ErrorCode.NOT_FOUND, "Coach profile not found")
    }
    await ctx.db.patch(args.profileId, {
      isActive: false,
      moderationNotes: args.notes ? sanitizeMessage(args.notes) : profile.moderationNotes,
      updatedAt: Date.now(),
    })
    await ctx.runMutation(internal.auditLog.create, {
      entityType: "coach_profile",
      entityId: args.profileId,
      action: "takedown_coach",
      userId: identity.subject,
      previousState: { isActive: profile.isActive },
      newState: { isActive: false },
      metadata: { coachUserId: profile.userId, notes: args.notes },
    })
    return args.profileId
  },
})
