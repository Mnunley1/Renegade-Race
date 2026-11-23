import { ConvexError } from "convex/values"
import { ErrorCode, type ErrorCodeType } from "./errors"
import { calculateReservationTotal } from "./pricing"

export const RENTAL_QUOTE_VERSION = 1 as const
export const RENTAL_QUOTE_RE_REQUEST =
  "This booking's quote cannot be verified. Please submit a new rental request for host approval."

type AddOn = {
  name: string
  price: number
  description?: string
  priceType?: "daily" | "one-time"
}
type Listing = { dailyRate: number; addOns?: Array<AddOn & { isRequired?: boolean }> }
type StoredQuote = {
  dailyRate: number
  totalDays: number
  totalAmount: number
  addOns?: AddOn[]
  quoteVersion?: typeof RENTAL_QUOTE_VERSION
}

// Quote recovery instructions must remain available after Convex redacts internal errors.
function quoteError(code: ErrorCodeType, message: string): never {
  throw new ConvexError({ code, message })
}

function assertCents(value: number, min: number, max: number, label: string) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    quoteError(
      ErrorCode.INVALID_AMOUNT,
      `${label} must be valid integer cents within allowed limits`
    )
  }
}

function validateTotal(dailyRate: number, totalDays: number, addOns: AddOn[]) {
  assertCents(dailyRate, 100, 5_000_000, "Daily rate")
  // New requests validate 1–3 days separately. Historical stored durations stay intact.
  if (!Number.isSafeInteger(totalDays) || totalDays < 1) {
    quoteError(ErrorCode.INVALID_AMOUNT, "Rental duration must be a positive whole number")
  }
  const names = new Set<string>()
  for (const addOn of addOns) {
    if (!addOn.name.trim() || names.has(addOn.name)) {
      quoteError(ErrorCode.INVALID_INPUT, "Add-on selections must have unique nonempty names")
    }
    names.add(addOn.name)
    assertCents(addOn.price, 0, 100_000, "Add-on price")
  }
  const totalAmount = calculateReservationTotal(dailyRate, totalDays, addOns)
  assertCents(totalAmount, 100, 1_000_000, "Rental subtotal")
  return totalAmount
}

/** Derive the quote from the listing; submitted monetary fields are stale-price assertions only. */
export function buildRentalQuote(listing: Listing, totalDays: number, selected: AddOn[] = []) {
  const available = new Map<string, NonNullable<Listing["addOns"]>[number]>()
  for (const addOn of listing.addOns ?? []) {
    if (!addOn.name.trim() || available.has(addOn.name)) {
      quoteError(ErrorCode.INVALID_INPUT, "The listing has ambiguous add-ons; contact the host")
    }
    available.set(addOn.name, addOn)
  }
  const names = new Set<string>()
  const addOns = selected.map((selection) => {
    if (names.has(selection.name)) {
      quoteError(ErrorCode.INVALID_INPUT, "An add-on cannot be selected more than once")
    }
    names.add(selection.name)
    const canonical = available.get(selection.name)
    if (!canonical) quoteError(ErrorCode.INVALID_INPUT, "A selected add-on is unavailable")
    const priceType = canonical.priceType ?? "one-time"
    if (selection.price !== canonical.price || (selection.priceType ?? "one-time") !== priceType) {
      quoteError(
        ErrorCode.PRICE_CHANGED,
        "Add-on pricing has changed. Review the listing before requesting."
      )
    }
    return {
      name: canonical.name,
      price: canonical.price,
      description: canonical.description,
      priceType,
    }
  })
  for (const addOn of available.values()) {
    if (addOn.isRequired && !names.has(addOn.name)) {
      quoteError(ErrorCode.INVALID_INPUT, "All required add-ons must be selected")
    }
  }
  return {
    dailyRate: listing.dailyRate,
    totalDays,
    addOns,
    totalAmount: validateTotal(listing.dailyRate, totalDays, addOns),
    quoteVersion: RENTAL_QUOTE_VERSION,
  }
}

/** Validated quotes are immutable; legacy quotes must exactly match current listing money/cadence. */
export function validateRentalQuote(reservation: StoredQuote, listing?: Listing | null) {
  try {
    let quote: StoredQuote & { quoteVersion: typeof RENTAL_QUOTE_VERSION; addOns: AddOn[] }
    if (reservation.quoteVersion === RENTAL_QUOTE_VERSION) {
      quote = {
        dailyRate: reservation.dailyRate,
        totalDays: reservation.totalDays,
        addOns: reservation.addOns ?? [],
        totalAmount: validateTotal(
          reservation.dailyRate,
          reservation.totalDays,
          reservation.addOns ?? []
        ),
        quoteVersion: RENTAL_QUOTE_VERSION,
      }
    } else {
      if (!listing || reservation.dailyRate !== listing.dailyRate) {
        throw new Error("Unverified listing rate")
      }
      quote = buildRentalQuote(listing, reservation.totalDays, reservation.addOns)
    }
    if (quote.totalAmount !== reservation.totalAmount) throw new Error("Unverified quote")
    return quote
  } catch {
    quoteError(ErrorCode.PRICE_CHANGED, RENTAL_QUOTE_RE_REQUEST)
  }
}
