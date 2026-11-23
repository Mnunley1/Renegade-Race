import type { Doc } from "./_generated/dataModel"
import type { QueryCtx } from "./_generated/server"

/** Matches legacy names generated from absent first/last name values. */
export const NULLISH_NAME_RE = /^(null|undefined)(\s+(null|undefined))+$/i

export async function publicAuthorProfile(ctx: QueryCtx, externalId: string) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .first()
  if (!user || user.isBanned) return null
  const driver = await ctx.db
    .query("driverProfiles")
    .withIndex("by_user", (q) => q.eq("userId", externalId))
    .filter((q) => q.eq(q.field("isActive"), true))
    .first()
  const profile = publicUserProfile(user)
  if (!profile) return null
  return { ...profile, driverProfileId: driver?._id }
}

export async function loadPublicActor(ctx: QueryCtx, externalId: string) {
  const profile = await publicAuthorProfile(ctx, externalId)
  if (!profile) return null
  return {
    userId: profile.externalId,
    name: profile.name,
    profileImage: profile.profileImage,
    profileImageR2Key: profile.profileImageR2Key,
    profileHref: profile.driverProfileId
      ? `/motorsports/drivers/${profile.driverProfileId}`
      : `/profile/${encodeURIComponent(profile.externalId)}`,
  }
}

export function publicDisplayName(user: { name?: string | null; email?: string | null }) {
  // Clerk historically used the account email as a fallback display name.
  const name = user.name?.trim() ?? ""
  const lowerName = name.toLowerCase()
  if (
    !name ||
    lowerName === "null" ||
    lowerName === "undefined" ||
    NULLISH_NAME_RE.test(name) ||
    lowerName === user.email?.trim().toLowerCase()
  ) {
    return "User"
  }
  return user.name as string
}

export function publicUserProfile(user: Doc<"users"> | null) {
  if (!user) return null
  return {
    _id: user._id,
    name: publicDisplayName(user),
    profileImage: user.profileImage,
    profileImageR2Key: user.profileImageR2Key,
    location: user.location,
    bio: user.bio,
    memberSince: user.memberSince,
    totalRentals: user.totalRentals,
    rating: user.rating,
    experience: user.experience,
    interests: user.interests,
    externalId: user.externalId, // Needed for fetching vehicles/reviews
    // Verification status (without exposing actual email/phone)
    isEmailVerified: !!user.email,
    isPhoneVerified: !!user.phone,
  }
}

export function userProfileWithAdminContact(user: Doc<"users"> | null, isAdmin: boolean) {
  if (!user) return null
  return {
    ...publicUserProfile(user),
    ...(isAdmin && { name: user.name, email: user.email, phone: user.phone }),
  }
}
