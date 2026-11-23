// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

vi.mock("./rateLimiter", () => ({
  rateLimiter: { limit: async () => ({ ok: true, retryAfter: 0 }) },
}))

const modules = (
  import.meta as unknown as {
    glob: (g: string) => Record<string, () => Promise<unknown>>
  }
).glob("./**/*.ts")

let activeTest: ReturnType<typeof convexTest> | undefined
beforeEach(() => vi.useFakeTimers())
afterEach(async () => {
  try {
    if (activeTest) {
      const unsuccessful = await drainScheduledWork(activeTest)
      if (unsuccessful.length) {
        throw new Error(`Scheduled callbacks did not succeed: ${JSON.stringify(unsuccessful)}`)
      }
    }
  } finally {
    activeTest = undefined
    vi.useRealTimers()
  }
})

function createTest() {
  const t = convexTest(schema, modules)
  activeTest = t
  return t
}

async function drainScheduledWork(t: ReturnType<typeof convexTest>) {
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  const jobs = await t.run(({ db }) => db.system.query("_scheduled_functions").collect())
  return jobs.filter((job) => job.state.kind !== "success")
}

async function notifications(t: ReturnType<typeof convexTest>) {
  return await t.run(async ({ db }) =>
    (await db.query("notifications").collect()).map(({ userId, type, metadata }) => ({
      userId,
      type,
      metadata,
    }))
  )
}

const COACH = "coach_1"
const RENTER = "renter_1"

async function seed(
  t: ReturnType<typeof convexTest>,
  bookingStatus: "confirmed" | "completed" = "completed"
) {
  return await t.run(async (ctx) => {
    const coachProfileId = await ctx.db.insert("coachProfiles", {
      userId: COACH,
      bio: "Test coach",
      specialties: ["HPDE"],
      hourlyRate: 15000,
      location: "Austin, TX",
      isActive: true,
      verificationStatus: "verified",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    const bookingId = await ctx.db.insert("coachingBookings", {
      coachProfileId,
      coachUserId: COACH,
      renterId: RENTER,
      startDate: "2030-01-01",
      endDate: "2030-01-01",
      sessionType: "hourly",
      hours: 2,
      totalDays: 1,
      rate: 15000,
      totalAmount: 30000,
      status: bookingStatus,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    return {
      coachProfileId,
      bookingId: bookingId as Id<"coachingBookings">,
    }
  })
}

describe("coaching reviews — submit", () => {
  it("creates a review on a completed booking and recalculates the coach rating", async () => {
    const t = createTest()
    const { coachProfileId, bookingId } = await seed(t, "completed")

    const asRenter = t.withIdentity({ subject: RENTER })
    const reviewId = await asRenter.mutation(api.coachingReviews.submitReview, {
      bookingId,
      rating: 5,
      communication: 5,
      knowledge: 4,
      title: "Great session",
      review: "Learned a lot about trail braking.",
    })
    // Drain the scheduled recalcCoachRating mutation.
    await drainScheduledWork(t)

    const profile = await t.run((ctx) => ctx.db.get(coachProfileId))
    expect(profile?.rating).toBe(5)
    expect(profile?.reviewCount).toBe(1)
    expect(await notifications(t)).toEqual([
      { userId: COACH, type: "review_received", metadata: { bookingId, reviewId } },
    ])
  })

  it("rejects reviewing a non-completed booking", async () => {
    const t = createTest()
    const { bookingId } = await seed(t, "confirmed")

    const asRenter = t.withIdentity({ subject: RENTER })
    await expect(
      asRenter.mutation(api.coachingReviews.submitReview, {
        bookingId,
        rating: 5,
        title: "Too soon",
        review: "Not done yet",
      })
    ).rejects.toThrow()
  })

  it("rejects a non-renter reviewer", async () => {
    const t = createTest()
    const { bookingId } = await seed(t, "completed")

    const asCoach = t.withIdentity({ subject: COACH })
    await expect(
      asCoach.mutation(api.coachingReviews.submitReview, {
        bookingId,
        rating: 5,
        title: "Self review",
        review: "Cannot review myself",
      })
    ).rejects.toThrow()
  })

  it("allows only one review per booking", async () => {
    const t = createTest()
    const { coachProfileId, bookingId } = await seed(t, "completed")

    const asRenter = t.withIdentity({ subject: RENTER })
    const reviewId = await asRenter.mutation(api.coachingReviews.submitReview, {
      bookingId,
      rating: 5,
      title: "First",
      review: "First review",
    })
    await drainScheduledWork(t)

    await expect(
      asRenter.mutation(api.coachingReviews.submitReview, {
        bookingId,
        rating: 3,
        title: "Second",
        review: "Duplicate review",
      })
    ).rejects.toThrow()
    await drainScheduledWork(t)
    expect(await t.run(({ db }) => db.get(coachProfileId))).toMatchObject({
      rating: 5,
      reviewCount: 1,
    })
    expect(await t.run(({ db }) => db.query("coachingReviews").collect())).toHaveLength(1)
    expect(await notifications(t)).toEqual([
      { userId: COACH, type: "review_received", metadata: { bookingId, reviewId } },
    ])
  })

  it("rejects an out-of-range rating", async () => {
    const t = createTest()
    const { bookingId } = await seed(t, "completed")

    const asRenter = t.withIdentity({ subject: RENTER })
    await expect(
      asRenter.mutation(api.coachingReviews.submitReview, {
        bookingId,
        rating: 9,
        title: "Bad rating",
        review: "Out of range",
      })
    ).rejects.toThrow()
  })
})
