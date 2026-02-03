import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { checkAdmin } from "./admin"
import { rateLimiter } from "./rateLimiter"
import { sanitizeMessage } from "./sanitize"

// Create a new report
export const createReport = mutation({
  args: {
    reportedUserId: v.optional(v.string()),
    reportedVehicleId: v.optional(v.id("vehicles")),
    reportedReviewId: v.optional(v.id("rentalReviews")),
    reason: v.union(
      v.literal("inappropriate_content"),
      v.literal("fraud"),
      v.literal("safety_concern"),
      v.literal("harassment"),
      v.literal("spam"),
      v.literal("other")
    ),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    // Rate limit: 5 reports per hour per user
    await rateLimiter.limit(ctx, "createReport", {
      key: identity.subject,
      throws: true,
    })

    const reporterId = identity.subject

    // Validate that at least one target is provided
    if (!(args.reportedUserId || args.reportedVehicleId || args.reportedReviewId)) {
      throw new Error("Must report a user, vehicle, or review")
    }

    // Create the report
    const reportId = await ctx.db.insert("reports", {
      reporterId,
      reportedUserId: args.reportedUserId,
      reportedVehicleId: args.reportedVehicleId,
      reportedReviewId: args.reportedReviewId,
      reason: args.reason,
      description: sanitizeMessage(args.description),
      status: "pending",
      createdAt: Date.now(),
    })

    return reportId
  },
})

// Get all reports (admin only)
export const getReports = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("reviewed"),
        v.literal("resolved"),
        v.literal("dismissed")
      )
    ),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    let reports

    if (args.status) {
      reports = await ctx.db
        .query("reports")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect()
    } else {
      reports = await ctx.db.query("reports").order("desc").collect()
    }

    // Get reporter user details for each report
    const reportsWithDetails = await Promise.all(
      reports.map(async (report) => {
        const reporter = await ctx.db
          .query("users")
          .withIndex("by_external_id", (q) => q.eq("externalId", report.reporterId))
          .first()

        let reportedUser
        if (report.reportedUserId) {
          reportedUser = await ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", report.reportedUserId!))
            .first()
        }

        let reportedVehicle
        if (report.reportedVehicleId) {
          reportedVehicle = await ctx.db.get(report.reportedVehicleId)
        }

        let reportedReview
        if (report.reportedReviewId) {
          reportedReview = await ctx.db.get(report.reportedReviewId)
        }

        return {
          ...report,
          reporter,
          reportedUser: reportedUser || null,
          reportedVehicle: reportedVehicle || null,
          reportedReview: reportedReview || null,
        }
      })
    )

    return reportsWithDetails
  },
})

// Resolve a report (admin only)
export const resolveReport = mutation({
  args: {
    reportId: v.id("reports"),
    status: v.union(v.literal("reviewed"), v.literal("resolved"), v.literal("dismissed")),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await checkAdmin(ctx)

    const report = await ctx.db.get(args.reportId)
    if (!report) {
      throw new Error("Report not found")
    }

    await ctx.db.patch(args.reportId, {
      status: args.status,
      adminNotes: args.adminNotes ? sanitizeMessage(args.adminNotes) : undefined,
      resolvedAt: Date.now(),
      resolvedBy: identity.subject,
    })

    return args.reportId
  },
})
