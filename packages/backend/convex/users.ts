import type { UserJSON } from "@clerk/backend"
import { type Validator, v } from "convex/values"
import { internalMutation, mutation, type QueryCtx, query } from "./_generated/server"
import { getWelcomeEmailTemplate, sendTransactionalEmail } from "./emails"
import { imagePresets, r2 } from "./r2"

export const current = query({
  args: {},
  handler: async (ctx) => await getCurrentUser(ctx),
})

export const getByExternalId = query({
  args: { externalId: v.string() },
  handler: async (ctx, args) => await userByExternalId(ctx, args.externalId),
})

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> }, // no runtime validation, trust Clerk
  async handler(ctx, { data }) {
    const userData = data as UserJSON // Type assertion for Clerk data
    const user = await userByExternalId(ctx, data.id)
    const isNewUser = user === null
    const userName = `${userData.first_name} ${userData.last_name}`.trim() || "Unknown User"
    const userEmail = userData.email_addresses?.[0]?.email_address

    if (isNewUser) {
      await ctx.db.insert("users", {
        externalId: data.id,
        name: userName,
        email: userEmail,
      })

      // Send welcome email to new user
      if (userEmail) {
        try {
          const template = getWelcomeEmailTemplate(userName)
          await sendTransactionalEmail(ctx, userEmail, template)
        } catch (error) {
          console.error("Failed to send welcome email:", error)
          // Don't fail the mutation if email fails
        }
      }
    } else {
      await ctx.db.patch(user._id, {
        name: userName,
        email: userEmail || user.email, // Update email if provided
      })
    }
  },
})

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  async handler(ctx, { clerkUserId }) {
    const user = await userByExternalId(ctx, clerkUserId)

    if (user !== null) {
      // Check if this user is a host with active or upcoming rentals
      const today = new Date().toISOString().split("T")[0]
      
      // Get all vehicles owned by this user
      const ownedVehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_owner", (q) => q.eq("ownerId", clerkUserId))
        .collect()

      // Check for active or upcoming reservations on any of their vehicles
      for (const vehicle of ownedVehicles) {
        const activeReservations = await ctx.db
          .query("reservations")
          .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicle._id))
          .filter((q) =>
            q.and(
              // Only check pending or confirmed reservations
              q.or(
                q.eq(q.field("status"), "pending"),
                q.eq(q.field("status"), "confirmed")
              ),
              // Check if reservation end date is in the future (active or upcoming)
              q.gte(q.field("endDate"), today)
            )
          )
          .collect()

        if (activeReservations.length > 0) {
          throw new Error(
            `Cannot delete host account with active or upcoming rentals. User has ${activeReservations.length} active reservation(s) on vehicle ${vehicle.make} ${vehicle.model}.`
          )
        }
      }

      await ctx.db.delete(user._id)
    } else {
      console.warn(`Can't delete user, there is none for Clerk user ID: ${clerkUserId}`)
    }
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
      const userData = {
        externalId: userId,
        name: identity.name || identity.email || "Unknown User",
        email: identity.email,
      }
      const newUserId = await ctx.db.insert("users", userData)
      user = await ctx.db.get(newUserId)
    }

    if (!user) {
      throw new Error("Failed to create or retrieve user")
    }

    // Prefer R2 key, fallback to legacy storage ID
    if (args.r2Key) {
      // Generate ImageKit URL for profile image
      const profileImageUrl = imagePresets.original(args.r2Key)
      await ctx.db.patch(user._id, {
        profileImage: profileImageUrl,
        profileImageR2Key: args.r2Key,
      })
    } else if (args.storageId) {
      // Legacy: Get the URL from the storage ID
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
      const userData = {
        externalId: userId,
        name: args.name || identity.name || identity.email || "Unknown User",
        email: args.email || identity.email,
        phone: args.phone,
        interests: args.interests,
        bio: args.bio,
        location: args.location,
        experience: args.experience,
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
    return user.notificationPreferences || {
      reservationUpdates: true,
      messages: true,
      reviewsAndRatings: true,
      paymentUpdates: true,
      marketing: false,
    }
  },
})

export const setStripeAccountId = mutation({
  args: {
    userId: v.string(),
    stripeAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.userId))
      .first()

    if (!user) {
      throw new Error("User not found")
    }

    await ctx.db.patch(user._id, {
      stripeAccountId: args.stripeAccountId,
      stripeAccountStatus: "pending",
    })

    return user._id
  },
})

export const setStripeCustomerId = mutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.userId))
      .first()

    if (!user) {
      throw new Error("User not found")
    }

    await ctx.db.patch(user._id, {
      stripeCustomerId: args.stripeCustomerId,
    })

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
      safetyStandards: user.hostOnboardingSteps?.safetyStandards,
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
      steps: user.hostOnboardingSteps || steps,
      stepCompletion: user.hostOnboardingStepCompletion || {
        step1_location: false,
        step2_vehicleInfo: false,
        step3_specifications: false,
        step4_amenities: false,
        step5_photos: false,
        step6_availability: false,
        step7_submit: false,
      },
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

    await ctx.db.patch(user._id, {
      onboardingVehicleAddress: args.address,
      hostOnboardingStatus: user.hostOnboardingStatus === "not_started" ? "in_progress" : user.hostOnboardingStatus || "in_progress",
    })

    return { success: true }
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

    await ctx.db.patch(user._id, {
      hostOnboardingStatus: "completed",
      // Clear temporary onboarding data after completion
      // Note: Images are already associated with the vehicle, so we don't delete them
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

// Update individual step completion
export const updateOnboardingStepCompletion = mutation({
  args: {
    step: v.union(
      v.literal("step1_location"),
      v.literal("step2_vehicleInfo"),
      v.literal("step3_specifications"),
      v.literal("step4_amenities"),
      v.literal("step5_photos"),
      v.literal("step6_availability"),
      v.literal("step7_submit")
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

    const currentSteps = user.hostOnboardingStepCompletion || {
      step1_location: false,
      step2_vehicleInfo: false,
      step3_specifications: false,
      step4_amenities: false,
      step5_photos: false,
      step6_availability: false,
      step7_submit: false,
    }

    const updatedSteps = {
      ...currentSteps,
      [args.step]: args.completed,
    }

    await ctx.db.patch(user._id, {
      hostOnboardingStepCompletion: updatedSteps,
    })

    return { success: true }
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

    // Clean up orphaned images from R2 before clearing draft
    if (user.hostOnboardingDraft?.images) {
      for (const image of user.hostOnboardingDraft.images) {
        if (image.r2Key) {
          try {
            await r2.deleteObject(ctx, image.r2Key)
          } catch (error) {
            console.error(`Failed to delete orphaned R2 image ${image.r2Key}:`, error)
            // Continue with cleanup even if R2 deletion fails
          }
        }
      }
    }

    await ctx.db.patch(user._id, {
      hostOnboardingDraft: undefined,
      hostOnboardingStepCompletion: undefined,
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

    // Clean up orphaned images from R2 before clearing draft
    if (user.hostOnboardingDraft?.images) {
      for (const image of user.hostOnboardingDraft.images) {
        if (image.r2Key) {
          try {
            await r2.deleteObject(ctx, image.r2Key)
          } catch (error) {
            console.error(`Failed to delete orphaned R2 image ${image.r2Key}:`, error)
            // Continue with cleanup even if R2 deletion fails
          }
        }
      }
    }

    // Reset onboarding status and clear all draft data
    await ctx.db.patch(user._id, {
      hostOnboardingStatus: "not_started",
      hostOnboardingDraft: undefined,
      hostOnboardingStepCompletion: undefined,
      onboardingVehicleAddress: undefined,
    })

    return { success: true }
  },
})
