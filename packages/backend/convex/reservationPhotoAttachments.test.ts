// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

vi.hoisted(() => {
  vi.stubEnv("R2_BUCKET", "attachment-test")
  vi.stubEnv("R2_ENDPOINT", "https://storage.invalid")
  vi.stubEnv("R2_ACCESS_KEY_ID", "test-key")
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret")
  vi.stubEnv("WEB_URL", "https://staging.invalid")
})
vi.mock("./rateLimiter", () => ({
  rateLimiter: { limit: async () => ({ ok: true, retryAfter: 0 }) },
}))
vi.mock("./emails", async (original) => ({
  ...(await original<typeof import("./emails")>()),
  getSupportEmail: () => undefined,
  sendTransactionalEmail: vi.fn(async () => undefined),
}))
const modules = (
  import.meta as unknown as { glob: (g: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
const tests: ReturnType<typeof convexTest>[] = []
beforeEach(() => vi.useFakeTimers())
afterEach(async () => {
  try {
    for (const t of tests) {
      await t.finishAllScheduledFunctions(vi.runAllTimers)
      const jobs = await t.run(({ db }) => db.system.query("_scheduled_functions").collect())
      if (jobs.some((job) => job.state.kind !== "success")) {
        throw new Error("Scheduled attachment callbacks did not complete successfully")
      }
    }
  } finally {
    tests.length = 0
    vi.useRealTimers()
  }
})

const writers = ["dispute", "message", "damage", "review", "edit"] as const
type Writer = (typeof writers)[number]
const reviewFields = { rating: 5, title: "Synthetic review", review: "Synthetic review text" }
function purposeFor(kind: Writer) {
  if (kind === "damage") return "damage"
  if (kind === "review" || kind === "edit") return "reviews"
  return "disputes"
}

async function setup(kind: Writer, subject = "owner", historicalPhotos: string[] = []) {
  const t = convexTest(schema, modules)
  tests.push(t)
  const ids = await t.run(async ({ db }) => {
    const ownerId = await db.insert("users", { externalId: "owner", name: "Owner" })
    const renterId = await db.insert("users", { externalId: "renter", name: "Renter" })
    await db.insert("users", { externalId: "outsider", name: "Outsider" })
    const trackId = await db.insert("tracks", { name: "Test", location: "Test", isActive: true })
    const vehicleId = await db.insert("vehicles", {
      trackId,
      ownerId: "owner",
      make: "Test",
      model: "Test",
      year: 2020,
      dailyRate: 1000,
      description: "Synthetic fixture",
      amenities: [],
      addOns: [],
      isActive: true,
      isApproved: true,
      createdAt: 1,
      updatedAt: 1,
    })
    const booking = {
      vehicleId,
      ownerId: "owner",
      renterId: "renter",
      status: "completed" as const,
      startDate: "2030-01-01",
      endDate: "2030-01-01",
      totalDays: 1,
      dailyRate: 1000,
      totalAmount: 1000,
      createdAt: 1,
      updatedAt: 1,
    }
    const reservationId = await db.insert("reservations", booking)
    const otherReservationId = await db.insert("reservations", booking)
    const completionId = await db.insert("rentalCompletions", {
      reservationId,
      vehicleId,
      ownerId: "owner",
      renterId: "renter",
      status: "completed",
      createdAt: 1,
      updatedAt: 1,
    })
    const disputeId =
      kind === "message"
        ? await db.insert("disputes", {
            completionId,
            reservationId,
            vehicleId,
            ownerId: "owner",
            renterId: "renter",
            createdBy: "owner",
            reason: "Synthetic",
            description: "Synthetic",
            photos: historicalPhotos,
            status: "open",
            createdAt: 1,
            updatedAt: 1,
          })
        : undefined
    const reviewId =
      kind === "edit"
        ? await db.insert("rentalReviews", {
            rentalCompletionId: completionId,
            reservationId,
            vehicleId,
            reviewerId: subject,
            reviewedId: subject === "owner" ? "renter" : "owner",
            reviewType: subject === "owner" ? "owner_to_renter" : "renter_to_owner",
            ...reviewFields,
            photos: historicalPhotos,
            isPublic: true,
            isModerated: false,
            createdAt: 1,
            updatedAt: 1,
          })
        : undefined
    return {
      ownerId,
      renterId,
      vehicleId,
      reservationId,
      otherReservationId,
      completionId,
      disputeId,
      reviewId,
    }
  })
  const owner = t.withIdentity({ subject: "owner" })
  const renter = t.withIdentity({ subject: "renter" })
  const outsider = t.withIdentity({ subject: "outsider" })
  const actor = subject === "owner" ? owner : renter
  async function upload(
    caller = actor,
    purpose = purposeFor(kind),
    reservationId = ids.reservationId
  ) {
    const signers = {
      disputes: api.r2.generateDisputePhotoUploadUrl,
      reviews: api.r2.generateReviewPhotoUploadUrl,
      damage: api.r2.generateDamagePhotoUploadUrl,
    }
    return (await caller.mutation(signers[purpose], { reservationId })).key
  }
  function write(caller: typeof owner, photos?: string[]) {
    if (kind === "dispute")
      return caller.mutation(api.disputes.create, {
        completionId: ids.completionId,
        reason: "Synthetic",
        description: "Synthetic",
        photos,
      })
    if (kind === "message")
      return caller.mutation(api.disputes.addMessage, {
        disputeId: ids.disputeId as Id<"disputes">,
        message: "Synthetic message",
        photos,
      })
    if (kind === "damage")
      return caller.mutation(api.damageInvoices.create, {
        reservationId: ids.reservationId,
        amount: 1000,
        description: "Synthetic claim",
        photos: photos ?? [],
      })
    if (kind === "review")
      return caller.mutation(api.rentalCompletions.submitReview, {
        completionId: ids.completionId,
        ...reviewFields,
        photos,
      })
    return caller.mutation(api.reviews.updateReview, {
      reviewId: ids.reviewId as Id<"rentalReviews">,
      ...reviewFields,
      photos,
    })
  }
  function snapshot() {
    return t.run(async ({ db }) => ({
      completion: await db.get(ids.completionId),
      disputes: await db.query("disputes").collect(),
      damage: await db.query("damageInvoices").collect(),
      reviews: await db.query("rentalReviews").collect(),
      jobs: await db.system.query("_scheduled_functions").collect(),
    }))
  }
  async function attached() {
    const state = await snapshot()
    if (kind === "dispute") return state.disputes[0]?.photos
    if (kind === "message") return state.disputes[0]?.messages?.at(-1)?.photos
    if (kind === "damage") return state.damage[0]?.photos
    return state.reviews[0]?.photos
  }
  return { t, ...ids, owner, renter, outsider, actor, upload, write, snapshot, attached }
}

describe("reservation evidence attachment boundaries", () => {
  it.each(
    writers
  )("%s accepts its participant's issued photo and persists the expected reference", async (kind) => {
    const s = await setup(kind)
    const key = await s.upload()
    await s.write(s.actor, [key])
    expect(await s.attached()).toEqual([key])
  })

  it.each([
    "dispute",
    "message",
    "review",
    "edit",
  ] as const)("%s permits the renter's own correctly scoped upload", async (kind) => {
    const s = await setup(kind, "renter")
    const key = await s.upload()
    await s.write(s.renter, [key])
    expect(await s.attached()).toEqual([key])
  })

  it.each(
    writers
  )("%s rejects anonymous and unrelated callers without writing records or scheduling work", async (kind) => {
    const s = await setup(kind)
    const key = await s.upload()
    const before = await s.snapshot()
    for (const caller of [s.t, s.outsider]) {
      await expect(s.write(caller, [key])).rejects.toThrow()
      expect(await s.snapshot()).toEqual(before)
    }
    if (kind === "damage") {
      await expect(s.write(s.renter, [key])).rejects.toThrow()
      expect(await s.snapshot()).toEqual(before)
    }
  })

  it.each(
    writers
  )("%s rejects foreign, cross-booking, wrong-purpose and forged keys atomically", async (kind) => {
    const s = await setup(kind)
    const valid = await s.upload()
    const crossBooking = await s.upload(s.actor, purposeFor(kind), s.otherReservationId)
    const wrongPurpose = await s.upload(
      s.actor,
      purposeFor(kind) === "reviews" ? "disputes" : "reviews"
    )
    let foreign: string
    if (kind === "damage") {
      // Model a historical grant issued before the damage signer was owner-only.
      foreign = `images/damage/${s.reservationId}/${s.renterId}-historical-grant`
      await s.t.run(({ db }) =>
        db.insert("r2Uploads", {
          bucket: "attachment-test",
          key: foreign,
          ownerId: "renter",
          purpose: "other",
        })
      )
    } else foreign = await s.upload(s.renter)
    const otherBucket = `images/${purposeFor(kind)}/${s.reservationId}/${s.ownerId}-other-bucket`
    await s.t.run(({ db }) =>
      db.insert("r2Uploads", {
        bucket: "other-bucket",
        key: otherBucket,
        ownerId: "owner",
        purpose: "other",
      })
    )
    const wrongLedgerPurpose = `images/${purposeFor(kind)}/${s.reservationId}/${s.ownerId}-general`
    await s.t.run(({ db }) =>
      db.insert("r2Uploads", {
        bucket: "attachment-test",
        key: wrongLedgerPurpose,
        ownerId: "owner",
        purpose: "general",
      })
    )
    const before = await s.snapshot()
    for (const key of [
      foreign,
      crossBooking,
      wrongPurpose,
      otherBucket,
      wrongLedgerPurpose,
      `${valid}-unissued`,
      "https://private.invalid/evidence",
    ]) {
      await expect(s.write(s.actor, [valid, key])).rejects.toThrow("Upload this")
      expect(await s.snapshot()).toEqual(before)
    }
  })

  it("preserves historical review reads and unchanged references while validating additions and removals", async () => {
    const historical = "images/reviews/old-booking/old-owner-unrecorded"
    const s = await setup("edit", "owner", [historical])
    const reviewId = s.reviewId as Id<"rentalReviews">
    expect((await s.owner.query(api.reviews.getById, { reviewId }))?.photos).toEqual([historical])
    await s.write(s.owner, [historical])
    expect(await s.attached()).toEqual([historical])
    const own = await s.upload()
    await s.write(s.owner, [historical, own])
    expect(await s.attached()).toEqual([historical, own])
    const foreign = await s.upload(s.renter)
    await expect(s.write(s.owner, [historical, own, foreign])).rejects.toThrow("Upload this")
    expect(await s.attached()).toEqual([historical, own])
    await s.write(s.owner, [own])
    expect(await s.attached()).toEqual([own])
    await expect(s.write(s.owner, [historical, own])).rejects.toThrow("Upload this")
    expect(await s.attached()).toEqual([own])
    await s.write(s.owner, [])
    expect(await s.attached()).toEqual([])
    await s.write(s.owner, [own])
    await s.write(s.owner)
    expect(await s.attached()).toBeUndefined()
  })

  it("does not copy an unverified historical review reference to a new review", async () => {
    const s = await setup("review")
    await expect(
      s.write(s.owner, ["images/reviews/old-booking/old-owner-unrecorded"])
    ).rejects.toThrow("Upload this")
    expect(await s.attached()).toBeUndefined()
  })

  it("retains historical dispute and damage photos for participant reads", async () => {
    const historical = "images/disputes/legacy-attachment"
    const s = await setup("message", "owner", [historical])
    const damageId = await s.t.run(({ db }) =>
      db.insert("damageInvoices", {
        reservationId: s.reservationId,
        completionId: s.completionId,
        vehicleId: s.vehicleId,
        ownerId: "owner",
        renterId: "renter",
        amount: 1000,
        description: "Historical fixture",
        photos: ["images/damage/legacy-attachment"],
        status: "pending_review",
        createdAt: 1,
        updatedAt: 1,
      })
    )
    for (const actor of [s.owner, s.renter]) {
      expect(
        (await actor.query(api.disputes.getById, { id: s.disputeId as Id<"disputes"> }))?.photos
      ).toEqual([historical])
      expect((await actor.query(api.damageInvoices.getById, { id: damageId }))?.photos).toEqual([
        "images/damage/legacy-attachment",
      ])
    }
    await s.write(s.owner, [await s.upload()])
    expect(
      (await s.owner.query(api.disputes.getById, { id: s.disputeId as Id<"disputes"> }))?.photos
    ).toEqual([historical])
  })
})
