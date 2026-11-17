// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { describe, expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

vi.mock("./r2", () => ({ r2: {} }))

const modules = (
  import.meta as unknown as { glob: (p: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
const renterForm = {
  returnDate: "2030-01-02",
  vehicleCondition: "good" as const,
  fuelLevel: "full" as const,
  mileage: 135,
  notes: "Private renter note",
  photos: ["renter-evidence"],
  submittedAt: 1,
}
const ownerReview = {
  vehicleReceived: true,
  conditionMatches: true,
  fuelLevelMatches: true,
  mileageMatches: true,
  notes: "Private owner note",
  photos: ["owner-evidence"],
  submittedAt: 2,
}

async function setup() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async ({ db, storage }) => {
    const trackId = await db.insert("tracks", { name: "Test", location: "Test", isActive: true })
    const vehicleId = await db.insert("vehicles", {
      ownerId: "owner",
      trackId,
      make: "Test",
      model: "Test",
      year: 2020,
      dailyRate: 1000,
      description: "Test",
      amenities: [],
      addOns: [],
      isActive: true,
      isApproved: true,
      createdAt: 1,
      updatedAt: 1,
    })
    const reservation = {
      ownerId: "owner",
      renterId: "renter",
      vehicleId,
      status: "confirmed" as const,
      paymentStatus: "paid" as const,
      startDate: "2030-01-01",
      endDate: "2030-01-02",
      totalDays: 1,
      dailyRate: 1000,
      totalAmount: 1000,
      createdAt: 1,
      updatedAt: 1,
    }
    const reservationId = await db.insert("reservations", reservation)
    const nextReservationId = await db.insert("reservations", reservation)
    const foreignReservationId = await db.insert("reservations", {
      ...reservation,
      ownerId: "third-party-owner",
      renterId: "third-party-renter",
    })
    const storageId = await storage.store(new Blob(["return evidence"]))
    const renterPhoto = await db.insert("returnEvidence", {
      reservationId,
      uploader: "renter",
      storageId,
    })
    const ownerPhoto = await db.insert("returnEvidence", {
      reservationId,
      uploader: "owner",
      storageId,
    })
    const foreignPhoto = await db.insert("returnEvidence", {
      reservationId: foreignReservationId,
      uploader: "third-party-renter",
      storageId,
    })
    const renterId = await db.insert("users", { externalId: "renter", name: "Renter" })
    const legacyPhoto = `images/returns/${reservationId}/${renterId}-554dbfbb-6fc4-434e-aeae-a2394c244784`
    const foreignKey = legacyPhoto.replace(reservationId, foreignReservationId)
    const common = {
      reservationId,
      vehicleId,
      ownerId: "owner",
      renterId: "renter",
      createdAt: 1,
      updatedAt: 1,
    }
    const completionId = await db.insert("rentalCompletions", {
      ...common,
      status: "pending_owner",
      renterReturnForm: {
        ...renterForm,
        photos: [renterPhoto, legacyPhoto, foreignKey, foreignPhoto, ownerPhoto],
      },
      ownerReturnReview: { ...ownerReview, photos: [ownerPhoto, renterPhoto] },
    })
    const disputeId = await db.insert("disputes", {
      ...common,
      completionId,
      createdBy: "renter",
      reason: "test",
      description: "Test dispute",
      photos: [],
      status: "open",
    })
    return {
      completionId,
      reservationId,
      nextReservationId,
      foreignReservationId,
      disputeId,
      renterPhoto,
      ownerPhoto,
    }
  })
  return { t, ids }
}

describe("participant-only return evidence", () => {
  it.each([
    "renter",
    "owner",
    "unrelated",
    "anonymous",
    "admin",
  ] as const)("enforces single, list, pending and dispute access for %s", async (role) => {
    const { t, ids } = await setup()
    const caller =
      role === "anonymous"
        ? t
        : t.withIdentity({
            subject: role,
            ...(role === "admin" && { publicMetadata: { role: "admin" } }),
          })
    const participant = role === "renter" || role === "owner"
    const expected = {
      renterReturnForm: { ...renterForm, photos: [ids.renterPhoto, "legacy:renter:1"] },
      ownerReturnReview: { ...ownerReview, photos: [ids.ownerPhoto] },
    }
    const direct = await Promise.all([
      caller.query(api.rentalCompletions.getById, { id: ids.completionId }),
      caller.query(api.rentalCompletions.getByReservation, { reservationId: ids.reservationId }),
    ])
    for (const row of direct) {
      if (participant) expect(row).toMatchObject(expected)
      else expect(row).toBeNull()
    }
    const target = role === "owner" ? "owner" : "renter"
    const list = await caller.query(api.rentalCompletions.getByUser, {
      role: target,
      userId: target,
    })
    const disputes = await caller.query(api.disputes.getByUser, { userId: target })
    const pending = await caller.query(api.rentalCompletions.getPendingCompletions, {
      userId: "owner",
    })
    if (participant) {
      expect(list).toMatchObject([expected])
      expect(disputes).toMatchObject([{ completion: expected }])
    } else {
      expect(list).toEqual([])
      expect(disputes).toEqual([])
    }
    if (role === "owner") expect(pending).toMatchObject([expected])
    else expect(pending).toEqual([])
    const other = role === "owner" ? "renter" : "owner"
    expect(
      await caller.query(api.rentalCompletions.getByUser, { userId: other, role: other })
    ).toEqual([])
    const disputeIdRead = await caller.query(api.disputes.getById, { id: ids.disputeId })
    const disputeReservationRead = await caller.query(api.disputes.getByReservation, {
      reservationId: ids.reservationId,
    })
    if (participant) {
      expect(disputeIdRead?.completion).toMatchObject(expected)
      expect(disputeReservationRead?.completion).toMatchObject(expected)
    } else if (role === "admin") {
      expect(disputeIdRead).toMatchObject({ _id: ids.disputeId, completion: null })
      expect(disputeReservationRead).toBeNull()
      expect(await caller.query(api.admin.getAllDisputes, {})).toMatchObject([
        { _id: ids.disputeId, completion: null },
      ])
    } else {
      expect(disputeIdRead).toBeNull()
      expect(disputeReservationRead).toBeNull()
    }
  })

  it("requires the actual reservation to agree with denormalized parties and joined completion IDs", async () => {
    const { t, ids } = await setup()
    const owner = t.withIdentity({ subject: "owner" })
    await t.run(({ db }) => db.patch(ids.completionId, { reservationId: ids.foreignReservationId }))
    expect(await owner.query(api.rentalCompletions.getById, { id: ids.completionId })).toBeNull()
    expect(
      await owner.query(api.rentalCompletions.getByUser, { userId: "owner", role: "owner" })
    ).toEqual([])
    expect(
      await owner.query(api.rentalCompletions.getPendingCompletions, { userId: "owner" })
    ).toEqual([])
    expect((await owner.query(api.disputes.getById, { id: ids.disputeId }))?.completion).toBeNull()
    await expect(
      owner.mutation(api.rentalCompletions.submitOwnerReturnReview, {
        completionId: ids.completionId,
        vehicleReceived: true,
        conditionMatches: true,
        fuelLevelMatches: true,
        mileageMatches: true,
        photos: [],
      })
    ).rejects.toThrow("Not authorized")
  })

  it("allows the actual renter and owner to submit their own sections", async () => {
    const { t, ids } = await setup()
    const owner = t.withIdentity({ subject: "owner" })
    const renter = t.withIdentity({ subject: "renter" })
    const outsider = t.withIdentity({ subject: "unrelated" })
    const reservation = { reservationId: ids.nextReservationId }
    for (const denied of [t, outsider])
      await expect(denied.mutation(api.rentalCompletions.create, reservation)).rejects.toThrow()
    const completionId = await renter.mutation(api.rentalCompletions.create, reservation)
    const renterInput = {
      completionId,
      vehicleCondition: "good" as const,
      fuelLevel: "full" as const,
      returnDate: "2030-02-03",
      mileage: 12,
      photos: [],
      notes: "check tires",
    }
    for (const denied of [t, outsider, owner])
      await expect(
        denied.mutation(api.rentalCompletions.submitRenterReturnForm, renterInput)
      ).rejects.toThrow()
    await renter.mutation(api.rentalCompletions.submitRenterReturnForm, renterInput)
    const ownerInput = {
      completionId,
      vehicleReceived: true,
      conditionMatches: true,
      mileageMatches: true,
      fuelLevelMatches: true,
      notes: "checked",
      photos: [],
    }
    for (const denied of [t, outsider, renter])
      await expect(
        denied.mutation(api.rentalCompletions.submitOwnerReturnReview, ownerInput)
      ).rejects.toThrow()
    await owner.mutation(api.rentalCompletions.submitOwnerReturnReview, ownerInput)
    for (const permitted of [renter, owner])
      expect(
        await permitted.query(api.rentalCompletions.getById, { id: completionId })
      ).toMatchObject({
        renterReturnForm: { notes: "check tires" },
        ownerReturnReview: { notes: "checked" },
      })
  })
})
