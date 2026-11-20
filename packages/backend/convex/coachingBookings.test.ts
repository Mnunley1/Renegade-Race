// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

// The rate-limiter component isn't registered in convex-test; stub it to a no-op.
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

async function seedProfile(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("coachProfiles", {
      userId: COACH,
      bio: "Test coach",
      specialties: ["HPDE"],
      hourlyRate: 15000,
      halfDayRate: 50000,
      fullDayRate: 90000,
      location: "Austin, TX",
      isActive: true,
      verificationStatus: "verified",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  )
}

async function seedBooking(
  t: ReturnType<typeof convexTest>,
  coachProfileId: Id<"coachProfiles">,
  overrides: Record<string, unknown> = {}
) {
  return (await t.run(async (ctx) =>
    ctx.db.insert("coachingBookings", {
      coachProfileId,
      coachUserId: COACH,
      renterId: RENTER,
      startDate: "2030-03-01",
      endDate: "2030-03-01",
      sessionType: "half_day",
      totalDays: 1,
      rate: 50000,
      totalAmount: 50000,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    })
  )) as Id<"coachingBookings">
}

describe("coaching bookings — create", () => {
  it("creates a pending booking for an active coach", async () => {
    const t = createTest()
    const coachProfileId = await seedProfile(t)

    const asRenter = t.withIdentity({ subject: RENTER })
    const bookingId = await asRenter.mutation(api.coachingBookings.create, {
      coachProfileId,
      sessionType: "half_day",
      startDate: "2030-03-01",
      endDate: "2030-03-01",
    })

    const booking = await t.run((ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe("pending")
    expect(booking?.totalAmount).toBe(50000)
    await drainScheduledWork(t)
    expect(await notifications(t)).toEqual([
      { userId: COACH, type: "coaching_request_pending", metadata: { bookingId } },
    ])
  })

  it("rejects booking yourself as a coach", async () => {
    const t = createTest()
    const coachProfileId = await seedProfile(t)

    const asCoach = t.withIdentity({ subject: COACH })
    await expect(
      asCoach.mutation(api.coachingBookings.create, {
        coachProfileId,
        sessionType: "half_day",
        startDate: "2030-03-01",
        endDate: "2030-03-01",
      })
    ).rejects.toThrow()
  })
})

describe("coaching bookings — approve / complete", () => {
  it("lets the coach approve a pending booking and auto-declines overlapping pending ones", async () => {
    const t = createTest()
    const coachProfileId = await seedProfile(t)
    const target = await seedBooking(t, coachProfileId)
    const overlapping = await seedBooking(t, coachProfileId, { renterId: "renter_2" })

    const asCoach = t.withIdentity({ subject: COACH })
    await asCoach.mutation(api.coachingBookings.approve, { bookingId: target })
    await drainScheduledWork(t)

    const approved = await t.run((ctx) => ctx.db.get(target))
    const declined = await t.run((ctx) => ctx.db.get(overlapping))
    expect(approved?.status).toBe("approved")
    expect(declined?.status).toBe("declined")
    expect(await notifications(t)).toEqual([
      { userId: "renter_2", type: "coaching_declined", metadata: { bookingId: overlapping } },
      { userId: RENTER, type: "coaching_approved", metadata: { bookingId: target } },
    ])
  })

  it("forbids a non-coach from approving", async () => {
    const t = createTest()
    const coachProfileId = await seedProfile(t)
    const bookingId = await seedBooking(t, coachProfileId)

    const asRenter = t.withIdentity({ subject: RENTER })
    await expect(asRenter.mutation(api.coachingBookings.approve, { bookingId })).rejects.toThrow()
  })

  it("only allows completing a confirmed booking, by the coach", async () => {
    const t = createTest()
    const coachProfileId = await seedProfile(t)
    const bookingId = await seedBooking(t, coachProfileId, { status: "confirmed" })

    const asRenter = t.withIdentity({ subject: RENTER })
    await expect(asRenter.mutation(api.coachingBookings.complete, { bookingId })).rejects.toThrow()

    const asCoach = t.withIdentity({ subject: COACH })
    await asCoach.mutation(api.coachingBookings.complete, { bookingId })
    await drainScheduledWork(t)

    const booking = await t.run((ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe("completed")
    expect(await notifications(t)).toEqual([
      { userId: RENTER, type: "coaching_completed", metadata: { bookingId } },
      { userId: COACH, type: "coaching_completed", metadata: { bookingId } },
    ])
  })
})

describe("coaching bookings — reportIssue", () => {
  it("flags a confirmed booking and blocks duplicate reports", async () => {
    const t = createTest()
    const coachProfileId = await seedProfile(t)
    const bookingId = await seedBooking(t, coachProfileId, { status: "confirmed" })

    const asRenter = t.withIdentity({ subject: RENTER })
    await asRenter.mutation(api.coachingBookings.reportIssue, {
      bookingId,
      reason: "Coach did not show up",
    })
    await drainScheduledWork(t)

    const booking = await t.run((ctx) => ctx.db.get(bookingId))
    expect(booking?.disputeStatus).toBe("open")
    expect(booking?.issueReportedBy).toBe(RENTER)

    await expect(
      asRenter.mutation(api.coachingBookings.reportIssue, {
        bookingId,
        reason: "again",
      })
    ).rejects.toThrow()
    await drainScheduledWork(t)
    expect(await notifications(t)).toEqual([
      { userId: COACH, type: "dispute_update", metadata: { bookingId } },
    ])
  })

  it("rejects reporting on a non-confirmed/completed booking", async () => {
    const t = createTest()
    const coachProfileId = await seedProfile(t)
    const bookingId = await seedBooking(t, coachProfileId, { status: "pending" })

    const asRenter = t.withIdentity({ subject: RENTER })
    await expect(
      asRenter.mutation(api.coachingBookings.reportIssue, {
        bookingId,
        reason: "too early",
      })
    ).rejects.toThrow()
  })
})
