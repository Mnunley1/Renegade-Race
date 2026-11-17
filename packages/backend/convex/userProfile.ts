import type { Doc } from "./_generated/dataModel"

export function publicDisplayName(user: Pick<Doc<"users">, "name" | "email">) {
  // Clerk historically used the account email as a fallback display name.
  return user.name.trim().toLowerCase() === user.email?.trim().toLowerCase() ? "User" : user.name
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
