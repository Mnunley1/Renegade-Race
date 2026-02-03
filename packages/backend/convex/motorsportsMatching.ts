import { v } from "convex/values"
import { query } from "./_generated/server"
import { getCurrentUser } from "./users"

export const getRecommendedTeams = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []

    // Get current user's driver profile
    const driverProfile = await ctx.db
      .query("driverProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user.externalId))
      .first()

    if (!driverProfile) return []

    // Get all active teams
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect()

    // Score and rank teams
    const scored = teams
      .filter((team) => team.ownerId !== user.externalId)
      .map((team) => {
        let score = 0

        // Location match
        if (
          team.location.toLowerCase() === driverProfile.location.toLowerCase()
        ) {
          score += 30
        }

        // Racing type match
        if (
          team.racingType &&
          driverProfile.racingType &&
          (team.racingType === driverProfile.racingType ||
            team.racingType === "both" ||
            driverProfile.racingType === "both")
        ) {
          score += 25
        }

        // Category overlap
        const overlap = team.specialties.filter((s) =>
          driverProfile.preferredCategories.includes(s)
        )
        score += overlap.length * 10

        // Available seats bonus
        if (team.availableSeats > 0) {
          score += 15
        }

        // Experience match (teams with requirements vs driver experience)
        const expLevels = ["beginner", "intermediate", "advanced", "professional"]
        const driverLevel = expLevels.indexOf(driverProfile.experience)
        if (driverLevel >= 2) {
          score += 10
        }

        return { ...team, matchScore: score }
      })

    scored.sort((a, b) => b.matchScore - a.matchScore)
    return scored.slice(0, 6)
  },
})

export const getRecommendedDrivers = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []

    const team = await ctx.db.get(args.teamId)
    if (!team || team.ownerId !== user.externalId) return []

    // Get all active driver profiles
    const drivers = await ctx.db
      .query("driverProfiles")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect()

    // Score and rank drivers
    const scored = drivers
      .filter((driver) => driver.userId !== user.externalId)
      .map((driver) => {
        let score = 0

        // Location match
        if (driver.location.toLowerCase() === team.location.toLowerCase()) {
          score += 30
        }

        // Racing type match
        if (
          team.racingType &&
          driver.racingType &&
          (team.racingType === driver.racingType ||
            team.racingType === "both" ||
            driver.racingType === "both")
        ) {
          score += 25
        }

        // Category overlap
        const overlap = driver.preferredCategories.filter((c) =>
          team.specialties.includes(c)
        )
        score += overlap.length * 10

        // Experience bonus
        const expLevels = ["beginner", "intermediate", "advanced", "professional"]
        score += expLevels.indexOf(driver.experience) * 5

        return { ...driver, matchScore: score }
      })

    scored.sort((a, b) => b.matchScore - a.matchScore)
    return scored.slice(0, 6)
  },
})
