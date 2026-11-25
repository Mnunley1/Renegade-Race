// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { describe, expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

vi.mock("./r2", () => ({ r2: {} }))
const modules = (
  import.meta as unknown as { glob: (p: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
const archivedStates = [{ isActive: false }, { deletedAt: 0 }, { isSuspended: true }]
async function fixture() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async ({ db }) => {
    await db.insert("users", {
      externalId: "current-owner",
      name: "Synthetic host",
      email: "private@example.test",
      stripeAccountId: "acct_test",
      stripeAccountStatus: "enabled",
    })
    const trackId = await db.insert("tracks", {
      name: "Synthetic",
      location: "Test",
      isActive: true,
    })
    const vehicleId = await db.insert("vehicles", {
      ownerId: "current-owner",
      trackId,
      make: "BMW",
      model: "M3",
      year: 2015,
      dailyRate: 1800,
      description: "Retained legacy description",
      damageDepositAmount: 12345,
      amenities: [],
      addOns: [],
      isActive: true,
      isApproved: true,
      createdAt: 1,
      updatedAt: 1,
    })
    const imageId = await db.insert("vehicleImages", {
      vehicleId,
      r2Key: "synthetic/photo",
      isPrimary: true,
      order: 0,
    })
    const reservationId = await db.insert("reservations", {
      vehicleId,
      renterId: "renter",
      ownerId: "historic-owner",
      startDate: "2031-01-01",
      endDate: "2031-01-01",
      totalDays: 1,
      dailyRate: 1800,
      totalAmount: 1800,
      status: "completed",
      createdAt: 1,
      updatedAt: 1,
    })
    return { vehicleId, imageId, reservationId }
  })
  return { t, ids }
}
describe("inactive vehicle detail visibility", () => {
  it.each(
    archivedStates
  )("hides archived details %j without changing participant history or images", async (patch) => {
    const { t, ids } = await fixture()
    await t.run(({ db }) => db.patch(ids.vehicleId, patch))
    const before = await t.run(async ({ db }) => ({
      vehicle: await db.get(ids.vehicleId),
      reservation: await db.get(ids.reservationId),
      image: await db.get(ids.imageId),
    }))
    for (const viewer of [t, t.withIdentity({ subject: "unrelated" })])
      expect(await viewer.query(api.vehicles.getById, { id: ids.vehicleId })).toBeNull()
    for (const subject of ["current-owner", "renter", "historic-owner"]) {
      const row = await t
        .withIdentity({ subject })
        .query(api.vehicles.getById, { id: ids.vehicleId })
      expect(row).toMatchObject({
        _id: ids.vehicleId,
        description: "Retained legacy description",
        images: [{ _id: ids.imageId }],
      })
      expect(row?.owner).not.toHaveProperty("email")
    }
    expect(
      (
        await t
          .withIdentity({ subject: "admin", publicMetadata: { role: "admin" } })
          .query(api.vehicles.getById, { id: ids.vehicleId })
      )?.owner
    ).toHaveProperty("email", "private@example.test")
    expect(
      await t.run(async ({ db }) => ({
        vehicle: await db.get(ids.vehicleId),
        reservation: await db.get(ids.reservationId),
        image: await db.get(ids.imageId),
      }))
    ).toEqual(before)
    expect(await t.query(api.vehicles.getAllWithOptimizedImages, {})).toEqual([])
    expect(await t.query(api.vehicles.searchWithAvailability, {})).toEqual([])
    expect(
      await t.query(api.vehicles.getByOwner, { ownerId: "current-owner", includeDeleted: true })
    ).toEqual([])
  })
  it.each([
    "pending",
    "approved",
    "confirmed",
    "cancelled",
    "completed",
    "declined",
  ] as const)("retains vehicle access for %s reservation history", async (status) => {
    const { t, ids } = await fixture()
    await t.run(async ({ db }) => {
      await db.patch(ids.vehicleId, { isActive: false })
      await db.patch(ids.reservationId, { status })
    })
    expect(
      await t.withIdentity({ subject: "renter" }).query(api.vehicles.getById, { id: ids.vehicleId })
    ).not.toBeNull()
  })
  it("does not expose archived copy through a participant's message-thread preview", async () => {
    const { t, ids } = await fixture()
    const conversationId = await t.run(async ({ db }) => {
      await db.patch(ids.vehicleId, { isActive: false })
      return db.insert("conversations", {
        vehicleId: ids.vehicleId,
        renterId: "unrelated",
        ownerId: "current-owner",
        lastMessageAt: 1,
        unreadCountRenter: 0,
        unreadCountOwner: 0,
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      })
    })
    const viewer = t.withIdentity({ subject: "unrelated" })
    expect(
      await viewer.query(api.conversations.getById, { conversationId, userId: "unrelated" })
    ).toMatchObject({
      _id: conversationId,
      vehicle: null,
      vehicleImageKey: null,
    })
    expect(
      (await viewer.query(api.conversations.getByUser, { userId: "unrelated", role: "renter" }))[0]
    ).toMatchObject({ _id: conversationId, vehicle: null, vehicleImageKey: null })
    expect(
      await viewer.query(api.conversations.getByVehicleAndParticipants, {
        vehicleId: ids.vehicleId,
        renterId: "unrelated",
        ownerId: "current-owner",
      })
    ).toMatchObject({ _id: conversationId, vehicle: null })
    expect(
      (
        await t
          .withIdentity({ subject: "current-owner" })
          .query(api.conversations.getById, { conversationId, userId: "current-owner" })
      )?.vehicle?._id
    ).toBe(ids.vehicleId)
  })
  it("keeps a conversation-only host's messages while redacting archived vehicle details", async () => {
    const { t, ids } = await fixture()
    await t.run(async ({ db }) => {
      await db.patch(ids.vehicleId, { isActive: false })
      await db.insert("conversations", {
        vehicleId: ids.vehicleId,
        renterId: "unrelated",
        ownerId: "conversation-only-host",
        lastMessageAt: 1,
        unreadCountRenter: 0,
        unreadCountOwner: 0,
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      })
    })
    const viewer = t.withIdentity({ subject: "conversation-only-host" })
    expect(
      (
        await viewer.query(api.messages.getHostConversations, { hostId: "conversation-only-host" })
      )[0]?.vehicle
    ).toBeNull()
  })
  it("keeps active listings public", async () => {
    const { t, ids } = await fixture()
    expect((await t.query(api.vehicles.getById, { id: ids.vehicleId }))?.description).toBe(
      "Retained legacy description"
    )
  })
  it("does not treat a review or old favorite as reservation ownership", async () => {
    const { t, ids } = await fixture()
    await t.run(async ({ db }) => {
      await db.patch(ids.vehicleId, { isActive: false })
      await db.insert("favorites", { userId: "unrelated", vehicleId: ids.vehicleId, createdAt: 1 })
      const completionId = await db.insert("rentalCompletions", {
        reservationId: ids.reservationId,
        vehicleId: ids.vehicleId,
        renterId: "renter",
        ownerId: "historic-owner",
        status: "completed",
        createdAt: 1,
        updatedAt: 1,
      })
      await db.insert("rentalReviews", {
        rentalCompletionId: completionId,
        reservationId: ids.reservationId,
        vehicleId: ids.vehicleId,
        reviewerId: "renter",
        reviewedId: "historic-owner",
        reviewType: "renter_to_owner",
        rating: 5,
        title: "Synthetic",
        review: "Public review",
        isPublic: true,
        isModerated: false,
        createdAt: 1,
        updatedAt: 1,
      })
    })
    for (const viewer of [t, t.withIdentity({ subject: "unrelated" })]) {
      const reviews = await viewer.query(api.reviews.getByUser, {
        userId: "renter",
        role: "reviewer",
      })
      expect(reviews).toHaveLength(1)
      expect(reviews[0]?.vehicle).toBeNull()
      expect(reviews[0]?.reservation).toBeNull()
      const pending = await viewer.query(api.reviews.getPendingResponses, {
        userId: "historic-owner",
      })
      expect(pending[0]?.vehicle).toBeNull()
      expect(pending[0]?.reservation).toBeNull()
      const vehicleReviews = await viewer.query(api.reviews.getByVehicle, {
        vehicleId: ids.vehicleId,
      })
      expect(vehicleReviews[0]?.reservation).toBeNull()
    }
    expect(
      (
        await t
          .withIdentity({ subject: "renter" })
          .query(api.reviews.getByUser, { userId: "renter", role: "reviewer" })
      )[0]?.vehicle?._id
    ).toBe(ids.vehicleId)
    expect(
      await t.withIdentity({ subject: "unrelated" }).query(api.favorites.getUserFavorites, {})
    ).toEqual([])
    expect(
      await t
        .withIdentity({ subject: "unrelated" })
        .query(api.vehicles.getById, { id: ids.vehicleId })
    ).toBeNull()
  })
})
