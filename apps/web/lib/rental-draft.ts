import { formatDateToISO, isValidRentalDuration, parseLocalDate } from "@/lib/date-utils"

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const RENTAL_TIME = /^(0[6-9]|1\d|2[01]):(00|30)$/
const DRAFT_LIFETIME_MS = 24 * 60 * 60 * 1000
const MAX_DRAFT_BYTES = 16_384

export type RentalDraft = {
  version: 1
  vehicleId: string
  ownerId: string | null
  savedAt: number
  startDate: string | null
  duration: number | null
  pickupTime: string
  dropoffTime: string
  selectedAddOnNames: string[]
  renterMessage: string
}

export function rentalDraftKey(vehicleId: string): string {
  return `rental-request:v1:${vehicleId}`
}

export function isDateOnly(value: unknown): value is string {
  return typeof value === "string" && DATE_ONLY.test(value) && parseLocalDate(value) !== null
}

export function parseRentalDraft(
  raw: string | null,
  vehicleId: string,
  ownerId: string | null,
  now = Date.now()
): RentalDraft | null {
  if (!raw || raw.length > MAX_DRAFT_BYTES) return null
  try {
    const draft = JSON.parse(raw)
    if (
      !draft ||
      draft.version !== 1 ||
      draft.vehicleId !== vehicleId ||
      (draft.ownerId !== null && draft.ownerId !== ownerId) ||
      !Number.isFinite(draft.savedAt) ||
      draft.savedAt > now ||
      now - draft.savedAt > DRAFT_LIFETIME_MS ||
      (draft.startDate !== null &&
        (!isDateOnly(draft.startDate) || draft.startDate < formatDateToISO(new Date(now)))) ||
      (draft.duration !== null && !isValidRentalDuration(draft.duration)) ||
      typeof draft.pickupTime !== "string" ||
      (draft.pickupTime !== "" && !RENTAL_TIME.test(draft.pickupTime)) ||
      typeof draft.dropoffTime !== "string" ||
      (draft.dropoffTime !== "" && !RENTAL_TIME.test(draft.dropoffTime)) ||
      typeof draft.renterMessage !== "string" ||
      draft.renterMessage.length > 1000 ||
      !Array.isArray(draft.selectedAddOnNames) ||
      draft.selectedAddOnNames.length > 100 ||
      !draft.selectedAddOnNames.every(
        (name: unknown) => typeof name === "string" && name.length > 0 && name.length <= 200
      )
    )
      return null
    // Deliberately discard unknown fields, including any client-supplied prices.
    return {
      version: 1,
      vehicleId,
      ownerId: draft.ownerId,
      savedAt: draft.savedAt,
      startDate: draft.startDate,
      duration: draft.duration,
      pickupTime: draft.pickupTime,
      dropoffTime: draft.dropoffTime,
      selectedAddOnNames: [...new Set<string>(draft.selectedAddOnNames)],
      renterMessage: draft.renterMessage,
    }
  } catch {
    return null
  }
}

export function loadRentalDraft(vehicleId: string, ownerId: string | null): RentalDraft | null {
  try {
    const key = rentalDraftKey(vehicleId)
    const raw = sessionStorage.getItem(key)
    const draft = parseRentalDraft(raw, vehicleId, ownerId)
    if (raw && !draft) sessionStorage.removeItem(key)
    return draft
  } catch {
    return null
  }
}

export function saveRentalDraft(draft: RentalDraft): boolean {
  try {
    const raw = JSON.stringify(draft)
    if (!parseRentalDraft(raw, draft.vehicleId, draft.ownerId)) return false
    sessionStorage.setItem(rentalDraftKey(draft.vehicleId), raw)
    return true
  } catch {
    return false
  }
}

export function clearRentalDraft(vehicleId: string): void {
  try {
    sessionStorage.removeItem(rentalDraftKey(vehicleId))
  } catch {
    // A successful request must not fail because browser storage is unavailable.
  }
}
