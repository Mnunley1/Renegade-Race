// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { afterEach, describe, expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

vi.hoisted(() => {
  vi.stubEnv("R2_BUCKET", "synthetic-public-media")
  vi.stubEnv("R2_ENDPOINT", "https://storage.invalid")
  vi.stubEnv("R2_ACCESS_KEY_ID", "test-key")
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret")
  vi.stubEnv("R2_PUBLIC_URL", "https://images.renegaderace.com")
})
vi.mock("./rateLimiter", () => ({
  rateLimiter: { limit: async () => ({ ok: true, retryAfter: 0 }) },
}))
const modules = (
  import.meta as unknown as { glob: (g: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
const publicUrl = (key: string) => `https://images.renegaderace.com/${key}`
const teamArgs = {
  name: "Synthetic team",
  description: "Media ownership test",
  location: "Test track",
  specialties: [],
  availableSeats: 1,
  requirements: [],
  contactInfo: {},
}
const driverArgs = {
  bio: "Synthetic driver",
  experience: "beginner" as const,
  licenses: [],
  preferredCategories: [],
  availability: [],
  location: "Test track",
  contactInfo: {},
}
const coachArgs = {
  bio: "Synthetic coach",
  specialties: ["HPDE"],
  hourlyRate: 1000,
  location: "Test track",
}

async function setup() {
  const t = convexTest(schema, modules)
  const ownerId = await t.run(({ db }) =>
    db.insert("users", { externalId: "owner", name: "Owner" })
  )
  const otherId = await t.run(({ db }) =>
    db.insert("users", { externalId: "other", name: "Other" })
  )
  const owner = t.withIdentity({ subject: "owner" })
  const other = t.withIdentity({ subject: "other" })
  const teamId = await owner.mutation(api.teams.create, teamArgs)
  const driverId = await owner.mutation(api.driverProfiles.create, driverArgs)
  const coachId = await owner.mutation(api.coachProfiles.create, coachArgs)
  return { t, owner, other, ownerId, otherId, teamId, driverId, coachId }
}

function seedBooking(f: Awaited<ReturnType<typeof setup>>) {
  return f.t.run(({ db }) =>
    db.insert("coachingBookings", {
      coachProfileId: f.coachId,
      coachUserId: "owner",
      renterId: "other",
      startDate: "2030-01-01",
      endDate: "2030-01-01",
      sessionType: "hourly",
      hours: 1,
      totalDays: 1,
      rate: 1000,
      totalAmount: 1000,
      status: "completed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  )
}

afterEach(() => vi.useRealTimers())

describe("public media ownership and intended use", () => {
  it("accepts issued general uploads for team logos, posts, and driver portfolios", async () => {
    const f = await setup()
    for (const signer of [api.r2.generateUploadUrl, api.r2.generateUploadUrlWithKey]) {
      const { key } = await f.owner.mutation(signer, {})
      const teamId = await f.owner.mutation(api.teams.create, { ...teamArgs, logoR2Key: key })
      await f.owner.mutation(api.teams.update, {
        teamId,
        logoR2Key: key,
        logoUrl: publicUrl(key),
      })
      const postId = await f.owner.mutation(api.posts.createPost, {
        content: "Public media",
        teamId,
        mediaR2Keys: [key],
        mediaType: "image",
      })
      const mediaId = await f.owner.mutation(api.driverMedia.add, {
        driverProfileId: f.driverId,
        type: "image",
        url: publicUrl(key),
        r2Key: key,
      })
      expect((await f.t.run(({ db }) => db.get(teamId)))?.logoR2Key).toBe(key)
      expect((await f.t.query(api.posts.getPost, { postId }))?.mediaR2Keys).toEqual([key])
      expect((await f.t.run(({ db }) => db.get(mediaId)))?.url).toBe(publicUrl(key))
    }
  })

  it("shares issued profile uploads between account, driver, and coach avatars", async () => {
    const f = await setup()
    const { key } = await f.owner.mutation(api.r2.generateProfileImageUploadUrl, {})
    await f.owner.mutation(api.users.updateProfileImage, { r2Key: key })
    await f.owner.mutation(api.driverProfiles.update, {
      profileId: f.driverId,
      avatarUrl: publicUrl(key),
    })
    await f.owner.mutation(api.coachProfiles.update, {
      profileId: f.coachId,
      avatarR2Key: key,
      avatarUrl: publicUrl(key),
    })
    expect((await f.owner.query(api.users.current, {}))?.profileImageR2Key).toBe(key)
    expect((await f.t.run(({ db }) => db.get(f.driverId)))?.avatarUrl).toBe(publicUrl(key))
    expect((await f.t.run(({ db }) => db.get(f.coachId)))?.avatarR2Key).toBe(key)

    const otherKey = (await f.other.mutation(api.r2.generateProfileImageUploadUrl, {})).key
    const driverId = await f.other.mutation(api.driverProfiles.create, {
      ...driverArgs,
      avatarUrl: publicUrl(otherKey),
    })
    const coachId = await f.other.mutation(api.coachProfiles.create, {
      ...coachArgs,
      avatarR2Key: otherKey,
    })
    expect((await f.t.run(({ db }) => db.get(driverId)))?.avatarUrl).toBe(publicUrl(otherKey))
    expect((await f.t.run(({ db }) => db.get(coachId)))?.avatarR2Key).toBe(otherKey)
  })

  it("rejects anonymous media writes and unauthorized target updates", async () => {
    const f = await setup()
    const general = (await f.owner.mutation(api.r2.generateUploadUrl, {})).key
    const profile = (await f.owner.mutation(api.r2.generateProfileImageUploadUrl, {})).key
    await expect(
      f.t.mutation(api.teams.create, { ...teamArgs, logoR2Key: general })
    ).rejects.toThrow()
    await expect(
      f.t.mutation(api.driverProfiles.create, { ...driverArgs, avatarUrl: publicUrl(profile) })
    ).rejects.toThrow()
    await expect(
      f.t.mutation(api.coachProfiles.create, { ...coachArgs, avatarR2Key: profile })
    ).rejects.toThrow()
    await expect(
      f.t.mutation(api.posts.createPost, { content: "Anonymous", mediaR2Keys: [general] })
    ).rejects.toThrow()
    for (const actor of [f.t, f.other]) {
      await expect(
        actor.mutation(api.teams.update, { teamId: f.teamId, logoR2Key: general })
      ).rejects.toThrow()
      await expect(
        actor.mutation(api.driverProfiles.update, {
          profileId: f.driverId,
          avatarUrl: publicUrl(profile),
        })
      ).rejects.toThrow()
      await expect(
        actor.mutation(api.coachProfiles.update, { profileId: f.coachId, avatarR2Key: profile })
      ).rejects.toThrow()
      await expect(
        actor.mutation(api.driverMedia.add, {
          driverProfileId: f.driverId,
          type: "image",
          url: publicUrl(general),
        })
      ).rejects.toThrow()
    }
  })

  it("rejects another uploader's media on caller-owned records and new profiles", async () => {
    const f = await setup()
    const general = (await f.other.mutation(api.r2.generateUploadUrl, {})).key
    const profile = (await f.other.mutation(api.r2.generateProfileImageUploadUrl, {})).key
    await expect(
      f.owner.mutation(api.teams.create, { ...teamArgs, logoR2Key: general })
    ).rejects.toThrow()
    await expect(
      f.owner.mutation(api.teams.update, { teamId: f.teamId, logoUrl: publicUrl(general) })
    ).rejects.toThrow()
    await expect(
      f.owner.mutation(api.driverProfiles.update, {
        profileId: f.driverId,
        avatarUrl: publicUrl(profile),
      })
    ).rejects.toThrow()
    await expect(
      f.owner.mutation(api.coachProfiles.update, { profileId: f.coachId, avatarR2Key: profile })
    ).rejects.toThrow()
    const ownedProfile = (await f.owner.mutation(api.r2.generateProfileImageUploadUrl, {})).key
    await expect(
      f.other.mutation(api.driverProfiles.create, {
        ...driverArgs,
        avatarUrl: publicUrl(ownedProfile),
      })
    ).rejects.toThrow()
    await expect(
      f.other.mutation(api.coachProfiles.create, {
        ...coachArgs,
        avatarUrl: publicUrl(ownedProfile),
      })
    ).rejects.toThrow()
    await expect(
      f.owner.mutation(api.driverMedia.add, {
        driverProfileId: f.driverId,
        type: "image",
        url: publicUrl(general),
      })
    ).rejects.toThrow()
  })

  it("rejects mixed-owner post attachments atomically without an activity event", async () => {
    const f = await setup()
    const own = (await f.owner.mutation(api.r2.generateUploadUrl, {})).key
    const foreign = (await f.other.mutation(api.r2.generateUploadUrl, {})).key
    await expect(
      f.owner.mutation(api.posts.createPost, {
        content: "Mixed batch",
        mediaR2Keys: [own, foreign],
      })
    ).rejects.toThrow()
    expect(await f.t.run(({ db }) => db.query("posts").collect())).toEqual([])
    expect(await f.t.run(({ db }) => db.query("activityEvents").collect())).toEqual([])
  })

  it("rejects owned onboarding, vehicle, and reservation evidence on public surfaces", async () => {
    const f = await setup()
    const draft = (await f.owner.mutation(api.r2.generateOnboardingImageUploadUrl, {})).key
    const listing = (await f.owner.mutation(api.r2.generateListingImageUploadUrl, {})).key
    const evidence = `images/damage/synthetic-reservation/${f.ownerId}-photo`
    await f.t.run(({ db }) =>
      db.insert("r2Uploads", {
        bucket: "synthetic-public-media",
        ownerId: "owner",
        key: evidence,
        purpose: "other",
      })
    )
    for (const key of [draft, listing, evidence, "returns/synthetic-private-photo"]) {
      await expect(
        f.owner.mutation(api.teams.update, { teamId: f.teamId, logoR2Key: key })
      ).rejects.toThrow()
      await expect(
        f.owner.mutation(api.coachProfiles.update, { profileId: f.coachId, avatarR2Key: key })
      ).rejects.toThrow()
      await expect(
        f.owner.mutation(api.driverProfiles.update, {
          profileId: f.driverId,
          avatarUrl: publicUrl(key),
        })
      ).rejects.toThrow()
      await expect(
        f.owner.mutation(api.posts.createPost, { content: "Wrong purpose", mediaR2Keys: [key] })
      ).rejects.toThrow()
      await expect(
        f.owner.mutation(api.driverMedia.add, {
          driverProfileId: f.driverId,
          type: "image",
          url: publicUrl(key),
        })
      ).rejects.toThrow()
    }
  })

  it("keeps profile and general public upload purposes distinct", async () => {
    const f = await setup()
    const general = (await f.owner.mutation(api.r2.generateUploadUrl, {})).key
    const profile = (await f.owner.mutation(api.r2.generateProfileImageUploadUrl, {})).key
    await expect(
      f.owner.mutation(api.driverProfiles.update, {
        profileId: f.driverId,
        avatarUrl: publicUrl(general),
      })
    ).rejects.toThrow()
    await expect(
      f.owner.mutation(api.coachProfiles.update, { profileId: f.coachId, avatarR2Key: general })
    ).rejects.toThrow()
    await expect(
      f.owner.mutation(api.teams.update, { teamId: f.teamId, logoR2Key: profile })
    ).rejects.toThrow()
    await expect(
      f.owner.mutation(api.posts.createPost, {
        content: "Wrong public purpose",
        mediaR2Keys: [profile],
      })
    ).rejects.toThrow()
  })

  it("requires an upload record for the active bucket and correct recorded purpose", async () => {
    const f = await setup()
    for (const [bucket, purpose] of [
      ["foreign-bucket", "general"],
      ["synthetic-public-media", "onboarding"],
    ] as const) {
      const key = `images/general/${f.ownerId}/${bucket}-${purpose}`
      await f.t.run(({ db }) => db.insert("r2Uploads", { bucket, ownerId: "owner", key, purpose }))
      await expect(
        f.owner.mutation(api.teams.update, { teamId: f.teamId, logoR2Key: key })
      ).rejects.toThrow()
      await expect(
        f.owner.mutation(api.posts.createPost, { content: "Forged record", mediaR2Keys: [key] })
      ).rejects.toThrow()
    }
    const unissued = `images/profiles/${f.ownerId}/unissued`
    await expect(
      f.owner.mutation(api.driverProfiles.update, {
        profileId: f.driverId,
        avatarUrl: publicUrl(unissued),
      })
    ).rejects.toThrow()
    await expect(
      f.owner.mutation(api.coachProfiles.update, { profileId: f.coachId, avatarR2Key: unissued })
    ).rejects.toThrow()
  })

  it("rejects supplied key and URL pairs that reference different uploads", async () => {
    const f = await setup()
    const general = (await f.owner.mutation(api.r2.generateUploadUrl, {})).key
    const otherGeneral = (await f.owner.mutation(api.r2.generateUploadUrl, {})).key
    const profile = (await f.owner.mutation(api.r2.generateProfileImageUploadUrl, {})).key
    const otherProfile = (await f.owner.mutation(api.r2.generateProfileImageUploadUrl, {})).key
    await expect(
      f.owner.mutation(api.teams.update, {
        teamId: f.teamId,
        logoR2Key: general,
        logoUrl: publicUrl(otherGeneral),
      })
    ).rejects.toThrow()
    await expect(
      f.owner.mutation(api.coachProfiles.update, {
        profileId: f.coachId,
        avatarR2Key: profile,
        avatarUrl: publicUrl(otherProfile),
      })
    ).rejects.toThrow()
    await expect(
      f.owner.mutation(api.driverMedia.add, {
        driverProfileId: f.driverId,
        type: "image",
        r2Key: general,
        url: publicUrl(otherGeneral),
      })
    ).rejects.toThrow()
  })

  it("does not turn malformed, decorated, or foreign platform URLs into owned avatar references", async () => {
    const f = await setup()
    const key = (await f.owner.mutation(api.r2.generateProfileImageUploadUrl, {})).key
    const urls = [
      "https://external.example/photo.png",
      `https://images.renegaderace.com.evil.example/${key}`,
      `${publicUrl(key)}?download=1`,
      `${publicUrl(key)}#image`,
      `https://user@images.renegaderace.com/${key}`,
      `https://images.renegaderace.com/${key.replace("images/", "%69mages/")}`,
      `https://images.renegaderace.com/unused/../${key}`,
      `https://images.renegaderace.com/${key.replaceAll("/", "%2F")}`,
      `https://pub-another.r2.dev/${key}`,
      `https://example.convex.cloud/api/storage/${key}`,
      "javascript:alert(1)",
      `//images.renegaderace.com/${key}`,
    ]
    for (const avatarUrl of urls) {
      await expect(
        f.owner.mutation(api.driverProfiles.update, { profileId: f.driverId, avatarUrl })
      ).rejects.toThrow()
      await expect(
        f.owner.mutation(api.coachProfiles.update, { profileId: f.coachId, avatarUrl })
      ).rejects.toThrow()
    }
    expect((await f.t.run(({ db }) => db.get(f.driverId)))?.avatarUrl).toBeUndefined()
  })

  it("preserves same-record legacy media through unrelated and unchanged updates", async () => {
    const f = await setup()
    const legacyUrl = "https://old.example/existing.png"
    const legacyKey = "legacy/untracked-key"
    await f.t.run(async ({ db }) => {
      await db.patch(f.teamId, { logoUrl: legacyUrl, logoR2Key: legacyKey })
      await db.patch(f.coachId, { avatarUrl: legacyUrl, avatarR2Key: legacyKey })
      await db.patch(f.driverId, { avatarUrl: legacyUrl })
    })
    await f.owner.mutation(api.teams.update, { teamId: f.teamId, description: "Edited" })
    await f.owner.mutation(api.teams.update, {
      teamId: f.teamId,
      logoUrl: legacyUrl,
      logoR2Key: legacyKey,
    })
    await f.owner.mutation(api.coachProfiles.update, { profileId: f.coachId, bio: "Edited" })
    await f.owner.mutation(api.coachProfiles.update, {
      profileId: f.coachId,
      avatarUrl: legacyUrl,
      avatarR2Key: legacyKey,
    })
    await f.owner.mutation(api.driverProfiles.update, {
      profileId: f.driverId,
      bio: "Edited",
      avatarUrl: legacyUrl,
    })
    expect((await f.t.run(({ db }) => db.get(f.teamId)))?.logoUrl).toBe(legacyUrl)
    expect((await f.t.run(({ db }) => db.get(f.coachId)))?.avatarR2Key).toBe(legacyKey)
    expect((await f.t.run(({ db }) => db.get(f.driverId)))?.avatarUrl).toBe(legacyUrl)
    await expect(
      f.owner.mutation(api.teams.create, { ...teamArgs, logoUrl: legacyUrl, logoR2Key: legacyKey })
    ).rejects.toThrow()
    await expect(
      f.other.mutation(api.coachProfiles.create, { ...coachArgs, avatarUrl: legacyUrl })
    ).rejects.toThrow()
    await expect(
      f.other.mutation(api.driverProfiles.create, { ...driverArgs, avatarUrl: legacyUrl })
    ).rejects.toThrow()
  })

  it("allows owners to clear media without validating obsolete legacy uploads", async () => {
    const f = await setup()
    await f.t.run(async ({ db }) => {
      await db.patch(f.teamId, { logoUrl: "https://old.example/logo", logoR2Key: "old-key" })
      await db.patch(f.coachId, { avatarUrl: "https://old.example/avatar", avatarR2Key: "old-key" })
      await db.patch(f.driverId, { avatarUrl: "https://old.example/avatar" })
    })
    await f.owner.mutation(api.teams.update, { teamId: f.teamId, logoUrl: "", logoR2Key: "" })
    await f.owner.mutation(api.coachProfiles.update, {
      profileId: f.coachId,
      avatarUrl: "",
      avatarR2Key: "",
    })
    await f.owner.mutation(api.driverProfiles.update, { profileId: f.driverId, avatarUrl: "" })
    expect((await f.t.run(({ db }) => db.get(f.teamId)))?.logoR2Key || undefined).toBeUndefined()
    expect((await f.t.run(({ db }) => db.get(f.coachId)))?.avatarUrl || undefined).toBeUndefined()
    expect((await f.t.run(({ db }) => db.get(f.driverId)))?.avatarUrl || undefined).toBeUndefined()
  })

  it("preserves explicit external portfolio links without treating platform aliases as external", async () => {
    const f = await setup()
    for (const url of [
      "https://media.example/video.mp4?version=2",
      "http://media.example/image.png",
      "https://MEDIA.example/video.mp4#t=10",
    ]) {
      const id = await f.owner.mutation(api.driverMedia.add, {
        driverProfileId: f.driverId,
        type: "video",
        url,
      })
      expect((await f.t.run(({ db }) => db.get(id)))?.url).toBe(url)
    }
    const key = (await f.owner.mutation(api.r2.generateUploadUrl, {})).key
    for (const url of [
      `https://pub-other.r2.dev/${key}`,
      `https://bucket.account.r2.cloudflarestorage.com/${key}`,
      "https://example.convex.cloud/api/storage/private-id",
      "https://example.convex.site/api/storage/private-id",
      "https://www.renegaderace.com/_next/image?url=private-photo",
      "https://admin.renegaderace.com/_next/image?url=private-photo",
      "https://renegade-web-env-staging-nineonenine.vercel.app/_next/image?url=private-photo",
      "https://staging-renegade-admin.vercel.app/_next/image?url=private-photo",
      `${publicUrl(key)}?redirect=1`,
      `${publicUrl(key)}#media`,
      `https://user@images.renegaderace.com/${key}`,
      "data:image/png;base64,AAAA",
      "javascript:alert(1)",
    ]) {
      await expect(
        f.owner.mutation(api.driverMedia.add, { driverProfileId: f.driverId, type: "image", url })
      ).rejects.toThrow()
    }
    await expect(
      f.owner.mutation(api.driverMedia.add, {
        driverProfileId: f.driverId,
        type: "image",
        url: "https://media.example/external.png",
        r2Key: key,
      })
    ).rejects.toThrow()
  })

  it("binds platform URLs to the configured bucket origin", async () => {
    const f = await setup()
    const key = (await f.owner.mutation(api.r2.generateProfileImageUploadUrl, {})).key
    const stagingOrigin = "https://pub-synthetic-staging.r2.dev"
    vi.stubEnv("R2_PUBLIC_URL", stagingOrigin)
    try {
      await expect(
        f.owner.mutation(api.driverProfiles.update, {
          profileId: f.driverId,
          avatarUrl: publicUrl(key),
        })
      ).rejects.toThrow()
      const avatarUrl = `${stagingOrigin}/${key}`
      await f.owner.mutation(api.driverProfiles.update, { profileId: f.driverId, avatarUrl })
      expect((await f.t.run(({ db }) => db.get(f.driverId)))?.avatarUrl).toBe(avatarUrl)
    } finally {
      vi.stubEnv("R2_PUBLIC_URL", "https://images.renegaderace.com")
    }
  })

  it("does not let an owned upload authorize posting on another user's team", async () => {
    const f = await setup()
    const key = (await f.other.mutation(api.r2.generateUploadUrl, {})).key
    await expect(
      f.other.mutation(api.posts.createPost, {
        teamId: f.teamId,
        content: "Not my team",
        mediaR2Keys: [key],
      })
    ).rejects.toThrow("Not authorized")
    expect(await f.t.run(({ db }) => db.query("posts").collect())).toEqual([])
  })
})

describe("coaching review attachments", () => {
  it("rejects new unproven photos without creating review rows or scheduled callbacks", async () => {
    const f = await setup()
    const bookingId = await seedBooking(f)
    const ownKey = (await f.other.mutation(api.r2.generateUploadUrl, {})).key
    for (const photos of [
      [ownKey],
      ["images/reviews/synthetic-reservation/photo"],
      ["https://media.example/photo.png"],
    ]) {
      await expect(
        f.other.mutation(api.coachingReviews.submitReview, {
          bookingId,
          rating: 5,
          title: "Session",
          review: "Learned a lot",
          photos,
        })
      ).rejects.toThrow()
    }
    expect(await f.t.run(({ db }) => db.query("coachingReviews").collect())).toEqual([])
    expect(await f.t.run(({ db }) => db.system.query("_scheduled_functions").collect())).toEqual([])
  })

  it("accepts omitted and empty photos and completes rating and notification callbacks", async () => {
    vi.useFakeTimers()
    const f = await setup()
    for (const photos of [undefined, []]) {
      const bookingId = await seedBooking(f)
      await f.other.mutation(api.coachingReviews.submitReview, {
        bookingId,
        rating: 5,
        title: "Session",
        review: "Learned a lot",
        photos,
      })
      await f.t.finishAllScheduledFunctions(vi.runAllTimers)
    }
    const profile = await f.t.run(({ db }) => db.get(f.coachId))
    expect(profile?.rating).toBe(5)
    expect(profile?.reviewCount).toBe(2)
    const notifications = await f.t.run(({ db }) => db.query("notifications").collect())
    expect(
      notifications.filter((n) => n.type === "review_received" && n.userId === "owner")
    ).toHaveLength(2)
  })

  it("preserves existing review photo display and still requires the booking renter", async () => {
    const f = await setup()
    const bookingId = await seedBooking(f)
    const args = { bookingId, rating: 5, title: "Session", review: "Learned a lot", photos: [] }
    await expect(f.t.mutation(api.coachingReviews.submitReview, args)).rejects.toThrow()
    await expect(f.owner.mutation(api.coachingReviews.submitReview, args)).rejects.toThrow()
    const photos = ["legacy/photo"]
    await f.t.run(({ db }) =>
      db.insert("coachingReviews", {
        coachingBookingId: bookingId,
        coachProfileId: f.coachId,
        coachUserId: "owner",
        reviewerId: "other",
        rating: 5,
        title: "Historical",
        review: "Preserve existing display",
        photos,
        isPublic: true,
        isModerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    )
    const result = await f.t.query(api.coachingReviews.getByCoach, { coachProfileId: f.coachId })
    expect(result.reviews[0]?.photos).toEqual(photos)
  })
})
