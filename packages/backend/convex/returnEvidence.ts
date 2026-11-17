import { R2 } from "@convex-dev/r2"
import { v } from "convex/values"
import { components, internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
  type ActionCtx,
  httpAction,
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server"
import { isReservationParticipant, participantCompletion } from "./helpers"

const issuedUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const legacySlot = /^legacy:(renter|owner):(0|[1-9][0-9]*)$/
const maxBytes = 10 * 1024 * 1024
const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
}
const unmapped = () => new Response(null, { status: 404, headers: responseHeaders })
const unauthorized = () => new Response(null, { status: 401, headers: responseHeaders })

async function imageType(blob: Blob) {
  if (!blob.size || blob.size > maxBytes) return null
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer())
  if ([0xff, 0xd8, 0xff].every((b, i) => bytes[i] === b)) return "image/jpeg"
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return "image/png"
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp"
  return null
}

async function participantReservation(ctx: QueryCtx, reservationId: string, subject: string) {
  const id = ctx.db.normalizeId("reservations", reservationId)
  const reservation = id ? await ctx.db.get(id) : null
  return isReservationParticipant(reservation, subject) ? reservation : null
}

export const canUpload = internalQuery({
  args: { reservationId: v.string(), subject: v.string() },
  handler: async (ctx, { reservationId, subject }) =>
    (await participantReservation(ctx, reservationId, subject))?._id ?? null,
})

export const registerUpload = internalMutation({
  args: { reservationId: v.id("reservations"), uploader: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    if (!isReservationParticipant(await ctx.db.get(args.reservationId), args.uploader)) return null
    return ctx.db.insert("returnEvidence", args)
  },
})

export const discardUnbound = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const bound = await ctx.db
      .query("returnEvidence")
      .withIndex("by_storage", (q) => q.eq("storageId", storageId))
      .first()
    if (!bound) await ctx.storage.delete(storageId)
  },
})

// A failed or ambiguous binding response may follow a committed mutation.
// Check the durable reference before disposing of the private copy.
async function storeAndBind<T>(
  ctx: ActionCtx,
  photo: Blob,
  bind: (id: Id<"_storage">) => Promise<T>
) {
  const storageId = await ctx.storage.store(photo)
  let result: T
  try {
    result = await bind(storageId)
  } catch (error) {
    await ctx.runMutation(internal.returnEvidence.discardUnbound, { storageId })
    throw error
  }
  if (!result) await ctx.runMutation(internal.returnEvidence.discardUnbound, { storageId })
  return result
}

export async function validateReturnPhotos(
  ctx: QueryCtx,
  reservationId: Id<"reservations">,
  uploader: string,
  photos: string[]
) {
  for (const key of photos) {
    const id = ctx.db.normalizeId("returnEvidence", key)
    const upload = id ? await ctx.db.get(id) : null
    if (upload?.reservationId !== reservationId || upload.uploader !== uploader) {
      throw new Error("Upload this return photo for this reservation")
    }
  }
}

type Source = { storageId: Id<"_storage"> } | { legacyKey: string }

// Earlier releases issued random keys with this exact booking + uploader namespace.
// Old form values alone are untrusted. Never fetch arbitrary URLs or keys.
async function legacyOwner(ctx: QueryCtx, completion: Doc<"rentalCompletions">, key: string) {
  const reservation = await ctx.db.get(completion.reservationId)
  if (!(reservation && participantCompletion(completion, reservation, completion.renterId)))
    return null
  for (const role of ["renter", "owner"] as const) {
    const subject = role === "renter" ? reservation.renterId : reservation.ownerId
    const form = role === "renter" ? completion.renterReturnForm : completion.ownerReturnReview
    if (!form?.photos.includes(key)) continue
    const uploaders = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", subject))
      .take(2)
    const uploader = uploaders[0]
    if (!uploader || uploaders.length !== 1) continue
    const prefix = `images/returns/${reservation._id}/${uploader._id}-`
    if (
      key.length === prefix.length + 36 &&
      key.startsWith(prefix) &&
      issuedUuid.test(key.slice(prefix.length))
    ) {
      return { subject, role }
    }
  }
  return null
}

type Role = "owner" | "renter"

// A participant's UI needs an image reference, never a historical public R2 key.
export async function visibleReturnPhotos(
  ctx: QueryCtx,
  completion: Doc<"rentalCompletions">
): Promise<Doc<"rentalCompletions">> {
  async function visible(role: Role, photos: string[], uploader: string) {
    const result: string[] = []
    for (const [index, key] of photos.entries()) {
      const id = ctx.db.normalizeId("returnEvidence", key)
      if (id) {
        const photo = await ctx.db.get(id)
        if (photo?.reservationId === completion.reservationId && photo.uploader === uploader)
          result.push(id)
      } else if ((await legacyOwner(ctx, completion, key))?.role === role) {
        result.push(`legacy:${role}:${index}`)
      }
    }
    return result
  }
  const renter = completion.renterReturnForm
  const owner = completion.ownerReturnReview
  return {
    ...completion,
    ...(renter && {
      renterReturnForm: {
        ...renter,
        photos: await visible("renter", renter.photos, completion.renterId),
      },
    }),
    ...(owner && {
      ownerReturnReview: {
        ...owner,
        photos: await visible("owner", owner.photos, completion.ownerId),
      },
    }),
  }
}

export const readSource = internalQuery({
  args: { reservationId: v.string(), subject: v.string(), key: v.string() },
  handler: async (ctx, { reservationId, subject, key }): Promise<Source | null> => {
    const reservation = await participantReservation(ctx, reservationId, subject)
    if (!reservation) return null
    const id = ctx.db.normalizeId("returnEvidence", key)
    const upload = id ? await ctx.db.get(id) : null
    if (
      upload &&
      (upload.reservationId !== reservation._id ||
        !isReservationParticipant(reservation, upload.uploader))
    )
      return null
    const completion = await ctx.db
      .query("rentalCompletions")
      .withIndex("by_reservation", (q) => q.eq("reservationId", reservation._id))
      .unique()
    if (completion && !participantCompletion(completion, reservation, subject)) return null
    if (upload?.uploader === subject) return { storageId: upload.storageId }
    if (!completion) return null
    if (upload) {
      const form =
        upload.uploader === reservation.renterId
          ? completion.renterReturnForm
          : completion.ownerReturnReview
      return form?.photos.includes(key) ? { storageId: upload.storageId } : null
    }
    const slot = legacySlot.exec(key)
    if (!slot) return null
    const form = slot[1] === "renter" ? completion.renterReturnForm : completion.ownerReturnReview
    const legacyKey = form?.photos[Number(slot[2])]
    if (!legacyKey || (await legacyOwner(ctx, completion, legacyKey))?.role !== slot[1]) return null
    return { legacyKey }
  },
})

async function loadLegacyPhoto(key: string) {
  const r2 = new R2(components.r2)
  const response = await fetch(await r2.getUrl(key), { redirect: "error" })
  if (response.status === 404) return null
  if (!response.ok) throw new Error("Failed to read return photo from storage")
  if (Number(response.headers.get("Content-Length")) > maxBytes) return null
  return response.blob()
}

export const returnPhotoOptions = httpAction(
  async () => new Response(null, { status: 204, headers: responseHeaders })
)

export const uploadReturnPhoto = httpAction(async (ctx, req) => {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return unauthorized()
  const reservationId = await ctx.runQuery(internal.returnEvidence.canUpload, {
    reservationId: new URL(req.url).searchParams.get("reservationId") ?? "",
    subject: identity.subject,
  })
  if (!reservationId) return unmapped()
  if (Number(req.headers.get("Content-Length")) > maxBytes)
    return new Response(null, { status: 413, headers: responseHeaders })
  const photo = await req.blob()
  if (photo.size > maxBytes) return new Response(null, { status: 413, headers: responseHeaders })
  const type = await imageType(photo)
  if (!type) return new Response(null, { status: 415, headers: responseHeaders })
  const key = await storeAndBind(ctx, photo.slice(0, photo.size, type), (storageId) =>
    ctx.runMutation(internal.returnEvidence.registerUpload, {
      reservationId,
      uploader: identity.subject,
      storageId,
    })
  )
  if (!key) return unmapped()
  return Response.json({ key }, { status: 201, headers: responseHeaders })
})

export const readReturnPhoto = httpAction(async (ctx, req) => {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return unauthorized()
  const params = new URL(req.url).searchParams
  const source = await ctx.runQuery(internal.returnEvidence.readSource, {
    reservationId: params.get("reservationId") ?? "",
    key: params.get("key") ?? "",
    subject: identity.subject,
  })
  if (!source) return unmapped()
  const blob =
    "storageId" in source
      ? await ctx.storage.get(source.storageId)
      : await loadLegacyPhoto(source.legacyKey)
  const type = blob && (await imageType(blob))
  if (!type) return unmapped()
  return new Response(blob, { headers: { ...responseHeaders, "Content-Type": type } })
})

// Operator-only. Copy a historically issued, attached photo first; switch its
// reference and schedule deletion of that exact old R2 object in one transaction.
type InventoryEntry = {
  completionId: Id<"rentalCompletions">
  form: "renter" | "owner"
  index: number
} & ({ status: "verified"; key: string } | { status: "manual" })

export const inventoryLegacy = internalQuery({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const { page, isDone, continueCursor } = await ctx.db
      .query("rentalCompletions")
      .paginate({ numItems: 10, cursor: cursor ?? null })
    const entries: InventoryEntry[] = []
    for (const completion of page) {
      for (const role of ["renter", "owner"] as const) {
        const form = role === "renter" ? completion.renterReturnForm : completion.ownerReturnReview
        for (const [index, key] of (form?.photos ?? []).entries()) {
          const id = ctx.db.normalizeId("returnEvidence", key)
          const uploaded = id && (await ctx.db.get(id))
          const uploader = role === "renter" ? completion.renterId : completion.ownerId
          if (
            uploaded &&
            uploaded.reservationId === completion.reservationId &&
            uploaded.uploader === uploader
          )
            continue
          const location = { completionId: completion._id, form: role, index }
          const verified = (await legacyOwner(ctx, completion, key))?.role === role
          entries.push(
            verified ? { ...location, status: "verified", key } : { ...location, status: "manual" }
          )
        }
      }
    }
    return { entries, isDone, continueCursor }
  },
})

export const inspectLegacy = internalQuery({
  args: { completionId: v.id("rentalCompletions"), key: v.string() },
  handler: async (ctx, { completionId, key }) => {
    const completion = await ctx.db.get(completionId)
    return completion && (await legacyOwner(ctx, completion, key))
  },
})

export const adoptLegacy = internalMutation({
  args: { completionId: v.id("rentalCompletions"), key: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, { completionId, key, storageId }) => {
    const completion = await ctx.db.get(completionId)
    if (!completion) return false
    const owner = await legacyOwner(ctx, completion, key)
    if (!owner) return false
    const privateId = await ctx.db.insert("returnEvidence", {
      reservationId: completion.reservationId,
      uploader: owner.subject,
      storageId,
    })
    const field = owner.role === "owner" ? "ownerReturnReview" : "renterReturnForm"
    const form = completion[field]!
    await ctx.db.patch(completion._id, {
      [field]: { ...form, photos: form.photos.map((k) => (k === key ? privateId : k)) },
    })
    const r2 = new R2(components.r2)
    await r2.deleteObject(ctx, key)
    return true
  },
})

export const migrateLegacyPhoto = internalAction({
  args: { completionId: v.id("rentalCompletions"), key: v.string() },
  handler: async (ctx, args): Promise<"migrated" | "unverified" | "unavailable"> => {
    if (!(await ctx.runQuery(internal.returnEvidence.inspectLegacy, args))) return "unverified"
    const blob = await loadLegacyPhoto(args.key)
    const type = blob && (await imageType(blob))
    if (!(blob && type)) return "unavailable"
    const adopted = await storeAndBind(ctx, blob.slice(0, blob.size, type), (storageId) =>
      ctx.runMutation(internal.returnEvidence.adoptLegacy, { ...args, storageId })
    )
    return adopted ? "migrated" : "unverified"
  },
})
